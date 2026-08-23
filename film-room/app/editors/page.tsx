import { redirect } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabaseServer";
import { Editor } from "@/lib/types";
import { requireOwner } from "@/lib/requireOwner";
import InviteEditorForm from "@/components/InviteEditorForm";

export const dynamic = "force-dynamic";

export default async function EditorsPage() {
  try {
    await requireOwner();
  } catch {
    redirect("/today");
  }

  const db = supabaseAdmin();
  const { data: editors } = await db.from("editors").select("*").order("created_at");
  const list = (editors ?? []) as Editor[];

  return (
    <div className="p-8 max-w-3xl space-y-8">
      <div>
        <div className="label-eyebrow mb-2">FILM ROOM / ACCESS CONTROL</div>
        <h1 className="font-display text-3xl tracking-wide mb-2">EDITORS</h1>
        <p className="text-dim text-sm max-w-xl">
          Create editor access here. Each editor receives a one-time setup email, chooses their own password, then uses normal email + password sign-in from that point forward.
        </p>
      </div>

      <div className="panel p-5">
        <div className="label-eyebrow mb-4">Add an editor</div>
        <InviteEditorForm />
      </div>

      <div className="space-y-3">
        {list.map((editor) => (
          <div key={editor.id} className="panel p-4 flex items-center justify-between gap-4">
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
