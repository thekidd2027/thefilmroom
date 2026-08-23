import { NextRequest, NextResponse } from "next/server";
import { updateBrandBrainKey } from "@/lib/getBrandBrain";
import { BrandBrain } from "@/lib/brandBrain";
import { requireOwner } from "@/lib/requireOwner";

export async function POST(req: NextRequest) {
  try {
    await requireOwner();
    const body = await req.json().catch(() => ({}));
    if (!body.key || body.value === undefined) {
      return NextResponse.json({ error: "key and value are required" }, { status: 400 });
    }
    await updateBrandBrainKey(body.key as keyof BrandBrain, body.value);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    const status = e?.message === "UNAUTHORIZED" ? 401 : e?.message === "FORBIDDEN" ? 403 : 500;
    return NextResponse.json({ error: status === 401 ? "Please sign in again." : status === 403 ? "Owner access required." : e?.message ?? "Brand Brain update failed" }, { status });
  }
}
