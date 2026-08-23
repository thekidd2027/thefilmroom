export type ReelStatus =
  | "proposed"
  | "approved"
  | "claimed"
  | "submitted"
  | "changes_requested"
  | "published"
  | "rejected";

export type ClipRef = {
  video_id: string;
  title: string;
  channel_title?: string;
  source_url?: string;
  start_seconds: number;
  end_seconds: number;
  direct_url: string;
  moment: string;
  story_function: string;
  camera_angle?: string;
  rights_note?: string;
  can_replace?: number[];
};

export type MusicOption = {
  title: string;
  artist: string;
  source: string;
  note: string;
  rank: number;
};

export type KeyframeInstruction = {
  at_seconds: number;
  x: number;
  y: number;
  scale: number;
  note: string;
};

export type EditShot = {
  order: number;
  source_video_id: string;
  source_start_seconds: number;
  source_end_seconds: number;
  direct_url: string;
  shot: string;
  purpose: string;
  on_screen_text: string;
  audio_note: string;
  keyframes: KeyframeInstruction[];
};

export type StoryResearch = {
  why_today: string;
  viewer_feeling: string;
  popularity_evidence: string[];
  trend_sources: { label: string; url: string }[];
  fan_allegiance_logic: string;
  seasonal_fit: string;
};

export type ChecklistItem = { key: string; label: string; done: boolean };

export type Editor = {
  id: string;
  display_name: string;
  email: string;
  role: "editor" | "owner";
  auth_user_id: string | null;
  invited_at: string;
  created_at: string;
};

export type Reel = {
  id: string;
  slate_date: string;
  slot: number;
  candidate_id: string | null;
  status: ReelStatus;
  headline: string;
  sport: string;
  predicted_interest: number;
  script: string | null;
  caption: string | null;
  cover_text: string | null;
  edit_notes: EditShot[] | null;
  music_options: MusicOption[] | null;
  clip_primary: ClipRef | null;
  clip_backups: ClipRef[] | null;
  primary_clips?: ClipRef[] | null;
  story_research?: StoryResearch | null;
  template_name?: string | null;
  assigned_to: string | null;
  assigned_at: string | null;
  checklist: ChecklistItem[] | null;
  final_video_url: string | null;
  review_note: string | null;
  published_url: string | null;
  created_at: string;
  updated_at: string;
};

export type Candidate = {
  id: string;
  slate_date: string;
  headline: string;
  sport: string;
  summary: string | null;
  source_urls: string[];
  youtube_video_id: string | null;
  youtube_channel_id: string | null;
  youtube_channel_title: string | null;
  view_count: number | null;
  published_at: string | null;
  score: number | null;
  score_breakdown: Record<string, number> | null;
  selected: boolean;
  rejection_reason: string | null;
  created_at: string;
};
