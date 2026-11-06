import { UIWANG_6301 } from "./uiwang-chopyeong-6301";
import { MASOK_555 } from "./masok-555";
export interface SitePreset {
  id: string;
  aliases: string[];
  address: string;
  province: string;
  district: string;
  neighborhood: string;
  parcel: string;
  siteArea: number;
  landCategory: string;
  zone: string;
  districtPlan: boolean;
  publicPricePerSqm: number;
  publicPriceBase: string;
  roads: string[];
  planningRoadWidth: number;
  restrictions: string[];
  landscape: string;
  buildingCoverageRatioAssumption: number;
  farAssumption: number;
  source: string;
  confirmedAt: string;
  warnings: string[];
}

export const SITE_PRESETS: SitePreset[] = [
  {
    id: "namyangju-masok-555",
    aliases: [
      "마석우리555", "마석우리 555", "화도읍 마석우리 555",
      "남양주시 화도읍 마석우리 555", "경기도 남양주시 화도읍 마석우리 555",
      "경기도 남양주시 화도읍 마석우리 555번지",
    ],
    address: MASOK_555.address,
    province: "경기도",
    district: "남양주시",
    neighborhood: "마석우리",
    parcel: "555",
    siteArea: MASOK_555.approvedGrossProjectSqm,
    landCategory: "대",
    zone: MASOK_555.zone,
    districtPlan: true,
    publicPricePerSqm: 0,
    publicPriceBase: "2026 개별공시지가·등기 자료 미확인 (2020 과거 감정평가액은 현 시가 아님)",
    roads: [
      "소로 화도1-4호선 접면(조건부 115세대안은 2.5m 보행공지)",
      "2024 승인 단지 내 도로 2,319.7㎡(현행 준공·접근 가능 여부 미확인)",
    ],
    planningRoadWidth: 0,
    restrictions: [
      "마석택지지구 단독2-A14 · 블록형 단독주택용지",
      "지구단위계획 건폐율 50% / 용적률 150% / 지상 3층 이하",
      "단독주택(다중·다가구 제외)·단독형 집합주택·3층 이하 공동주택(기숙사 제외) 허용",
      "오피스텔 불허(허용용도 미열거)",
      "블록 전체 기본 50세대 · 조건부 115세대(주차장 759.4㎡ 기부채납 + 2.5m 공지)",
      "원형지 기반시설 20% 이상 기준; 산입 시설·현황 재검증",
      "2024 승인: 주택용지 9,228.4㎡ / 34필지 / 도로 2,319.7㎡",
    ],
    landscape: "남양주시 고시 제2025-314호(2025.7.29.) 마석지구 지구단위계획 시행지침 제36조",
    buildingCoverageRatioAssumption: MASOK_555.plan.bcrPercent,
    farAssumption: MASOK_555.plan.farPercent,
    source: "남양주시 공식 결정조서 p.43~44·시행지침 p.11·2024-417/2025-20 대지조성 승인 고시 대조(2026-11-07)",
    confirmedAt: MASOK_555.verifiedAsOf,
    warnings: [
      "11,776.2㎡는 2024/2025 승인 사업부지 총면적이며 건축용 주택용지 9,228.4㎡와 다름. 기존 VWorld 도형 면적 약 11,713.5㎡는 근사값.",
      "115세대는 무조건 허용이 아니라 주택법 주택건설사업계획승인·759.4㎡ 주차장 도시계획시설 결정/조성/기부채납 및 2.5m 보행공간 조건부.",
      "2025.7.29 이전 승인받고 조성 완료한 필지에 대한 경과규정 있음. 기존 34필지 조성준공·분할 및 종전 허용용도 적용 여부 확인 전.",
      "LH 경기북부 26-4차 공고상 남양주시와 30세대 이상 일반요건에 해당하더라도 LH 매입약정 선정은 별도 심사.",
      "기부채납 주차장 759.4㎡ 전부를 주택용지에서 공제하는 것은 예비 규모검토 가정이지 확정 획지면적이 아님.",
      "주차·옹벽·하수·소방·일조·정북방향·토목·LH 매입가격 및 현행 소유권 미확인.",
    ],
  },
  {
    id: "uiwang-chopyeong-630-1",
    aliases: ["초평동630-1", "초평동 630-1", "의왕시 초평동 630-1", "경기도 의왕시 초평동 630-1"],
    address: UIWANG_6301.address,
    province: "경기도",
    district: "의왕시",
    neighborhood: "초평동",
    parcel: "630-1",
    siteArea: UIWANG_6301.historicalArea,
    landCategory: "대",
    zone: UIWANG_6301.currentVworldZone,
    districtPlan: true,
    publicPricePerSqm: 0,
    publicPriceBase: "공식 개별공시지가 미조회(총액 39.1억원은 사용자 제공)",
    roads: ["28m 도로 접합(사용자 제공)", "12m 도로 접합(사용자 제공)"],
    planningRoadWidth: 0,
    restrictions: ["의왕초평 공급촉진지구", "지구단위계획구역", "C1 상업시설용지(사용자 지도·결정도 위치 대조)", "공동주택 허용용도 미열거·오피스텔 명시 제외", "C1-2 세부획지 번호는 공식 지번변경 이력 미확인"],
    landscape: "국토교통부 고시 제2026-308호 (2026-06-30) 및 지구단위계획 시행지침(2026-10 LH 첨부)",
    buildingCoverageRatioAssumption: 70,
    farAssumption: 450,
    source: "VWorld 준주거·지구단위 + 사용자 지도 대조 C1 블록 확인 + 2026 의왕초평 시행지침 표Ⅱ-4-2 C1 상업시설용지 70/450/7층 (C1-2 세부획지는 미확인)",
    confirmedAt: "2026-10-31",
    warnings: [...UIWANG_6301.warnings,
      "토지 소유법인, 희망가격 81.5억원(약 1,799만원/평) 및 공시가격 39.1억원은 사용자 제시사항으로 등기·토지대장·공시지가 원본 검증 전.",
    ],
  },
  {
    id: "paju-bongam-1343-2",
    aliases: [
      "봉암리1343-2", "봉암리 1343-2", "파주읍 봉암리 1343-2",
      "파주시 파주읍 봉암리 1343-2", "파주시 봉암리 1343-2",
      "경기도 파주시 파주읍 봉암리 1343-2",
    ],
    address: "경기도 파주시 파주읍 봉암리 1343-2",
    province: "경기도",
    district: "파주시",
    neighborhood: "봉암리",
    parcel: "1343-2",
    siteArea: 3236.5,
    landCategory: "대",
    zone: "준주거지역",
    districtPlan: true,
    publicPricePerSqm: 987300,
    publicPriceBase: "2026/01",
    roads: ["중로1류(폭 20~25m) 접합 · 실제 진출입 허용 여부 별도 확인"],
    planningRoadWidth: 20,
    restrictions: [
      "파주 센트럴밸리 일반산업단지",
      "지구단위계획구역(2018-11-29)",
      "군사시설 제한보호구역(전방지역 25km)",
      "군사시설 기타(2026-06-05, 35m 행정위탁)",
      "가축사육제한구역",
      "토지거래계약 허가구역(일부 외국인 등의 주택용 토지 취득)",
    ],
    landscape: "파주 센트럴밸리 일반산업단지 · 2026-06-12 변경고시 원문 및 산업단지 관리기본계획 별도 확인",
    buildingCoverageRatioAssumption: 60,
    farAssumption: 300,
    source: "사용자 제출 토지이음(2026-10-26)·토지 등기사항전부증명서(2026-10-27)·파주시 조례 일반기준",
    confirmedAt: "2026-10-27",
    warnings: [
      "건폐율 60%·용적률 300%는 파주시 준주거지역의 일반 조례상 예비기준이며, 지구단위계획·산업단지 용지별 제한을 확인하기 전 확정 적용 불가",
      "파주시 도시계획 조례 제33조제4항은 공공임대주택 용적률 120% 이내 완화를 규정. 300%→360%는 조건부 가능성으로만 표시하고, 산업단지 지구단위계획과 인허가 적용 검증 전 자동 적용 금지",
      "군사기지 및 군사시설 기타 35m는 행정위탁된 고도 관련 수치. 지구단위계획상 최종 허용높이로 자동 확정하지 않음",
      "산업단지 내 지원시설용지의 공동주택·오피스텔 허용용도, 의무 비주거, 용적률·최고높이는 2026-143 변경고시 및 시행지침 원문 검토 필요",
      "등기부상 신탁등기(2024-1262호) 존속: 신탁원부, 처분동의 및 매입약정 신청권원·토지확보서류 검토 필요",
      "서울지역 LH 2026년 6차 공고는 이 파주시 대상지에 적용할 수 없으며 경기북부 4차 공고를 확인해야 함",
      "2026-10-14 파주시 개발행위허가 제한구역 신규고시와 본 필지 중첩 여부 별도 지형도면 확인",
    ],
  },
  {
    id: "uijeongbu-ganeung-75-1",
    aliases: ["가능동75-1", "가능동 75-1", "의정부 가능동 75-1", "의정부시 가능동 75-1", "경기도 의정부시 가능동 75-1"],
    address: "경기도 의정부시 가능동 75-1",
    province: "경기도",
    district: "의정부시",
    neighborhood: "가능동",
    parcel: "75-1",
    siteArea: 1467,
    landCategory: "주유소용지",
    zone: "제2종일반주거지역",
    districtPlan: false,
    publicPricePerSqm: 2535000,
    publicPriceBase: "2026/01",
    roads: ["대로3류(폭 25m~30m) 접합", "중로2류 중로2-1(폭 15m~20m) 접합"],
    planningRoadWidth: 25,
    restrictions: ["가축사육제한구역", "과밀억제권역", "(한강)폐기물매립시설 설치제한지역"],
    landscape: "중점경관관리구역(평화로)",
    buildingCoverageRatioAssumption: 60,
    farAssumption: 250,
    source: "등기사항전부증명서 및 토지이용계획확인서(토지이음)",
    confirmedAt: "2026-10-22",
    warnings: ["주유소용지: 토양오염 조사, 위험물시설 폐업·철거 및 정화책임 확인 필요", "도시계획도로 접합은 실제 차량 진출입 허가나 확폭선 비저촉을 의미하지 않음"],
  },
  {
    id: "uijeongbu-ganeung-72-5",
    aliases: ["가능동72-5", "가능동 72-5", "의정부 가능동 72-5", "의정부시 가능동 72-5", "경기도 의정부시 가능동 72-5"],
    address: "경기도 의정부시 가능동 72-5",
    province: "경기도",
    district: "의정부시",
    neighborhood: "가능동",
    parcel: "72-5",
    siteArea: 628,
    landCategory: "대",
    zone: "제2종일반주거지역",
    districtPlan: false,
    publicPricePerSqm: 2535000,
    publicPriceBase: "2026/01",
    roads: ["중로2류 중로2-1(폭 15m~20m) 접합"],
    planningRoadWidth: 15,
    restrictions: ["가축사육제한구역", "과밀억제권역", "(한강)폐기물매립시설 설치제한지역"],
    landscape: "중점경관관리구역(평화로)",
    buildingCoverageRatioAssumption: 60,
    farAssumption: 250,
    source: "등기사항전부증명서 및 토지이용계획확인서(토지이음)",
    confirmedAt: "2026-10-22",
    warnings: ["도시계획도로 접합은 실제 차량 진출입 허가나 확폭선 비저촉을 의미하지 않음", "소규모 대지로 자주식 주차 시 지하층 부담 검토 필요"],
  },
];

function normalize(value: string) {
  return value.toLowerCase().replace(/\s+/g, "").replace(/[()]/g, "");
}

export function findSitePreset(query: string) {
  const target = normalize(query);
  return SITE_PRESETS.find((preset) => preset.aliases.some((alias) => normalize(alias) === target) || normalize(preset.address) === target) ?? null;
}
