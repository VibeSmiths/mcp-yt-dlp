// src/index.ts — yt-dlp MCP Server

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import express from "express";

import { registerInfoTools } from "./tools/info.js";
import { registerSubtitleTools } from "./tools/subtitles.js";
import { registerDownloadTools } from "./tools/download.js";

const server = new McpServer({
  name: "yt-dlp",
  version: "1.0.0"
});

registerInfoTools(server);
registerSubtitleTools(server);
registerDownloadTools(server);

// ─── Transport: stdio ─────────────────────────────────────────────────────────
async function runStdio(): Promise<void> {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("yt-dlp MCP Server running on stdio");
}

// ─── Transport: HTTP ──────────────────────────────────────────────────────────
async function runHTTP(): Promise<void> {
  const app = express();
  app.use(express.json());

  app.post("/mcp", async (req, res) => {
    const transport = new StreamableHTTPServerTransport({
      sessionIdGenerator: undefined,
      enableJsonResponse: true
    });
    res.on("close", () => transport.close());
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  });

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", server: "yt-dlp", version: "1.0.0" });
  });

  const port = parseInt(process.env.PORT ?? "3000");
  app.listen(port, () => {
    console.error(`yt-dlp MCP Server running on http://localhost:${port}/mcp`);
  });
}

const transport = process.env.TRANSPORT ?? "stdio";
if (transport === "http") {
  runHTTP().catch(error => { console.error("Server error:", error); process.exit(1); });
} else {
  runStdio().catch(error => { console.error("Server error:", error); process.exit(1); });
}
