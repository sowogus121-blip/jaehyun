/**
 * 전국 공통 법령 기준 (국가법령). 이 파일의 값은 "법령상 범위·상한"이며,
 * 필지에 적용되는 실제 값은 관할 조례·지구단위계획으로 확인한 뒤에만 계산에 들어간다.
 */
import type { SourceRef } from "./types";

export function lawUrl(name: string, article?: string) {
  const base = "https://www.law.go.kr/법령/" + name.replace(/\s+/g, "");
  return encodeURI(article ? `${base}/${article}` : base);
}

export const ZONES = [
  { zone: "제1종전용주거지역", annex: 2, bcr: 50, far: 100, residential: true, sunlight: true },
  { zone: "제2종전용주거지역", annex: 3, bcr: 50, far: 150, residential: true, sunlight: true },
  { zone: "제1종일반주거지역", annex: 4, bcr: 60, far: 200, residential: true, sunlight: true },
  { zone: "제2종일반주거지역", annex: 5, bcr: 60, far: 250, residential: true, sunlight: true },
  { zone: "제3종일반주거지역", annex: 6, bcr: 50, far: 300, residential: true, sunlight: true },
  { zone: "준주거지역", annex: 7, bcr: 70, far: 500, residential: true, sunlight: false },
  { zone: "중심상업지역", annex: 8, bcr: 90, far: 1500, residential: false, sunlight: false },
  { zone: "일반상업지역", annex: 9, bcr: 80, far: 1300, residential: false, sunlight: false },
  { zone: "근린상업지역", annex: 10, bcr: 70, far: 900, residential: false, sunlight: false },
  { zone: "유통상업지역", annex: 11, bcr: 80, far: 1100, residential: false, sunlight: false },
  { zone: "전용공업지역", annex: 12, bcr: 70, far: 300, residential: false, sunlight: false },
  { zone: "일반공업지역", annex: 13, bcr: 70, far: 350, residential: false, sunlight: false },
  { zone: "준공업지역", annex: 14, bcr: 70, far: 400, residential: false, sunlight: false },
  { zone: "보전녹지지역", annex: 15, bcr: 20, far: 80, residential: false, sunlight: false },
  { zone: "생산녹지지역", annex: 16, bcr: 20, far: 100, residential: false, sunlight: false },
  { zone: "자연녹지지역", annex: 17, bcr: 20, far: 100, residential: false, sunlight: false },
  { zone: "보전관리지역", annex: 18, bcr: 20, far: 80, residential: false, sunlight: false },
  { zone: "생산관리지역", annex: 19, bcr: 20, far: 80, residential: false, sunlight: false },
  { zone: "계획관리지역", annex: 20, bcr: 40, far: 100, residential: false, sunlight: false },
  { zone: "농림지역", annex: 21, bcr: 20, far: 80, residential: false, sunlight: false },
  { zone: "자연환경보전지역", annex: 22, bcr: 20, far: 80, residential: false, sunlight: false },
] as const;
export type ZoneInfo = (typeof ZONES)[number];

const norm = (v: string) => v.replace(/[\s()·]/g, "");
export function findZone(name: string): ZoneInfo | null {
  const n = norm(name);
  return ZONES.find((z) => n.includes(norm(z.zone))) ?? null;
}

export const LAW = {
  planningAct: "국토의 계획 및 이용에 관한 법률",
  planningDecree: "국토의 계획 및 이용에 관한 법률 시행령",
  buildingAct: "건축법",
  buildingDecree: "건축법 시행령",
  parkingAct: "주차장법",
  parkingRule: "주차장법 시행규칙",
  housingStd: "주택건설기준 등에 관한 규정",
  publicHousingDecree: "공공주택 특별법 시행령",
  accessibility: "장애인ㆍ노인ㆍ임산부 등의 편의증진 보장에 관한 법률",
  fire: "소방시설 설치 및 관리에 관한 법률",
  evacuation: "건축물의 피난ㆍ방화구조 등의 기준에 관한 규칙",
};

export function ref(title: string, article?: string, extra: Partial<SourceRef> = {}): SourceRef {
  return { title, article, url: lawUrl(title, article), kind: "law", ...extra };
}

/** 용도지역별 건축제한 별표 (국토계획법 시행령 제71조). 조례 별표 번호는 지자체마다 다를 수 있다. */
export function useRestrictionRef(zone: ZoneInfo): SourceRef {
  return ref(LAW.planningDecree, "제71조", { annex: `별표 ${zone.annex}` });
}

/** 정북방향 일조 (건축법 제61조제1항, 시행령 제86조제1항): 전용·일반주거지역 */
export const SUNLIGHT_TEXT = "높이 10m 이하 부분: 정북 인접대지경계선에서 1.5m 이상 / 10m 초과 부분: 해당 높이의 1/2 이상";
export const SUNLIGHT_HIGHLIGHTS = ["10m 이하", "1.5m", "1/2"];

/** 공개공지 (건축법 제43조, 시행령 제27조의2) */
export const OPEN_SPACE_ZONES = ["일반주거", "준주거", "상업", "준공업"];
export const OPEN_SPACE_FLOOR_AREA = 5000;
