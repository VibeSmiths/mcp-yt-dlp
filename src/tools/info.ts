// src/tools/info.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const YTDLP = "yt-dlp";

export function registerInfoTools(server: McpServer): void {

  server.registerTool(
    "ytdlp_info",
    {
      title: "Get Video / Playlist Info",
      description: `Fetch metadata for a video or playlist URL using yt-dlp.
Supports YouTube, Vimeo, Twitter/X, TikTok, and 1000+ other sites.

Args:
  - url (string): Video or playlist URL
  - playlist (boolean, optional): Fetch all entries in a playlist (default: false — single video only)

Returns: Title, uploader, duration, view/like counts, upload date, description snippet,
thumbnail URL, available subtitle languages, and format count.`,
      inputSchema: z.object({
        url: z.string().url().describe("Video or playlist URL"),
        playlist: z.boolean().optional().default(false).describe("Fetch full playlist entries (default: false)")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ url, playlist }) => {
      const args = ["--dump-json", "--no-warnings"];
      if (!playlist) args.push("--no-playlist");
      args.push(url);

      try {
        const { stdout } = await execFileAsync(YTDLP, args, {
          timeout: 30_000,
          maxBuffer: 10 * 1024 * 1024
        });

        const lines = stdout.trim().split("\n").filter(Boolean);
        const results = lines.map(line => {
          const d = JSON.parse(line);
          return {
            id: d.id,
            title: d.title,
            uploader: d.uploader,
            channel: d.channel,
            duration_seconds: d.duration,
            duration_string: d.duration_string,
            view_count: d.view_count,
            like_count: d.like_count,
            upload_date: d.upload_date,
            description: (d.description ?? "").slice(0, 600),
            thumbnail: d.thumbnail,
            webpage_url: d.webpage_url,
            tags: (d.tags ?? []).slice(0, 20),
            categories: d.categories,
            format_count: (d.formats ?? []).length,
            subtitle_langs: Object.keys(d.subtitles ?? {}),
            auto_caption_langs: Object.keys(d.automatic_captions ?? {}),
          };
        });

        const payload = results.length === 1 ? results[0] : results;
        return { content: [{ type: "text", text: JSON.stringify(payload, null, 2) }] };
      } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string };
        return {
          content: [{ type: "text", text: `Error: ${e.stderr ?? e.message}` }],
          isError: true
        };
      }
    }
  );

  server.registerTool(
    "ytdlp_formats",
    {
      title: "List Available Formats",
      description: `List every downloadable format for a video URL.

Args:
  - url (string): Video URL

Returns: Array of format objects with format_id, extension, resolution, codecs, bitrate, and estimated file size.
Use the format_id values with ytdlp_download's custom_format option.`,
      inputSchema: z.object({
        url: z.string().url().describe("Video URL")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ url }) => {
      try {
        const { stdout } = await execFileAsync(
          YTDLP,
          ["--dump-json", "--no-playlist", "--no-warnings", url],
          { timeout: 30_000, maxBuffer: 10 * 1024 * 1024 }
        );

        const d = JSON.parse(stdout.trim());
        const formats = (d.formats ?? []).map((f: Record<string, unknown>) => ({
          format_id: f.format_id,
          ext: f.ext,
          resolution: f.resolution ?? `${f.width ?? "?"}x${f.height ?? "?"}`,
          fps: f.fps,
          vcodec: f.vcodec === "none" ? null : f.vcodec,
          acodec: f.acodec === "none" ? null : f.acodec,
          tbr_kbps: f.tbr,
          filesize_bytes: f.filesize ?? f.filesize_approx ?? null,
          format_note: f.format_note,
        }));

        return {
          content: [{
            type: "text",
            text: JSON.stringify({ title: d.title, format_count: formats.length, formats }, null, 2)
          }]
        };
      } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string };
        return {
          content: [{ type: "text", text: `Error: ${e.stderr ?? e.message}` }],
          isError: true
        };
      }
    }
  );
}
