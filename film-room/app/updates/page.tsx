import { getSportsUpdateContext } from "@/lib/sportsUpdates";\nimport RefreshSportsButton from "./RefreshSportsButton";

export const dynamic = "force-dynamic";

function when(value: string) {
  if (!value) return "";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function SportChip({ sport }: { sport: "football" | "basketball" }) {
  return <span className="rounded-full bg-sinbad/35 px-3 py-1 font-mono text-[10px] tracking-[0.16em] uppercase text-ink">{sport}</span>;
}

export default async function UpdatesPage() {
  const data = await getSportsUpdateContext();

  return (
    <div className="p-8 max-w-6xl space-y-8">
      <div className="flex items-end justify-between gap-6">
        <div>
          <div className="label-eyebrow mb-1">FILM ROOM / LIVE DESK</div>
          <h1 className="font-display text-4xl tracking-wide">SPORTS UPDATE</h1>
          <p className="text-dim mt-2 max-w-2xl">A fast scan of men&apos;s college football and basketball for anything that should become a Film Room reel.</p>
        </div>
        <div className="rounded-full border border-rule bg-white/70 px-4 py-2 font-mono text-[10px] tracking-[0.14em] text-dim">
          UPDATED {when(data.generatedAt) || "JUST NOW"}
        </div>
      </div>

      <section className="panel rounded-[2rem] p-6">
        <div className="flex items-center justify-between mb-5">
          <div>
            <div className="label-eyebrow">REEL RADAR</div>
            <h2 className="font-display text-2xl mt-1">WHAT NEEDS ATTENTION</h2>
          </div>
          <div className="h-3 w-3 rounded-full bg-milan animate-pulse" />
        </div>
        {data.reelAlerts.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {data.reelAlerts.map((a) => (
              <a key={a.id} href={a.sourceUrl || "#"} target={a.sourceUrl ? "_blank" : undefined} rel="noreferrer"
                className="group rounded-[1.6rem] border border-rule bg-white/65 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_18px_40px_rgba(37,121,155,.10)]">
                <div className="flex items-center gap-2 mb-3">
                  <span className={`rounded-full px-3 py-1 font-mono text-[10px] tracking-[.16em] ${a.urgency === "NOW" ? "bg-milan/15 text-milan" : "bg-sidecar text-ink"}`}>{a.urgency}</span>
                  <SportChip sport={a.sport} />
                </div>
                <h3 className="font-display text-xl leading-tight">{a.title}</h3>
                <p className="text-sm text-dim mt-2 leading-6">{a.reason}</p>
              </a>
            ))}
          </div>
        ) : (
          <div className="rounded-[1.6rem] border border-dashed border-rule p-8 text-center text-dim">No urgent reel-worthy news or game alerts right now.</div>
        )}
      </section>

      <section>
        <div className="label-eyebrow mb-3">RECENT GAMES</div>
        <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
          {data.scores.length ? data.scores.map((g) => (
            <a key={g.id} href={g.url || "#"} target={g.url ? "_blank" : undefined} rel="noreferrer"
              className="rounded-[1.7rem] border border-rule bg-white/70 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(37,121,155,.08)]">
              <div className="flex items-center justify-between gap-3 mb-4">
                <SportChip sport={g.sport} />
                <span className="font-mono text-[10px] tracking-[.12em] text-dim">{g.status}</span>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-4"><span className="font-medium">{g.awayTeam}</span><span className="font-display text-2xl">{g.awayScore || "—"}</span></div>
                <div className="flex items-center justify-between gap-4"><span className="font-medium">{g.homeTeam}</span><span className="font-display text-2xl">{g.homeScore || "—"}</span></div>
              </div>
              {g.leaders.length > 0 && <div className="mt-4 pt-4 border-t border-rule/70 text-xs text-dim leading-5">{g.leaders.slice(0,2).join(" · ")}</div>}
            </a>
          )) : (
            <div className="panel rounded-[1.7rem] p-7 text-dim">No recent college football or men&apos;s basketball games found.</div>
          )}
        </div>
      </section>

      <section>
        <div className="label-eyebrow mb-3">LATEST NEWS</div>
        {data.news.length ? (
          <div className="grid md:grid-cols-2 gap-4">
            {data.news.map((n) => (
              <a key={n.id} href={n.url || "#"} target={n.url ? "_blank" : undefined} rel="noreferrer"
                className="rounded-[1.7rem] border border-rule bg-white/70 p-5 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_16px_36px_rgba(37,121,155,.08)]">
                <div className="flex items-center justify-between gap-4">
                  <SportChip sport={n.sport} />
                  <span className="font-mono text-[10px] tracking-[.1em] text-dim">{when(n.published)}</span>
                </div>
                <h3 className="font-display text-xl leading-tight mt-4">{n.headline}</h3>
                {n.description && <p className="text-sm text-dim leading-6 mt-2">{n.description}</p>}
              </a>
            ))}
          </div>
        ) : (
          <div className="panel rounded-[1.7rem] p-8 text-center text-dim">No major college football or men&apos;s basketball news right now.</div>
        )}
      </section>

      <div className="rounded-[1.7rem] bg-sidecar/55 border border-rule p-5 text-sm text-dim leading-6">
        <span className="font-medium text-ink">Editorial rule:</span> Sports Update is a discovery desk, not a footage source. A hot play can trigger a Daily Reel idea immediately, but the build stage still has to locate legitimate broadcast/source footage that matches the exact topic.
      </div>
    </div>
  );
}
