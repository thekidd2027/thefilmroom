"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const LINKS = [
  { href: "/today", label: "Today" },
  { href: "/review", label: "Review" },
  { href: "/archive", label: "Archive" },
  { href: "/editors", label: "Editors" },
  { href: "/brand-brain", label: "Brand Brain" },
  { href: "/setup", label: "Setup" },
];

export default function Nav() {
  const pathname = usePathname();

  return (
    <nav className="w-60 shrink-0 border-r border-rule bg-white/78 backdrop-blur-xl flex flex-col sticky top-0 h-screen shadow-[10px_0_30px_rgba(37,121,155,0.04)]">
      <div className="px-6 py-7 flex items-center gap-3">
        <span className="animated-dot w-3 h-3 rounded-full bg-jelly" />
        <div>
          <span className="font-display text-xl tracking-wide text-ink block leading-none">FILM ROOM</span>
          <span className="font-mono text-[9px] tracking-[0.2em] text-dim">EDITORIAL DESK</span>
        </div>
      </div>

      <div className="flex-1 px-3 pt-2">
        {LINKS.map((link, index) => {
          const active = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              style={{ animationDelay: `${index * 45}ms` }}
              className={clsx(
                "group relative block px-4 py-3 mb-1.5 rounded-xl text-sm font-medium overflow-hidden animate-[pageReveal_420ms_ease_both]",
                active
                  ? "bg-sidecar text-ink shadow-[0_7px_18px_rgba(37,121,155,0.07)]"
                  : "text-dim hover:text-ink hover:bg-sinbad/15"
              )}
            >
              <span className={clsx(
                "absolute left-0 top-1/2 -translate-y-1/2 h-0 w-1 rounded-r-full bg-jelly transition-all duration-300",
                active ? "h-7" : "group-hover:h-4"
              )} />
              <span className="relative transition-transform duration-300 group-hover:translate-x-1 inline-block">{link.label}</span>
            </Link>
          );
        })}
      </div>

      <div className="px-6 py-6 border-t border-rule/70">
        <div className="label-eyebrow leading-5">Daily Dose of<br />College Sports</div>
        <div className="mt-3 flex gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-jelly" />
          <span className="h-1.5 w-6 rounded-full bg-sinbad" />
          <span className="h-1.5 w-6 rounded-full bg-sidecar border border-rule" />
          <span className="h-1.5 w-6 rounded-full bg-milan" />
        </div>
      </div>
    </nav>
  );
}
