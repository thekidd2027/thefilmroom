import { BrandBrain } from "./brandBrain";
import { ChecklistItem, EditShot } from "./types";

export function buildChecklist(brandBrain: BrandBrain, editShots: EditShot[] | null): ChecklistItem[] {
  const items: ChecklistItem[] = [
    { key: "read_story", label: "Read WHY TODAY + viewer feeling before editing", done: false },
    { key: "open_sources", label: "Open every source from its timestamped link and visually verify the AI-selected moment", done: false },
    { key: "rights", label: "Review each source's rights note; public availability is not the same as repost permission", done: false },
  ];
  (editShots ?? []).forEach((shot, i) => items.push({
    key:`shot_${i}`, label:`Shot ${i+1}: ${shot.shot} — ${shot.purpose}`, done:false
  }));
  items.push(
    { key:"crop", label:"Use 9:16 Film Room template; follow keyframes so the important action stays framed", done:false },
    { key:"grade", label:"Apply the consistent Film Room grade/frame; no random extra effects", done:false },
    { key:"music", label:"Choose one of the 3 approved song directions; use platform-licensed audio where available", done:false },
    { key:"audio", label:"Preserve crowd/commentator audio where the recipe calls for it", done:false },
    { key:"copy", label:"Use the approved on-screen words and caption exactly unless you request a change", done:false },
    { key:"export", label:"Export vertical 1080×1920 MP4 and upload it below", done:false }
  );
  return items;
}
