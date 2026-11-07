import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT } from "../lib/calculator";
import { buildLegalReviewReport } from "../lib/legal-review-report";
import { getPreliminaryOrdinanceInputs } from "../lib/massing-readiness";
import type { UploadedDocument } from "../lib/types";

const bangbae = { ...DEFAULT_INPUT, address: "서울특별시 서초구 방배동 750-14" };

describe("user-supplied sources are reflected without being treated as site approvals", () => {
  it("extracts ordinary 60/400 from the verified Bangbae lot report despite annotations", () => {
    const report = buildLegalReviewReport(bangbae, null);
    expect(report.area).toBe(1211.1);
    expect(report.rows.find(row => row.id === "height")?.status).toBe("conditional");
    expect(getPreliminaryOrdinanceInputs(report.rows)).toEqual({ bcr: 60, far: 400 });
  });

  it("does not parse a conditional 500% scenario as ordinary FAR", () => {
    expect(getPreliminaryOrdinanceInputs([
      { id: "bcr", status: "source", detail: "60% 이하 (조례 일반기준)" },
      { id: "far", status: "conditional", detail: "500% 이하 (준주거지역 조례 일반상한 · 미승인)" },
    ])).toBeNull();
  });

  it("connects analyzed uploaded documents only to the current site", () => {
    const attached: UploadedDocument = {
      id: "sample-height-pdf",
      name: "동작대로_지침.pdf",
      size: 1200,
      category: "검토자료",
      sourceAddress: bangbae.address,
      status: "analyzed",
      uploadedAt: "2026-11-08T00:00:00+09:00",
      analysis: {
        format: "pdf", pageCount: 10, textLength: 3200, preview: "",
        warnings: [],
        candidates: [{ topic: "높이", quote: "최고높이 기준은 지침도 간선과 이면을 구분", value: null, unit: null, verified: false }],
      },
    };
    const matched = buildLegalReviewReport(bangbae, null, null, [], [attached]);
    expect(matched.rows.some(row => row.label.includes("제출자료 본문 검토"))).toBe(true);
    expect(matched.rows.find(row => row.id === "height")?.note).toContain("동작대로_지침.pdf");

    const unrelated = buildLegalReviewReport(
      { ...DEFAULT_INPUT, address: "경기도 의정부시 가능동 75-1" },
      null, null, [], [attached],
    );
    expect(unrelated.rows.some(row => row.label.includes("제출자료 본문 검토"))).toBe(false);
    expect(unrelated.rows.find(row => row.id === "height")?.status).toBe("unknown");
  });

  it("does not reuse legacy uploads with unknown site ownership", () => {
    const unscoped: UploadedDocument = {
      id: "legacy", name: "unknown.pdf", size: 800, category: "검토자료",
      status: "analyzed", uploadedAt: "2026-11-07",
      analysis: { format: "pdf", pageCount: 2, textLength: 200,
        preview: "", warnings: [],
        candidates: [{ topic: "용적률", quote: "400% 이하", value: 400, unit: "%", verified: false }] },
    };
    const report = buildLegalReviewReport(bangbae, null, null, [], [unscoped]);
    expect(report.rows.some(row => row.label.includes("제출자료 본문 검토"))).toBe(false);
  });
});
