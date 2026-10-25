export interface ZoningStandard {
  zone: string;
  buildingCoverageRatio: number;
  far: number;
  source: string;
}

const SOURCE = "국토계획법 시행령상 용도지역별 일반 상한(관할 조례·지구단위계획 별도 확인)";

const STANDARDS: Array<Omit<ZoningStandard, "source">> = [
  { zone: "제1종전용주거지역", buildingCoverageRatio: 50, far: 100 },
  { zone: "제2종전용주거지역", buildingCoverageRatio: 50, far: 150 },
  { zone: "제1종일반주거지역", buildingCoverageRatio: 60, far: 200 },
  { zone: "제2종일반주거지역", buildingCoverageRatio: 60, far: 250 },
  { zone: "제3종일반주거지역", buildingCoverageRatio: 50, far: 300 },
  { zone: "준주거지역", buildingCoverageRatio: 70, far: 500 },
  { zone: "중심상업지역", buildingCoverageRatio: 90, far: 1500 },
  { zone: "일반상업지역", buildingCoverageRatio: 80, far: 1300 },
  { zone: "근린상업지역", buildingCoverageRatio: 70, far: 900 },
  { zone: "유통상업지역", buildingCoverageRatio: 80, far: 1100 },
  { zone: "전용공업지역", buildingCoverageRatio: 70, far: 300 },
  { zone: "일반공업지역", buildingCoverageRatio: 70, far: 350 },
  { zone: "준공업지역", buildingCoverageRatio: 70, far: 400 },
  { zone: "보전녹지지역", buildingCoverageRatio: 20, far: 80 },
  { zone: "생산녹지지역", buildingCoverageRatio: 20, far: 100 },
  { zone: "자연녹지지역", buildingCoverageRatio: 20, far: 100 },
  { zone: "보전관리지역", buildingCoverageRatio: 20, far: 80 },
  { zone: "생산관리지역", buildingCoverageRatio: 20, far: 80 },
  { zone: "계획관리지역", buildingCoverageRatio: 40, far: 100 },
  { zone: "농림지역", buildingCoverageRatio: 20, far: 80 },
  { zone: "자연환경보전지역", buildingCoverageRatio: 20, far: 80 },
];

function normalize(value: string) {
  return value.replace(/\s+/g, "").replace(/[()]/g, "");
}

export function findZoningStandard(names: string[]) {
  const joined = normalize(names.join(" "));
  const standard = STANDARDS.find((item) => joined.includes(normalize(item.zone)));
  return standard ? { ...standard, source: SOURCE } : null;
}
