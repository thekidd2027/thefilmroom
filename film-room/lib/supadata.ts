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
  const attempts = [
    new URLSearchParams({ url, lang: "en", text: "false", mode: "auto" }),
    new URLSearchParams({ url, lang: "en", text: "false" }),
    new URLSearchParams({ url, text: "false" }),
  ];

  let lastError: unknown = null;
  for (const params of attempts) {
    try {
      let data = await supadataFetch(`/transcript?${params.toString()}`);
      if (data.jobId) data = await pollJob(`/transcript/${data.jobId}`, 75_000);
      const content = Array.isArray(data.content) ? data.content : Array.isArray(data?.data?.content) ? data.data.content : [];
      if (content.length) {
        return content.map((c: any) => ({
          text: String(c.text ?? ""),
          offset: Number(c.offset ?? c.start ?? 0),
          duration: Number(c.duration ?? 0),
          lang: c.lang,
        }));
      }
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) throw lastError;
  return [];
}

export async function inspectVideo(url: string): Promise<VideoVisualMoment[]> {
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

  const request = async (structured: boolean) => {
    const body: Record<string, unknown> = {
      url,
      prompt: "Identify useful sports-editing moments with real timestamps. Prioritize recognizable plays, setup/stakes, crowd reaction, replay angles, celebrations, atmosphere, and shots that crop well vertically. Never invent timestamps.",
    };
    if (structured) body.schema = schema;
    const job = await supadataFetch(`/extract`, { method: "POST", body: JSON.stringify(body) });
    if (!job.jobId) return [];
    const result = await pollJob(`/extract/${job.jobId}`, 95_000);
    const moments = result?.data?.moments ?? result?.moments;
    return Array.isArray(moments) ? moments as VideoVisualMoment[] : [];
  };

  try {
    const structured = await request(true);
    if (structured.length) return structured;
  } catch (error) {
    console.warn("Structured Supadata extract failed; retrying simplified extract.", error);
  }
  return request(false).catch(() => []);
}

export function parseManualTranscript(input: string): TranscriptChunk[] {
  const lines = String(input ?? "").split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  const parsed: { seconds:number; text:string }[] = [];
  const timestamp = /^(?:\[)?(?:(\d{1,2}):)?(\d{1,2}):(\d{2})(?:\])?\s*[-–—:]?\s*(.+)$/;

  for (const line of lines) {
    const match = line.match(timestamp);
    if (!match) continue;
    const hours = Number(match[1] ?? 0);
    const minutes = Number(match[2] ?? 0);
    const seconds = Number(match[3] ?? 0);
    const text = String(match[4] ?? "").trim();
    if (!text) continue;
    parsed.push({ seconds: hours * 3600 + minutes * 60 + seconds, text });
  }

  return parsed.map((item, index) => {
    const next = parsed[index + 1];
    const durationSeconds = next ? Math.max(1, next.seconds - item.seconds) : 4;
    return {
      text: item.text,
      offset: item.seconds * 1000,
      duration: durationSeconds * 1000,
      lang: "en",
    };
  });
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
