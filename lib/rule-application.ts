import type { ProjectInput, SiteReviewResult } from "./types";

/** A discovered clause is not yet an applicable law for an individual parcel. */
export type ReviewedRuleField =
  | "buildingCoverageRatio"
  | "baseFar"
  | "apartmentParkingRatio"
  | "officetelParkingRatio"
  | "maxHeight"
  | "maxFloors";

export interface ReviewedRule {
  field: ReviewedRuleField;
  value: number;
  sourceTitle: string;
  sourceUrl: string;
  excerpt: string;
  scopeKey: string;
  reviewedAt: string;
  reviewStatus: "user-reviewed";
}

const LIMITS: Record<ReviewedRuleField, { min: number; max: number; topic: string }> = {
  buildingCoverageRatio: { min: 0.01, max: 100, topic: "건폐율" },
  baseFar: { min: 0.01, max: 2000, topic: "용적률" },
  apartmentParkingRatio: { min: 0, max: 10, topic: "주차" },
  officetelParkingRatio: { min: 0, max: 10, topic: "주차" },
  maxHeight: { min: 0.01, max: 1500, topic: "높이" },
  maxFloors: { min: 1, max: 200, topic: "높이" },
};

export function siteScopeKey(input: Pick<ProjectInput, "address" | "parcelList" | "multipleParcels">) {
  const trim = (value: string) => value.replace(/\s+/g, "").toLowerCase();
  const address = trim(input.address);
  if (!address) return "";
  const additional = input.multipleParcels
    ? input.parcelList.split(/\r?\n/).map(trim).filter(Boolean).sort().join("|")
    : "";
  return address + "#" + additional;
}

export function isGovernmentSource(value: string) {
  try {
    const url = new URL(value);
    if (url.protocol !== "https:") return false;
    const host = url.hostname.toLowerCase();
    return host === "law.go.kr" || host.endsWith(".law.go.kr")
      || host === "eum.go.kr" || host.endsWith(".eum.go.kr")
      || host === "lh.or.kr" || host.endsWith(".lh.or.kr")
      || host === "molit.go.kr" || host.endsWith(".molit.go.kr")
      || host.endsWith(".go.kr");
  } catch {
    return false;
  }
}

export function confirmReviewedRule(
  input: ProjectInput,
  review: SiteReviewResult | null,
  field: ReviewedRuleField,
  value: number,
  candidate: { topic: string; sourceTitle: string; sourceUrl: string; excerpt: string },
  reviewedAt: string,
): ReviewedRule | null {
  const limit = LIMITS[field];
  const scopeKey = siteScopeKey(input);
  if (!review || !scopeKey || review.mixedUseZones || !limit ||
    !Number.isFinite(value) || value < limit.min || value > limit.max ||
    (field === "maxFloors" && !Number.isInteger(value)) ||
    candidate.topic !== limit.topic || !candidate.sourceTitle.trim() ||
    !candidate.excerpt.trim() || !isGovernmentSource(candidate.sourceUrl)) return null;

  const hasMatchingSource = review.ordinanceArticleCandidates?.some((item) =>
    item.topic === candidate.topic && item.sourceTitle === candidate.sourceTitle &&
    item.sourceUrl === candidate.sourceUrl && item.excerpt === candidate.excerpt);
  if (!hasMatchingSource) return null;
  return {
    field, value, sourceTitle: candidate.sourceTitle,
    sourceUrl: candidate.sourceUrl, excerpt: candidate.excerpt,
    scopeKey, reviewedAt, reviewStatus: "user-reviewed",
  };
}

export function applyReviewedRule(input: ProjectInput, rule: ReviewedRule): ProjectInput {
  if (rule.reviewStatus !== "user-reviewed" || !isGovernmentSource(rule.sourceUrl) ||
    rule.scopeKey !== siteScopeKey(input)) return input;
  const limits = LIMITS[rule.field];
  if (!limits || !Number.isFinite(rule.value) || rule.value < limits.min ||
    rule.value > limits.max || (rule.field === "maxFloors" && !Number.isInteger(rule.value))) return input;
  return { ...input, [rule.field]: rule.value };
}

export function activeReviewedRules(input: ProjectInput, rules: ReviewedRule[]) {
  const scope = siteScopeKey(input);
  return rules.filter((rule) => rule.scopeKey === scope && rule.reviewStatus === "user-reviewed"
    && isGovernmentSource(rule.sourceUrl) && input[rule.field] === rule.value);
}

export function removeRuleForEditedField(rules: ReviewedRule[], field: keyof ProjectInput) {
  return rules.filter((rule) => rule.field !== field);
}
