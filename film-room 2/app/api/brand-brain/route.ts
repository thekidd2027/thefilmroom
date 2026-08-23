import { NextRequest, NextResponse } from "next/server";
import { updateBrandBrainKey } from "@/lib/getBrandBrain";
import { BrandBrain } from "@/lib/brandBrain";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (!body.key || body.value === undefined) {
    return NextResponse.json({ error: "key and value are required" }, { status: 400 });
  }
  try {
    await updateBrandBrainKey(body.key as keyof BrandBrain, body.value);
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}
