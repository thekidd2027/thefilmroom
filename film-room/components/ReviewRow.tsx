"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Reel } from "@/lib/types";
import { StatusPill } from "./Badges";

export default function ReviewRow({ reel }: { reel: Reel }) {
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [publishedUrl, setPublishedUrl] = useState("");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function loadVideo() {
    const res = await fetch(`/api/reels/${reel.id}/video-url`);
    const data = await res.json();
    if (data.url) setVideoUrl(data.url);
  }

  async function requestChanges() {
    setBusy(true);
    await fetch(`/api/reels/${reel.id}/request-changes`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ note }),
    });
    setBusy(false);
    router.refresh();
  }

  async function publish() {
    setBusy(true);
    await fetch(`/api/reels/${reel.id}/publish`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ publishedUrl }),
    });
    setBusy(false);
    router.refresh();
  }

  return (
    <div className="panel p-4">
      <div className="flex items-center justify-between">
        <div>
          <Link href={`/reel/${reel.id}`} className="font-medium hover:text-tally">
            {reel.headline}
          </Link>
          <div className="mt-1"><StatusPill status={reel.status} /></div>
        </div>
        <button onClick={loadVideo} className="btn-ghost">
          {videoUrl ? "Reload video" : "Load video"}
        </button>
      </div>

      {videoUrl && (
        <video src={videoUrl} controls className="w-full max-w-xs mt-3 rounded-sm" />
      )}

      <div className="mt-4 grid grid-cols-2 gap-3">
        <div>
          <div className="label-eyebrow mb-1">Request changes</div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="What needs to change?"
            className="w-full bg-bay2 border border-rule rounded-sm px-2 py-1.5 text-sm mb-2"
            rows={2}
          />
          <button onClick={requestChanges} disabled={busy} className="btn-signal w-full">
            Send back
          </button>
        </div>
        <div>
          <div className="label-eyebrow mb-1">Approve &amp; publish</div>
          <input
            value={publishedUrl}
            onChange={(e) => setPublishedUrl(e.target.value)}
            placeholder="Live post URL (optional)"
            className="w-full bg-bay2 border border-rule rounded-sm px-2 py-1.5 text-sm mb-2"
          />
          <button onClick={publish} disabled={busy} className="btn-go w-full">
            Mark published
          </button>
        </div>
      </div>
    </div>
  );
}
