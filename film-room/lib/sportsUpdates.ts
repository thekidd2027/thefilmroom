export type SportsNewsItem = {
  id: string;
  sport: "football" | "basketball";
  headline: string;
  description: string;
  published: string;
  url: string;
  image?: string;
};

export type SportsScore = {
  id: string;
  sport: "football" | "basketball";
  status: string;
  date: string;
  awayTeam: string;
  awayScore: string;
  homeTeam: string;
  homeScore: string;
  headline: string;
  url?: string;
  leaders: string[];
};

export type ReelAlert = {
  id: string;
  sport: "football" | "basketball";
  title: string;
  reason: string;
  urgency: "NOW" | "HIGH" | "WATCH";
  sourceUrl?: string;
};

export type SportsUpdateContext = {
  generatedAt: string;
  news: SportsNewsItem[];
  scores: SportsScore[];
  reelAlerts: ReelAlert[];
};

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const UA = { "user-agent": "FilmRoom/1.0 editorial dashboard" };

async function getJson(url: string) {
  const res = await fetch(url, { headers: UA, next: { revalidate: 180 } });
  if (!res.ok) throw new Error(`Sports feed failed (${res.status})`);
  return res.json();
}

function articleLink(item: any) {
  return item?.links?.web?.href || item?.links?.api?.news?.href || item?.link || "";
}

function parseNews(data: any, sport: "football" | "basketball"): SportsNewsItem[] {
  const rows = data?.articles ?? data?.feed ?? [];
  return rows.slice(0, 12).map((a: any, i: number) => ({
    id: String(a?.id ?? `${sport}-news-${i}`),
    sport,
    headline: String(a?.headline ?? a?.title ?? "").trim(),
    description: String(a?.description ?? a?.story ?? "").replace(/<[^>]+>/g, "").trim(),
    published: String(a?.published ?? a?.lastModified ?? a?.date ?? ""),
    url: articleLink(a),
    image: a?.images?.[0]?.url,
  })).filter((x: SportsNewsItem) => x.headline);
}

function parseScores(data: any, sport: "football" | "basketball"): SportsScore[] {
  return (data?.events ?? []).map((event: any, i: number) => {
    const comp = event?.competitions?.[0] ?? {};
    const competitors = comp?.competitors ?? [];
    const home = competitors.find((x: any) => x?.homeAway === "home") ?? competitors[0] ?? {};
    const away = competitors.find((x: any) => x?.homeAway === "away") ?? competitors[1] ?? {};
    const leaders = (comp?.leaders ?? []).flatMap((group: any) =>
      (group?.leaders ?? []).slice(0, 2).map((l: any) => {
        const name = l?.athlete?.displayName ?? "";
        const display = l?.displayValue ?? l?.value ?? "";
        return [name, display].filter(Boolean).join(" — ");
      })
    ).filter(Boolean).slice(0, 4);
    return {
      id: String(event?.id ?? `${sport}-score-${i}`),
      sport,
      status: String(event?.status?.type?.shortDetail ?? event?.status?.type?.description ?? ""),
      date: String(event?.date ?? ""),
      awayTeam: String(away?.team?.displayName ?? away?.team?.shortDisplayName ?? "Away"),
      awayScore: String(away?.score ?? ""),
      homeTeam: String(home?.team?.displayName ?? home?.team?.shortDisplayName ?? "Home"),
      homeScore: String(home?.score ?? ""),
      headline: String(event?.name ?? ""),
      url: event?.links?.[0]?.href,
      leaders,
    } satisfies SportsScore;
  });
}

function buildReelAlerts(news: SportsNewsItem[], scores: SportsScore[]): ReelAlert[] {
  const out: ReelAlert[] = [];
  const hot = /(walk[- ]?off|buzzer|game[- ]?winner|upset|stun|overtime|record|touchdown|interception|pick[- ]?six|one-handed|poster|dunk|career-high|yards|points|comeback|hail mary|viral|highlight)/i;

  for (const n of news) {
    if (!hot.test(`${n.headline} ${n.description}`)) continue;
    out.push({
      id: `news-${n.id}`,
      sport: n.sport,
      title: n.headline,
      reason: "Current coverage contains a potentially reel-worthy play, performance or game storyline.",
      urgency: /today|tonight|just|stun|walk|buzzer|game-winner|upset/i.test(`${n.headline} ${n.description}`) ? "NOW" : "HIGH",
      sourceUrl: n.url,
    });
  }

  for (const g of scores) {
    const a = Number(g.awayScore);
    const h = Number(g.homeScore);
    if (!Number.isFinite(a) || !Number.isFinite(h) || !/final/i.test(g.status)) continue;
    const margin = Math.abs(a - h);
    const close = margin <= (g.sport === "football" ? 7 : 6);
    const huge = Math.max(a, h) >= (g.sport === "football" ? 45 : 95);
    if (!close && !huge && !g.leaders.length) continue;
    out.push({
      id: `game-${g.id}`,
      sport: g.sport,
      title: `${g.awayTeam} ${g.awayScore} — ${g.homeTeam} ${g.homeScore}`,
      reason: close
        ? "Close final — check for a decisive late play, comeback or game-winner."
        : g.leaders.length
          ? `Top performance: ${g.leaders[0]}`
          : "High-output game worth checking for standout highlights.",
      urgency: close ? "NOW" : "WATCH",
      sourceUrl: g.url,
    });
  }

  const rank = { NOW: 0, HIGH: 1, WATCH: 2 };
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency]).slice(0, 10);
}

function compactDate(d: Date) {
  return d.toISOString().slice(0, 10).replace(/-/g, "");
}

export async function getSportsUpdateContext(): Promise<SportsUpdateContext> {
  const now = new Date();
  const start = new Date(now.getTime() - 3 * 86400000);
  const end = new Date(now.getTime() + 1 * 86400000);
  const range = `${compactDate(start)}-${compactDate(end)}`;

  const [cfbNews, cbbNews, cfbScores, cbbScores] = await Promise.all([
    getJson(`${ESPN}/football/college-football/news?limit=20`).catch(() => ({ articles: [] })),
    getJson(`${ESPN}/basketball/mens-college-basketball/news?limit=20`).catch(() => ({ articles: [] })),
    getJson(`${ESPN}/football/college-football/scoreboard?dates=${range}&limit=100`).catch(() => ({ events: [] })),
    getJson(`${ESPN}/basketball/mens-college-basketball/scoreboard?dates=${range}&limit=100`).catch(() => ({ events: [] })),
  ]);

  const news = [...parseNews(cfbNews, "football"), ...parseNews(cbbNews, "basketball")]
    .sort((a, b) => Date.parse(b.published || "0") - Date.parse(a.published || "0"))
    .slice(0, 18);
  const scores = [...parseScores(cfbScores, "football"), ...parseScores(cbbScores, "basketball")]
    .sort((a, b) => Date.parse(b.date || "0") - Date.parse(a.date || "0"))
    .slice(0, 24);

  return {
    generatedAt: now.toISOString(),
    news,
    scores,
    reelAlerts: buildReelAlerts(news, scores),
  };
}

export function sportsContextForPrompt(ctx: SportsUpdateContext) {
  const news = ctx.news.slice(0, 10).map((n) =>
    `[${n.sport}] ${n.headline} — ${n.description.slice(0, 180)}`
  ).join("\n");
  const scores = ctx.scores.slice(0, 10).map((g) =>
    `[${g.sport}] ${g.status}: ${g.awayTeam} ${g.awayScore} at ${g.homeTeam} ${g.homeScore}${g.leaders[0] ? ` | ${g.leaders[0]}` : ""}`
  ).join("\n");
  const upcoming = ctx.upcoming.slice(0, 12).map((g) =>\n    `[${g.sport}] UPCOMING TODAY: ${g.awayTeam} at ${g.homeTeam} — ${g.status}`\n  ).join("\\n");\n  const alerts = ctx.reelAlerts.slice(0, 8).map((a) =>
    `[${a.urgency}] [${a.sport}] ${a.title} — ${a.reason}`
  ).join("\n");

  return `REEL RADAR:\n${alerts || "No urgent verified reel alerts."}\n\nRECENT SCORES:\n${scores || "No recent college football/basketball scores."}\n\nLATEST NEWS:\n${news || "No major college football/basketball news."}`;
}
