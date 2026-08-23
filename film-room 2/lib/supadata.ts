export type TranscriptChunk = {
  text: string;
  offset: number; // milliseconds
  duration: number; // milliseconds
  lang?: string;
};

export type VideoVisualMoment = {
  timestamp: string;
  endTimestamp?: string;
  description: string;
  cameraAngle?: string;
  subjects?: string[];
  quality?: number;
  verticalCrop?: number;
  emotion?: string;
};

const BASE = "https://api.supadata.ai/v1";

function apiKey() {
  const key = process.env.SUPADATA_API_KEY;
  if (!key) throw new Error("Missing SUPADATA_API_KEY env var.");
  return key;
}

async function supadataFetch(path: string, init?: RequestInit) {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      "x-api-key": apiKey(),
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
    cache: "no-store",
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body?.message || body?.error || `Supadata request failed (${res.status})`);
  return body;
}

export async function getTranscript(url: string): Promise<TranscriptChunk[]> {
  const params = new URLSearchParams({ url, lang: "en", text: "false", mode: "auto" });
  let data = await supadataFetch(`/transcript?${params.toString()}`);
  if (data.jobId) {
    data = await pollJob(`/transcript/${data.jobId}`, 75_000);
  }
  if (!Array.isArray(data.content)) return [];
  return data.content.map((c: any) => ({
    text: String(c.text ?? ""),
    offset: Number(c.offset ?? 0),
    duration: Number(c.duration ?? 0),
    lang: c.lang,
  }));
}

export async function inspectVideo(url: string): Promise<VideoVisualMoment[]> {
  // Supadata Extract analyzes what is seen and heard in the source video.
  // Keep this for shorter source videos; very long compilations may exceed provider limits.
  const schema = {
    type: "object",
    properties: {
      moments: {
        type: "array",
        items: {
          type: "object",
          properties: {
            timestamp: { type: "string", description: "HH:MM:SS or MM:SS start timestamp" },
            endTimestamp: { type: "string", description: "Approximate end timestamp" },
            description: { type: "string", description: "What is visually happening" },
            cameraAngle: { type: "string", description: "broadcast wide, tight replay, sideline, crowd, endzone, etc." },
            subjects: { type: "array", items: { type: "string" } },
            quality: { type: "number", description: "1-10 visual clarity and usefulness" },
            verticalCrop: { type: "number", description: "1-10 suitability for a 9:16 crop with manual keyframes" },
            emotion: { type: "string", description: "crowd eruption, tension, celebration, heartbreak, etc." },
          },
          required: ["timestamp", "description", "cameraAngle", "quality", "verticalCrop"],
        },
      },
    },
    required: ["moments"],
  };

  const job = await supadataFetch(`/extract`, {
    method: "POST",
    body: JSON.stringify({
      url,
      prompt:
        "Identify the most useful sports-editing moments and camera angles. Prioritize recognizable plays, setup/stakes, crowd reaction, replay angles, celebrations, atmosphere, and shots that crop well vertically. Do not invent timestamps.",
      schema,
    }),
  });
  if (!job.jobId) return [];
  const result = await pollJob(`/extract/${job.jobId}`, 95_000);
  return (result?.data?.moments ?? result?.moments ?? []) as VideoVisualMoment[];
}

async function pollJob(path: string, timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = await supadataFetch(path);
    if (data.status === "completed" || data.data || data.content) return data;
    if (data.status === "failed") throw new Error(data.error || "Supadata job failed");
    await new Promise((r) => setTimeout(r, 1200));
  }
  throw new Error("Supadata job timed out.");
}

export function transcriptToText(chunks: TranscriptChunk[], maxChars = 24_000) {
  const lines = chunks.map((c) => `${formatTimestamp(Math.floor(c.offset / 1000))} ${c.text}`);
  const joined = lines.join("\n");
  return joined.length <= maxChars ? joined : `${joined.slice(0, maxChars)}\n[truncated]`;
}

export function formatTimestamp(totalSeconds: number) {
  totalSeconds = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(totalSeconds / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return h > 0
    ? `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`
    : `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

export function parseTimestamp(ts: string) {
  const parts = ts.split(":").map(Number).filter((n) => Number.isFinite(n));
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return parts[0] ?? 0;
}
