import { NextRequest, NextResponse } from "next/server";
import { decisionKeywords, listDecisionGosi, scanGosiForParcel, eumUnavailable } from "../../../lib/server/eum-gosi";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

/**
 * 최신 결정고시 자동 적용용 단계 API.
 *  - {step:"list", address, names}       → 관련 고시 목록(최신순)
 *  - {step:"scan", seq, place, lot, label} → 고시 1건에서 지번의 가구·획지와 건축물 결정내용
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { step?: string; address?: string; names?: string[]; seq?: string; place?: string; lot?: string; label?: string | null } | null;
  if (!body?.step) return NextResponse.json({ error: "step 필요" }, { status: 400 });
  const down = eumUnavailable();
  if (down) return NextResponse.json({ error: down }, { status: 503 });
  try {
    if (body.step === "list") {
      const keywords = decisionKeywords(String(body.address ?? ""), Array.isArray(body.names) ? body.names.map(String) : []);
      return NextResponse.json({ keywords, rows: await listDecisionGosi(keywords) });
    }
    if (body.step === "scan") {
      if (!/^\d+$/.test(String(body.seq)) || !body.place || !body.lot) return NextResponse.json({ error: "seq·place·lot 필요" }, { status: 400 });
      return NextResponse.json(await scanGosiForParcel(String(body.seq), String(body.place), String(body.lot), body.label ? String(body.label) : null));
    }
    return NextResponse.json({ error: "알 수 없는 step" }, { status: 400 });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "토지이음 조회 실패" }, { status: 502 });
  }
}
