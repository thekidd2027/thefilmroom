import clsx from "clsx";
import { ReelStatus } from "@/lib/types";

export function ScoreBadge({ score }: { score: number }) {
  const tone = score >= 9 ? "text-tally" : score >= 7.5 ? "text-go" : "text-dim";
  return (
    <span className={clsx("font-mono text-sm font-medium", tone)}>
      {score.toFixed(1)}<span className="text-dim">/10</span>
    </span>
  );
}

const STATUS_LABEL: Record<ReelStatus, string> = {
  proposed: "Awaiting approval",
  approved: "Approved · unassigned",
  claimed: "In progress",
  submitted: "Awaiting review",
  changes_requested: "Changes requested",
  published: "Published",
  rejected: "Rejected",
};

const STATUS_TONE: Record<ReelStatus, string> = {
  proposed: "bg-tally/15 text-tally border-tally/30",
  approved: "bg-wire/15 text-wire border-wire/30",
  claimed: "bg-wire/15 text-wire border-wire/30",
  submitted: "bg-tally/15 text-tally border-tally/30",
  changes_requested: "bg-signal/15 text-signal border-signal/30",
  published: "bg-go/15 text-go border-go/30",
  rejected: "bg-signal/15 text-signal border-signal/30",
};

export function StatusPill({ status }: { status: ReelStatus }) {
  return (
    <span className={clsx("px-2 py-0.5 rounded-full text-xs font-medium border", STATUS_TONE[status])}>
      {STATUS_LABEL[status]}
    </span>
  );
}
