-- Run this after the original schema.sql if you already created the database.
alter table reels add column if not exists primary_clips jsonb default '[]'::jsonb;
alter table reels add column if not exists story_research jsonb;
alter table reels add column if not exists template_name text;

alter table performance add column if not exists watch_time_seconds numeric default 0;
alter table performance add column if not exists completion_rate numeric default 0;
alter table performance add column if not exists profile_visits bigint default 0;
alter table performance add column if not exists follows bigint default 0;
alter table performance add column if not exists saves bigint default 0;

create table if not exists editorial_feedback (
  id uuid primary key default uuid_generate_v4(),
  reel_id uuid references reels(id) on delete cascade,
  category text not null,
  note text not null,
  created_at timestamptz not null default now()
);
alter table editorial_feedback enable row level security;
do $$ begin
  create policy "authenticated read/write editorial_feedback" on editorial_feedback
    for all using (auth.role() = 'authenticated') with check (auth.role() = 'authenticated');
exception when duplicate_object then null; end $$;
