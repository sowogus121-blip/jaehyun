/** 누리플렉스 본사 / 방배동 750-14 / 사평대로 16.
 * Preliminary comparative screen only: underlying land register and zoning
 * certificate, district plan, setbacks, permit, and LH 0.3 approval unknown.
 */
export const NURIFLEX_750_14 = {
  address: "서울특별시 서초구 방배동 750-14",
  roadAddress: "서울특별시 서초구 사평대로 16",
  siteSqm: 1211.09,
  approximateZone: "준주거지역",
  /** 2026-11-07 VWorld site-review: parcel outline area is approximate. */
  vworldVerification: {
    pnu: "1165010100107500014",
    approximateParcelSqm: 1209.1,
    zone: "준주거지역",
    zoneCode: "LT_C_UQ111",
    latitude: 37.498339653992176,
    longitude: 126.98611154842392,
    districtPlanApiStatus: "unknown", // VWorld did not resolve a district-plan designation.
  },
  /** Independent 2026-09-11 Seoul GIS point-in-polygon; NOT legal parcel certificate. */
  districtPlanGIS: {
    publishedAt: "2026-09-11",
    datasetFile: "576_UQ161_지구단위계획구역_202609.zip",
    coordinateSystem: "EPSG:5174",
    pointInside: false,
    nearestPlan: "반포아파트지구 지구단위계획구역",
    nearestPlanMeters: 102.5,
    nextPlan: "이수아파트지구 지구단위계획구역",
    nextPlanMeters: 167,
    caveat: "건물 중심좌표 대 서울시 2026년 9월 폴리곤 중첩; 법정 필지경계·최신 변경고시 확인서 아님.",
  },
  seoul500Scenario: {
    ordinaryFarPercent: 400,
    conditionalFarPercent: 500,
    publicRentalFractionOfIncrease: 0.5,
    minPublicRentalCountedFloorSqm: Math.round(1211.09 * 0.5 * 100) / 100,
    permitApplicationBy: "2028-03-27",
    status: "unconfirmed-for-lh-alone",
    caution: "서울시 매입업무 처리기준은 인수자를 서울특별시장으로 명시; LH 매입약정이 서울시 제51조제2항제3호 공공주택 확보분에 해당하는지 서면 판단 필요.",
  },
  provisionalBcrPercent: 60,
  provisionalFarPercent: 400,
  existing: { floors: 10, basementFloors: 3, farSqm: 4646.72, grossSqm: 6674.81, parkingStalls: 31, heightMeters: 40.6 },
  siteEvidence: "건축물대장 기반 민간 집계자료(2026.11.07 조회), 토지대장·토지이용계획확인서 원본 별도 확인 필요",
  sources: {
    headquarters: "https://nuriflex.co.kr/kr/about/headquarter-location.html",
    buildingSummary: "https://zippoom.com/부동산/서울-서초구-방배동-누리빌딩/8e14dv",
    seoulOrdinance: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2116611",
    seoulZoningOrdinance: "https://www.law.go.kr/LSW/ordinSc.do?eventGubun=060101&menuId=3&query=서울특별시%20도시계획%20조례",
    seoul500ExtendingGazette: "https://event.seoul.go.kr/snews/data/CN_MST/seoulsibo_20250102153808_00456.pdf",
    cityPublicRentalPurchaseRules: "https://news.seoul.go.kr/citybuild/files/2024/02/65dd3b53be8e01.95626212.pdf",
    cityPublicRentalPurchaseGuide: "https://news.seoul.go.kr/citybuild/archives/520265",
    seoulDistrictPlanGIS202609: "https://data.seoul.go.kr/dataList/OA-21161/A/1/datasetView.do",
    seoulRoadHeightPublicGuide: "https://news.seoul.go.kr/citybuild/archives/523924",
    seoulRoadHeightOfficial2024: "https://www.seoul.go.kr/news/news_notice.do?nttNo=414285&tr_code=snews",
    seoulRoadHeight2024Pdf: "https://seoulboard.seoul.go.kr/comm/getFile?srvcId=BBSTY1&upperNo=414285&fileTy=ATTACH&fileNo=1&bbsNo=277",
    lhCurrentSeoulPurchaseList: "https://apply.lh.or.kr/lhapply/apply/pch/list.do?mi=1076",
    publicHousingParking: "https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0037&lsiSeq=289503&urlMode=lsScJoRltInfoR",
    lhCurrentGuide: "https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68421266",
    lhSeoul6: "https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1735",
    lhSeoul7: {
      announcedAt: "2026-11-06",
      closesAt: "2026-11-30",
      statusAsOf: "2026-11-07: 접수중",
      /** Provider-specific numeric detail URL not retrieved; do not fabricate. */
      source: "https://apply.lh.or.kr/lhapply/apply/pch/list.do?mi=1076",
    },
    seoulCityPlanning: "https://news.seoul.go.kr/citybuild/archives/520265",
    cadastralRecords: "https://www.eum.go.kr/",
    seoulPlanningPortal: "https://urban.seoul.go.kr/",
  },
} as const;

export type NuriflexUse = "urban" | "officetel";
export interface NuriflexScreen {
  use: NuriflexUse;
  exclusiveSqm: 20 | 22 | 24;
  farPercent: 350 | 400 | 500;
  grossFarSqm: number;
  exclusiveEfficiency: number;
  homes: number;
  parking05: number;
  parking03Conditional: number;
  parking05GrossSqm: [number, number];
  parking03GrossSqm: [number, number];
}

/** Only a FAR-capacity comparison, NOT a permit, parking or LH approval.
 *  - 1m²/community per dwelling and 50m² additional gross space.
 *  - All nonresidential obligations are unknown and omitted.
 *  - 500% is a separate unverified housing-related relaxation.
 */
export function screenNuriflex(use: NuriflexUse, exclusiveSqm:20|22|24, farPercent:350|400|500):NuriflexScreen {
  const efficiency = use === "urban" ? 0.70 : 0.45;
  const grossFarSqm = NURIFLEX_750_14.siteSqm*farPercent/100;
  const homes = Math.max(0,Math.floor((grossFarSqm-50)/(exclusiveSqm/efficiency+1)));
  const parking05 = Math.ceil(homes*0.5);
  const parking03Conditional = Math.ceil(homes*0.3);
  return {
    use,exclusiveSqm,farPercent,grossFarSqm,
    exclusiveEfficiency:efficiency,homes,parking05,parking03Conditional,
    parking05GrossSqm:[parking05*35,parking05*40],
    parking03GrossSqm:[parking03Conditional*35,parking03Conditional*40],
  };
}

export function isNuriflexBangbae(input:string):boolean {
  const value=input.toLowerCase().replace(/\s+/g,"");
  return /(?:방배동)?750-14(?:번지)?$/.test(value)
    || (value.includes("사평대로16") && !value.includes("사평대로160"))
    || value.includes("누리플렉스") || value.includes("누리빌딩");
}
