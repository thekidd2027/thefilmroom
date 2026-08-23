"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Editor } from "@/lib/types";

export default function AssignPicker({
  reelId,
  editors,
  currentEditorId,
}: {
  reelId: string;
  editors: Editor[];
  currentEditorId: string | null;
}) {
  const [selected, setSelected] = useState(currentEditorId ?? "");
  const [busy, setBusy] = useState(false);
  const router = useRouter();

  async function assign() {
    if (!selected) return;
    setBusy(true);
    await fetch(`/api/reels/${reelId}/assign`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ editorId: selected }),
    });
    setBusy(false);
    router.refresh();
  }

  if (editors.length === 0) {
    return (
      <div className="text-sm text-dim">
        No editors yet — add one from the <a href="/editors" className="text-wire hover:underline">Editors</a> page.
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <select
        value={selected}
        onChange={(e) => setSelected(e.target.value)}
        className="bg-bay2 border border-rule rounded-sm px-3 py-1.5 text-sm"
      >
        <option value="">Unassigned</option>
        {editors.map((e) => (
          <option key={e.id} value={e.id}>
            {e.display_name}
          </option>
        ))}
      </select>
      <button onClick={assign} disabled={busy || !selected} className="btn-ghost disabled:opacity-50">
        {currentEditorId ? "Reassign" : "Assign"}
      </button>
    </div>
  );
}
