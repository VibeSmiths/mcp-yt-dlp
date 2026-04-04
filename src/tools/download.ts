// src/tools/download.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { FORMAT_PRESETS } from "../data/presets.js";

const execFileAsync = promisify(execFile);
const YTDLP = "yt-dlp";
const DOWNLOAD_DIR = process.env.DOWNLOAD_DIR ?? "/downloads";

export function registerDownloadTools(server: McpServer): void {

  server.registerTool(
    "ytdlp_download",
    {
      title: "Download Video or Audio",
      description: `Download a video or audio file from a URL using yt-dlp.
Files are saved to /downloads inside the container. Mount a host volume to access them:
  docker run --rm -i -v ./downloads:/downloads yt-dlp-mcp:latest

Args:
  - url (string): Video URL to download
  - preset (string, optional): Quality preset — "best", "1080p", "720p", "480p", "audio_mp3", "audio_m4a" (default: "best")
  - filename (string, optional): Custom output filename without extension (default: video title)
  - subtitles (boolean, optional): Also download English subtitles (default: false)

Returns: Path of the downloaded file inside the container.`,
      inputSchema: z.object({
        url: z.string().url().describe("Video URL"),
        preset: z.enum(["best", "1080p", "720p", "480p", "audio_mp3", "audio_m4a"])
          .default("best")
          .describe("Quality/format preset (default: best)"),
        filename: z.string().optional().describe("Custom filename without extension"),
        subtitles: z.boolean().default(false).describe("Download English subtitles alongside video (default: false)")
      }),
      annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ url, preset, filename, subtitles }) => {
      const isAudio = preset.startsWith("audio_");
      const outputTemplate = filename
        ? `${DOWNLOAD_DIR}/${filename}.%(ext)s`
        : `${DOWNLOAD_DIR}/%(title)s.%(ext)s`;

      const args: string[] = [
        "-f", FORMAT_PRESETS[preset],
        "-o", outputTemplate,
        "--no-warnings",
        "--no-playlist",
        "--print", "after_move:filepath",
      ];

      if (isAudio) {
        const fmt = preset === "audio_mp3" ? "mp3" : "m4a";
        args.push("--extract-audio", "--audio-format", fmt, "--audio-quality", "0");
      } else {
        args.push("--merge-output-format", "mp4");
      }

      if (subtitles) {
        args.push("--write-subs", "--write-auto-subs", "--sub-lang", "en");
      }

      args.push(url);

      try {
        const { stdout } = await execFileAsync(YTDLP, args, {
          timeout: 600_000,       // 10 min for large files
          maxBuffer: 50 * 1024 * 1024
        });

        return {
          content: [{
            type: "text",
            text: `Download complete.\nFile: ${stdout.trim()}`
          }]
        };
      } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string };
        return {
          content: [{ type: "text", text: `Download failed: ${e.stderr ?? e.message}` }],
          isError: true
        };
      }
    }
  );
}
