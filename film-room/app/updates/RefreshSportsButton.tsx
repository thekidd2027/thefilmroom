"use client";

import { useState } from "react";

export default function RefreshSportsButton() {
  const [loading, setLoading] = useState(false);

  function refresh() {
    setLoading(true);
    window.location.reload();
  }

  return (
    <button
      type="button"
      onClick={refresh}
      disabled={loading}
      className="group rounded-full border border-rule bg-white/85 px-4 py-2 font-mono text-[10px] tracking-[0.14em] text-ink transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_10px_26px_rgba(37,121,155,.10)] disabled:opacity-60"
    >
      <span className={loading ? "inline-block animate-spin mr-2" : "inline-block mr-2 transition-transform duration-500 group-hover:rotate-180"}>↻</span>
      {loading ? "REFRESHING" : "REFRESH LIVE DESK"}
    </button>
  );
}
