import { NextRequest, NextResponse } from "next/server";
import {
  METRO_ORDINANCE_CATALOG_UPDATED_AT,
  METRO_ORDINANCE_RULES,
  METRO_ORDINANCE_SOURCES,
  findMetroOrdinanceRules,
  findMetroOrdinanceSource,
} from "../../../lib/metro-ordinance-catalog";
import { METRO_ANNEX_RECORDS, LH_PURCHASE_NOTICES, LH_GUIDELINE_EVIDENCE, findMetroAnnexRecords, findLhPurchaseNotice, findLhGuidelines, matchLhRegion, noticeIsOpen, koreaLocalDay } from "../../../lib/metro-annex-lh-catalog";
import { DISTRICT_PLAN_SOURCES, DISTRICT_PLAN_DISCOVERY, findDistrictPlanEvidence } from "../../../lib/district-plan-sources";
import { NATIONAL_SCREENING_RULES, NATIONAL_SCREENING_UPDATED } from "../../../lib/national-screening-rules";

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
  const lhRegion = address?matchLhRegion(address):null;
  const lhNotices = address
    ? (findLhPurchaseNotice(address)?[findLhPurchaseNotice(address)!]:[])
    : LH_PURCHASE_NOTICES.filter(x=>!region || region==="서울"&&x.region==="서울" || region==="인천"&&x.region==="인천·부천" || region==="경기"&&x.region!=="서울");
  const annexes = address ? findMetroAnnexRecords(address).filter(x=>sources.some(s=>s.city===x.city))
    : METRO_ANNEX_RECORDS.filter(x=>sources.some(s=>s.city===x.city));
  const guidelines = address ? findLhGuidelines(address)
    : LH_GUIDELINE_EVIDENCE.filter(x=>!region || x.applicableRegions.some(y=>region==="서울"&&y==="서울" || region==="인천"&&y==="인천·부천" || region==="경기"&&y!=="서울"));
  const cityPlans=address
    ? findDistrictPlanEvidence(address,{includeCitySources:true})
    : DISTRICT_PLAN_SOURCES.filter(x=>!region||x.region===region).map(plan=>({plan,level:"city-only-source" as const,message:"검색용 원문 색인: 개별 필지 적용성 미검증",automaticallyApply:false as const}));
  const districtDiscovery=DISTRICT_PLAN_DISCOVERY.filter(x=>
    (!region||x.region===region) && (!address||x.city===sourceForAddress?.city));
  const legalChecklist=NATIONAL_SCREENING_RULES;
  const asOf=koreaLocalDay();
  return NextResponse.json({
    status:"research-evidence-only",
    updatedAt:METRO_ORDINANCE_CATALOG_UPDATED_AT,
    lastVerifiedScope:"city-clause-or-source-index",
    automaticApplication:false,
    scope:{region:region||null,address:address||null,matchedCity:sourceForAddress?.city??null,matchedLhRegion:lhRegion},
    asOf,
    counts:{cities:sources.length,rules:rules.length,clauseChecked:rules.filter(r=>r.evidence==="clause-checked").length,currentRecheck:rules.filter(r=>r.evidence==="needs-current-recheck").length,sourceIndexed:rules.filter(r=>r.evidence==="source-indexed").length,
      annexRecords:annexes.length,annexTitleVerified:annexes.filter(x=>x.evidence!=="lookup-only").length,
      lhNotices:lhNotices.length,lhGuidelineItems:guidelines.length,
      officialPlans:cityPlans.length,cityPlanDiscovery:districtDiscovery.length,nationalLawChecks:legalChecklist.length},
    warnings:["지구단위계획·용도제한·지역별 별표와 LH 공고별 요건은 필지 단위로 별도 확인해야 합니다.","개정 시행일 이후 조문이 변경될 수 있으므로 설계 인허가 전 최신 원문을 반드시 대조하세요."],
    sources,rules,annexes,lhNotices:lhNotices.map(n=>({...n,isWithinAnnouncedPeriod:noticeIsOpen(n,asOf)})),guidelines,
    districtPlans:cityPlans,cityPlanDiscovery:districtDiscovery,nationalLawChecks:legalChecklist,nationalLawUpdatedAt:NATIONAL_SCREENING_UPDATED,
  }, {headers:{"Cache-Control":"public, max-age=300, s-maxage=1800"}});
}
