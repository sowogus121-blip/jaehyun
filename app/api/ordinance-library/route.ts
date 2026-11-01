import { NextRequest, NextResponse } from "next/server";
import {
  METRO_ORDINANCE_CATALOG_UPDATED_AT,
  METRO_ORDINANCE_RULES,
  METRO_ORDINANCE_SOURCES,
  findMetroOrdinanceRules,
  findMetroOrdinanceSource,
} from "../../../lib/metro-ordinance-catalog";

/**
 * Read-only, versioned ordinance evidence API.
 * No address geocoding or automatic permission/relaxation approval is performed.
 * Examples:
 * GET /api/ordinance-library
 * GET /api/ordinance-library?address=경기도%20파주시%20파주읍%20봉암리%201343-2
 * GET /api/ordinance-library?region=경기
 */
export async function GET(request: NextRequest) {
  const params = request.nextUrl.searchParams;
  const address = (params.get("address") ?? "").trim().slice(0,256);
  const region = (params.get("region") ?? "").trim();
  if (region && !["서울","경기","인천"].includes(region)) return NextResponse.json({error:"region은 서울·경기·인천 중 하나여야 합니다."}, {status:400});
  const sourceForAddress = address ? findMetroOrdinanceSource(address) : null;
  const sources = METRO_ORDINANCE_SOURCES.filter(x =>
    (!region || x.region === region) && (!address || x.city === sourceForAddress?.city));
  const rules = address
    ? findMetroOrdinanceRules(address).filter(x => sources.some(s=>s.city===x.city))
    : METRO_ORDINANCE_RULES.filter(x=>sources.some(s=>s.city===x.city));
  return NextResponse.json({
    status:"research-evidence-only",
    updatedAt:METRO_ORDINANCE_CATALOG_UPDATED_AT,
    lastVerifiedScope:"city-clause-or-source-index",
    automaticApplication:false,
    scope:{region:region||null,address:address||null,matchedCity:sourceForAddress?.city??null},
    counts:{cities:sources.length,rules:rules.length,clauseChecked:rules.filter(r=>r.evidence==="clause-checked").length,currentRecheck:rules.filter(r=>r.evidence==="needs-current-recheck").length,sourceIndexed:rules.filter(r=>r.evidence==="source-indexed").length},
    warnings:["지구단위계획·용도제한·지역별 별표와 LH 공고별 요건은 필지 단위로 별도 확인해야 합니다.","개정 시행일 이후 조문이 변경될 수 있으므로 설계 인허가 전 최신 원문을 반드시 대조하세요."],
    sources,rules,
  }, {headers:{"Cache-Control":"public, max-age=300, s-maxage=1800"}});
}
