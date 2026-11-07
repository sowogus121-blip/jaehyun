/** 누리플렉스 본사 / 방배동 750-14 / 사평대로 16.
 * Preliminary comparative screen only: underlying land register and zoning
 * certificate, district plan, setbacks, permit, and LH 0.3 approval unknown.
 */
export const NURIFLEX_750_14 = {
  address: "서울특별시 서초구 방배동 750-14",
  roadAddress: "서울특별시 서초구 사평대로 16",
  siteSqm: 1211.09,
  approximateZone: "준주거지역",
  provisionalBcrPercent: 60,
  provisionalFarPercent: 400,
  existing: { floors: 10, basementFloors: 3, farSqm: 4646.72, grossSqm: 6674.81, parkingStalls: 31, heightMeters: 40.6 },
  siteEvidence: "건축물대장 기반 민간 집계자료(2026.11.07 조회), 토지대장·토지이용계획확인서 원본 별도 확인 필요",
  sources: {
    headquarters: "https://nuriflex.co.kr/kr/about/headquarter-location.html",
    buildingSummary: "https://zippoom.com/부동산/서울-서초구-방배동-누리빌딩/8e14dv",
    seoulOrdinance: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2116611",
    publicHousingParking: "https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0037&lsiSeq=289503&urlMode=lsScJoRltInfoR",
    lhCurrentGuide: "https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68421266",
    lhSeoul6: "https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1735",
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
