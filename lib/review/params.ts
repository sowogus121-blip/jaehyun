import type { ParamKey, ReviewRow, RuleParams } from "./types";

export const USABLE: ReadonlyArray<ReviewRow["status"]> = ["verified", "user"];

export interface ResolvedParam<K extends ParamKey = ParamKey> {
  key: K;
  value: RuleParams[K];
  rowId: string;
  status: ReviewRow["status"];
  label: string;
}

export type ResolvedParams = { [K in ParamKey]?: ResolvedParam<K> };

export const PARAM_LABEL: Record<ParamKey, string> = {
  siteArea: "대지면적(㎡)", bcr: "건폐율(%)", far: "기본 용적률(%)", relaxedFar: "완화 용적률(%)",
  maxFloors: "최고층수(층)", maxHeight: "최고높이(m)", landscapeRatio: "조경비율(%)",
  parkingApartment: "공동주택 주차(대/세대)", parkingUrban: "도시형생활주택 주차(대/세대)", parkingOfficetel: "오피스텔 주차(대/호)",
  parkingApartmentTiers: "공동주택 세대당 최소주차(구간)", parkingUrbanTiers: "도시형생활주택 세대당 최소주차(구간)", parkingOfficetelTiers: "오피스텔 호당 최소주차(구간)",
  useApartment: "공동주택 허용", useUrban: "도시형생활주택 허용", useOfficetel: "오피스텔 허용",
  mechApartment: "조례 기계식(공동주택)", mechUrban: "조례 기계식(도생)", mechOfficetel: "조례 기계식(오피스텔)",
  mechMaxPercent: "조례 기계식 최대비율(%)", mechMinStalls: "조례 기계식 최소대수(대)",
  lhMechApartment: "LH 기계식 인수(공동주택)", lhMechUrban: "LH 기계식 인수(도생)", lhMechOfficetel: "LH 기계식 인수(오피스텔)",
  lhMechMaxPercent: "LH 기계식 최대비율(%)", lhParking03: "LH 0.3대 특례", lhParking03MaxArea: "0.3대 특례 전용면적 상한(㎡)",
  lhMinHomes: "LH 최소 매입 호수", lhCommunityThreshold: "LH 커뮤니티 기준 세대수", lhCommunitySqmPerHome: "LH 커뮤니티 ㎡/세대",
  publicOpenSpaceRatio: "공개공지 비율(%)",
};

export const NUMERIC_PARAMS: ParamKey[] = [
  "siteArea", "bcr", "far", "relaxedFar", "maxFloors", "maxHeight", "landscapeRatio",
  "parkingApartment", "parkingUrban", "parkingOfficetel", "mechMaxPercent", "mechMinStalls",
  "lhMechMaxPercent", "lhParking03MaxArea", "lhMinHomes", "lhCommunityThreshold", "lhCommunitySqmPerHome", "publicOpenSpaceRatio",
];
export const VERDICT_PARAMS: ParamKey[] = [
  "useApartment", "useUrban", "useOfficetel", "mechApartment", "mechUrban", "mechOfficetel",
  "lhMechApartment", "lhMechUrban", "lhMechOfficetel", "lhParking03",
];

/** 계산에 쓰일 수치: verified·user 행만. 같은 키가 여러 행에 있으면 user > verified, 뒤 행 우선. */
export function resolveParams(rows: ReviewRow[]): ResolvedParams {
  const out: ResolvedParams = {};
  const rank = (s: ReviewRow["status"]) => (s === "user" ? 2 : s === "verified" ? 1 : 0);
  for (const row of rows) {
    if (!USABLE.includes(row.status) || !row.params) continue;
    for (const [key, value] of Object.entries(row.params) as Array<[ParamKey, RuleParams[ParamKey]]>) {
      if (value === undefined || value === null || (typeof value === "number" && !Number.isFinite(value))) continue;
      const prev = out[key];
      if (prev && rank(prev.status) > rank(row.status)) continue;
      (out as Record<string, ResolvedParam>)[key] = { key, value, rowId: row.id, status: row.status, label: PARAM_LABEL[key] };
    }
  }
  return out;
}

/** 후보 행에만 있는 수치 (계산 미적용, 화면 안내용) */
export function candidateParams(rows: ReviewRow[]): ResolvedParams {
  const out: ResolvedParams = {};
  for (const row of rows) {
    if (row.status !== "candidate" || !row.params) continue;
    for (const [key, value] of Object.entries(row.params) as Array<[ParamKey, RuleParams[ParamKey]]>) {
      if (value === undefined) continue;
      (out as Record<string, ResolvedParam>)[key] = { key, value, rowId: row.id, status: row.status, label: PARAM_LABEL[key] };
    }
  }
  return out;
}
