import { supabaseAdmin } from "@/lib/supabaseServer";
import { Reel, Editor, ClipRef } from "@/lib/types";
import { notFound } from "next/navigation";
import { StatusPill, ScoreBadge } from "@/components/Badges";
import AssignPicker from "@/components/AssignPicker";
import ChecklistBox from "@/components/ChecklistBox";
import UploadBox from "@/components/UploadBox";
import PerformanceForm from "@/components/PerformanceForm";

export const dynamic = "force-dynamic";

export default async function ReelJobPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const db = supabaseAdmin();

  const [{ data: reel }, { data: editors }, { data: performance }] = await Promise.all([
    db.from("reels").select("*").eq("id", id).single(),
    db.from("editors").select("*").order("display_name"),
    db.from("performance").select("*").eq("reel_id", id).maybeSingle(),
  ]);

  if (!reel) notFound();

  const r = reel as Reel;
  const editorList = (editors ?? []) as Editor[];
  const sr = r.story_research;
  const clips = r.primary_clips ?? (r.clip_primary ? [r.clip_primary] : []);
  const firstClip = clips[0];

  return (
    <div className="p-6 md:p-8 max-w-4xl space-y-5">
      <div>
        <div className="label-eyebrow mb-1">
          Reel Job · Slot {r.slot} · {r.template_name ?? ""}
        </div>
        <div className="flex items-start justify-between gap-4">
          <h1 className="font-display text-2xl tracking-wide">{r.headline}</h1>
          <ScoreBadge score={r.predicted_interest} />
        </div>
        <div className="mt-2 flex gap-2">
          <StatusPill status={r.status} />
          <span className="text-dim text-sm capitalize">{r.sport}</span>
        </div>
      </div>

      {sr && (
        <Section title="Story">
          <p className="font-medium">{sr.why_today}</p>
          <p className="text-dim text-sm mt-2">Viewer should feel: {sr.viewer_feeling}</p>
          <p className="text-dim text-sm mt-2">Fan logic: {sr.fan_allegiance_logic}</p>
          {sr.popularity_evidence?.length > 0 && (
            <ul className="mt-3 text-sm list-disc pl-5">
              {sr.popularity_evidence.map((x, i) => <li key={i}>{x}</li>)}
            </ul>
          )}
          {sr.trend_sources?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {sr.trend_sources.map((x, i) => (
                <a key={i} href={x.url} target="_blank" rel="noreferrer" className="text-wire text-xs hover:underline">
                  {x.label}
                </a>
              ))}
            </div>
          )}
        </Section>
      )}

      <Section title="Primary YouTube source">
        {firstClip ? (
          <div className="rounded-[1.4rem] border border-rule bg-white/70 p-4">
            <div className="font-medium">{firstClip.title}</div>
            <div className="text-dim text-sm mt-1">{firstClip.channel_title}</div>
            <a
              target="_blank"
              rel="noreferrer"
              href={firstClip.source_url || firstClip.direct_url}
              className="btn-ghost inline-block mt-3"
            >
              Open full YouTube source
            </a>

            <div className="mt-5 label-eyebrow">TIMESTAMP PLAN · KEEP ANNOUNCER AUDIO</div>
            <div className="space-y-2 mt-2">
              {clips.map((clip, i) => <ClipCard key={i} clip={clip} index={i + 1} />)}
            </div>
          </div>
        ) : (
          <div className="text-dim text-sm">No grounded source yet.</div>
        )}
      </Section>

      <Section title="Edit recipe">
        <ol className="space-y-4">
          {(r.edit_notes ?? []).map((s, i) => (
            <li key={i} className="text-sm border-b border-rule/60 pb-3 last:border-0">
              <div className="font-medium">{s.order}. {s.shot}</div>
              <a className="text-wire font-mono text-xs" target="_blank" rel="noreferrer" href={s.direct_url}>
                Open source at exact timestamp
              </a>
              <div className="text-dim mt-1">{s.purpose}</div>
              {s.on_screen_text && (
                <div className="mt-1">
                  Text: <span className="font-medium">{s.on_screen_text}</span>
                </div>
              )}
              <div className="mt-1 text-dim">
                Audio: {s.audio_note || "KEEP ORIGINAL ANNOUNCER AUDIO; music low underneath."}
              </div>
            </li>
          ))}
        </ol>
      </Section>

      <Section title="3 song options">
        <div className="space-y-2">
          {(r.music_options ?? []).map((m, i) => (
            <div key={i} className="text-sm">
              <span className="font-medium">#{m.rank} {m.title}</span> — {m.artist}
              <div className="text-dim">{m.note}</div>
            </div>
          ))}
        </div>
      </Section>

      <Section title="Words + caption">
        <div className="text-sm">
          <div><span className="text-dim">Cover:</span> {r.cover_text || "—"}</div>
          <div className="mt-1"><span className="text-dim">Caption:</span> {r.caption || "—"}</div>
        </div>
      </Section>

      <Section title="Assignment">
        <AssignPicker reelId={r.id} editors={editorList} currentEditorId={r.assigned_to} />
      </Section>

      <Section title="Editor checklist">
        <ChecklistBox reelId={r.id} items={r.checklist ?? []} />
      </Section>

      <Section title="Upload finished MP4">
        <UploadBox reelId={r.id} existingPath={r.final_video_url} />
      </Section>

      {r.status === "published" && (
        <Section title="Performance feedback">
          <PerformanceForm reelId={r.id} initial={performance} />
        </Section>
      )}
    </div>
  );
}

function fmt(sec: number) {
  const value = Math.max(0, Math.floor(sec || 0));
  const minutes = Math.floor(value / 60);
  return `${minutes}:${String(value % 60).padStart(2, "0")}`;
}

function ClipCard({ clip, index }: { clip: ClipRef; index: number }) {
  return (
    <div className="bg-bay2 border border-rule rounded-[1rem] p-3 text-sm">
      <div className="flex justify-between gap-3">
        <div>
          <span className="font-mono text-dim mr-2">{index}</span>
          <span className="font-medium">{fmt(clip.start_seconds)}–{fmt(clip.end_seconds)}</span>
          <span className="text-dim ml-2">{clip.moment || clip.story_function}</span>
        </div>
        <a target="_blank" rel="noreferrer" href={clip.direct_url} className="btn-ghost shrink-0">
          Open @ {fmt(clip.start_seconds)}
        </a>
      </div>
      <div className="mt-1 text-dim">{clip.story_function}</div>
      {clip.rights_note && <div className="mt-1 text-xs text-signal">Rights: {clip.rights_note}</div>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="panel p-4">
      <div className="label-eyebrow mb-2">{title}</div>
      {children}
    </div>
  );
}
