-- Film Room schema
-- Run this once in Supabase: Project -> SQL Editor -> New query -> paste -> Run.

create extension if not exists "uuid-ossp";

-- ---------------------------------------------------------------------------
-- Brand Brain: the permanent rule set the AI must follow. One row per rule
-- "block" so the Brand Brain page can edit them independently. The app also
-- ships a hardcoded default (lib/brandBrain.ts) used to seed this table and
-- as a fallback if a key is missing.
-- ---------------------------------------------------------------------------
create table if not exists brand_brain (
  key text primary key,              -- e.g. 'scoring_weights', 'media_sourcing', 'music_policy'
  label text not null,               -- human-readable name shown in the UI
  value jsonb not null,              -- the actual rule payload
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Candidate stories the discovery step finds before scoring. Kept even for
-- stories that don't make the slate, so the scoring model can be reviewed
-- and tuned later against what it passed on.
-- ---------------------------------------------------------------------------
create table if not exists candidates (
  id uuid primary key default uuid_generate_v4(),
  slate_date date not null,
  headline text not null,
  sport text not null,               -- 'football' | 'basketball' | 'baseball' | ...
  summary text,
  source_urls text[] default '{}',
  youtube_video_id text,             -- only ever a licensable/allowed source (see media_sourcing rule)
  youtube_channel_id text,
  youtube_channel_title text,
  view_count bigint,
  published_at timestamptz,
  score numeric,                     -- final weighted score (0-10)
  score_breakdown jsonb,             -- per-criterion sub-scores, for transparency
  selected boolean default false,    -- true if it made today's slate
  rejection_reason text,
  created_at timestamptz not null default now()
);

create index if not exists candidates_slate_date_idx on candidates (slate_date);

-- ---------------------------------------------------------------------------
-- Reels: one row per assignment, from "AI proposed it" through "published".
-- ---------------------------------------------------------------------------
create type reel_status as enum (
  'proposed',        -- AI generated, awaiting your approve/reject on Today
  'approved',        -- you approved the story+recipe, open for an editor to claim
  'claimed',         -- an editor is working it
  'submitted',       -- editor uploaded a finished MP4, awaiting review
  'changes_requested',
  'published',
  'rejected'
);

create table if not exists reels (
  id uuid primary key default uuid_generate_v4(),
  slate_date date not null,
  slot int not null,                       -- 1-4, position in the day's dose
  candidate_id uuid references candidates(id),
  status reel_status not null default 'proposed',
  headline text not null,
  sport text not null,
  predicted_interest numeric,              -- 0-10, shown as the "9.4/10" badge
  script text,                             -- narration / VO script the AI wrote
  caption text,                            -- IG/TikTok caption copy
  cover_text text,                         -- small on-frame title for the cover
  edit_notes jsonb,                        -- structured shot list: [{shot, start, end, purpose}]
  music_options jsonb,                     -- [{title, artist, license, note}] — royalty-free only
  clip_primary jsonb,                      -- {video_id, start, end, title}
  clip_backups jsonb,                      -- array of same shape
  assigned_to uuid,                        -- references editors(id); set by owner OR by self-claim
  assigned_at timestamptz,
  checklist jsonb,                         -- [{key, label, done}] generated at approval time
  final_video_url text,                    -- storage path once uploaded
  review_note text,
  published_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists reels_slate_date_idx on reels (slate_date);
create index if not exists reels_status_idx on reels (status);
create index if not exists reels_assigned_to_idx on reels (assigned_to);

-- ---------------------------------------------------------------------------
-- Editors who can be assigned reels, claim them, and upload finished MP4s.
-- Created by the owner from /editors, which sends a real Supabase Auth
-- invite email so they can log in themselves.
-- ---------------------------------------------------------------------------
create table if not exists editors (
  id uuid primary key default uuid_generate_v4(),
  auth_user_id uuid references auth.users(id) on delete set null,
  display_name text not null,
  email text unique not null,
  role text not null default 'editor',   -- 'editor' | 'owner'
  invited_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

alter table reels
  add constraint reels_assigned_to_fkey foreign key (assigned_to) references editors(id) on delete set null;

-- ---------------------------------------------------------------------------
-- Performance, fed back in after publishing so scoring can be tuned later.
-- ---------------------------------------------------------------------------
create table if not exists performance (
  reel_id uuid primary key references reels(id) on delete cascade,
  views bigint default 0,
  likes bigint default 0,
  comments bigint default 0,
  shares bigint default 0,
  saved bigint default 0,
  measured_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Row Level Security. MVP posture: any authenticated user (i.e. any logged-in
-- editor/owner) can read/write. Tighten per-role once you have real staff.
-- ---------------------------------------------------------------------------
alter table brand_brain enable row level security;
alter table candidates enable row level security;
alter table reels enable row level security;
alter table editors enable row level security;
alter table performance enable row level security;

create policy "authenticated read/write brand_brain" on brand_brain
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write candidates" on candidates
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write reels" on reels
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write editors" on editors
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
create policy "authenticated read/write performance" on performance
  for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');

-- ---------------------------------------------------------------------------
-- Storage bucket for finished MP4 uploads. Create the bucket via the
-- Supabase dashboard (Storage -> New bucket -> "reels", private), then run:
-- ---------------------------------------------------------------------------
-- insert into storage.buckets (id, name, public) values ('reels', 'reels', false)
--   on conflict (id) do nothing;

-- Film Room intelligence layer additions
alter table reels add column if not exists primary_clips jsonb default '[]'::jsonb;
alter table reels add column if not exists story_research jsonb;
alter table reels add column if not exists template_name text;
alter table performance add column if not exists watch_time_seconds numeric default 0;
alter table performance add column if not exists completion_rate numeric default 0;
alter table performance add column if not exists profile_visits bigint default 0;
alter table performance add column if not exists follows bigint default 0;
alter table performance add column if not exists saves bigint default 0;
create table if not exists editorial_feedback (
  id uuid primary key default uuid_generate_v4(), reel_id uuid references reels(id) on delete cascade,
  category text not null, note text not null, created_at timestamptz not null default now()
);
alter table editorial_feedback enable row level security;
do $$ begin
  create policy "authenticated read/write editorial_feedback" on editorial_feedback
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
