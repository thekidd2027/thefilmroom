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
  upcoming: SportsScore[];
  reelAlerts: ReelAlert[];
};

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const UA = { "user-agent": "FilmRoom/1.0 editorial dashboard" };
export const FILM_ROOM_TIME_ZONE = "America/Chicago";

async function getJson(url: string) {
  const res = await fetch(url, { headers: UA, cache: "no-store" });
  if (!res.ok) throw new Error(`Sports feed failed (${res.status})`);
  return res.json();
}

function articleLink(item: any) {
  return item?.links?.web?.href || item?.links?.api?.news?.href || item?.link || "";
}

function parseNews(data: any, sport: "football" | "basketball"): SportsNewsItem[] {
  const rows = data?.articles ?? data?.feed ?? [];
  return rows
    .slice(0, 16)
    .map((a: any, i: number) => ({
      id: String(a?.id ?? `${sport}-news-${i}`),
      sport,
      headline: String(a?.headline ?? a?.title ?? "").trim(),
      description: String(a?.description ?? a?.story ?? "").replace(/<[^>]+>/g, "").trim(),
      published: String(a?.published ?? a?.lastModified ?? a?.date ?? ""),
      url: articleLink(a),
      image: a?.images?.[0]?.url,
    }))
    .filter((x: SportsNewsItem) => x.headline);
}

function parseScores(data: any, sport: "football" | "basketball"): SportsScore[] {
  return (data?.events ?? []).map((event: any, i: number) => {
    const comp = event?.competitions?.[0] ?? {};
    const competitors = comp?.competitors ?? [];
    const home = competitors.find((x: any) => x?.homeAway === "home") ?? competitors[0] ?? {};
    const away = competitors.find((x: any) => x?.homeAway === "away") ?? competitors[1] ?? {};
    const leaders = (comp?.leaders ?? [])
      .flatMap((group: any) =>
        (group?.leaders ?? []).slice(0, 2).map((l: any) => {
          const name = l?.athlete?.displayName ?? "";
          const display = l?.displayValue ?? l?.value ?? "";
          return [name, display].filter(Boolean).join(" — ");
        })
      )
      .filter(Boolean)
      .slice(0, 4);

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

function localDateKey(d: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: FILM_ROOM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(d);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "";
  return `${get("year")}${get("month")}${get("day")}`;
}

function dateKeyOffset(days: number) {
  return localDateKey(new Date(Date.now() + days * 86400000));
}

function isFinal(game: SportsScore) {
  return /final/i.test(game.status);
}

function isLive(game: SportsScore) {
  return /in progress|quarter|half|halftime|ot|end of/i.test(game.status);
}

function isStarted(game: SportsScore) {
  return isFinal(game) || isLive(game);
}

function dedupeGames(games: SportsScore[]) {
  return [...new Map(games.map((g) => [g.id, g])).values()];
}

function buildReelAlerts(news: SportsNewsItem[], scores: SportsScore[]): ReelAlert[] {
  const out: ReelAlert[] = [];
  const hot = /(walk[- ]?off|buzzer|game[- ]?winner|upset|stun|overtime|record|touchdown|interception|pick[- ]?six|one-handed|poster|dunk|career-high|yards|points|comeback|hail mary|viral|highlight|breakout)/i;

  for (const n of news) {
    if (!hot.test(`${n.headline} ${n.description}`)) continue;
    out.push({
      id: `news-${n.id}`,
      sport: n.sport,
      title: n.headline,
      reason: "Current coverage points to a potentially reel-worthy play, performance, or game storyline.",
      urgency: /today|tonight|just|stun|walk|buzzer|game-winner|upset|viral/i.test(`${n.headline} ${n.description}`) ? "NOW" : "HIGH",
      sourceUrl: n.url,
    });
  }

  for (const g of scores) {
    const away = Number(g.awayScore);
    const home = Number(g.homeScore);
    if (!Number.isFinite(away) || !Number.isFinite(home)) continue;

    const margin = Math.abs(away - home);
    const close = margin <= (g.sport === "football" ? 7 : 6);
    const huge = Math.max(away, home) >= (g.sport === "football" ? 45 : 95);
    const hasLeader = g.leaders.length > 0;

    if (!close && !huge && !hasLeader && !isLive(g)) continue;

    out.push({
      id: `game-${g.id}`,
      sport: g.sport,
      title: `${g.awayTeam} ${g.awayScore} — ${g.homeTeam} ${g.homeScore}`,
      reason: isLive(g)
        ? "Live game — watch for a breakout performance or defining play that should become a reel immediately."
        : close
          ? "Close final — check for the decisive late play, comeback, or game-winner."
          : hasLeader
            ? `Top performance: ${g.leaders[0]}`
            : "High-output game worth checking for standout highlights.",
      urgency: isLive(g) || close ? "NOW" : "WATCH",
      sourceUrl: g.url,
    });
  }

  const rank: Record<ReelAlert["urgency"], number> = { NOW: 0, HIGH: 1, WATCH: 2 };
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency]).slice(0, 12);
}

async function scoreboardForDate(sportPath: string, dateKey: string) {
  return getJson(`${ESPN}/${sportPath}/scoreboard?dates=${dateKey}&limit=100`).catch(() => ({ events: [] }));
}

export async function getSportsUpdateContext(): Promise<SportsUpdateContext> {
  const todayKey = dateKeyOffset(0);
  const recentKeys = [dateKeyOffset(-1), dateKeyOffset(-2), dateKeyOffset(-3)];

  const [cfbNews, cbbNews, cfbToday, cbbToday, ...recentFeeds] = await Promise.all([
    getJson(`${ESPN}/football/college-football/news?limit=30`).catch(() => ({ articles: [] })),
    getJson(`${ESPN}/basketball/mens-college-basketball/news?limit=30`).catch(() => ({ articles: [] })),
    scoreboardForDate("football/college-football", todayKey),
    scoreboardForDate("basketball/mens-college-basketball", todayKey),
    ...recentKeys.flatMap((dateKey) => [
      scoreboardForDate("football/college-football", dateKey),
      scoreboardForDate("basketball/mens-college-basketball", dateKey),
    ]),
  ]);

  const todayGames = dedupeGames([
    ...parseScores(cfbToday, "football"),
    ...parseScores(cbbToday, "basketball"),
  ]);

  const recentGames: SportsScore[] = [];
  for (let i = 0; i < recentFeeds.length; i += 2) {
    recentGames.push(...parseScores(recentFeeds[i], "football"));
    recentGames.push(...parseScores(recentFeeds[i + 1], "basketball"));
  }

  const upcoming = todayGames
    .filter((game) => !isStarted(game))
    .sort((a, b) => Date.parse(a.date || "0") - Date.parse(b.date || "0"));

  const todayStarted = todayGames.filter(isStarted);
  const scores = dedupeGames([...todayStarted, ...recentGames.filter(isStarted)])
    .sort((a, b) => Date.parse(b.date || "0") - Date.parse(a.date || "0"))
    .slice(0, 30);

  const news = [...parseNews(cfbNews, "football"), ...parseNews(cbbNews, "basketball")]
    .sort((a, b) => Date.parse(b.published || "0") - Date.parse(a.published || "0"))
    .slice(0, 24);

  return {
    generatedAt: new Date().toISOString(),
    news,
    scores,
    upcoming,
    reelAlerts: buildReelAlerts(news, scores),
  };
}

export function sportsContextForPrompt(ctx: SportsUpdateContext) {
  const upcoming = ctx.upcoming
    .slice(0, 12)
    .map((g) => `[${g.sport}] UPCOMING TODAY: ${g.awayTeam} at ${g.homeTeam} — ${g.status || g.date}`)
    .join("\n");

  const scores = ctx.scores
    .slice(0, 12)
    .map((g) => `[${g.sport}] ${g.status}: ${g.awayTeam} ${g.awayScore} at ${g.homeTeam} ${g.homeScore}${g.leaders[0] ? ` | ${g.leaders[0]}` : ""}`)
    .join("\n");

  const alerts = ctx.reelAlerts
    .slice(0, 10)
    .map((a) => `[${a.urgency}] [${a.sport}] ${a.title} — ${a.reason}`)
    .join("\n");

  const news = ctx.news
    .slice(0, 12)
    .map((n) => `[${n.sport}] ${n.headline} — ${n.description.slice(0, 180)}`)
    .join("\n");

  return `REEL RADAR:
${alerts || "No urgent verified reel alerts."}

UPCOMING TODAY:
${upcoming || "No upcoming men's college football or basketball games today."}

RECENT/LIVE SCORES:
${scores || "No recent men's college football or basketball scores."}

LATEST NEWS:
${news || "No major men's college football or basketball news."}`;
}
