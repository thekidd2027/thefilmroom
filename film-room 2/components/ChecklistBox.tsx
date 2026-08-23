"use client";

import { useState } from "react";
import clsx from "clsx";
import { ChecklistItem } from "@/lib/types";

export default function ChecklistBox({ reelId, items }: { reelId: string; items: ChecklistItem[] }) {
  const [checklist, setChecklist] = useState(items);

  async function toggle(key: string) {
    setChecklist((prev) => prev.map((i) => (i.key === key ? { ...i, done: !i.done } : i)));
    await fetch(`/api/reels/${reelId}/checklist`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key }),
    });
  }

  const done = checklist.filter((i) => i.done).length;

  return (
    <div>
      <div className="text-dim text-xs font-mono mb-2">{done} / {checklist.length} complete</div>
      <ul className="space-y-1.5">
        {checklist.map((item) => (
          <li key={item.key}>
            <button
              onClick={() => toggle(item.key)}
              className="flex items-start gap-2 text-left w-full group"
            >
              <span
                className={clsx(
                  "mt-0.5 w-4 h-4 shrink-0 rounded-sm border flex items-center justify-center text-[10px]",
                  item.done ? "bg-go/80 border-go text-ink" : "border-dim group-hover:border-paper"
                )}
              >
                {item.done && "✓"}
              </span>
              <span className={clsx("text-sm", item.done && "line-through text-dim")}>{item.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
