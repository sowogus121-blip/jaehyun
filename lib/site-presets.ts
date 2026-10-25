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
