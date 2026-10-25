import type {
  AlternativeEligibilityStatus,
  CalculationContext,
  ProjectInput,
  SiteReviewResult,
  UseType,
} from "./types";

function findingOutcome(review: SiteReviewResult | null, topic: string, useType?: UseType): AlternativeEligibilityStatus {
  const findings = review?.ruleFindings ?? [];
  const relevant = findings.filter((finding) => {
    const searchable = `${finding.topic} ${finding.sourceTitle} ${finding.conditions.join(" ")}`;
    const useMatches = !useType || searchable.includes(useType === "apartment" ? "공동주택" : "오피스텔");
    return useMatches && searchable.includes(topic) && finding.verified;
  });
  if (relevant.some((finding) => finding.outcome === "not-applicable")) return "ineligible";
  if (relevant.some((finding) => finding.outcome === "applicable")) return "eligible";
  if (relevant.some((finding) => finding.outcome === "conditional")) return "conditional";
  return "unknown";
}

export function deriveCalculationContext(review: SiteReviewResult | null, input: ProjectInput): CalculationContext {
  const usePermissions: CalculationContext["usePermissions"] = {
    apartment: findingOutcome(review, "허용용도", "apartment"),
    officetel: findingOutcome(review, "허용용도", "officetel"),
  };
  const lhPurchaseEligibility: CalculationContext["lhPurchaseEligibility"] = {
    apartment: findingOutcome(review, "LH 매입", "apartment"),
    officetel: findingOutcome(review, "LH 매입", "officetel"),
  };
  const mechanicalFinding = findingOutcome(review, "기계식주차");

  return {
    planningEvidence: (review?.ruleFindings ?? []).some((finding) => finding.verified && ["건폐율", "용적률", "높이"].includes(finding.topic)) ? "verified" : review?.planningStandards ? "review" : "unknown",
    usePermissions,
    lhPurchaseEligibility,
    mechanicalParkingEligibility: input.mechanicalAllowed ? mechanicalFinding : "ineligible",
    lhPurchaseMechanicalRestrictedToOfficetelOrUrban: Boolean(review?.lhNotice?.rules && input.businessMode === "purchase"),
  };
}

export function calculateReviewCompleteness(review: SiteReviewResult | null) {
  if (!review) return 0;
  const requiredTopics = ["허용용도", "건폐율", "용적률", "높이", "주차", "조경", "일조", "LH 매입"];
  const verifiedTopics = new Set((review.ruleFindings ?? []).filter((finding) => finding.verified && finding.outcome !== "unresolved").map((finding) => finding.topic));
  const evidenceScore = requiredTopics.filter((topic) => verifiedTopics.has(topic)).length / requiredTopics.length;
  const siteScore = [review.location, review.parcel, review.landUse.length > 0].filter(Boolean).length / 3;
  return Math.round((evidenceScore * 0.75 + siteScore * 0.25) * 100);
}
