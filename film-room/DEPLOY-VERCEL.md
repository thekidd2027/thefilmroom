# Film Room — Vercel deployment

Use these Vercel settings:

- Framework Preset: **Next.js**
- Root Directory: **film-room** if you upload the whole folder to the repository, OR `./` if you upload the contents of `film-room` directly to the repo root.
- Build Command: leave Override **off**
- Output Directory: leave Override **off / blank**
- Install Command: leave Override **off**

Required public environment variables:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Other server-side variables used by the portal as features are enabled:

- `SUPABASE_SERVICE_ROLE_KEY`
- `OPENAI_API_KEY`
- `YOUTUBE_API_KEY`
- `SUPADATA_API_KEY`

Do not name the app folder with spaces. The included folder is `film-room`.
