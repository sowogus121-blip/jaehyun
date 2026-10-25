import { describe, expect, it } from "vitest";
import { ALTERNATIVES, EXAMPLE_INPUT, calculateAlternative } from "../lib/calculator";
import { activeReviewedRules, applyReviewedRule, confirmReviewedRule, siteScopeKey } from "../lib/rule-application";
import type { SiteReviewResult } from "../lib/types";

const candidate = {
  topic: "용적률",
  sourceTitle: "검증용 가상시 도시계획 조례",
  sourceUrl: "https://www.law.go.kr/DRF/lawService.do?ID=123",
  excerpt: "제2종일반주거지역의 용적률은 관계 규정에 따른다.",
};
const input = { ...EXAMPLE_INPUT, address: "가상시 테스트동 123-4" };
const review = { mixedUseZones: false, ordinanceArticleCandidates: [{ ...candidate, article: "제12조", verified: false }] } as unknown as SiteReviewResult;

describe("review-gated rule application", () => {
  it("connects a reviewed local FAR to actual unit calculations", () => {
    const rule = confirmReviewedRule(input, review, "baseFar", 175, candidate, "2026-10-25T01:00:00Z");
    expect(rule?.reviewStatus).toBe("user-reviewed");
    const applied = applyReviewedRule(input, rule!);
    expect(applied.baseFar).toBe(175);
    expect(calculateAlternative(applied, ALTERNATIVES[0]).unitCount)
      .toBeLessThan(calculateAlternative(input, ALTERNATIVES[0]).unitCount);
    expect(activeReviewedRules(applied, [rule!])).toHaveLength(1);
  });

  it("updates separately reviewed apartment and officetel parking coefficients", () => {
    const parkingEvidence = { ...candidate, topic: "주차", excerpt: "주차기준 관련 별표 검토" };
    const parkingReview: SiteReviewResult = { ...review, ordinanceArticleCandidates: [{ ...parkingEvidence, article: "제21조", verified: false as const }] };
    const apartment = confirmReviewedRule(input, parkingReview, "apartmentParkingRatio", 0.7, parkingEvidence, "2026-10-25");
    const officetel = confirmReviewedRule(input, parkingReview, "officetelParkingRatio", 0.4, parkingEvidence, "2026-10-25");
    const changed = applyReviewedRule(applyReviewedRule(input, apartment!), officetel!);
    expect(calculateAlternative(changed, ALTERNATIVES[0]).parking.originalLegalRatio).toBe(0.7);
    expect(calculateAlternative(changed, ALTERNATIVES[2]).parking.originalLegalRatio).toBe(0.4);
  });

  it("rejects a result from another address, a fake source, and a different topic", () => {
    const rule = confirmReviewedRule(input, review, "baseFar", 175, candidate, "2026-10-25")!;
    const moved = { ...input, address: "다른시 테스트동 1" };
    expect(siteScopeKey(moved)).not.toBe(siteScopeKey(input));
    expect(applyReviewedRule(moved, rule)).toBe(moved);
    expect(activeReviewedRules(moved, [rule])).toHaveLength(0);
    expect(confirmReviewedRule(input, review, "baseFar", 175, { ...candidate, sourceUrl: "https://example.com/rules" }, "2026-10-25")).toBeNull();
    expect(confirmReviewedRule(input, review, "buildingCoverageRatio", 50, candidate, "2026-10-25")).toBeNull();
    expect(confirmReviewedRule(input, review, "baseFar", -20, candidate, "2026-10-25")).toBeNull();
  });

  it("does not attach one-zone evidence to mixed zoning sites", () => {
    expect(confirmReviewedRule(input, { ...review, mixedUseZones: true }, "baseFar", 175, candidate, "2026-10-25")).toBeNull();
  });
});
