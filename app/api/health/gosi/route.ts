import { NextRequest, NextResponse } from "next/server";
import { grepGosi } from "../../../../lib/server/eum-gosi";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const maxDuration = 60;

/** 토지이음 고시 원문 검색 (점검용). ?seq=639979&q=정거장|준공 */
export async function GET(request: NextRequest) {
  const seq = (request.nextUrl.searchParams.get("seq") ?? "").replace(/\D/g, "");
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  const files = Math.min(5, Number(request.nextUrl.searchParams.get("files") ?? "3") || 3);
  if (!seq || !q) return NextResponse.json({ error: "seq, q 필요" }, { status: 400 });
  try { return NextResponse.json(await grepGosi(seq, new RegExp(q), files)); }
  catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "실패" }, { status: 502 }); }
}
