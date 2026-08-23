import { supabaseAdmin } from "@/lib/supabaseServer";
import { Editor } from "@/lib/types";
import InviteEditorForm from "@/components/InviteEditorForm";

export const dynamic = "force-dynamic";

export default async function EditorsPage() {
  const db = supabaseAdmin();
  const { data: editors } = await db.from("editors").select("*").order("created_at");
  const list = (editors ?? []) as Editor[];

  return (
    <div className="p-8 max-w-2xl space-y-8">
      <div>
        <h1 className="font-display text-3xl tracking-wide mb-2">EDITORS</h1>
        <p className="text-dim text-sm">
          Add the people helping you edit. They get a real login invite and can claim or be
          assigned reels from Today.
        </p>
      </div>

      <div className="panel p-4">
        <div className="label-eyebrow mb-3">Invite an editor</div>
        <InviteEditorForm />
      </div>

      <div className="space-y-2">
        {list.map((editor) => (
          <div key={editor.id} className="panel p-3 flex items-center justify-between">
            <div>
              <div className="font-medium">{editor.display_name}</div>
              <div className="text-dim text-sm">{editor.email}</div>
            </div>
            <span className="label-eyebrow">{editor.role}</span>
          </div>
        ))}
        {list.length === 0 && <div className="panel p-8 text-center text-dim">No editors yet.</div>}
      </div>
    </div>
  );
}
