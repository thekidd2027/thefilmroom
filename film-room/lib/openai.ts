import { BrandBrain } from "./brandBrain";
import { YouTubeSearchResult, VideoStats } from "./youtube";
import { TranscriptChunk, transcriptToText, VideoVisualMoment } from "./supadata";
import { youtubeTimestampUrl } from "./time";
import type { ClipRef, EditShot, MusicOption, StoryResearch } from "./types";

const MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";
const RESEARCH_MODEL = process.env.ANTHROPIC_RESEARCH_MODEL ?? MODEL;
const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";

type ClaudeContentBlock = {
  type: string;
  text?: string;
};

type ClaudeMessageResponse = {
  content?: ClaudeContentBlock[];
  error?: { message?: string };
};

async function claude(prompt: string, options?: { model?: string; webSearch?: boolean; maxTokens?: number }) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) throw new Error("Missing ANTHROPIC_API_KEY env var.");

  const body: Record<string, unknown> = {
    model: options?.model ?? MODEL,
    max_tokens: options?.maxTokens ?? 5000,
    messages: [{ role: "user", content: prompt }],
  };

  if (options?.webSearch) {
    body.tools = [
      {
        type: "web_search_20250305",
        name: "web_search",
        max_uses: 5,
      },
    ];
  }

  const response = await fetch(ANTHROPIC_API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify(body),
  });

  const data = (await response.json()) as ClaudeMessageResponse;
  if (!response.ok) {
    throw new Error(data?.error?.message ?? `Anthropic request failed (${response.status})`);
  }

  return (data.content ?? [])
    .filter((block) => block.type === "text" && typeof block.text === "string")
    .map((block) => block.text)
    .join("\n")
    .trim();
}

function brainPrompt(b: BrandBrain) {
  return `You are Editor-in-Chief and senior producer for Film Room, a college-sports media brand.
Core sports: ${b.editorialRules.coreSports.join(", ")}.
Brand thesis: make today's college sports feel historic and historic college sports feel alive again.
Voice: ${b.voice.principles.join(" ")}
Banned language: ${b.voice.bannedPhrases.join(" | ")}
Season rule: ${b.editorialRules.currentVsFlashback}
Fan rule: ${b.editorialRules.generalHypeFanRule}
Rivalry exception: ${b.editorialRules.rivalryException}
Source rule: ${b.editorialRules.sourceRule}
Camera-angle rule: ${b.editorialRules.cameraAngleRule}
Replacement rule: ${b.editorialRules.replacementRule}
Length rule: ${b.editorialRules.reelLengthRule}
Music palette: ${b.musicPolicy.soundPalette.join("; ")}
Music usage: ${b.musicPolicy.usageRule}
Footage rights policy: allowed=${b.mediaSourcing.allowedSourceTypes.join("; ")}; caution=${b.mediaSourcing.cautionSourceTypes.join("; ")}; banned=${b.mediaSourcing.bannedSourceTypes.join("; ")}.
Do not confuse popularity with story quality. Research what fans/media actually cared about. Prefer recognizable, culturally sticky moments over random athletic plays. Never invent a timestamp.`;
}

function parseJson<T>(text: string, fallback: T): T {
  const cleaned = text.trim().replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const firstBrace = cleaned.indexOf("{");
    const lastBrace = cleaned.lastIndexOf("}");
    if (firstBrace >= 0 && lastBrace > firstBrace) {
      try {
        return JSON.parse(cleaned.slice(firstBrace, lastBrace + 1)) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

export type TrendStory = {
  headline: string;
  sport: "football" | "basketball";
  summary: string;
  whyToday: string;
  viewerFeeling: string;
  searchQueries: string[];
  popularityEvidence: string[];
  trendSources: { label: string; url: string }[];
  template: "MOMENT" | "FEELING" | "STORY" | "TAKE";
  fanAllegianceLogic: string;
};

export async function researchTodaysStories(brandBrain: BrandBrain, dateIso: string): Promise<TrendStory[]> {
  const prompt = `${brainPrompt(brandBrain)}
Today is ${dateIso}. Research the CURRENT college football and college basketball landscape using web search. Check major media and broad conversation, especially ESPN, Bleacher Report, AP/Reuters, NCAA/conference/team coverage, current scores/results, rankings, upcoming marquee games, player trends, anniversaries and viral/culturally sticky moments.

Return the 10 strongest Reel story candidates for Film Room. The page is trying to grow followers and become monetizable, so each candidate needs a reason people care TODAY and a reason someone might share/follow. It can be current or a flashback if today's calendar/story makes the flashback relevant.

Return ONLY JSON: {"stories":[{"headline":"...","sport":"football|basketball","summary":"...","whyToday":"...","viewerFeeling":"...","searchQueries":["YouTube query 1","query 2"],"popularityEvidence":["specific evidence"],"trendSources":[{"label":"ESPN","url":"https://..."}],"template":"MOMENT|FEELING|STORY|TAKE","fanAllegianceLogic":"..."}]}`;

  const text = await claude(prompt, {
    model: RESEARCH_MODEL,
    webSearch: true,
    maxTokens: 7000,
  });

  return parseJson<{ stories: TrendStory[] }>(text, { stories: [] }).stories ?? [];
}

export type ScoredCandidate = {
  headline: string;
  sport: string;
  summary: string;
  wowFactor: number;
  storyValue: number;
  brandFit: number;
  verticalViability: number;
  rightsRisk: "clear" | "caution" | "blocked";
  rightsReason: string;
};

export async function scoreVideoCandidates(
  brandBrain: BrandBrain,
  story: TrendStory,
  items: { search: YouTubeSearchResult; stats: VideoStats }[]
): Promise<ScoredCandidate[]> {
  const payload = items.map((it) => ({
    title: it.search.title,
    channelTitle: it.search.channelTitle,
    description: it.search.description.slice(0, 500),
    publishedAt: it.search.publishedAt,
    viewCount: it.stats.viewCount,
    likeCount: it.stats.likeCount,
    commentCount: it.stats.commentCount,
    durationSeconds: it.stats.durationSeconds,
  }));

  const text = await claude(
    `${brainPrompt(brandBrain)}\nStory: ${JSON.stringify(story)}\nScore each source candidate for usefulness in telling THIS story. "rightsRisk" must be clear/caution/blocked, with public broadcast/highlight footage usually caution unless explicit reuse permission is evident. Return ONLY JSON {"candidates":[...]}. Candidate order must match input order. Fields: headline,sport,summary,wowFactor,storyValue,brandFit,verticalViability,rightsRisk,rightsReason.\n${JSON.stringify(payload)}`,
    { model: MODEL, maxTokens: 4500 }
  );

  return parseJson<{ candidates: ScoredCandidate[] }>(text, { candidates: [] }).candidates ?? [];
}

export type SourceInspection = {
  search: YouTubeSearchResult;
  stats: VideoStats;
  transcript: TranscriptChunk[];
  visuals: VideoVisualMoment[];
};

export type ReelRecipe = {
  caption: string;
  cover_text: string;
  template_name: string;
  target_length_seconds: number;
  primary_clips: ClipRef[];
  replacement_clips: ClipRef[];
  edit_notes: EditShot[];
  music_options: MusicOption[];
  story_research: StoryResearch;
};

export async function buildGroundedRecipe(
  brandBrain: BrandBrain,
  story: TrendStory,
  sources: SourceInspection[]
): Promise<ReelRecipe> {
  const sourcePayload = sources.map((s) => ({
    videoId: s.search.videoId,
    title: s.search.title,
    channelTitle: s.search.channelTitle,
    url: `https://www.youtube.com/watch?v=${s.search.videoId}`,
    durationSeconds: s.stats.durationSeconds,
    views: s.stats.viewCount,
    transcript: transcriptToText(s.transcript, 12_000),
    visualInspection: s.visuals,
  }));

  const text = await claude(
    `${brainPrompt(brandBrain)}
Build the final editor-ready recipe for this story: ${JSON.stringify(story)}
Ground every clip timestamp in the transcript and/or visual inspection provided. Do not invent. Prefer multiple camera angles/sources when they materially improve the story. For a general hype/feeling reel enforce fan-allegiance continuity. For rivalry/matchup reels conflict is allowed.

Choose 4-7 PRIMARY clips in exact story order and EXACTLY 3 replacements. Replacements must name primary order numbers they can replace. Each primary should usually be 1-5 seconds in the final reel, even if the source window is longer. Give CapCut 9:16 keyframe instructions as x/y percentages and scale percentage, only when useful.

Music: exactly 3 real song suggestions within the Film Room palette; rank 1-3. These are creative suggestions for use through platform-licensed music where available. Never claim sync rights.

Return ONLY JSON with this shape:
{"caption":"","cover_text":"","template_name":"MOMENT|FEELING|STORY|TAKE","target_length_seconds":24,
"primary_clips":[{"video_id":"","title":"","channel_title":"","start_seconds":0,"end_seconds":0,"moment":"","story_function":"","camera_angle":"","rights_note":""}],
"replacement_clips":[{"video_id":"","title":"","channel_title":"","start_seconds":0,"end_seconds":0,"moment":"","story_function":"","camera_angle":"","rights_note":"","can_replace":[1]}],
"edit_notes":[{"order":1,"source_video_id":"","source_start_seconds":0,"source_end_seconds":0,"shot":"","purpose":"","on_screen_text":"","audio_note":"","keyframes":[{"at_seconds":0,"x":50,"y":50,"scale":150,"note":"center QB"}]}],
"music_options":[{"title":"","artist":"","source":"Instagram/YouTube licensed music library if available","note":"","rank":1}],
"story_research":{"why_today":"","viewer_feeling":"","popularity_evidence":[""],"trend_sources":[{"label":"","url":""}],"fan_allegiance_logic":"","seasonal_fit":""}}
}

Sources:\n${JSON.stringify(sourcePayload)}`,
    { model: MODEL, maxTokens: 9000 }
  );

  const recipe = parseJson<ReelRecipe>(text, {
    caption: "",
    cover_text: "",
    template_name: story.template,
    target_length_seconds: 22,
    primary_clips: [],
    replacement_clips: [],
    edit_notes: [],
    music_options: [],
    story_research: {
      why_today: story.whyToday,
      viewer_feeling: story.viewerFeeling,
      popularity_evidence: story.popularityEvidence,
      trend_sources: story.trendSources,
      fan_allegiance_logic: story.fanAllegianceLogic,
      seasonal_fit: story.whyToday,
    },
  });

  const sourceById = new Map(sources.map((s) => [s.search.videoId, s]));
  const decorate = (clip: any): ClipRef => {
    const src = sourceById.get(clip.video_id);
    const start = Math.max(0, Number(clip.start_seconds ?? 0));
    const end = Math.max(start + 0.5, Number(clip.end_seconds ?? start + 3));
    return {
      ...clip,
      title: clip.title || src?.search.title || "Source clip",
      channel_title: clip.channel_title || src?.search.channelTitle,
      source_url: `https://www.youtube.com/watch?v=${clip.video_id}`,
      start_seconds: start,
      end_seconds: end,
      direct_url: youtubeTimestampUrl(clip.video_id, start),
    };
  };

  recipe.primary_clips = (recipe.primary_clips ?? []).map(decorate);
  recipe.replacement_clips = (recipe.replacement_clips ?? []).slice(0, 3).map(decorate);
  recipe.edit_notes = (recipe.edit_notes ?? []).map((n: any, idx) => ({
    ...n,
    order: Number(n.order ?? idx + 1),
    direct_url: youtubeTimestampUrl(n.source_video_id, Number(n.source_start_seconds ?? 0)),
  }));
  recipe.music_options = (recipe.music_options ?? []).slice(0, 3).sort((a, b) => a.rank - b.rank);
  recipe.story_research = {
    ...recipe.story_research,
    why_today: recipe.story_research?.why_today || story.whyToday,
    viewer_feeling: recipe.story_research?.viewer_feeling || story.viewerFeeling,
    popularity_evidence: recipe.story_research?.popularity_evidence?.filter(Boolean) ?? story.popularityEvidence,
    trend_sources: recipe.story_research?.trend_sources?.filter((x) => x?.url) ?? story.trendSources,
    fan_allegiance_logic: recipe.story_research?.fan_allegiance_logic || story.fanAllegianceLogic,
    seasonal_fit: recipe.story_research?.seasonal_fit || story.whyToday,
  };

  return recipe;
}
