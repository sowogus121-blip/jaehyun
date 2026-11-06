import type { ProjectInput, SiteLookupDetails, SiteReviewResult } from "./types";
import type { ReviewedRule } from "./rule-application";
import { screenParking03 } from "./lh-parking-screen";
import { getLhParkingReview } from "./lh-parking-review";
import { isHanamCommercialSite, calculateHanamCommercialMix, HANAM_CITY_ORDINANCE_URL } from "./hanam-commercial-mix";
import { ALTERNATIVES } from "./calculator";
import { UIWANG_6301, isUiwangChopyeong6301 } from "./uiwang-chopyeong-6301";
import { MASOK_555, isMasok555 } from "./masok-555";
import { findMetroOrdinanceSource, findMetroOrdinanceRules } from "./metro-ordinance-catalog";
import { findMetroAnnexRecords, findLhPurchaseNotice, findLhGuidelines, koreaLocalDay, noticeIsOpen } from "./metro-annex-lh-catalog";
import { findDistrictPlanEvidence } from "./district-plan-sources";
import { NATIONAL_SCREENING_RULES } from "./national-screening-rules";
import { getMunicipalMechanicalGuard } from "./metropolitan-parking-guards";

export type LegalRowStatus = "source" | "conditional" | "unknown" | "user";
export interface LegalReviewRow {
  id: string;
  section: "대상지 현황" | "건축·도시계획" | "LH·주차 검토";
  label: string;
  detail: string;
  citation: string;
  note: string;
  status: LegalRowStatus;
  sourceUrl: string | null;
  excerpt: string | null;
}
export interface LegalReviewReport {
  rows: LegalReviewRow[];
  confirmedSourceCount: number;
  conditionalCount: number;
  unknownCount: number;
  zone: string;
  area: number | null;
  calculatedLimits: Array<{ label: string; value: string; source: string; status: LegalRowStatus }>;
}

const fmt = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 1 });
const clean = (s: string) => s.replace(/\s+/g, " ").trim();
const normalized = (s: string) => s.replace(/\s+/g, "");

type Article = NonNullable<SiteReviewResult["ordinanceArticleCandidates"]>[number];

function findArticle(review: Pick<SiteReviewResult, "ordinanceArticleCandidates"> | null, ordinance: string, terms: string[]): Article | null {
  const rows=review?.ordinanceArticleCandidates?.filter(a=>a.sourceTitle.includes(ordinance))??[];
  // An unrelated §36 may quote §50 and appear before §50 in the law API.
  // Select the actual article HEADING first, not the earliest substring hit.
  return rows.find(a=>terms.some(term=>a.article.includes(term))) ??
    rows.find(a=>terms.some(term=>a.excerpt.includes(term))) ?? null;
}
function citation(article: Article | null, fallback: string) {
  return article ? article.sourceTitle + " · " + clean(article.article) : fallback;
}
function sourceUrl(review: SiteReviewResult | null, ordinance: string) {
  return review?.ordinances.find((row) => row.name.includes(ordinance))?.link ?? null;
}
function zoneRatio(article: Article | null, zone: string): number | null {
  if (!article || !zone || zone === "미확인") return null;
  const body = normalized(article.excerpt);
  const zoneName = normalized(zone);
  const position = body.indexOf(zoneName);
  if (position === -1) return null;
  const after = body.slice(position + zoneName.length);
  // Official municipal ordinances write 1300 as '1천300퍼센트' as well as
  // '1,300퍼센트' or '1300%'. Never treat the leading '1' as the FAR.
  const match=after.match(/^(?:[:：]|[은는])((?:\d{1,2}천\d{1,3})|(?:\d{1,2},\d{3})|(?:\d{1,4}(?:\.\d+)?))(?:%|퍼센트)/);
  if(!match)return null;
  const korean=match[1].match(/^(\d{1,2})천(\d{1,3})$/);
  const value=korean?Number(korean[1])*1000+Number(korean[2]):Number(match[1].replace(/,/g,""));
  return value > 0 && value <= 2000 ? value : null;
}

/** Extract general district ordinance maxima for a single, exactly named zone. Parcel applicability remains conditional. */
export function getOrdinanceZoneStandards(review: Pick<SiteReviewResult, "ordinanceArticleCandidates">, zone: string): {bcr:number;far:number} | null {
  const bcrArticle=findArticle(review,"도시계획 조례",["용도지역안에서의 건폐율","용도지역 안에서의 건폐율"]);
  const farArticle=findArticle(review,"도시계획 조례",["용도지역안에서의 용적률","용도지역 안에서의 용적률"]);
  const bcr=zoneRatio(bcrArticle,zone);
  const far=zoneRatio(farArticle,zone);
  return bcr===null||far===null?null:{bcr,far};
}

/** One report per site; a sourced clause must never be mistaken for parcel-level approval. */
export function buildLegalReviewReport(
  input: ProjectInput,
  review: SiteReviewResult | null,
  lookup: SiteLookupDetails | null = null,
  reviewedRules: ReviewedRule[] = [],
): LegalReviewReport {
  const rows: LegalReviewRow[] = [];
  const place = review?.location?.parcelAddress || review?.location?.address || input.address || "주소 미입력";
  const isParcelAssembly = Boolean(review?.parcels && review.parcels.length > 1);
  const singleUiwangC1 = isUiwangChopyeong6301(place) && !isParcelAssembly;
  const unverifiedUiwangAssembly = isUiwangChopyeong6301(place) && isParcelAssembly;
  const siteArea = review?.parcels && review.parcels.length > 1 && !review.parcel?.area
    ? null : review?.parcel?.area || lookup?.siteArea || (input.siteArea > 0 ? input.siteArea : null);
  const landUse = review?.landUse.filter((item) => item.category === "용도지역") ?? [];
  const zones = [...new Set(landUse.map((item) => item.name))];
  const zone = review?.mixedUseZones ? zones.join(" / ") + " (혼합)" : zones[0] || lookup?.zone || (input.zone !== "미확인" ? input.zone : "미확인");
  const cityOrdinance = sourceUrl(review, "도시계획 조례");
  const buildingOrdinance = sourceUrl(review, "건축 조례");
  const parkingOrdinance = sourceUrl(review, "주차장 설치 및 관리 조례");
  const cityName = review?.ordinances.find((item) => item.name.includes("도시계획 조례"))?.name || "관할 도시계획 조례";
  const districtPlans = review?.officialDocuments?.documents.filter((doc) => doc.kind === "district-plan") ?? [];
  const lhDocuments = review?.officialDocuments?.documents.filter((doc) => doc.kind === "lh-notice") ?? [];
  const districtDocument = districtPlans.find((doc) => doc.status === "analyzed");
  const lhDocument = lhDocuments.find((doc) => doc.status === "analyzed");
  const bcrArticle = findArticle(review, "도시계획 조례", ["용도지역안에서의 건폐율", "용도지역 안에서의 건폐율"]);
  const farArticle = findArticle(review, "도시계획 조례", ["용도지역안에서의 용적률", "용도지역 안에서의 용적률"]);
  const effectiveZone = review?.mixedUseZones ? "" : zone;
  const bcr = zoneRatio(bcrArticle, effectiveZone);
  const far = zoneRatio(farArticle, effectiveZone);
  const selectedRule = (field: string) => reviewedRules.find((rule) => rule.field === field && rule.value === input[field as keyof ProjectInput]);
  const add = (id: string, section: LegalReviewRow["section"], label: string, detail: string, citationText: string,
    note: string, status: LegalRowStatus, link: string | null = null, excerpt: string | null = null) => {
    rows.push({ id, section, label, detail, citation: citationText, note, status, sourceUrl: link, excerpt });
  };

  add("address", "대상지 현황", "위치", place, "VWorld 주소조회 / 사업지 입력", "좌표 및 지번 일치 여부 확인",
    review?.location ? "source" : "user");
  add("area", "대상지 현황", "구역·대지면적",
    siteArea ? fmt(siteArea) + "㎡" : "면적 미확보",
    review?.parcel?.source || lookup?.source || "지적도·등기사항증명서",
    review?.parcel?.approximate ? "도형 환산면적 · 지적공부 대조 필요" : "도로 편입·제외면적은 별도 확인",
    review?.parcel?.area ? "source" : lookup?.siteArea ? "source" : siteArea ? "user" : "unknown");
  add("zone", "대상지 현황", "용도지역·지구", zone, "VWorld 토지이용정보 / 토지이용계획확인서",
    review?.mixedUseZones ? "혼합 용도지역 · 획지별 가중산정 및 면적 대조 필요" : "다른 용도지구·구역 중첩 제한 확인",
    landUse.length ? "source" : lookup?.zone ? "source" : "unknown");

  // One parcel's mapped block does not grant a uniform development control
  // for an entire assembled parcel. The combination is a new planning case.
  if(isParcelAssembly && isUiwangChopyeong6301(place)){
    add("uiwang-assembled-block-unverified","건축·도시계획",
      "의왕초평 630-1+C1 인접 필지 합필: 획지별 규정 재검토",
      "630-1의 C1 단일필지 주거불허 근거를 합필 전체에 일괄 적용하지 않음",
      "2026 의왕초평 지구단위계획 결정도·가구획지 결정도",
      "630-1 외 각 필지의 허용용도·건축한계선·건폐율·용적률 및 실제 합필가능성 미검증.",
      "conditional",UIWANG_6301.controlPlanUrl);
  }
  // Parcel vs plan proof: show specific verified/candidate records only,
  // never any generic city plan as applying to an arbitrary address.
  const districtPlanEvidence=isParcelAssembly?[]:findDistrictPlanEvidence(place);
  for(const match of districtPlanEvidence) {
    const plan=match.plan;
    add("plan-"+plan.id,
      "건축·도시계획", "[지구단위·특별계획] "+plan.name,
      plan.noticeNo+" · "+plan.noticeDate+" · "+match.message,
      "토지이음 등 공식 결정고시",
      plan.scopeHint+" · "+plan.warnings.join(" ")+" · 고시문 확인과 지번별 적용은 별개.",
      match.level==="user-map-confirmed-block"?"user":"conditional",
      plan.officialNoticeUrl);
    for (let i=0;i<plan.documents.length;i++){
      const doc=plan.documents[i];
      add("plan-"+plan.id+"-document-"+i,
        "건축·도시계획","[원문자료] "+doc.kind,
        doc.note,
        plan.noticeNo+" · "+doc.kind,
        "이 자료에 개별 필지의 획지/건축선/허용용도 등이 명확히 지정되는지 추가 대조. 지도·고시문만으로 용적률 완화 승인 판정 불가.",
        "conditional",doc.url);
    }
  }
  // National screening applies as CHECKLIST, never as automatic numerical
  // assumptions for building scale/parking/LH purchase.
  for(const rule of NATIONAL_SCREENING_RULES){
    add("national-"+rule.id,
      rule.category==="주차·피난·방화" || rule.category==="주택·주민공동시설"?"LH·주차 검토":"건축·도시계획",
      "[국가법규 필수점검] "+rule.title,
      rule.description,
      rule.law+" "+rule.article,
      rule.screeningQuestion+" · "+rule.screeningPriority+" · 지자체 별표·지구단위계획·LH 매입유형 적용성 확인 전 자동 계산 금지",
      "conditional",rule.sourceUrl);
  }

  // Evidence library: city-matched, dated and cited screening rules ONLY.
  // They do not change legal FAR, parking, unit count or parcel permission.
  const metroSource = findMetroOrdinanceSource(place);
  if (metroSource) {
    add("metro-catalog-source", "건축·도시계획", "수도권 조례 근거DB · 시행본",
      metroSource.city + " · " + metroSource.title + " · 시행 " + metroSource.effectiveDate,
      "국가법령정보센터 " + metroSource.ordinanceNo,
      "지역별 조례 근거 연결 완료. 개별 필지 지구단위계획·용도제한·특례 승인 여부는 별도로 검증해야 합니다.",
      "source", metroSource.url);
    for (const entry of findMetroOrdinanceRules(place)) {
      add("metro-" + entry.id,
        entry.kind === "주차·LH" ? "LH·주차 검토" : "건축·도시계획",
        "[" + entry.kind + "] " + entry.title,
        entry.detail,
        metroSource.title + " " + entry.article + " · 시행 " + metroSource.effectiveDate,
        entry.conditions + " · [" + (entry.evidence === "clause-checked" ? "조문 발췌 확인" : entry.evidence === "needs-current-recheck" ? "최근 개정본문 재대조 필요" : "원문 위치만 확보") + "] · 자동 완화·상한 계산에 미적용",
        entry.evidence === "source-indexed" ? "unknown" : "conditional",
        metroSource.url);
    }
  }

  // Standalone annex index + regional LH notice/guidelines: non-operative
  // evidence only. An indexed appendix title does NOT verify its numeric cells.
  for (const item of findMetroAnnexRecords(place)) {
    add("annex-"+item.id,
      item.topic.startsWith("주차장") ? "LH·주차 검토" : "건축·도시계획",
      "[별표] "+item.title,
      item.appendix ? item.appendix+" · "+item.title : "별표 원문·번호 미추출 · 공식 조례에서 확인",
      item.city+" · "+item.topic+" · "+(item.appendix??"별표 원문 검색"),
      item.conditions+" · "+(item.evidence==="direct-excerpt" ? "해당 원문 일부 직접 검토" : item.evidence==="verified-title" ? "공식 별표 제목·조번호 확인; 숫자 미추출" : "원문 링크 색인만 완료; 본문 검증 전")+" · 자동 수치 적용 없음",
      item.evidence==="lookup-only"?"unknown":"conditional",
      item.sourceUrl);
  }
  const regionalLh=findLhPurchaseNotice(place);
  if(regionalLh){
    const accepts=noticeIsOpen(regionalLh,koreaLocalDay());
    add("lh-regional-notice-"+regionalLh.id,
      "LH·주차 검토",
      "지역 LH 민간신축 매입약정 "+(accepts?"공고기간 내":"접수기간 종료"),
      regionalLh.title+" · "+regionalLh.startDate+" ~ "+regionalLh.closeDate,
      regionalLh.region+" · "+regionalLh.noticePdfUrl,
      regionalLh.scopeNote+" · "+regionalLh.revisionNote+" · 공고기간 내 여부와 해당 필지 매입 적합성은 별개; 개별 심의 확인",
      "conditional",regionalLh.noticeUrl);
    add("lh-regional-minimum-"+regionalLh.id,
      "LH·주차 검토","LH 지역본부 최소 매입규모",
      "일반지역 "+regionalLh.normalMinimumHomes+"호 / 당시 규제지역 "+regionalLh.regulatedMinimumHomes+"호 (공고기준)",
      regionalLh.title+" · 원문 PDF",
      "규제지역 여부·주택 유형·해당 공고 범위에 따라 변동. 신규 사업에 종료 공고 자동 적용 금지.",
      "conditional",regionalLh.noticePdfUrl);
    add("lh-regional-guide-"+regionalLh.id,
      "LH·주차 검토","LH 신청서식·설계·시공 가이드라인",
      "지역본부 첨부 ZIP · 공식 원문 연결",
      regionalLh.title+" · 첨부파일",
      "엑셀 체크리스트 및 HWPX/도면 세부 규정은 항목별 재검증 후 적용. 본부별 첨부본 자동 교체 금지.",
      "conditional",regionalLh.guidelineZipUrl);
  }
  for(const guide of findLhGuidelines(place)){
    add("lh-guide-"+guide.id,
      "LH·주차 검토","[설계가이드] "+guide.topic,
      guide.detail,
      guide.sourceLocation,
      guide.conditions+" · "+(guide.evidence==="attachment-index"?"원문 목록 확인, 내용 미추출":"공고/체크리스트 해당 부분 직접 확인")+" · 자동 법정기준 적용 없음",
      guide.evidence==="attachment-index"?"unknown":"conditional",
      regionalLh?.guidelineZipUrl??null);
  }

  if (singleUiwangC1) {
    add("uiwang-c1-2", "대상지 현황", "지도 대조 확인 획지",
      "초평동 630-1 = C1 상업시설용지 블록(사용자 지도 대조)",
      "2026 LH 지구단위계획 결정도와 현행 필지 위치 사용자 비교",
      "블록 C1 위치는 사용자가 확인. 세부 획지 C1-2와 2023 예정지번 401-2의 공식 대응관계는 아직 미확정이며 행정 확인을 대체하지 않음.",
      "user", UIWANG_6301.controlPlanUrl);
    add("uiwang-use-block", "건축·도시계획", "C1 블록 공동주택·오피스텔 허용용도",
      "공동주택 미허용 · 업무시설 중 오피스텔 명시 제외",
      "2026 의왕초평 지구단위계획 제Ⅱ편 제4장 제2조 표Ⅱ-4-2 (PDF p.38)",
      "사용자 지도 대조로 C1 블록에 위치 확인. 따라서 LH 신혼형 공동주택·청년형 오피스텔 개발 부적합. 법정 지적도 교차검증과 변경고시는 최종 허가 전 별도 확인.",
      "user", UIWANG_6301.districtGuidelineUrl);
    add("uiwang-c1-limits", "건축·도시계획", "C1 상업시설용지 건축상한",
      "건폐율 70% 이하 · 용적률 450% 이하 · 최고 7층",
      "2026 의왕초평 지구단위계획 제Ⅱ편 제4장 제2조 표Ⅱ-4-2",
      "C1 블록 위치 사용자 확인과 지구단위계획 원문을 결합한 상업용도 검토기준. 상한이 주거용도 허용을 뜻하지 않음.",
      "user", UIWANG_6301.districtGuidelineUrl);
    add("uiwang-zone-appendix-6", "건축·도시계획", "준주거지역 일반 건축제한 · 별표 6",
      "공동주택·오피스텔을 준주거지역 일반 금지목록에 열거하지 않음",
      "의왕시 도시계획 조례 제32조제6호 별표 6 (2024.12.30)",
      "준주거 일반규정은 확인되지만 사용자 지도 대조로 C1 블록 위치가 확인돼 C1 상업시설용지의 별도 허용용도가 적용됨.",
      "source", UIWANG_6301.cityZoningAnnex.appendixOriginalUrl);
    add("uiwang-zone-sales", "건축·도시계획", "판매시설 3,000㎡ 이상 · 별표 6",
      "판매시설 3,000㎡ 이상은 폭 15m 이상 도로에 15m 이상 접한 경우 예외",
      "의왕시 도시계획 조례 별표 6 제2호나목 (2024.12.30)",
      "제공된 28m 도로는 폭 요건에 유리하나 실제 해당 도로 접도길이 15m 이상·C1 허용 판매시설 종류를 별도 확인해야 함.",
      "conditional", UIWANG_6301.cityZoningAnnex.appendixOriginalUrl);
    add("uiwang-parking-appendix-5", "LH·주차 검토", "부설주차장 · 별표 5 일반",
      "공동주택·오피스텔: 전용 85㎡ 이하 합계/85㎡, 최소 세대·호실당 1대",
      "의왕시 주차장설치 및 관리 조례 제16조제1항 별표 5 제5호 (2026.5.7)",
      "별표5 주차는 주거 용도가 허용될 때의 일반기준일 뿐, C1 상업시설용지에서 공동주택·오피스텔 신축을 허용하는 것은 아님.",
      "source", UIWANG_6301.cityParkingAnnex.appendixOriginalUrl);
    add("uiwang-parking-03-appendix-5", "LH·주차 검토", "매입약정주택 주차 0.3대 · 별표 5",
      "공공주택사업자 매도약정 + 전용면적 30㎡ 미만 = 0.3대/세대 적용 가능",
      "의왕시 주차장설치 및 관리 조례 별표 5 제5호 (2026.5.7) · 공특법 시행령 제37조제4항",
      "LH 경기남부 3차 원문 p.6은 청년형 역·대학교 500m, 고령자 입지제한 없음. p.8·10은 0.3대와 기계식 병행 불가. C1의 주거 용도 제한을 해제하지 못함.",
      "conditional", UIWANG_6301.cityParkingAnnex.appendixOriginalUrl);
    add("uiwang-parking-machine-city", "LH·주차 검토", "기계식주차 의왕시 한도",
      "법정주차대수의 최대 30%, 총 주차대수 20대 이하 설치 불가",
      "의왕시 주차장설치 및 관리 조례 제20조제1항 (2026.5.7)",
      "LH 경기남부 3차 공고 p.8의 최대 50% 안내보다 의왕시의 30% 제한을 우선 충족. LH 0.3대 특례 적용 시에는 기계식 금지.",
      "source", UIWANG_6301.cityParkingAnnex.ordinanceUrl);
    add("uiwang-commercial-parking", "LH·주차 검토", "상업시설 주차 기준(허용용도 별도)",
      "판매·일반업무시설: 시설면적 100㎡당 1대, 제1·2종 근생: 120㎡당 1대",
      "의왕시 주차장설치 및 관리 조례 별표 5 제2·3호 (2026.5.7)",
      "일반 상업시설 분류에 따른 주차 별표 참고용. 현재 지번의 획지별 허용 용도는 추가확인.",
      "source", UIWANG_6301.cityParkingAnnex.appendixOriginalUrl);
  }

  const useArticle = findArticle(review, "도시계획 조례", ["용도지역안에서의 건축제한", "용도지역 안에서의 건축제한"]);
  add("use", "건축·도시계획", "건축행위 가능 여부",
    singleUiwangC1
      ? "C1 상업시설용지: 공동주택·오피스텔 불허(사용자 지도 확인)"
      : "공동주택 / 오피스텔(업무시설) 용도별 허용여부 별도 판정",
    singleUiwangC1
      ? "의왕초평 2026 지구단위계획 시행지침 제Ⅱ편 제4장 표Ⅱ-4-2"
      : citation(useArticle, cityName + " · 건축제한 조항 및 별표"),
    singleUiwangC1
      ? "사용자가 현재 필지와 결정도 위치 대조로 C1 블록 확인. C1 표Ⅱ-4-2에는 공동주택 미열거, 오피스텔 제외. C1-2 세부획지 지번변경 이력은 미확정."
      : "조례 본문만으로 적합 확정 불가 · 용도별 별표, 다른 법률에 따른 제한 확인",
    singleUiwangC1 ? "user" : useArticle ? "conditional" : "unknown",
    singleUiwangC1 ? UIWANG_6301.districtGuidelineUrl : useArticle?.sourceUrl || cityOrdinance,
    singleUiwangC1 ? null : useArticle?.excerpt || null);

  add("bcr", "건축·도시계획", "건폐율",
    bcr !== null ? bcr + "% 이하 (조례 일반기준)" : "대상 용도지역별 건폐율 조항 확인 필요",
    citation(bcrArticle, cityName + " · 건폐율 조항"),
    (unverifiedUiwangAssembly ? "630-1의 C1과 추가 필지는 획지별 허용용도·건폐율 미확정 · 합필 전체 값으로 산정 불가. " : "") + "지구단위계획·특별지구·완화·강화 등 우선 적용 기준 확인 전 · 계산 자동반영 안 함",
    bcr !== null ? (unverifiedUiwangAssembly ? "conditional" : "source") : bcrArticle ? "conditional" : "unknown", bcrArticle?.sourceUrl || cityOrdinance, bcrArticle?.excerpt || null);

  add("far", "건축·도시계획", "용적률",
    far !== null ? far + "% 이하 (조례 일반기준)" : "대상 용도지역별 용적률 조항 확인 필요",
    citation(farArticle, cityName + " · 용적률 조항"),
    (unverifiedUiwangAssembly ? "630-1 C1과 인접획지 허용용도·기준용적률 별도 확인 전 합필용적률 확정 금지. " : "") + "지구단위계획·공공임대 완화 요건 대조 전 · 계산 자동반영 안 함",
    far !== null ? (unverifiedUiwangAssembly ? "conditional" : "source") : farArticle ? "conditional" : "unknown", farArticle?.sourceUrl || cityOrdinance, farArticle?.excerpt || null);

  if(isHanamCommercialSite(review)){
    const mix=calculateHanamCommercialMix(input.commercialMixShare||20);
    add("hanam-use-mix","건축·도시계획","일반상업지역 주거·오피스텔 혼합 용적률",
      "상업 "+mix.commercialShare+"% + 주거·오피스텔 "+mix.housingShare+"% 가정 → 총 "+mix.totalFar+"% (조례 일반 1,300% 직접 적용 아님)",
      "하남시 도시계획 조례 제53조제1항·제56조제1항 (2026.10.1 시행)",
      "상업비율은 법정 승인값이 아닌 계획 가정. 상업용도 1,300% 및 준주거 500% 가중식, 대지별 지구단위·금지용도·국토계획법 시행령 별표 9 대조 필요",
      "conditional",HANAM_CITY_ORDINANCE_URL);
    add("hanam-use-bonus","건축·도시계획","상업지역 비주거·공공기여 추가 용적률",
      "위원회 심의를 거친 기반시설 기부채납 등은 제56조제2항에 따라 최대 +100%p 검토 가능",
      "하남시 도시계획 조례 제56조제2항 (2026.10.1 시행)",
      "도로·주차장 등 기부채납 + 심의 요건 충족 시 검토; 이 대지에 자동 허용되지 않으며 기본 계산에 미적용",
      "conditional",HANAM_CITY_ORDINANCE_URL);
  }
  const relaxation = findArticle(review, "도시계획 조례", ["공공임대주택", "임대주택", "용적률"]);
  add("relax", "건축·도시계획", "공공임대 용적률 완화",
    "공공임대 유형·사업방식별 완화율 및 최종 상한 조건부 검토",
    citation(relaxation, cityName + " · 공공주택 특례·용적률 조항"),
    "120%·300% 등 수치는 해당 호·항 적용조건 및 상한 검증 전 확정하거나 계산에 넣지 않음",
    relaxation ? "conditional" : "unknown", relaxation?.sourceUrl || cityOrdinance, relaxation?.excerpt || null);

  add("plan", "건축·도시계획", "지구단위계획 / 결정고시",
    review?.districtPlan === true ? "지구단위계획구역 레이어 검출" : review?.districtPlan === false ? "조회한 레이어에서 미검출" : "미확인",
    "VWorld 도시계획구역 / 관할 지자체 결정고시",
    districtDocument ? "공식 첨부 확보 · 최신 결정도서 및 대상 획지 적용 여부 확인" : "결정도서·시행지침·건축한계선 등 개별 조회 필요",
    "conditional", districtDocument?.sourceUrl || null, districtDocument?.preview || null);

  add("height", "건축·도시계획", "최고높이 / 층수",
    input.maxHeight > 0 || input.maxFloors > 0 ?
      [input.maxHeight > 0 ? input.maxHeight + "m" : "", input.maxFloors > 0 ? input.maxFloors + "층" : ""].filter(Boolean).join(" / ") + " (입력값)" :
      "최고높이 별도 확인 필요",
    "건축법 제60조 · 도시관리계획·지구단위계획",
    "고도지구·항공·경관 및 특수건축물 높이 제한 추가 검토",
    input.maxHeight > 0 || input.maxFloors > 0 ? "user" : "unknown");

  const sunshine = findArticle(review, "건축 조례", ["일조", "정북", "일조 등의 확보"]);
  add("sun", "건축·도시계획", "정북일조 · 채광 · 인동거리",
    "높이·인접대지 경계·배치방위별 이격거리 산정 필요",
    citation(sunshine, "건축법 제61조 · 건축법 시행령 제86조 · 관할 건축조례"),
    "거리 수치는 대지경계·건축물 용도·높이별 조건 대조 후 확정",
    sunshine ? "conditional" : "unknown", sunshine?.sourceUrl || buildingOrdinance, sunshine?.excerpt || null);

  const setback = findArticle(review, "건축 조례", ["대지 안의 공지", "대지안의 공지"]);
  add("setback", "건축·도시계획", "대지 안의 공지",
    "용도별 건축선·인접대지경계선 이격거리 및 별표 확인",
    citation(setback, "건축법 제58조 · 관할 건축조례 별표"),
    "건축선 후퇴, 지구단위 건축한계선, 도로경계 조건 구분",
    setback ? "conditional" : "unknown", setback?.sourceUrl || buildingOrdinance, setback?.excerpt || null);

  const landscape = findArticle(review, "건축 조례", ["대지의 조경", "조경"]);
  add("landscape", "건축·도시계획", "조경 의무비율",
    input.landscapeRatio > 0 ? input.landscapeRatio + "% (사용자 가정)" : "대지면적·용도별 의무면적 확인 필요",
    citation(landscape, "건축법 제42조 · 관할 건축조례"),
    "의무조경/공개공지/대지 내 공지 별도 산정",
    landscape ? "conditional" : "unknown", landscape?.sourceUrl || buildingOrdinance, landscape?.excerpt || null);

  const road = lookup?.roads?.join(" · ") || (input.roadWidth > 0 ? input.roadWidth + "m 접도(입력값)" : "도로 폭원·진출입 조건 미확보");
  add("road", "건축·도시계획", "도로·건축선·진출입", road,
    lookup?.source || "건축법 제44조 · 도로법 / 도시계획시설",
    "도시계획도로 접합은 차량진출입 허가를 의미하지 않음",
    lookup?.roads.length ? "source" : "unknown");

  add("fire", "건축·도시계획", "소방활동·피난 기준",
    "층수·건축면적 확정 후 소방차 접근·피난계단·피난용승강기 확인",
    "건축법령 · 소방시설 설치 및 관리에 관한 법률",
    "개략 규모만으로 소방시설·피난층 적용 판정 불가", "unknown");

  const lhParking = getLhParkingReview(review?.lhNotice??null,input);
  const verifiedParking=lhParking.verifiedOriginal;
  const parkingExtracted=lhParking.clauses.filter(c=>c.status==="extracted-unverified");
  const mechanical = findArticle(review, "주차장 설치 및 관리 조례", ["기계식주차", "기계식"]);
  add("mechanical", "LH·주차 검토", "기계식주차 (조례)",
    "설치 가능 용도·총 주차대수 대비 허용비율·최소 주차대수 확인",
    citation(mechanical, "주차장법령 · 관할 주차장 조례"),
    "공동주택·오피스텔별 허용여부와 주차장법 시행규칙 대조 필요",
    mechanical ? "conditional" : "unknown", mechanical?.sourceUrl || parkingOrdinance, mechanical?.excerpt || null);
  const municipalityMachine=getMunicipalMechanicalGuard(review,input);
  if(municipalityMachine){
    const cityLimit=municipalityMachine;
    const lhCap=review?.lhNotice?.rules && input.businessMode==="purchase"
      ? review.lhNotice.rules.mechanicalMaxPercent : null;
    const cap=lhCap===null?cityLimit.maxMechanicalPercent:Math.min(cityLimit.maxMechanicalPercent,lhCap);
    add("municipal-machine-cap","LH·주차 검토","지자체 조례 기계식주차 최대비율",
      "조례 "+cityLimit.maxMechanicalPercent+"% 이하"+(lhCap===null?" · LH 별도 확인":" · LH "+lhCap+"% → 더 엄격한 "+cap+"% 이하")+" · 최소 기계식 "+cityLimit.minMechanicalStalls+"대",
      cityLimit.sourceArticle,
      cityLimit.note+" · 주민공동/업무시설 용도·법정주차대수·최신 별표3과 LH 인수 심사 별도 확인. 비율 상한만 자동 제한하며 기계식주차를 자동 승인하지 않음.",
      "conditional",cityLimit.sourceUrl);
    if(cityLimit.apartmentProhibited)add("municipal-machine-apartment","LH·주차 검토","공동주택 기계식주차 허용 여부",
      "제2·3종일반주거지역 공동주택 기계식 불가(관할 시 조례)",
      cityLimit.sourceArticle,
      "오피스텔은 공동주택과 다른 허용조건이며 연면적·층수·최소 기계식 대수 확인 필요. LH 신혼형 일반 공동주택 기계식 대안은 부적합.",
      "source",cityLimit.sourceUrl);
  }
  // LH min-home standards screen only; never treat a municipality listing as
  // a purchase acceptance decision.
  const regionLh=findLhPurchaseNotice(place);
  if(regionLh){
    const current=noticeIsOpen(regionLh,koreaLocalDay());
    add("regional-lh-min-homes","LH·주차 검토","LH 지역본부 최소 매입 호수",
      (current?"공고기간 기준 ":"접수 종료 공고 참고값: ")+"일반 "+regionLh.normalMinimumHomes+"호 / 규제지역 "+regionLh.regulatedMinimumHomes+"호",
      regionLh.title+" · 원문 PDF",
      "규제지역 지정일·지역별 제외지·공급유형·약정/인수 요건 미확정. 호수 충족만으로 매입 승인 불가.",
      "conditional",regionLh.noticePdfUrl);
  }
  add("mechanical-lh", "LH·주차 검토", "기계식주차 (LH 공고 인수기준)",
    verifiedParking ? "총 주차대수 50% 이하 · 도시철도역 출구 직선 500m 이내 · 주거용 오피스텔/도시형생활주택" :
      parkingExtracted.length ? "해당 지역 LH PDF 주차 관련 문구 "+parkingExtracted.length+"건 추출 · 적용 검증 전" :
      lhParking.noticeTitle ? "관할 LH 공고 확보 · 주차 조항 원문분석 미완료" : "관할 LH 공고 미확인",
    review?.lhNotice?.title || lhDocument?.title || "LH 지역본부 공고 · 주차장 인수지침",
    verifiedParking ? "청년·신혼신생아 입주형 / 150세대 미만 기계식 20대 미만 우대 / 0.3대 완화시 기계식 지양 · 대상지 적용 전" :
      "LH 원문 추출여부와 실제 인수·입지 조건은 구분해 확인",
    verifiedParking || parkingExtracted.length ? "conditional" : "unknown",
    lhParking.sourceUrl||lhDocument?.sourceUrl||null,
    verifiedParking ? "경기북부 2026년 4차 공고문 p.11 · 기계식주차 50% 한도, 역세권 500m, 기계식 형식 및 배치조건" :
      parkingExtracted.find(x=>x.category==="기계식 주차")?.quote??null);
  if(verifiedParking) {
    const noticeSource=review?.lhNotice?.title||"LH 경기북부 4차 공고";
    add("lh-parking-machine-other","LH·주차 검토","LH 기계식주차 세부제한",
      "150세대 미만 기계식 20대 미만 우대 · 세대 벽 연접 금지 · 주차타워 상부 주거 배치 금지",
      noticeSource+" · p.11","일반 공동주택·근생 등 허용 대상 외 주차는 자주식 계획. 주차관리실 설치",
      "conditional",lhParking.sourceUrl,"승강기·평면왕복·다층순환 방식, 오토발렛 / 50% 일부 초과는 심의 수용여부 결정");
    add("lh-parking03-terms","LH·주차 검토","LH 전용 30㎡ 미만 0.3대 적용요건",
      "청년·고령자형 전용 30㎡ 미만 · 청년은 역 출구/대학 교문 500m · 고령자는 입지 제한 없음",
      noticeSource+" · p.9","매입약정·허가권자 적용 근거·공공기여 협의 필요. 신혼형 46㎡에는 이 조항 적용 안 됨",
      "conditional",lhParking.sourceUrl,"공공주택특별법 시행령 제37조제4항 0.3대 주차 완화 시 LH 협의");
    add("lh-parking-design","LH·주차 검토","LH 주차장 설계·운영기준",
      "50대 이상 경사로 2차선 폭 6m 이상 · 지하 5층 이상 또는 터파기 20m 초과 계획 지양",
      noticeSource+" · p.5","법적 의무와 LH 설계 지침을 구분하여 반영, 주차 동선과 관리실 확인",
      "conditional",lhParking.sourceUrl,null);
  }
  const apr = selectedRule("apartmentParkingRatio");
  add("apt-parking", "LH·주차 검토", "주차 — 공동주택 46㎡",
    input.apartmentParkingRatio > 0 ? input.apartmentParkingRatio + "대/세대 (계획 입력)" : "별표의 전용면적별 대수 및 세대당 최소대수 확인 필요",
    apr ? apr.sourceTitle : "주차장법 시행령 별표 · 관할 주차장 조례",
    "LH 공급유형별 별도 요구 대수도 중복 검토",
    input.apartmentParkingRatio > 0 ? "user" : "unknown", apr?.sourceUrl || parkingOrdinance, apr?.excerpt || null);
  const opr = selectedRule("officetelParkingRatio");
  add("office-parking", "LH·주차 검토", "주차 — 오피스텔 25㎡",
    input.officetelParkingRatio > 0 ? input.officetelParkingRatio + "대/호 (계획 입력)" : "업무시설·오피스텔 법정 산정식 확인 필요",
    opr ? opr.sourceTitle : "주차장법령 별표 · 관할 주차장 조례",
    "법정주차 기준과 LH 특례 0.3대/호는 별도로 관리",
    input.officetelParkingRatio > 0 ? "user" : "unknown", opr?.sourceUrl || parkingOrdinance, opr?.excerpt || null);
  const screening = screenParking03(input, ALTERNATIVES[2]);
  const missingChecks = screening.checks.filter((item) => item.status !== "pass").map((item) => item.label);
  add("special-parking", "LH·주차 검토", "LH 주차 0.3대/호 특례",
    !input.specialParkingEnabled ? verifiedParking ? "LH 공고상 0.3대 조건 확인 · 시나리오 미선택" : "미적용 · 특례 요건 검토 전" : screening.canApply ? "0.3대/호 (사용자 승인·요건 확인)" : screening.status === "ineligible" ? "현 사업조건에서는 특례 미적용" : "0.3대/호 조건부 비교안 · 기본 주차계수 유지",
    verifiedParking ? (review?.lhNotice?.title||"LH 경기북부 4차") + " · p.9 / 공공주택 특별법 시행령 제37조제4항" : "공공주택 특별법 시행령 관련 조항 · LH 지역본부 공고",
    missingChecks.length ? "미확인: " + missingChecks.join(", ") : "사용자 확인값으로 계산 · 허가권자 적용 근거 확인",
    !input.specialParkingEnabled ? "unknown" : screening.canApply ? "user" : screening.status === "conditional" ? "conditional" : "unknown",
    verifiedParking ? lhParking.sourceUrl : screening.sourceUrl);

  // Only the exact cadastral lot 555 (not its neighbors) gets A14 rules.
  // General first-residential zoning maxima (60/200) must not be shown
  // as the site's buildable 50/150 constraints.
  if (isMasok555(place) && !isParcelAssembly) {
    const src = MASOK_555.sources;
    const planCitation = "남양주시 고시 제2025-314호 · 마석택지지구 단독2-A14 결정조서 p.43~44";
    const overrides: Record<string, { detail:string; note:string; citation:string; sourceUrl:string; status:LegalRowStatus }> = {
      use: {
        detail: "3층 이하 공동주택 허용(기숙사 제외) · 단독·단독형 집합주택 허용 · 다중·다가구 제외 · 오피스텔 불허",
        note: "2025.7.29 이전 승인·조성 완료 필지의 종전 허용용도 경과규정 및 기존 34필지 사업계획 변경 필요. 용도 허용은 사업승인 보장이 아님.",
        citation: planCitation,
        sourceUrl: src.officialPlanPdf, status: "conditional"
      },
      bcr: {detail:"50% 이하 (단독2-A14 지구단위계획)",note:"조례 일반 제1종주거 60%와 구별해야 함.",citation:planCitation,sourceUrl:src.officialPlanPdf,status:"source"},
      far: {detail:"150% 이하 (단독2-A14 지구단위계획)",note:"조례 일반 제1종주거 200%와 구별해야 함.",citation:planCitation,sourceUrl:src.officialPlanPdf,status:"source"},
      height: {detail:"지상 3층 이하 (단독2-A14 지구단위계획)",note:"지구단위계획 제34조·제36조. 건축법상 별도 높이/일조 추가검토.",citation:planCitation,sourceUrl:src.officialGuidelinePdf,status:"source"},
      plan: {detail:"단독2-A14 · 원칙 50세대 / 주택법 사업계획승인 등 조건부 115세대",note:"759.4㎡ 공공주차장 결정·준공·기부채납, 소로 화도1-4호선 2.5m 보행공지, 블록 내 기반시설 20% 이상, 기존 조성사업 준공/경과규정 재확인.",citation:"마석지구 시행지침 제36조제1~4항 · 결정조서 p.43~44",sourceUrl:src.officialGuidelinePdf,status:"conditional"}
    };
    for (const row of rows) {
      const override=overrides[row.id];
      if (override) Object.assign(row, {...override,excerpt:override.note});
    }
    add("masok-approval", "대상지 현황", "대지조성사업 승인 현황",
      "2024 승인 11,776.2㎡ (주택용지 9,228.4㎡/34필지 · 도로 2,319.7㎡)",
      "남양주시 고시 2024-417 · 2025-20", "2025 변경승인은 사업주체 변경; 준공·분할 여부 확인 전. 전체 사업면적을 주택 건축대지로 사용하면 안 됨.",
      "source", src.changeApprovalPdf);
    add("masok-115", "건축·도시계획", "115세대 특례 조건",
      "115세대는 조건부 · 주차장 759.4㎡ 기부채납 + 도로변 2.5m 공지",
      "마석지구 시행지침 제36조제4항",
      "2025.7.29 신설. 계획 대지면적·공공주차장 시설결정 및 승인 전 115세대를 현재 건축 가능 세대로 확정 금지.",
      "conditional", src.officialGuidelinePdf);
    add("masok-lh", "LH·주차 검토", "경기북부 26-4차 매입약정",
      "남양주시 포함 · 원칙 30호 이상 · 신혼·신생아Ⅰ형 전용 36~85㎡",
      "LH 2026-11-06 정정공고 p.1·3·9·26",
      "LH 지역·규모요건은 건축허용과 인수심의가 아님. 50세대 이상 LH 커뮤니티 세대당 1㎡, 신혼형 전용46㎡ 0.3대 주차특례 적용 불가.",
      "conditional", src.lhNoticePdf);
  }

  const calculatedLimits: LegalReviewReport["calculatedLimits"] = [
    { label: "건폐율 · 계산 입력", value: input.buildingCoverageRatio > 0 ? input.buildingCoverageRatio + "%" : "미입력",
      source: selectedRule("buildingCoverageRatio")?.sourceTitle || "사용자 계산값 · 조례 일반기준과 별개", status: input.buildingCoverageRatio > 0 ? "user" : "unknown" },
    { label: "용적률 · 계산 입력", value: input.baseFar > 0 ? input.baseFar + "%" : "미입력",
      source: selectedRule("baseFar")?.sourceTitle || "사용자 계산값 · 적용조건 미검증", status: input.baseFar > 0 ? "user" : "unknown" },
    { label: "완화 용적률", value: input.relaxedFar > 0 ? input.relaxedFar + "%" : "미입력",
      source: "승인 전 조건부 시나리오 · 기본안과 별도", status: input.relaxedFar > 0 ? "conditional" : "unknown" },
    { label: "공동주택 주차계수", value: input.apartmentParkingRatio > 0 ? input.apartmentParkingRatio + "대/세대" : "미입력",
      source: apr?.sourceTitle || "별표·LH 인수기준 미검증", status: input.apartmentParkingRatio > 0 ? "user" : "unknown" },
    { label: "오피스텔 주차계수", value: input.officetelParkingRatio > 0 ? input.officetelParkingRatio + "대/호" : "미입력",
      source: opr?.sourceTitle || "별표·LH 인수기준 미검증", status: input.officetelParkingRatio > 0 ? "user" : "unknown" },
    { label: "최고높이·층수", value: input.maxHeight > 0 || input.maxFloors > 0 ?
        [input.maxHeight ? input.maxHeight + "m" : "", input.maxFloors ? input.maxFloors + "층" : ""].filter(Boolean).join(" / ") : "미입력",
      source: "높이·일조·도로 기준 검토 전", status: input.maxHeight > 0 || input.maxFloors > 0 ? "user" : "unknown" },
  ];
  return {
    rows, zone, area: siteArea,
    confirmedSourceCount: rows.filter((row) => row.status === "source").length,
    conditionalCount: rows.filter((row) => row.status === "conditional").length,
    unknownCount: rows.filter((row) => row.status === "unknown").length,
    calculatedLimits,
  };
}
