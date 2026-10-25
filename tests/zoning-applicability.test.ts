import { describe, expect, it } from "vitest";
import { suggestZoningRules } from "../lib/zoning-applicability";
import type { SiteReviewResult } from "../lib/types";

const base = {
  landUse: [{ category: "용도지역", name: "제2종일반주거지역", code: "VWorld", source: "VWorld", status: "verified" }],
  mixedUseZones: false,
  districtPlan: false,
  ordinanceArticleCandidates: [
    { topic: "용적률", excerpt: "1. 제1종일반주거지역: 180퍼센트 2. 제2종일반주거지역: 230퍼센트 이하 3. 제3종일반주거지역: 250퍼센트",
      sourceTitle: "가상시 도시계획 조례", sourceUrl: "https://www.law.go.kr/ordin", article: "제37조", verified: false },
    { topic: "건폐율", excerpt: "1. 제2종일반주거지역: 60퍼센트 이하",
      sourceTitle: "가상시 도시계획 조례", sourceUrl: "https://www.law.go.kr/ordin", article: "제36조", verified: false },
  ],
} as unknown as SiteReviewResult;

describe("single-zone conditional ordinance candidates", () => {
  it("matches only the exact parcel zone, not the first or largest number", () => {
    const values = suggestZoningRules(base);
    expect(values.find((x) => x.topic === "용적률")?.value).toBe(230);
    expect(values.find((x) => x.topic === "건폐율")?.value).toBe(60);
    expect(values.every((x) => x.status === "conditional")).toBe(true);
  });

  it("rejects mixed zones and ambiguous/no-operator percentages", () => {
    expect(suggestZoningRules({ ...base, mixedUseZones: true })).toHaveLength(0);
    const ambiguous = {
      ...base,
      ordinanceArticleCandidates: [{ ...base.ordinanceArticleCandidates![0], excerpt: "제2종일반주거지역은 심의를 거쳐 230퍼센트 이하" }],
    };
    expect(suggestZoningRules(ambiguous)).toHaveLength(0);
  });

  it("flags district-unit-plan review even when a municipal ordinance row matches", () => {
    const matched = suggestZoningRules({ ...base, districtPlan: true });
    expect(matched.length).toBeGreaterThan(0);
    expect(matched.every((x) => x.needsDistrictPlanReview)).toBe(true);
  });
});
