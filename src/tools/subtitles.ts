// src/tools/subtitles.ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { execFile } from "child_process";
import { promisify } from "util";
import { readFile, rm, mkdir, readdir } from "fs/promises";
import { join } from "path";
import { tmpdir } from "os";
import { randomUUID } from "crypto";

const execFileAsync = promisify(execFile);
const YTDLP = "yt-dlp";

function cleanVtt(raw: string): string {
  return raw
    .split("\n")
    .filter(line => {
      if (/^WEBVTT|^Kind:|^Language:/.test(line)) return false;
      if (/^\d{1,2}:\d{2}.*-->/.test(line)) return false;
      if (/^\d+$/.test(line.trim())) return false;
      if (line.trim() === "") return false;
      return true;
    })
    .map(line => line.replace(/<[^>]+>/g, "").trim())
    .filter(Boolean)
    .filter((line, i, arr) => line !== arr[i - 1])  // deduplicate consecutive repeats
    .join("\n");
}

export function registerSubtitleTools(server: McpServer): void {

  server.registerTool(
    "ytdlp_subtitles",
    {
      title: "Extract Subtitles / Transcript",
      description: `Download and return subtitle/caption text from a video URL.
Falls back to auto-generated captions when manual subtitles are unavailable (if auto_generated is true).
If no subtitles exist for the requested language, lists all available subtitle languages instead.

Args:
  - url (string): Video URL
  - lang (string, optional): BCP-47 language code, e.g. "en", "es", "fr" (default: "en")
  - auto_generated (boolean, optional): Try auto-generated captions if no manual subs (default: true)

Returns: Plain text transcript, or a list of available subtitle languages if none found.`,
      inputSchema: z.object({
        url: z.string().url().describe("Video URL"),
        lang: z.string().default("en").describe("Subtitle language code (default: en)"),
        auto_generated: z.boolean().default(true).describe("Include auto-generated captions (default: true)")
      }),
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false }
    },
    async ({ url, lang, auto_generated }) => {
      const tmpDir = join(tmpdir(), `ytdlp-${randomUUID()}`);
      await mkdir(tmpDir, { recursive: true });

      try {
        const args: string[] = [];
        if (auto_generated) args.push("--write-auto-subs");
        args.push(
          "--write-subs",
          "--sub-lang", lang,
          "--sub-format", "vtt",
          "--skip-download",
          "--no-warnings",
          "--no-playlist",
          "-o", join(tmpDir, "%(id)s.%(ext)s"),
          url
        );

        await execFileAsync(YTDLP, args, { timeout: 60_000 });

        const files = await readdir(tmpDir);
        const subFile = files.find(f => f.endsWith(".vtt") || f.endsWith(".srt"));

        if (!subFile) {
          // List available languages as fallback
          const { stdout } = await execFileAsync(
            YTDLP,
            ["--list-subs", "--no-warnings", "--no-playlist", url],
            { timeout: 30_000 }
          );
          return {
            content: [{
              type: "text",
              text: `No subtitles found for language "${lang}".\n\nAvailable subtitles:\n${stdout}`
            }]
          };
        }

        const raw = await readFile(join(tmpDir, subFile), "utf-8");
        return { content: [{ type: "text", text: cleanVtt(raw) }] };

      } catch (err: unknown) {
        const e = err as { stderr?: string; message?: string };
        return {
          content: [{ type: "text", text: `Error: ${e.stderr ?? e.message}` }],
          isError: true
        };
      } finally {
        await rm(tmpDir, { recursive: true, force: true });
      }
    }
  );
}
