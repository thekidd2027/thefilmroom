import { supabaseAdmin } from "./supabaseServer";
import { BrandBrain, DEFAULT_BRAND_BRAIN } from "./brandBrain";

type StructuredBrainRow = {
  id: string;
  mission: string | null;
  audience: string | null;
  voice_rules: Record<string, any> | null;
  visual_rules: Record<string, any> | null;
  music_rules: Record<string, any> | null;
  clip_selection_rules: Record<string, any> | null;
  seasonal_strategy: Record<string, any> | null;
  template_rules: Record<string, any> | null;
  runtime_config: Partial<BrandBrain> | null;
};

function buildBrainFromStructuredRow(row: StructuredBrainRow): BrandBrain {
  const voiceRules = row.voice_rules ?? {};
  const musicRules = row.music_rules ?? {};
  const clipRules = row.clip_selection_rules ?? {};
  const seasonalStrategy = row.seasonal_strategy ?? {};
  const templateRules = row.template_rules ?? {};
  const runtime = row.runtime_config ?? {};

  const musicPalette = [
    ...(Array.isArray(musicRules.style) ? musicRules.style : []),
    ...(Array.isArray(musicRules.examples) ? musicRules.examples : []),
  ];

  const formatMap = templateRules.formats && typeof templateRules.formats === "object"
    ? templateRules.formats
    : {};

  const templates = Object.entries(formatMap).map(([name, job]) => ({
    name: name.toUpperCase(),
    job: String(job),
  }));

  const structured: BrandBrain = {
    ...DEFAULT_BRAND_BRAIN,
    musicPolicy: {
      ...DEFAULT_BRAND_BRAIN.musicPolicy,
      soundPalette: musicPalette.length ? musicPalette : DEFAULT_BRAND_BRAIN.musicPolicy.soundPalette,
      usageRule: [
        DEFAULT_BRAND_BRAIN.musicPolicy.usageRule,
        musicRules.audio_rule ? `Audio rule: ${musicRules.audio_rule}` : "",
        musicRules.avoid ? `Avoid: ${musicRules.avoid}` : "",
      ].filter(Boolean).join(" "),
    },
    voice: {
      ...DEFAULT_BRAND_BRAIN.voice,
      principles: [
        ...(row.mission ? [row.mission] : []),
        ...(row.audience ? [`Audience: ${row.audience}`] : []),
        ...DEFAULT_BRAND_BRAIN.voice.principles,
        ...(Array.isArray(voiceRules.tone) ? voiceRules.tone.map((x: unknown) => `Tone: ${String(x)}`) : []),
        ...(voiceRules.hook_rule ? [`Hook rule: ${voiceRules.hook_rule}`] : []),
      ],
    },
    editorialRules: {
      ...DEFAULT_BRAND_BRAIN.editorialRules,
      currentVsFlashback: seasonalStrategy.core_story ?? DEFAULT_BRAND_BRAIN.editorialRules.currentVsFlashback,
      generalHypeFanRule: clipRules.fan_rule_general ?? DEFAULT_BRAND_BRAIN.editorialRules.generalHypeFanRule,
      rivalryException: clipRules.fan_rule_matchup ?? DEFAULT_BRAND_BRAIN.editorialRules.rivalryException,
      replacementRule: clipRules.replacement_rule ?? DEFAULT_BRAND_BRAIN.editorialRules.replacementRule,
      sourceRule: clipRules.source_rule ?? DEFAULT_BRAND_BRAIN.editorialRules.sourceRule,
      cameraAngleRule: clipRules.angle_rule ?? DEFAULT_BRAND_BRAIN.editorialRules.cameraAngleRule,
      reelLengthRule: templateRules.length_rule ?? DEFAULT_BRAND_BRAIN.editorialRules.reelLengthRule,
      templates: templates.length ? templates : DEFAULT_BRAND_BRAIN.editorialRules.templates,
    },
  };

  return {
    ...structured,
    ...runtime,
    scoringWeights: runtime.scoringWeights ?? structured.scoringWeights,
    seasonalCalendar: runtime.seasonalCalendar ?? structured.seasonalCalendar,
    mediaSourcing: runtime.mediaSourcing ?? structured.mediaSourcing,
    musicPolicy: runtime.musicPolicy ?? structured.musicPolicy,
    penalties: runtime.penalties ?? structured.penalties,
    voice: runtime.voice ?? structured.voice,
    editorialRules: runtime.editorialRules ?? structured.editorialRules,
    slateSize: runtime.slateSize ?? structured.slateSize,
  };
}

export async function getBrandBrain(): Promise<BrandBrain> {
  const db = supabaseAdmin();
  const { data, error } = await db
    .from("brand_brain")
    .select("id, mission, audience, voice_rules, visual_rules, music_rules, clip_selection_rules, seasonal_strategy, template_rules, runtime_config")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  if (!data) return DEFAULT_BRAND_BRAIN;

  return buildBrainFromStructuredRow(data as StructuredBrainRow);
}

export async function updateBrandBrainKey(key: keyof BrandBrain, value: unknown) {
  const db = supabaseAdmin();

  const { data, error: readError } = await db
    .from("brand_brain")
    .select("id, runtime_config")
    .eq("is_active", true)
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (readError) throw readError;
  if (!data) throw new Error("No active Brand Brain row found.");

  const runtimeConfig = {
    ...((data.runtime_config as Record<string, unknown> | null) ?? {}),
    [key]: value,
  };

  const { error } = await db
    .from("brand_brain")
    .update({ runtime_config: runtimeConfig, updated_at: new Date().toISOString() })
    .eq("id", data.id);

  if (error) throw error;
}
