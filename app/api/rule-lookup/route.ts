import { NextRequest, NextResponse } from "next/server";
import { fetchLawPayload, lawGovernmentFromAddress, searchLaw, searchOrdinance } from "../../../lib/server/law-api";
import { findArticlesByKeyword } from "../../../lib/server/ordinance-articles";
import { fetchOrdinanceElis, searchOrdinanceElis } from "../../../lib/server/elis";

export const runtime = "nodejs";
// 국내 공공 시스템(법령·ELIS·VWorld) 접근 안정성: 서울 리전 우선
export const preferredRegion = "icn1";

/**
 * 법규검토표 행별 근거 보완 탐색.
 * 관할 조례(또는 국가법령) 본문에서 검색어가 포함된 조문을 원문 그대로 돌려준다.
 * 결과는 후보이며, 검토자가 조문을 선택해 행 근거로 붙인 뒤 상태를 확정한다.
 */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { address?: string; source?: string; terms?: string[] } | null;
  const address = body?.address?.trim();
  const source = body?.source?.trim();
  const terms = (body?.terms ?? []).map((t) => String(t).trim()).filter(Boolean).slice(0, 6);
  if (!address || !source || !terms.length) return NextResponse.json({ error: "주소·검색 대상·검색어가 필요합니다." }, { status: 400 });
  const oc = process.env.LAW_OPEN_API_OC?.trim() ?? "";
  if (!oc && source.startsWith("법령:")) return NextResponse.json({ error: "LAW_OPEN_API_OC 서버 환경변수가 설정되지 않았습니다." }, { status: 503 });
  try {
    if (source.startsWith("법령:")) {
      const name = source.slice(3);
      const law = await searchLaw(name, oc);
      if (!law) return NextResponse.json({ results: [] });
      const payload = await fetchLawPayload("law", law, oc);
      return NextResponse.json({ results: [{ title: law.name, url: law.link, effectiveDate: law.enforcementDate, articles: findArticlesByKeyword(payload, terms) }] });
    }
    const government = lawGovernmentFromAddress(address);
    const parts = government.split(/\s+/).filter(Boolean);
    const jurisdictions = [government];
    if (/(?:특별시|광역시|특별자치시)$/.test(parts[0] ?? "") && parts.length > 1) jurisdictions.push(parts[0]);
    const results = [];
    for (const jurisdiction of jurisdictions) {
      const district = jurisdiction.split(/\s+/).at(-1) ?? jurisdiction;
      const query = `${jurisdiction === government ? district : jurisdiction} ${source}`;
      // 국가법령정보센터 우선, 점검·장애 시 자치법규정보시스템(ELIS) 대체
      let lawCenterDown = !oc;
      const ordinance = oc ? await searchOrdinance(query, oc, jurisdiction).catch(() => { lawCenterDown = true; return null; }) : null;
      if (ordinance) {
        try {
          const payload = await fetchLawPayload("ordin", ordinance, oc);
          results.push({ title: ordinance.name, url: ordinance.link, effectiveDate: ordinance.enforcementDate, articles: findArticlesByKeyword(payload, terms) });
          continue;
        } catch { lawCenterDown = true; }
      }
      if (!lawCenterDown) continue;
      const alt = await searchOrdinanceElis(query, jurisdiction).catch(() => null);
      if (!alt?.elis) continue;
      const got = await fetchOrdinanceElis(alt.elis.alrNo, alt.elis.histNo);
      results.push({ title: alt.name + " (ELIS)", url: got.link, effectiveDate: got.enforcementDate, articles: findArticlesByKeyword(got.payload, terms) });
    }
    return NextResponse.json({ results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "조회 실패" }, { status: 502 });
  }
}
