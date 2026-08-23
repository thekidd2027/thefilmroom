export type TranscriptChunk = {
  text: string;
  offset: number;
  duration: number;
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

function normalizeTranscript(data: any): TranscriptChunk[] {
  if (!Array.isArray(data?.content)) return [];
  return data.content
    .map((c: any) => ({
      text: String(c.text ?? ""),
      offset: Number(c.offset ?? c.start ?? 0),
      duration: Number(c.duration ?? 0),
      lang: c.lang ?? data.lang,
    }))
    .filter((c: TranscriptChunk) => c.text.trim().length > 0);
}

function youtubeId(url: string) {
  try {
    const u = new URL(url);
    if (u.hostname.includes("youtu.be")) return u.pathname.replace(/^\//, "");
    return u.searchParams.get("v") ?? "";
  } catch {
    return "";
  }
}

export async function getTranscript(url: string): Promise<TranscriptChunk[]> {
  const attempts: Array<() => Promise<any>> = [
    () => supadataFetch(`/transcript?${new URLSearchParams({ url, lang: "en", text: "false", mode: "auto" }).toString()}`),
    () => supadataFetch(`/transcript?${new URLSearchParams({ url, text: "false", mode: "auto" }).toString()}`),
  ];

  const id = youtubeId(url);
  if (id) {
    attempts.push(() => supadataFetch(`/youtube/transcript?${new URLSearchParams({ videoId: id, lang: "en" }).toString()}`));
  }

  let lastError: unknown = null;
  for (const attempt of attempts) {
    try {
      let data = await attempt();
      if (data?.jobId && !data?.content) data = await pollJob(`/transcript/${data.jobId}`, 55_000);
      const normalized = normalizeTranscript(data);
      if (normalized.length) return normalized;
    } catch (error) {
      lastError = error;
    }
  }
  if (lastError) console.warn("All Supadata transcript strategies failed", lastError);
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
          required: ["timestamp", "description"],
        },
      },
    },
    required: ["moments"],
  };

  const prompt = "Identify 8-16 useful sports-editing moments with exact source timestamps. Prioritize recognizable plays, setup/stakes, crowd reaction, replay angles, celebrations, atmosphere, entrances, player closeups, and shots that crop well vertically. Return only moments you can actually locate; never invent timestamps.";

  const run = async (withSchema: boolean) => {
    let job = await supadataFetch(`/extract`, {
      method: "POST",
      body: JSON.stringify(withSchema ? { url, prompt, schema } : { url, prompt }),
    });
    if (job?.data || job?.moments) return job;
    if (!job?.jobId) return null;
    return pollJob(`/extract/${job.jobId}`, 70_000);
  };

  let result: any = null;
  try {
    result = await run(true);
  } catch (error) {
    console.warn("Supadata structured extract failed; retrying simple extract", error);
    try { result = await run(false); } catch (fallbackError) { console.warn("Supadata simple extract failed", fallbackError); }
  }

  const moments = result?.data?.moments ?? result?.moments ?? result?.data;
  if (!Array.isArray(moments)) return [];
  return moments
    .filter((m: any) => m?.timestamp && m?.description)
    .map((m: any) => ({
      timestamp: String(m.timestamp),
      endTimestamp: m.endTimestamp ? String(m.endTimestamp) : undefined,
      description: String(m.description),
      cameraAngle: m.cameraAngle ? String(m.cameraAngle) : "source footage",
      subjects: Array.isArray(m.subjects) ? m.subjects.map(String) : [],
      quality: Number(m.quality ?? 7),
      verticalCrop: Number(m.verticalCrop ?? 7),
      emotion: m.emotion ? String(m.emotion) : undefined,
    }));
}

async function pollJob(path: string, timeoutMs: number) {
  const started = Date.now();
  while (Date.now() - started < timeoutMs) {
    const data = await supadataFetch(path);
    if (data.status === "completed" || data.data || data.content) return data;
    if (data.status === "failed") throw new Error(data.error || data.message || "Supadata job failed");
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
