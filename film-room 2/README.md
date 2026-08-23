# Film Room — AI Sports Newsroom Portal

This is the full MVP portal for the Film Room college-sports media workflow.

The goal is not “AI makes random highlights.” The system acts like an editor-in-chief: it researches what fans/media care about today, checks the season/calendar, finds source videos, pulls timestamped transcripts, visually inspects shorter videos for camera angles, builds a story, gives exact timestamped YouTube links, creates 3 replacements, recommends 3 on-brand songs, writes CapCut keyframes/on-screen words/caption, assigns work to editors, accepts the finished MP4, and stores your feedback/performance for later learning.

## What is included

- **Today** — Generate Today’s Slate and approve/reject proposed reels.
- **AI trend research** — OpenAI Responses API + web search researches current college football/basketball conversation, scores/results, rankings, upcoming games, media coverage and timely flashback hooks.
- **YouTube discovery** — YouTube Data API finds candidate source videos and provides views/likes/comments/duration.
- **Automatic transcripts** — Supadata fetches or generates timestamped transcripts.
- **Visual video inspection** — Supadata Extract analyzes what is actually seen/heard in shorter public source videos, including camera angle, reaction footage and vertical-crop usefulness.
- **Grounded Reel Recipe** — AI is instructed never to invent timestamps. It selects 4–7 primary clips in story order plus exactly 3 replacements.
- **Direct timestamp links** — every clip opens YouTube at the exact selected source time.
- **Fan-allegiance logic** — general hype reels avoid celebrating a fanbase and later embarrassing that same fanbase; matchup/rivalry reels allow conflict because conflict is the story.
- **Alternate angles** — the source step looks across multiple videos and can use setup/action/replay/reaction angles when that improves the story.
- **Editing recipe** — exact source windows, on-screen words, audio notes and CapCut 9:16 keyframe instructions.
- **Music recipe** — exactly 3 ranked songs in the Film Room sound palette: vintage soul, classic rock/Fleetwood Mac-type nostalgia, Remember the Titans-style score, Americana, and occasional tasteful country. Commercial tracks are creative suggestions for use through platform-licensed music libraries where available; the portal does not claim sync rights.
- **Editors** — invite editors, assign or self-claim jobs, complete checklist, upload final MP4.
- **Review** — preview upload, request changes, store your editorial feedback, mark published.
- **Archive + performance** — enter views, likes, comments, shares, saves, watch time, completion, profile visits and follows.
- **Brand Brain** — editable permanent rules the AI reads every generation.
- **Setup** — shows whether all required environment variables are configured without exposing secrets.
- **Auth** — email magic-link sign in through Supabase; portal routes are protected.

## Services / API keys you need

### 1. Supabase
Used for Postgres database, login/authentication and private MP4 storage.

1. Create a project at Supabase.
2. Project Settings → API: copy Project URL, anon/public key and service-role key.
3. SQL Editor: for a brand-new database run **`supabase/schema.sql`**.
4. If you already ran the original Film Room schema, run **`supabase/migration_002_full_portal.sql`** instead.
5. Storage → create a **private** bucket named exactly `reels`.
6. Authentication → Email should be enabled.
7. For your first owner account, create your user in Supabase Authentication, then add a matching row to `editors` with role `owner` (or invite yourself through the app after the first login is configured).

### 2. OpenAI API
Used for current web research, editorial ranking, story construction, clip selection and the final Reel Recipe.

The project uses the **Responses API**, which is the current OpenAI API path for model requests and built-in tools such as web search. Default model is `gpt-5.6-terra` to balance quality and cost; change `OPENAI_MODEL` / `OPENAI_RESEARCH_MODEL` if desired.

### 3. YouTube Data API v3
Used only to search public YouTube videos and retrieve metadata/statistics. It does **not** download video.

Google Cloud → enable YouTube Data API v3 → create API key.

### 4. Supadata
This is the key that removes the manual transcript step.

The app uses Supadata to:
- fetch/generate timestamped transcripts;
- visually inspect shorter public videos using its Extract endpoint;
- ground exact clip times and camera-angle decisions.

Create a Supadata account/API key and add `SUPADATA_API_KEY`.

## Environment variables

Copy `.env.example` to `.env.local`:

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
OPENAI_API_KEY=
OPENAI_MODEL=gpt-5.6-terra
OPENAI_RESEARCH_MODEL=gpt-5.6-terra
YOUTUBE_API_KEY=
SUPADATA_API_KEY=
```

## Run locally

```bash
npm install
cp .env.example .env.local
# fill in keys
npm run dev
```

Open `http://localhost:3000` and sign in through `/login`.

## Deploy

Vercel is the simplest option:

1. Push this folder to GitHub.
2. Import the repo into Vercel.
3. Add every variable from `.env.example` in Vercel → Settings → Environment Variables.
4. Deploy.
5. In Supabase Authentication URL configuration, add your deployed domain and `${YOUR_DOMAIN}/auth/callback` as allowed redirect URLs.

## How Generate Today’s Slate works

1. **Research** — OpenAI web search looks at the current CFB/CBB conversation and returns ten story candidates with “why today,” popularity evidence, source links and YouTube search queries.
2. **Source discovery** — YouTube API finds multiple videos for each story and retrieves real engagement metadata.
3. **Source scoring** — AI + deterministic scoring rank source usefulness, popularity, current relevance, story value, brand fit and vertical viability. Rights uncertainty is surfaced rather than hidden.
4. **Story selection** — top stories become the slate.
5. **Transcript + visual inspection** — Supadata analyzes the top source videos. Very long compilations may be transcript-only; shorter videos can receive visual inspection for angle/reaction/crop quality.
6. **Editorial construction** — AI chooses the actual clips in story order, applies fan-allegiance logic, searches across available angles, includes exactly three replacements and creates exact timestamp links.
7. **Recipe** — the editor receives the story purpose, clips, replacements, CapCut keyframes, on-screen words, audio notes, three songs, caption and checklist.
8. **Human edit** — editor executes; AI does not replace taste in the final timeline.
9. **Owner review** — approve/request changes/publish.
10. **Learning data** — feedback and performance are saved so the next iteration can eventually be optimized against your own account rather than generic internet assumptions.

## Important footage-rights note

The portal distinguishes **source discovery** from **permission to republish**. A public ESPN/NCAA/team YouTube link can be useful editorial research, but public availability is not itself a license. Every selected source includes a rights note so the owner/editor can decide whether the planned use has permission, a license, platform reuse authorization, or another defensible basis. The software never labels public broadcast footage “safe” merely because it found it online.

## What this MVP deliberately does not automate yet

- It does not download/screen-record YouTube footage for you.
- It does not automatically post to Instagram/YouTube.
- It does not automatically pull Instagram analytics because that requires connecting the appropriate Meta account/API permissions.
- It does not automatically edit the final video; your editors remain the last creative layer in CapCut/Premiere.

Those are intentional. The highest-value automation first is **what to post + why + exactly which footage + how to edit it**, because that is the editorial brain that determines whether the page feels like a brand instead of a content farm.
