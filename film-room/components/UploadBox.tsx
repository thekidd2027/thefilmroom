"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

export default function UploadBox({ reelId, existingPath }: { reelId: string; existingPath: string | null }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const router = useRouter();

  async function handleFile(file: File) {
    setBusy(true);
    setError(null);
    setFileName(file.name);
    try {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch(`/api/reels/${reelId}/upload`, { method: "POST", body: form });
      const data = await res.json();
      if (!res.ok || data.error) throw new Error(data.error ?? "Upload failed");
      router.refresh();
    } catch (e: any) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      {existingPath && (
        <div className="text-sm text-go mb-3">A finished file is already on this reel: {existingPath.split("/").pop()}</div>
      )}
      <div
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const file = e.dataTransfer.files?.[0];
          if (file) handleFile(file);
        }}
        onClick={() => inputRef.current?.click()}
        className="border border-dashed border-rule rounded-sm p-8 text-center cursor-pointer hover:border-dim transition-colors"
      >
        <input
          ref={inputRef}
          type="file"
          accept="video/mp4,video/quicktime"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleFile(file);
          }}
        />
        {busy ? (
          <span className="text-dim text-sm">Uploading {fileName}…</span>
        ) : (
          <span className="text-dim text-sm">
            Drop the finished MP4 here, or click to browse.
          </span>
        )}
      </div>
      {error && <div className="text-signal text-sm mt-2">{error}</div>}
    </div>
  );
}
