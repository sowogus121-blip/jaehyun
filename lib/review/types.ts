/**
 * LH Plan Lab v2 core model.
 *
 * 법규검토표의 한 행(ReviewRow)이 곧 규모검토의 입력이다.
 * 행에 묶인 수치(params)는 행 상태가 "verified"(공식 원문 + 필지 적용 확인) 또는
 * "user"(검토자가 직접 입력·확인)일 때만 계산에 사용된다.
 * "candidate"(원문 후보·조건부)와 "missing"(근거 누락)은 표에는 보이지만 계산에 쓰이지 않는다.
 */
import type { SiteReviewResult, UploadedDocument } from "../types";

export type RowStatus = "verified" | "user" | "candidate" | "missing";
export type UseKind = "apartment" | "urban" | "officetel";
export type UseVerdict = "allowed" | "conditional" | "prohibited";
export type BusinessType = "lh-purchase" | "lh-other" | "private";
export type LhSupply = "youth" | "newlywed" | "senior" | "general" | "multichild";

export const USE_LABEL: Record<UseKind, string> = {
  apartment: "공동주택(아파트·연립·다세대)",
  urban: "도시형생활주택",
  officetel: "오피스텔",
};
export const USE_SHORT: Record<UseKind, string> = { apartment: "공동주택", urban: "도시형생활주택", officetel: "오피스텔" };
export const UNIT_WORD: Record<UseKind, string> = { apartment: "세대", urban: "세대", officetel: "호" };
export const SUPPLY_LABEL: Record<LhSupply, string> = {
  youth: "청년", newlywed: "신혼·신생아", senior: "고령자", general: "일반", multichild: "다자녀",
};
export const STATUS_LABEL: Record<RowStatus, string> = {
  verified: "원문 확인", user: "검토자 입력", candidate: "후보·조건부", missing: "근거 누락",
};

/** 원문 근거. excerpt의 highlights 구간은 보고서 근거부록에서 형광펜으로 표시된다. */
export interface SourceRef {
  title: string;
  article?: string;
  annex?: string;
  noticeNo?: string;
  effectiveDate?: string;
  url?: string;
  excerpt?: string;
  /** true: 공식 API·원문에서 그대로 가져온 조문. false/없음: 검토자 요지(원문 대조 필요) */
  verbatim?: boolean;
  highlights?: string[];
  /** 원문 PDF 쪽번호 (공고문·고시문 등 조항 번호가 없는 문서) */
  page?: number | number[];
  /** 원본 PDF 주소 (부록 원본 이미지판) */
  pdfUrl?: string;
  kind?: "law" | "ordinance" | "plan" | "lh" | "upload" | "api" | "other";
}

/** 주차기준 구간: 전용면적 maxArea(㎡) 이하(strict면 미만)일 때 세대당 ratio대 이상, 또는 전용 sqmPerStall㎡당 1대 */
/** 완화 용적률 단계 (예: 매입임대 300%, 공공임대 추가공급 400%) */
export interface FarOption { far: number; label: string; condition?: string }

export interface ParkingTier { maxArea?: number; strict?: boolean; ratio?: number; sqmPerStall?: number }

/** 규모검토로 연동되는 수치. 모든 값은 선택적이며 단위는 키 이름에 맞춘다. */
export interface RuleParams {
  siteArea?: number;            // ㎡
  bcr?: number;                 // %
  far?: number;                 // % 기본(법정·조례) 용적률
  relaxedFar?: number;          // % 완화 적용 시 상한
  /** 완화 단계별 용적률 후보 */
  relaxedFarOptions?: FarOption[];
  maxFloors?: number;           // 층
  maxHeight?: number;           // m
  landscapeRatio?: number;      // % of site
  parkingApartment?: number;    // 대/세대
  parkingUrban?: number;        // 대/세대
  parkingOfficetel?: number;    // 대/호
  /** 조례 별표의 세대(호)당 최소대수 구간 (전용면적 이하 → 대수) */
  parkingApartmentTiers?: ParkingTier[];
  parkingUrbanTiers?: ParkingTier[];
  parkingOfficetelTiers?: ParkingTier[];
  useApartment?: UseVerdict;
  useUrban?: UseVerdict;
  useOfficetel?: UseVerdict;
  mechApartment?: UseVerdict;   // 지자체 조례상 기계식 설치 가능 여부
  mechUrban?: UseVerdict;
  mechOfficetel?: UseVerdict;
  mechMaxPercent?: number;      // 지자체 조례 기계식 최대비율(%)
  mechMinStalls?: number;       // 지자체 조례 기계식 최소 설치대수
  lhMechApartment?: UseVerdict; // LH 인수 가능 여부
  lhMechUrban?: UseVerdict;
  lhMechOfficetel?: UseVerdict;
  lhMechMaxPercent?: number;    // LH 인수 기계식 최대비율(%)
  lhParking03?: UseVerdict;     // LH 0.3대 특례 적용 가능 여부
  lhParking03MaxArea?: number;  // 특례 전용면적 상한(㎡, 미만)
  lhMinHomes?: number;          // LH 최소 매입 호수
  lhCommunityThreshold?: number;// 커뮤니티 설치 기준 세대수
  lhCommunitySqmPerHome?: number;
  publicOpenSpaceRatio?: number;// 공개공지 % of site
}
export type ParamKey = keyof RuleParams;

export interface ReviewRow {
  id: string;
  /** 첫 번째 구분 열 (예: 기계식주차) */
  group: string;
  /** 두 번째 구분 열 (예: 조례 / LH 기준). 없으면 group 셀이 두 칸을 차지한다. */
  sub?: string;
  section: "site" | "planning" | "building" | "parking" | "lh" | "extra";
  content: string;
  law: string;
  note: string;
  status: RowStatus;
  sources: SourceRef[];
  params?: RuleParams;
  /** 근거 누락 시 무엇이 빠졌는지 */
  missing?: string;
  /** 자동 재조회 시 덮어쓰지 않음 */
  edited?: boolean;
  origin: "auto" | "user";
  updatedAt?: string;
}

export interface UnitType {
  id: string;
  name: string;
  exclusive: number; // 전용면적 ㎡
  share: number;     // 구성비 %
  supply?: LhSupply;
}

export interface Scenario {
  id: string;
  name: string;
  use: UseKind;
  farMode: "base" | "relaxed" | "custom";
  /** 완화 용적률 대안에서 고른 값(%). 없으면 법규검토표의 대표 완화값 */
  relaxedFar?: number;
  /** farMode custom: 검토자 지정 용적률(%) */
  customFar?: number;
  parking: "self" | "mixed";
  mechanicalShare: number;   // 희망 기계식 비율 %
  apply03: boolean;          // LH 0.3대 특례 시나리오
  types: UnitType[];
  unitsPerFloor: number;     // 기준층 호수 (0 = 자동)
  efficiency: number;        // 공동주택: 전용/공급 %, 오피스텔: 전용/계약 %
  farEfficiency: number;     // 지상 용적률 산정면적 대비 전용 %
  floorHeight: number;       // m
}

export interface Assumptions {
  floorPlateRatio: number;       // 최대 건축면적 대비 기준층 계획면적 %
  basementRatio: number;         // 대지면적 대비 지하층 계획면적 %
  selfParkingArea: number;       // 자주식 1대당 소요면적 ㎡ (차로 포함)
  mechanicalParkingArea: number; // 기계식 1대당 소요면적 ㎡
  mechanicalStaging: number;     // 기계식 출입·대기 공간 ㎡
  equipmentRatio: number;        // 기계·전기실 등 지하 부속 (지상연면적 대비 %)
  equipmentMin: number;          // 기계·전기실 최소 ㎡
  groundFloorHeight: number;     // 1층 층고 m
  amenityApartment: number;      // 부대복리 ㎡/세대 (계획 가정)
  amenityOfficetel: number;      // 부대시설 ㎡/호
  otherCommonRatio: number;      // 계약면적 산정용 기타공용 (지하주차 등) 배분 %
}

export interface SiteInput {
  address: string;
  extraParcels: string[];
  siteAreaOverride?: number;
  business: BusinessType;
  uses: UseKind[];
  supplies: LhSupply[];
  /** 지구단위계획 획지번호 (예: C04). 확인되기 전에는 획지 기준을 적용하지 않는다. */
  blockNo?: string;
  /** 청년형 0.3대 특례 입지 (역 출구·대학 500m) 확인 */
  transitWithin500m?: boolean;
  /** 개통 예정역(공사 중)도 역세권 판정에 포함 (LH 인정 여부는 지역본부 확인) */
  countPlannedStations?: boolean;
  memo?: string;
}

export interface Project {
  schema: 2;
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  site: SiteInput;
  review: SiteReviewResult | null;
  reviewedAt?: string;
  rows: ReviewRow[];
  scenarios: Scenario[];
  selectedScenarioId: string;
  assumptions: Assumptions;
  documents: UploadedDocument[];
  legalDone: boolean;
  massingDone: boolean;
}
