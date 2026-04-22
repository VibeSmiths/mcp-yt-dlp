# mcp-yt-dlp

MCP server for YouTube video info, formats, subtitles, and download via yt-dlp.

Part of the [CRAFT](https://github.com/Mossworks-Labs/craft) content studio.

## Tools

| Tool | Description |
|------|-------------|
| `video_info` | Retrieve video metadata (title, duration, views, etc.) |
| `subtitles` | Extract subtitles/captions from videos |
| `download` | Download video or audio to `/downloads` directory |

## Usage

### Stdio (Claude Code / local)

```json
{
  "mcpServers": {
    "yt-dlp": {
      "command": "node",
      "args": ["dist/index.js"]
    }
  }
}
```

### HTTP (Docker / Kubernetes)

```bash
docker build -t mcp-yt-dlp .
docker run -p 8080:8080 -e MCP_TRANSPORT=http -v ./downloads:/downloads mcp-yt-dlp
```

## Development

```bash
npm install
npm run build
node dist/index.js
```

Requires Node.js 22+ and `yt-dlp` CLI (`pip install yt-dlp`).
