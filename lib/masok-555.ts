import type { SiteReviewResult } from "./types";

/**
 * 마석우리 555 / 마석택지지구 단독2-A14.
 * Source: 2025-07-29 남양주시 고시 제2025-314호와 공식 붙임 PDFs.
 * Parcel area is the approved 2024/2025 project area, not a live cadastral
 * certificate. Building envelope uses the separately approved housing-lot area.
 */
export const MASOK_555 = {
  address: "경기도 남양주시 화도읍 마석우리 555",
  pnu: "4136025621105550000",
  districtBlock: "마석택지지구 단독2-A14",
  zone: "제1종일반주거지역",
  approvedGrossProjectSqm: 11776.2,
  approvedHousingPlotSqm: 9228.4,
  approvedRoadSqm: 2319.7,
  approvedAmenityPlotSqm: 106.1,
  approvedHouseLots: 34,
  unallocatedApprovedAreaSqm: 122.0,
  plan: {
    bcrPercent: 50,
    farPercent: 150,
    maxFloors: 3,
    ordinaryMaxHomes: 50,
    conditionalMaxHomes: 115,
    conditionalParkingDedicationSqm: 759.4,
    conditionalRoadSetbackM: 2.5,
    minimumBlockInfrastructurePercent: 20,
    /**
     * ONLY a conservative sizing hypothesis. The 759.4 sqm proposed parking
     * facility might not all come out of the existing 9,228.4 sqm housing plots.
     */
    provisionalConditionalHousingPlotSqm: 8469.0,
  },
  lh: {
    announcementId: "1755",
    publishedAt: "2026-11-06",
    closesAt: "2026-11-23",
    region: "경기북부",
    normalMinimumHomes: 30,
    maxExclusiveSqm: 85,
    newlywed1ExclusiveMinSqm: 36,
    newlywed1ExclusiveMaxSqm: 85,
    newlywed1RoomsMin: 2,
    communityThreshold: 50,
    communitySqmPerHome: 1,
    youthParking03MaxExclusiveSqmStrict: 30,
    youthParking03StationOrCampusRadiusM: 500,
    notes: [
      "공고 지역·세대수 요건 충족과 개별 건축허가·LH 선정심의는 별개.",
      "전용 46㎡ 신혼·신생아Ⅰ형에 세대당 0.3대 주차 특례 적용 불가.",
      "신혼·신생아Ⅱ는 공고상 주택유형이 제한되므로 다세대 등으로 무조건 적용하지 말 것.",
    ],
  },
  sources: {
    municipalNoticeLanding: "https://www.nyj.go.kr/www/selectBbsNttView.do?bbsNo=98&key=3072&nttNo=498269",
    officialPlanPdf: "https://www.nyj.go.kr/www/downloadBbsFile.do?bbsNo=98&nttNo=498269&atchmnflNo=1507950",
    officialGuidelinePdf: "https://www.nyj.go.kr/www/downloadBbsFile.do?bbsNo=98&nttNo=498269&atchmnflNo=1507951",
    officialPlanDrawingPdf: "https://www.nyj.go.kr/www/downloadBbsFile.do?bbsNo=98&nttNo=498269&atchmnflNo=1507952",
    originalApprovalPdf: "https://www.nyj.go.kr/www/downloadBbsFile.do?bbsNo=69&nttNo=486226&atchmnflNo=1496020",
    changeApprovalPdf: "https://www.nyj.go.kr/www/downloadBbsFile.do?bbsNo=69&nttNo=490465&atchmnflNo=1499849",
    lhNoticeLanding: "https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1755",
    lhNoticePdf: "https://apply.lh.or.kr/lhapply/lhFile.do?fileid=69326768",
    lhGuideAttachment: "https://apply.lh.or.kr/lhapply/lhFile.do?fileid=69324941",
  },
  sourcePages: {
    planningAllowedUses: "지구단위계획 결정조서 PDF p.43~44 (단독2-A14; 고시 2025-314)",
    lotCapAndDedication: "시행지침 PDF p.11 (본문 -9-), 제36조 제1~4항",
    originalApproval: "남양주시보 제2191호 PDF p.25, 남양주시 고시 2024-417",
    changeApproval: "남양주시보 제2222호 PDF p.2, 남양주시 고시 2025-20",
    lhMinimum: "LH 26-4차 경기북부 공고 PDF p.1, p.3",
    lhCommunity: "LH 공고 PDF p.9",
    lh03Parking: "LH 공고 PDF p.26",
  },
  verifiedAsOf: "2026-11-07",
  unresolved: [
    "2025-07-29 이전 승인된 34필지 대지조성사업의 실제 조성완료·준공일과 분할 여부",
    "2025-314 경과규정에 따른 종전 허용용도 적용 여부 및 변경신청 수용 여부",
    "115세대 계획의 주택건설사업계획 승인 가능성과 부지 구성·도시계획시설 주차장 기부채납 절차",
    "759.4㎡ 기부채납 토지와 기존 9,228.4㎡ 주택용지의 중첩 여부 및 산정용 대지면적",
    "소로 화도1-4호선 2.5m 공지의 정확한 구간 및 진출입·도로경사",
    "주차장법·남양주시 조례·LH 공고의 건축유형별 주차대수, 자주식 진출입, 옹벽·소방 배치",
    "토지대장 최신 확정면적·공시지가·소유권 및 도시계획 변경 가능성",
    "LH 매입가격·매입약정 심의·상수원 권역의 하수처리 및 행정협의",
  ],
} as const;

export function isMasok555(address: string): boolean {
  const compact=address.replace(/[\s()]/g,"");
  return /^(?:경기도)?(?:남양주시)?(?:화도읍)?마석우리555(?:번지)?$/.test(compact);
}

export function getMasok555RuleFindings(): SiteReviewResult["ruleFindings"] {
  const p=MASOK_555.plan, s=MASOK_555.sources;
  const origin="마석택지지구 단독2-A14 지구단위계획 결정조서(남양주시 고시 제2025-314호)";
  const item=(id:string,topic:string,outcome:"applicable"|"not-applicable"|"conditional",value:number|string|null,unit:string|null,article:string,sourceUrl:string,conditions:string[]):SiteReviewResult["ruleFindings"][number]=>({
    id,topic,outcome,value,unit,sourceTitle:origin,article,sourceUrl,effectiveDate:"2025-07-29",conditions,verified:true
  });
  return [
    item("masok-apt-use","허용용도","conditional","공동주택",null,"결정조서 p.43 단독2-A14",s.officialPlanPdf,[
      "3층 이하 공동주택(기숙사 제외)은 지구단위계획상 허용. 건축허가·주택건설사업계획승인 및 2024년 기존 34필지 승인과의 정합성은 미검증",
      "다가구·다중주택은 변경 허용용도에서 제외. 종전 경과규정 해당 여부 별도 조사"
    ]),
    item("masok-office-use","허용용도","not-applicable","오피스텔",null,"결정조서 p.43 단독2-A14",s.officialPlanPdf,[
      "오피스텔은 단독2-A14 허용용도에 열거되지 않음",
      "제1종일반주거지역 일반기준으로 허용용도를 추정해서는 안 됨"
    ]),
    item("masok-bcr","건폐율","applicable",p.bcrPercent,"%","결정조서 p.43 단독2-A14",s.officialPlanPdf,["단독2-A14 블록 전용 상한; 조례 일반기준 60%보다 우선"]),
    item("masok-far","용적률","applicable",p.farPercent,"%","결정조서 p.43 단독2-A14",s.officialPlanPdf,["단독2-A14 블록 전용 상한; 조례 일반기준 200%보다 우선"]),
    item("masok-floors","높이","applicable",p.maxFloors,"층","결정조서 p.43 / 시행지침 제34조·제36조제2항",s.officialGuidelinePdf,["지상 3층 이하"]),
    item("masok-50-homes","지구단위계획","applicable",p.ordinaryMaxHomes,"세대","시행지침 제36조제1항",s.officialGuidelinePdf,["블록 전체 수용세대수 원칙 50세대 이하. 개별 동/필지마다 각각 50세대 적용 불가"]),
    item("masok-115-homes","지구단위계획","conditional",p.conditionalMaxHomes,"세대","시행지침 제36조제4항",s.officialGuidelinePdf,[
      "주택법 주택건설사업계획승인 신청",
      "759.4㎡ 도시계획시설 주차장 결정·조성·기부채납(공동주택 사용승인 전)",
      "소로 화도1-4호선 접면 2.5m 건축한계선 및 보도 연속 보행공간",
      "기존 대지조성 승인·준공 관계 및 기타 인허가 미확정"
    ]),
    item("masok-lh-purchase","LH 매입","conditional","신혼·신생아Ⅰ형 등",null,"2026 경기북부 4차 공고 p.1·3·9·26",s.lhNoticePdf,[
      "남양주시 포함, 원칙 최초 약정 30호 이상, 전용 85㎡ 이하(유형별 세부기준 적용)",
      "지역 및 규모 요건이 LH 선정·인수 적합성 확정 의미는 아님",
      "전용 46㎡ 신혼형 주차에 0.3대 특례 적용 불가"
    ]),
  ];
}

export function masokMassingScenario(conditional115: boolean) {
  const p=MASOK_555.plan;
  const maxHomes=conditional115?p.conditionalMaxHomes:p.ordinaryMaxHomes;
  const modelingSiteSqm=conditional115?p.provisionalConditionalHousingPlotSqm:MASOK_555.approvedHousingPlotSqm;
  const countedFarSqm=modelingSiteSqm*p.farPercent/100;
  return {
    maxHomes,
    modelingSiteSqm,
    countedFarSqm,
    maxCoverageSqm:modelingSiteSqm*p.bcrPercent/100,
    grossPer46Sqm:46/.75,
    areaOnly46Homes:Math.floor(countedFarSqm/(46/.75)),
    farUse46Sqm:maxHomes*(46/.75),
    conditional115,
    assumedPlotDeduction:conditional115,
  };
}
