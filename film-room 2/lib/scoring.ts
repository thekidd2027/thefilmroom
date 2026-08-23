import { BrandBrain } from "./brandBrain";
import { ScoredCandidate } from "./openai";
import { VideoStats } from "./youtube";

export type FinalScore = { total: number; breakdown: Record<string, number>; blocked: boolean; blockReason?: string };

function popularityScore(stats: VideoStats): number {
  const views = Math.log10(stats.viewCount + 1) / Math.log10(20_000_000) * 7;
  const engagement = Math.min(3, ((stats.likeCount + stats.commentCount * 3) / Math.max(1, stats.viewCount)) * 120);
  return Math.max(0, Math.min(10, views + engagement));
}
function recencyScore(publishedAt: string) {
  const hours = (Date.now() - new Date(publishedAt).getTime()) / 3_600_000;
  if (hours <= 12) return 10;
  if (hours <= 24) return 9;
  if (hours <= 48) return 7;
  if (hours <= 96) return 5;
  return 3;
}
function seasonalMultiplier(b: BrandBrain, sport: string) {
  const month = new Date().getMonth() + 1;
  const e = b.seasonalCalendar.find((x) => x.sport.toLowerCase() === sport.toLowerCase());
  if (!e) return 0.5;
  return e.months.includes(month) ? e.baseWeight : e.baseWeight * 0.35;
}
export function scoreCandidate(b: BrandBrain, s: ScoredCandidate, stats: VideoStats, publishedAt: string, recent: string[]): FinalScore {
  if (s.rightsRisk === "blocked") return { total: 0, breakdown: {}, blocked: true, blockReason: s.rightsReason };
  const w = b.scoringWeights;
  const popularity = popularityScore(stats);
  const currentRelevance = recencyScore(publishedAt) * seasonalMultiplier(b, s.sport);
  let total = popularity*w.popularity + currentRelevance*w.currentRelevance + s.wowFactor*w.wowFactor + s.storyValue*w.storyValue + s.brandFit*w.brandFit + s.verticalViability*w.verticalViability;
  const breakdown: Record<string, number> = { popularity, currentRelevance, wowFactor:s.wowFactor, storyValue:s.storyValue, brandFit:s.brandFit, verticalViability:s.verticalViability };
  if (recent.some((h) => h.toLowerCase() === s.headline.toLowerCase())) { total -= 1.8; breakdown.penalty_overused = -1.8; }
  if (s.rightsRisk === "caution") { total -= 0.35; breakdown.penalty_rights_caution = -0.35; }
  total = Math.max(0, Math.min(10, total));
  return { total: Math.round(total*10)/10, breakdown, blocked:false };
}
