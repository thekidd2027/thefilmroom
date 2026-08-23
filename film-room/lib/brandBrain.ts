export type ScoringWeights = {
  popularity: number;
  currentRelevance: number;
  wowFactor: number;
  storyValue: number;
  brandFit: number;
  verticalViability: number;
};
export type SeasonalWeight = { sport: string; months: number[]; baseWeight: number };
export type MediaSourcingRule = { allowedSourceTypes: string[]; cautionSourceTypes: string[]; bannedSourceTypes: string[]; rationale: string };
export type MusicPolicy = { soundPalette: string[]; usageRule: string; rationale: string };
export type PenaltyRule = { key: string; description: string; penalty: number };
export type BrandVoice = { principles: string[]; bannedPhrases: string[]; captionStyle: string; coverStyle: string };
export type EditorialRules = {
  coreSports: string[];
  currentVsFlashback: string;
  generalHypeFanRule: string;
  rivalryException: string;
  replacementRule: string;
  sourceRule: string;
  cameraAngleRule: string;
  reelLengthRule: string;
  templates: { name: string; job: string }[];
};
export type BrandBrain = {
  scoringWeights: ScoringWeights;
  seasonalCalendar: SeasonalWeight[];
  mediaSourcing: MediaSourcingRule;
  musicPolicy: MusicPolicy;
  penalties: PenaltyRule[];
  voice: BrandVoice;
  editorialRules: EditorialRules;
  slateSize: number;
};

export const DEFAULT_BRAND_BRAIN: BrandBrain = {
  slateSize: 3,
  scoringWeights: {
    popularity: 0.30,
    currentRelevance: 0.24,
    wowFactor: 0.20,
    storyValue: 0.11,
    brandFit: 0.10,
    verticalViability: 0.05,
  },
  seasonalCalendar: [
    { sport: "football", months: [8, 9, 10, 11, 12, 1], baseWeight: 1.45 },
    { sport: "basketball", months: [11, 12, 1, 2, 3, 4], baseWeight: 1.0 },
  ],
  mediaSourcing: {
    allowedSourceTypes: [
      "original footage",
      "creator/fan footage with explicit permission",
      "licensed footage",
      "school/team/player footage where reuse permission is actually granted",
      "platform remix/reuse where the platform and rightsholder explicitly allow it",
    ],
    cautionSourceTypes: [
      "ESPN/Fox/CBS/ABC/NCAA/conference broadcast footage",
      "official highlights that are publicly viewable but not explicitly licensed for reposting",
      "third-party highlight compilations",
    ],
    bannedSourceTypes: [
      "private/paywalled footage acquired by bypassing access controls",
      "stolen or leaked footage",
    ],
    rationale:
      "Publicly viewable does not mean licensed for reposting. The portal may surface caution sources for editorial research, but must label rights risk and never claim a clip is lawful merely because it is on YouTube.",
  },
  musicPolicy: {
    soundPalette: [
      "warm vintage soul in the Can I Call You Rose? universe",
      "Fleetwood Mac / classic-rock nostalgia",
      "Remember the Titans-style cinematic sports score",
      "Americana and old-record energy",
      "occasional tasteful country: Turnpike Troubadours, George Strait, Tyler Childers, Flatland Cavalry-type energy",
      "Spirit in the Sky-style vintage energy",
    ],
    usageRule:
      "Always suggest exactly 3 songs, ranked. Commercial tracks are suggestions for use through Instagram/YouTube's licensed in-app music library where available; do not tell editors to bake an unlicensed commercial master into the exported video.",
    rationale:
      "Music is a signature part of the brand. It should feel soulful, analog, nostalgic and human—not generic TikTok hype music.",
  },
  penalties: [
    { key: "fan_conflict", description: "In a general hype/highlight reel, a team is celebrated and then made the victim later without conflict being the story.", penalty: 1.8 },
    { key: "overused_clip", description: "Same moment or player angle has run recently.", penalty: 1.8 },
    { key: "stale_recency", description: "Old story has no current hook or evergreen purpose.", penalty: 1.0 },
    { key: "weak_story", description: "Great play but no role in the reel's emotional arc.", penalty: 1.2 },
    { key: "atmosphere_only", description: "Pitch is mainly crowd noise, marching band, stadium ambience, entrances, uniforms, signs, tailgates, or generic tradition footage without elite football/basketball action driving the reel.", penalty: 4.0 },
    { key: "low_recognition", description: "Pitch centers on obscure players, teams or moments when a more recognizable and shareable subject is available.", penalty: 2.0 },
  ],
  voice: {
    principles: [
      "This is a men's college football and men's college basketball media brand, not a faceless content farm.",
      "Make today's college sports feel historic and historic college sports feel alive again.",
      "The product is GREAT SPORTS CONTENT first: explosive highlights, iconic players, rivalry moments, legendary performances, comebacks, heartbreak, clutch plays and recognizable stories.",
      "Sound like someone with taste who loves the sport, not ESPN-lite and not an AI narrator.",
      "The footage, commentator audio and music do most of the storytelling.",
      "Use minimal on-screen words; every word must earn its place.",
      "Relevance isn't always recency. Cultural memory can beat a same-day mediocre play.",
      "Optimize for shares and follows, not just views.",
      "Atmosphere is seasoning, not the meal. Crowd, band, entrance or stadium shots can support a highlight story for a few seconds but should almost never BE the story.",
    ],
    bannedPhrases: ["You won't believe", "Here are today's top", "craziest ever!!!", "follow for more"],
    captionStyle: "Short, confident, human. Usually one sentence or fragment. No engagement bait.",
    coverStyle: "One strong action frame, player close-up or emotionally loaded sports frame; subtle title if needed; consistent film/editorial treatment. No collage.",
  },
  editorialRules: {
    coreSports: ["men's college football", "men's college basketball"],
    currentVsFlashback:
      "Use current moments as the discovery engine and flashbacks as the emotional engine. During football season, make the slate heavily football-first (normally 4 of 5 pitches) unless a men's college basketball story is genuinely bigger. Connect past to present whenever natural.",
    generalHypeFanRule:
      "For general hype/highlight reels, protect fan-allegiance continuity: avoid celebrating a fanbase and then showing that same fanbase getting embarrassed in the same reel.",
    rivalryException:
      "For rivalry, matchup, 'last time they played', historical conflict or debate reels, opposing fan pain is allowed because the conflict itself is the story.",
    replacementRule:
      "Every recipe must include exactly 3 pre-vetted replacement clips. Each replacement must name which primary clip(s) it can replace and preserve the same story function, pacing and fan-allegiance logic.",
    sourceRule:
      "Every source clip gets a raw source URL plus a clickable direct URL that opens at the exact timestamp. Never invent a timestamp. If transcript/visual inspection cannot ground it, flag it as unverified instead of guessing. Prefer at least 2 distinct source videos per reel and preserve multiple useful clip choices for the editor.",
    cameraAngleRule:
      "Search for alternate sources/angles of important moments. Prefer a package with setup, primary action, replay/tight angle and player/coach reaction when it improves the story. Multiple distinct clips and angles are strongly preferred. Do not use redundant angles just to look edited.",
    reelLengthRule:
      "Default to the shortest runtime that earns the payoff. Typical range 12-35 seconds. Longer is allowed only when a true player/team/rivalry story earns it.",
    templates: [
      { name: "MOMENT", job: "Reach: one elite current or iconic PLAY/PERFORMANCE with setup and payoff. Action must drive it." },
      { name: "FEELING", job: "Shares/brand: sports emotion built around actual highlights—heartbreak, comeback, dominance, rivalry, nostalgia. Atmosphere may support but never dominate." },
      { name: "STORY", job: "Follows/retention: a player, team, game or rivalry mini-narrative. Interviews/documentary audio may cold-open before strong highlight clips." },
      { name: "TAKE", job: "Comments/community: a defensible men's college football/basketball statement backed primarily by game footage." },
    ],
  },
};
