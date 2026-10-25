import type { AlternativeDefinition, ProjectInput } from "./types";

export const PARKING_03_LAW_URL =
  "https://www.law.go.kr/LSW/lsSideInfoP.do?docCls=jo&joBrNo=00&joNo=0037&lsiSeq=289503&urlMode=lsScJoRltInfoR";

export type ParkingCheckStatus = "pass" | "fail" | "unknown";

export interface Parking03Screening {
  status: "ineligible" | "conditional" | "confirmed";
  canShowConditional: boolean;
  canApply: boolean;
  checks: Array<{ id: string; label: string; status: ParkingCheckStatus; detail: string }>;
  sourceUrl: string;
}

/** Statutory pre-screening, not an approval by LH or the permit authority. */
export function screenParking03(input: ProjectInput, alternative: AlternativeDefinition): Parking03Screening {
  const areaMatches = alternative.exclusiveArea < 30;
  const isPurchase = input.businessMode === "purchase";
  const checked = input.specialParkingEnabled;
  const isOfficetel = alternative.useType === "officetel";
  const checks: Parking03Screening["checks"] = [
    {
      id: "area", label: "세대당 전용면적 30㎡ 미만",
      status: areaMatches ? "pass" : "fail",
      detail: String(alternative.exclusiveArea) + "㎡ · " + (areaMatches ? "규모 조건 충족" : "적용대상 아님"),
    },
    {
      id: "mode", label: "공공주택사업자 매도약정 대상 사업",
      status: input.businessMode === "undecided" ? "unknown" : isPurchase ? "pass" : "fail",
      detail: isPurchase ? "사업방식만 매입약정으로 선택됨 · 체결 여부 별도 확인" : "민간 신축매입약정 여부 확인 필요",
    },
    {
      id: "agreement", label: "실제 공공주택사업자 매도약정 체결",
      status: input.purchaseAgreementConfirmed ? "pass" : "unknown",
      detail: input.purchaseAgreementConfirmed ? "사용자가 관련 원본 문서 확인 표시" : "약정 체결문서 확인 전",
    },
    {
      id: "scope", label: isOfficetel ? "오피스텔의 법적 적용대상 및 인허가 인정" : "대상 건축물의 법적 적용범위 확인",
      status: input.specialParkingUseScopeConfirmed ? "pass" : "unknown",
      detail: input.specialParkingUseScopeConfirmed ? "사용자가 LH/관할청 원본 검토 확인 표시" : "건축물 용도·주택 해당성 및 허가권자 적용범위 미확인",
    },
    {
      id: "lh", label: "최신 관할 LH 공고·별도 요건 충족",
      status: input.specialParkingLhConfirmed ? "pass" : "unknown",
      detail: input.specialParkingLhConfirmed ? "사용자가 관할 지역본부 기준 확인 표시" : "해당 연도 공고·주택유형·역세권 등 별도조건 미확인",
    },
    {
      id: "approval", label: "특례 적용 승인·근거 최종 확인",
      status: input.specialParkingApproval === "rejected" ? "fail" :
        input.specialParkingApproval === "approved" ? "pass" : "unknown",
      detail: input.specialParkingApproval === "approved" ? "사용자 승인 확인 선택 · 관련 문서 확인 요망" : "승인 확인 전",
    },
  ];
  const basePossible = areaMatches && isPurchase && checked && input.specialParkingApproval !== "rejected";
  const canApply = basePossible && checks.every((check) => check.status === "pass");
  return {
    status: !areaMatches || (input.businessMode !== "undecided" && !isPurchase) ||
      input.specialParkingApproval === "rejected" ? "ineligible" : canApply ? "confirmed" : "conditional",
    canShowConditional: basePossible,
    canApply,
    checks,
    sourceUrl: PARKING_03_LAW_URL,
  };
}
