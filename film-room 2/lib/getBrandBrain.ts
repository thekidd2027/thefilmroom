import { supabaseAdmin } from "./supabaseServer";
import { BrandBrain, DEFAULT_BRAND_BRAIN } from "./brandBrain";

const KEYS: (keyof BrandBrain)[] = [
  "scoringWeights",
  "seasonalCalendar",
  "mediaSourcing",
  "musicPolicy",
  "penalties",
  "voice",
  "editorialRules",
  "slateSize",
];

export async function getBrandBrain(): Promise<BrandBrain> {
  const db = supabaseAdmin();
  const { data, error } = await db.from("brand_brain").select("key, value");
  if (error) throw error;

  const result = { ...DEFAULT_BRAND_BRAIN };
  const found = new Map((data ?? []).map((row) => [row.key, row.value]));

  if (found.size === 0) {
    // First run — seed the table with defaults so /brand-brain has
    // something to display and edit.
    await db.from("brand_brain").insert(
      KEYS.map((key) => ({
        key,
        label: key,
        value: DEFAULT_BRAND_BRAIN[key],
      }))
    );
    return DEFAULT_BRAND_BRAIN;
  }

  for (const key of KEYS) {
    if (found.has(key)) {
      (result as any)[key] = found.get(key);
    }
  }
  return result;
}

export async function updateBrandBrainKey(key: keyof BrandBrain, value: unknown) {
  const db = supabaseAdmin();
  const { error } = await db
    .from("brand_brain")
    .upsert({ key, label: key, value, updated_at: new Date().toISOString() });
  if (error) throw error;
}
