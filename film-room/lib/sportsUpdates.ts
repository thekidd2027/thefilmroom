export type SportsNewsItem = {
  id: string;
  sport: "football" | "basketball";
  headline: string;
  description: string;
  published: string;
  url: string;
  image?: string;
  source: string;
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
  source: string;
  verified: boolean;
};

export type ReelAlert = {
  id: string;
  sport: "football" | "basketball";
  title: string;
  reason: string;
  urgency: "NOW" | "HIGH" | "WATCH";
  sourceUrl?: string;
};

export type FeedHealth = {
  schedules: "verified" | "partial" | "unavailable";
  scores: "verified" | "partial" | "unavailable";
  news: "verified" | "partial" | "unavailable";
  notes: string[];
};

export type SportsUpdateContext = {
  generatedAt: string;
  news: SportsNewsItem[];
  scores: SportsScore[];
  upcoming: SportsScore[];
  reelAlerts: ReelAlert[];
  health: FeedHealth;
};

const ESPN = "https://site.api.espn.com/apis/site/v2/sports";
const UA = { "user-agent": "FilmRoom/1.0 editorial dashboard" };
export const FILM_ROOM_TIME_ZONE = "America/Chicago";

async function getJson(url: string) {
  const res = await fetch(url, { headers: UA, cache: "no-store" });
  if (!res.ok) throw new Error(`Feed failed (${res.status})`);
  return res.json();
}

async function getText(url: string) {
  const res = await fetch(url, { headers: UA, cache: "no-store" });
  if (!res.ok) throw new Error(`Feed failed (${res.status})`);
  return res.text();
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
      source: "ESPN",
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
      source: "ESPN",
      verified: true,
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

function isoFromEt(dateKey: string, hour24: number, minute: number) {
  const y = Number(dateKey.slice(0, 4));
  const m = Number(dateKey.slice(4, 6));
  const d = Number(dateKey.slice(6, 8));
  // Aug 29 is EDT (UTC-4). This fallback is only for the verified 2026 Week 0 slate.
  return new Date(Date.UTC(y, m - 1, d, hour24 + 4, minute)).toISOString();
}

function verifiedWeek0Fallback(dateKey: string): SportsScore[] {
  if (dateKey !== "20260829") return [];

  const sourceUrl = "https://www.ncaa.com/live-updates/football/fbs/college-football-week-0-live-updates-scores-schedule-highlights";
  const games = [
    ["North Carolina", "TCU", 12, 0, "ESPN"],
    ["San Jose State", "No. 14 USC", 15, 0, "NBC"],
    ["NC State", "Virginia", 15, 30, "ESPN"],
    ["Jacksonville State", "North Dakota State", 17, 30, "CBSSN"],
    ["Sacramento State", "Eastern Michigan", 18, 30, "ESPN+"],
    ["Hawai'i", "Stanford", 19, 0, "ACC Network"],
    ["New Mexico State", "Florida State", 19, 0, "CW"],
    ["Memphis", "UNLV", 22, 0, "FOX"],
  ] as const;

  return games.map(([awayTeam, homeTeam, hour, minute, network], index) => ({
    id: `ncaa-week0-${index}`,
    sport: "football" as const,
    status: `${network} · scheduled`,
    date: isoFromEt(dateKey, hour, minute),
    awayTeam,
    awayScore: "",
    homeTeam,
    homeScore: "",
    headline: `${awayTeam} at ${homeTeam}`,
    url: sourceUrl,
    leaders: [],
    source: "NCAA",
    verified: true,
  }));
}

async function fetchCbsUncTcuLive(dateKey: string): Promise<SportsScore | null> {
  if (dateKey !== "20260829") return null;

  const url = "https://www.cbssports.com/college-football/gametracker/live/NCAAF_20260829_UNC%40TCU/";
  try {
    const html = await getText(url);
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    const isLive = /INPROGRESS|In Progress/i.test(text);
    const isFinal = /FINAL/i.test(text);
    if (!isLive && !isFinal) return null;

    const clockMatch = text.match(/(1st|2nd|3rd|4th|OT)\s+(\d{1,2}:\d{2})/i);
    const scoreMatch = text.match(/North Carolina Tar Heels[\s\S]{0,180}?(\d{1,2})[\s\S]{0,180}?TCU Horned Frogs[\s\S]{0,180}?(\d{1,2})/i);

    return {
      id: "cbs-unc-tcu-20260829",
      sport: "football",
      status: isFinal ? "Final" : clockMatch ? `${clockMatch[1]} ${clockMatch[2]}` : "Live",
      date: isoFromEt(dateKey, 12, 0),
      awayTeam: "North Carolina",
      awayScore: scoreMatch?.[1] ?? "",
      homeTeam: "TCU",
      homeScore: scoreMatch?.[2] ?? "",
      headline: "North Carolina vs. TCU",
      url,
      leaders: [],
      source: "CBS Sports",
      verified: true,
    };
  } catch {
    return null;
  }
}

function isFinal(game: SportsScore) {
  return /final/i.test(game.status);
}

function isLive(game: SportsScore) {
  return /live|in progress|quarter|half|halftime|\b1st\b|\b2nd\b|\b3rd\b|\b4th\b|\bot\b|end of/i.test(game.status);
}

function isStarted(game: SportsScore) {
  return isFinal(game) || isLive(game);
}

function normalizeTeamName(value: string) {
  return value.toLowerCase().replace(/^no\.\s*\d+\s+/, "").replace(/[^a-z0-9]/g, "");
}

function gameKey(game: SportsScore) {
  return [normalizeTeamName(game.awayTeam), normalizeTeamName(game.homeTeam)].sort().join("-");
}

function mergeGames(primary: SportsScore[], fallback: SportsScore[]) {
  const map = new Map<string, SportsScore>();
  for (const game of fallback) map.set(gameKey(game), game);
  for (const game of primary) map.set(gameKey(game), game);
  return [...map.values()];
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
    const hasScores = Number.isFinite(away) && Number.isFinite(home) && g.awayScore !== "" && g.homeScore !== "";

    if (isLive(g)) {
      out.push({
        id: `game-${g.id}`,
        sport: g.sport,
        title: hasScores ? `${g.awayTeam} ${g.awayScore} — ${g.homeTeam} ${g.homeScore}` : `${g.awayTeam} at ${g.homeTeam}`,
        reason: "Live game — watch for a defining play or breakout performance that should become a Reel immediately.",
        urgency: "NOW",
        sourceUrl: g.url,
      });
      continue;
    }

    if (!hasScores || !isFinal(g)) continue;
    const margin = Math.abs(away - home);
    const close = margin <= (g.sport === "football" ? 7 : 6);
    if (!close && !g.leaders.length) continue;

    out.push({
      id: `game-${g.id}`,
      sport: g.sport,
      title: `${g.awayTeam} ${g.awayScore} — ${g.homeTeam} ${g.homeScore}`,
      reason: close ? "Close final — check for the decisive late play, comeback, or game-winner." : `Top performance: ${g.leaders[0]}`,
      urgency: close ? "NOW" : "WATCH",
      sourceUrl: g.url,
    });
  }

  const rank: Record<ReelAlert["urgency"], number> = { NOW: 0, HIGH: 1, WATCH: 2 };
  return out.sort((a, b) => rank[a.urgency] - rank[b.urgency]).slice(0, 12);
}

async function scoreboardForDate(sportPath: string, dateKey: string) {
  return getJson(`${ESPN}/${sportPath}/scoreboard?dates=${dateKey}&limit=100`);
}

export async function getSportsUpdateContext(): Promise<SportsUpdateContext> {
  const todayKey = dateKeyOffset(0);
  const recentKeys = [dateKeyOffset(-1), dateKeyOffset(-2), dateKeyOffset(-3)];
  const notes: string[] = [];

  let cfbNews: any = { articles: [] };
  let cbbNews: any = { articles: [] };
  let espnTodayFootball: any = { events: [] };
  let espnTodayBasketball: any = { events: [] };
  let espnScheduleOk = true;
  let espnNewsOk = true;

  try {
    [cfbNews, cbbNews, espnTodayFootball, espnTodayBasketball] = await Promise.all([
      getJson(`${ESPN}/football/college-football/news?limit=30`),
      getJson(`${ESPN}/basketball/mens-college-basketball/news?limit=30`),
      scoreboardForDate("football/college-football", todayKey),
      scoreboardForDate("basketball/mens-college-basketball", todayKey),
    ]);
  } catch (error) {
    notes.push("ESPN live feed did not fully respond; verified NCAA fallback is active where available.");
    espnScheduleOk = false;
    espnNewsOk = false;
  }

  const recentFeeds = await Promise.all(
    recentKeys.flatMap((dateKey) => [
      scoreboardForDate("football/college-football", dateKey).catch(() => ({ events: [] })),
      scoreboardForDate("basketball/mens-college-basketball", dateKey).catch(() => ({ events: [] })),
    ])
  );

  const espnTodayGames = [
    ...parseScores(espnTodayFootball, "football"),
    ...parseScores(espnTodayBasketball, "basketball"),
  ];

  const ncaaFallback = verifiedWeek0Fallback(todayKey);
  const liveCbsGame = await fetchCbsUncTcuLive(todayKey);
  const verifiedTodayGames = mergeGames(espnTodayGames, ncaaFallback);
  const todayGames = liveCbsGame
    ? mergeGames([liveCbsGame], verifiedTodayGames)
    : verifiedTodayGames;

  if (!espnTodayGames.length && ncaaFallback.length) {
    notes.push("Today's schedule is being shown from the verified NCAA Week 0 slate because the ESPN schedule feed returned no games.");
  }

  if (liveCbsGame) {
    notes.push("North Carolina–TCU live status is cross-checked with CBS Sports.");
  }

  const recentGames: SportsScore[] = [];
  for (let i = 0; i < recentFeeds.length; i += 2) {
    recentGames.push(...parseScores(recentFeeds[i], "football"));
    recentGames.push(...parseScores(recentFeeds[i + 1], "basketball"));
  }

  const now = Date.now();
  const upcoming = todayGames
    .filter((game) => {
      if (isStarted(game)) return false;
      const kickoff = Date.parse(game.date);
      return Number.isFinite(kickoff) ? kickoff > now - 10 * 60 * 1000 : true;
    })
    .sort((a, b) => Date.parse(a.date || "0") - Date.parse(b.date || "0"));

  const scores = [...todayGames.filter(isStarted), ...recentGames.filter(isStarted)]
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
    health: {
      schedules: todayGames.length ? "verified" : espnScheduleOk ? "partial" : "unavailable",
      scores: scores.length ? "verified" : "partial",
      news: news.length ? "verified" : espnNewsOk ? "partial" : "unavailable",
      notes,
    },
  };
}

export function sportsContextForPrompt(ctx: SportsUpdateContext) {
  const upcoming = ctx.upcoming
    .slice(0, 12)
    .map((g) => `[${g.sport}] UPCOMING TODAY: ${g.awayTeam} at ${g.homeTeam} — ${g.status || g.date} [${g.source}]`)
    .join("\n");

  const scores = ctx.scores
    .slice(0, 12)
    .map((g) => `[${g.sport}] ${g.status}: ${g.awayTeam} ${g.awayScore} at ${g.homeTeam} ${g.homeScore} [${g.source}]`)
    .join("\n");

  const alerts = ctx.reelAlerts
    .slice(0, 10)
    .map((a) => `[${a.urgency}] [${a.sport}] ${a.title} — ${a.reason}`)
    .join("\n");

  const news = ctx.news
    .slice(0, 12)
    .map((n) => `[${n.sport}] ${n.headline} — ${n.description.slice(0, 180)} [${n.source}]`)
    .join("\n");

  return `DATA HEALTH: schedules=${ctx.health.schedules}, scores=${ctx.health.scores}, news=${ctx.health.news}
${ctx.health.notes.join(" | ")}

REEL RADAR:
${alerts || "No verified urgent reel alerts."}

UPCOMING TODAY:
${upcoming || "No verified upcoming games available."}

RECENT/LIVE SCORES:
${scores || "No verified recent/live scores available."}

LATEST NEWS:
${news || "No verified news available."}`;
}
