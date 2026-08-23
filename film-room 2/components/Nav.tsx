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
    <nav className="w-56 shrink-0 border-r border-rule bg-bay flex flex-col">
      <div className="px-5 py-6 flex items-center gap-2">
        <span className="w-2.5 h-2.5 rounded-full bg-tally shadow-[0_0_8px_2px_rgba(226,163,59,0.5)]" />
        <span className="font-display text-lg tracking-wide">FILM ROOM</span>
      </div>
      <div className="flex-1 px-2">
        {LINKS.map((link) => {
          const active = pathname?.startsWith(link.href);
          return (
            <Link
              key={link.href}
              href={link.href}
              className={clsx(
                "block px-3 py-2 mb-1 rounded-sm text-sm font-medium",
                active ? "bg-bay2 text-paper" : "text-dim hover:text-paper hover:bg-bay2/60"
              )}
            >
              {link.label}
            </Link>
          );
        })}
      </div>
      <div className="px-5 py-4 label-eyebrow">Daily Dose of College Sports</div>
    </nav>
  );
}
