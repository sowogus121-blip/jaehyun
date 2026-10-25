import type { ProjectInput, SiteLookupDetails, SiteReviewResult } from "./types";
import type { ReviewedRule } from "./rule-application";
import { screenParking03 } from "./lh-parking-screen";
import { ALTERNATIVES } from "./calculator";

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

function findArticle(review: SiteReviewResult | null, ordinance: string, terms: string[]): Article | null {
  return review?.ordinanceArticleCandidates?.find((a) =>
    a.sourceTitle.includes(ordinance) && terms.some((term) => a.article.includes(term) || a.excerpt.includes(term))) ?? null;
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
  const match = after.match(/^(?:[:：]|[은는])(\d{1,4}(?:\.\d+)?)(?:%|퍼센트)/);
  if (!match) return null;
  const value = Number(match[1]);
  return value > 0 && value <= 2000 ? value : null;
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
  const siteArea = review?.parcel?.area || lookup?.siteArea || (input.siteArea > 0 ? input.siteArea : null);
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

  const useArticle = findArticle(review, "도시계획 조례", ["용도지역안에서의 건축제한", "용도지역 안에서의 건축제한"]);
  add("use", "건축·도시계획", "건축행위 가능 여부",
    "공동주택 / 오피스텔(업무시설) 용도별 허용여부 별도 판정",
    citation(useArticle, cityName + " · 건축제한 조항 및 별표"),
    "조례 본문만으로 적합 확정 불가 · 용도별 별표, 다른 법률에 따른 제한 확인",
    useArticle ? "conditional" : "unknown", useArticle?.sourceUrl || cityOrdinance, useArticle?.excerpt || null);

  add("bcr", "건축·도시계획", "건폐율",
    bcr !== null ? bcr + "% 이하 (조례 일반기준)" : "대상 용도지역별 건폐율 조항 확인 필요",
    citation(bcrArticle, cityName + " · 건폐율 조항"),
    "지구단위계획·특별지구·완화·강화 등 우선 적용 기준 확인 전 · 계산 자동반영 안 함",
    bcr !== null ? "source" : bcrArticle ? "conditional" : "unknown", bcrArticle?.sourceUrl || cityOrdinance, bcrArticle?.excerpt || null);

  add("far", "건축·도시계획", "용적률",
    far !== null ? far + "% 이하 (조례 일반기준)" : "대상 용도지역별 용적률 조항 확인 필요",
    citation(farArticle, cityName + " · 용적률 조항"),
    "지구단위계획·공공임대 완화 요건 대조 전 · 계산 자동반영 안 함",
    far !== null ? "source" : farArticle ? "conditional" : "unknown", farArticle?.sourceUrl || cityOrdinance, farArticle?.excerpt || null);

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

  const mechanical = findArticle(review, "주차장 설치 및 관리 조례", ["기계식주차", "기계식"]);
  add("mechanical", "LH·주차 검토", "기계식주차 (조례)",
    "설치 가능 용도·총 주차대수 대비 허용비율·최소 주차대수 확인",
    citation(mechanical, "주차장법령 · 관할 주차장 조례"),
    "공동주택·오피스텔별 허용여부와 주차장법 시행규칙 대조 필요",
    mechanical ? "conditional" : "unknown", mechanical?.sourceUrl || parkingOrdinance, mechanical?.excerpt || null);
  add("mechanical-lh", "LH·주차 검토", "기계식주차 (LH 인수기준)",
    lhDocument ? "공식 공고 후보 확보 · 관련 비율 및 적용주택 유형 검증 필요" : "관할 LH 최신 공고의 기계식 허용기준 미확보",
    lhDocument?.title || "LH 지역본부 공고 · 주차장 인수지침",
    "지자체 허용 여부와 LH 인수기준은 모두 충족해야 함",
    lhDocument ? "conditional" : "unknown", lhDocument?.sourceUrl || null, lhDocument?.preview || null);
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
    !input.specialParkingEnabled ? "미적용 · 특례 요건 검토 전" : screening.canApply ? "0.3대/호 (사용자 승인·요건 확인)" : screening.status === "ineligible" ? "현 사업조건에서는 특례 미적용" : "0.3대/호 조건부 비교안 · 기본 주차계수 유지",
    "공공주택 특별법 시행령 관련 조항 · LH 지역본부 공고",
    missingChecks.length ? "미확인: " + missingChecks.join(", ") : "사용자 확인값으로 계산 · 허가권자 적용 근거 확인",
    !input.specialParkingEnabled ? "unknown" : screening.canApply ? "user" : screening.status === "conditional" ? "conditional" : "unknown",
    screening.sourceUrl);

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
