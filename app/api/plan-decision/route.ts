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
  // 브라우저가 내려받은 HWP/HWPX/PDF 첨부의 텍스트 추출 (토지이음 접속 없음)
  if (request.nextUrl.searchParams.get("step") === "text") {
    const form = await request.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) return NextResponse.json({ error: "file 필요" }, { status: 400 });
    const data = new Uint8Array(await file.arrayBuffer());
    const ext = (file.name.split(".").pop() ?? "").toLowerCase();
    try {
      if (ext === "hwp") { const { extractHwpText } = await import("../../../lib/server/hwp"); return NextResponse.json({ text: await extractHwpText(data) }); }
      if (ext === "hwpx" || ext === "pdf") { const { extractDocumentText } = await import("../../../lib/server/document-parser"); return NextResponse.json({ text: (await extractDocumentText(data, ext, 2_000_000)).text }); }
      return NextResponse.json({ error: "지원하지 않는 형식" }, { status: 415 });
    } catch (e) { return NextResponse.json({ error: e instanceof Error ? e.message : "추출 실패" }, { status: 422 }); }
  }
  const body = await request.json().catch(() => null) as { step?: string; address?: string; names?: string[]; keywords?: string[]; seq?: string; place?: string; lot?: string; label?: string | null } | null;
  if (!body?.step) return NextResponse.json({ error: "step 필요" }, { status: 400 });
  const down = eumUnavailable();
  if (down) return NextResponse.json({ error: down }, { status: 503 });
  try {
    if (body.step === "list") {
      const override = Array.isArray(body.keywords) ? body.keywords.map(String).filter(Boolean) : [];
      const keywords = override.length ? override : decisionKeywords(String(body.address ?? ""), Array.isArray(body.names) ? body.names.map(String) : []);
      return NextResponse.json({ keywords, rows: await listDecisionGosi(keywords, override.length ? 6 : 3) });
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
