// The provider set comes from GET /api/providers; this file only defines the nine media routes.
export const mediaGroups = [
  { id: "embedding", title: "Embeddings", endpoint: "/v1/embeddings" },
  { id: "image", title: "Image generation", endpoint: "/v1/images/generations" },
  { id: "imageToText", title: "Image understanding", endpoint: "/v1/chat/completions" },
  { id: "tts", title: "Text to speech", endpoint: "/v1/audio/speech" },
  { id: "stt", title: "Speech to text", endpoint: "/v1/audio/transcriptions" },
  { id: "webSearch", title: "Web search", endpoint: "/v1/search" },
  { id: "webFetch", title: "Web fetch", endpoint: "/v1/web/fetch" },
  { id: "video", title: "Video", endpoint: "/v1/videos/generations" },
  { id: "music", title: "Music", endpoint: null },
] as const;
