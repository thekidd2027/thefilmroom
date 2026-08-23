"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

export default function RouteStage({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <div key={pathname} className="route-stage page-shell">
      <div className="route-glow route-glow-a" />
      <div className="route-glow route-glow-b" />
      <div className="route-content">{children}</div>
    </div>
  );
}
