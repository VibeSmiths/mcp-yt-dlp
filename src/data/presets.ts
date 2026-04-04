// Format selection strings for yt-dlp's -f flag.
// These prefer mp4 containers with avc1/mp4a codecs for broad compatibility.
export const FORMAT_PRESETS: Record<string, string> = {
  best:      "bestvideo[ext=mp4]+bestaudio[ext=m4a]/best[ext=mp4]/best",
  "1080p":   "bestvideo[height<=1080][ext=mp4]+bestaudio[ext=m4a]/best[height<=1080][ext=mp4]/best[height<=1080]",
  "720p":    "bestvideo[height<=720][ext=mp4]+bestaudio[ext=m4a]/best[height<=720][ext=mp4]/best[height<=720]",
  "480p":    "bestvideo[height<=480][ext=mp4]+bestaudio[ext=m4a]/best[height<=480][ext=mp4]/best[height<=480]",
  audio_mp3: "bestaudio/best",
  audio_m4a: "bestaudio[ext=m4a]/bestaudio/best",
};
