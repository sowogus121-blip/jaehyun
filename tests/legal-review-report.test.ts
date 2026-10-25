import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT } from "../lib/calculator";
import { buildLegalReviewReport } from "../lib/legal-review-report";
import type { SiteReviewResult } from "../lib/types";

const place = "경기도 의정부시 가능동 75-1";
const city = "의정부시 도시계획 조례";
const baseInput = { ...DEFAULT_INPUT, address: place, siteArea: 1467 };
const officialUrl = "https://www.law.go.kr/DRF/lawService.do?target=ordin&MST=2072835";

function sampleReview(): SiteReviewResult {
  return {
    location: { address: place, parcelAddress: place, x: "127.04", y: "37.75" },
    parcel: { area: 1467, landCategory: "주유소용지", pnu: "4115011000100750001", approximate: false, source: "VWorld 지적정보" },
    landUse: [{ category: "용도지역", name: "제2종일반주거지역", code: "LT_C_UQ111", source: "VWorld", status: "verified" }],
    mixedUseZones: false,
    ordinances: [
      { name: city, link: officialUrl, localGovernment: "경기도 의정부시", promulgationDate: null, enforcementDate: "20250925", retrievalStatus: "metadata-only", applicationStatus: "not-assessed" },
      { name: "의정부시 주차장 설치 및 관리 조례", link: officialUrl, localGovernment: "경기도 의정부시", promulgationDate: null, enforcementDate: "20260109", retrievalStatus: "metadata-only", applicationStatus: "not-assessed" },
    ],
    ordinanceArticleCandidates: [
      { sourceTitle: city, sourceUrl: officialUrl, topic: "건폐율", article: "제42조 · 용도지역안에서의 건폐율",
        excerpt: "제42조 용도지역안에서의 건폐율. 3. 제1종일반주거지역 : 60퍼센트 이하 4. 제2종일반주거지역 : 60퍼센트 이하5. 제3종일반주거지역 : 50퍼센트 이하", verified: false },
      { sourceTitle: city, sourceUrl: officialUrl, topic: "용적률", article: "제46조 · 용도지역안에서의 용적률",
        excerpt: "제46조 용도지역안에서의 용적률. 3. 제1종일반주거지역 : 200퍼센트 이하 4. 제2종일반주거지역 : 250퍼센트 이하 5. 제3종일반주거지역 : 300퍼센트 이하", verified: false },
    ],
    districtPlan: false,
    officialDocuments: {
      checkedAt: "2026-10-25T00:00:00Z", totalCandidates: 0, analysisComplete: false,
      errors: [], documents: [],
    },
  } as unknown as SiteReviewResult;
}

describe("legal review worksheet", () => {
  it("shows sourced ordinary BCR/FAR in 18 auditable rows with named articles", () => {
    const r = buildLegalReviewReport(baseInput, sampleReview());
    expect(r.rows.length).toBeGreaterThanOrEqual(18);
    expect(r.rows.find((row) => row.id === "bcr")).toEqual(expect.objectContaining({
      detail: "60% 이하 (조례 일반기준)", status: "source", sourceUrl: officialUrl,
    }));
    expect(r.rows.find((row) => row.id === "far")).toEqual(expect.objectContaining({
      detail: "250% 이하 (조례 일반기준)", status: "source", sourceUrl: officialUrl,
    }));
    expect(r.rows.find((row) => row.id === "use")?.status).toBe("unknown");
    expect(r.rows.find((row) => row.id === "special-parking")?.detail).toContain("미적용");
    expect(r.calculatedLimits.find((x) => x.label.includes("용적률 · 계산"))?.value).toBe("미입력");
  });

  it("never uses the first or largest adjacent zone limit", () => {
    const r = buildLegalReviewReport(baseInput, sampleReview());
    expect(r.rows.find((row) => row.id === "far")?.detail).not.toContain("300%");
    expect(r.rows.find((row) => row.id === "bcr")?.detail).not.toContain("50%");
  });

  it("does not certify mixed zones or arbitrary values from a nonmatching ordinance", () => {
    const a = sampleReview();
    a.mixedUseZones = true;
    a.landUse.push({ category: "용도지역", name: "준주거지역", code: "LT_C_UQ111", source: "VWorld", status: "verified" });
    const result = buildLegalReviewReport(baseInput, a);
    expect(result.rows.find((r) => r.id === "far")?.status).not.toBe("source");
    expect(result.rows.find((r) => r.id === "bcr")?.status).not.toBe("source");
    expect(result.rows.find((r) => r.id === "zone")?.note).toContain("혼합");
  });

  it("preserves user-supplied assumptions separately from legally supported values", () => {
    const r = buildLegalReviewReport({ ...baseInput, baseFar: 290, buildingCoverageRatio: 70 }, sampleReview());
    expect(r.rows.find((x) => x.id === "far")?.detail).toContain("250%");
    expect(r.calculatedLimits.find((x) => x.label.includes("용적률 · 계산"))?.value).toBe("290%");
    expect(r.calculatedLimits.find((x) => x.label.includes("건폐율 · 계산"))?.value).toBe("70%");
    expect(r.rows.find((x) => x.id === "far")?.note).toContain("자동반영 안 함");
  });

  it("produces a useful unresolved report even without official API results", () => {
    const r = buildLegalReviewReport({ ...DEFAULT_INPUT, address: "부산광역시 해운대구 우동 1" }, null);
    expect(r.rows.length).toBeGreaterThanOrEqual(18);
    expect(r.rows.find((x) => x.id === "far")?.status).toBe("unknown");
    expect(r.confirmedSourceCount).toBe(0);
  });
});
