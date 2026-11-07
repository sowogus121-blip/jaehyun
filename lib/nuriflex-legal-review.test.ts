import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT } from "./calculator";
import { buildLegalReviewReport } from "./legal-review-report";
import { NURIFLEX_750_14 } from "./nuriflex-bangbae-750-14";

const site = { ...DEFAULT_INPUT, address: NURIFLEX_750_14.address, siteArea: 0, zone: "미확인" as const, businessMode: "purchase" as const, lhSupplyType: "youth" as const };
const row = (report: ReturnType<typeof buildLegalReviewReport>, id: string) => {
  const match = report.rows.find((item) => item.id === id);
  if (!match) throw new Error("Missing legal row "+id);
  return match;
};

describe("Nuriflex legal report from 2026-11-08 uploaded primary evidence", () => {
  it("overrides unknown generic municipal OCR with the verified EUM parcel and general maxima", () => {
    const report = buildLegalReviewReport(site, null);
    expect(report.zone).toBe("준주거지역");
    expect(report.area).toBe(1211.1);
    expect(row(report, "area").status).toBe("source");
    expect(row(report, "zone").detail).toContain("가로구역별 최고높이 제한지역");
    expect(row(report, "bcr")).toMatchObject({ status:"source" });
    expect(row(report, "bcr").detail).toContain("60%");
    expect(row(report, "far")).toMatchObject({ status:"source" });
    expect(row(report, "far").detail).toContain("400%");
    expect(row(report, "landscape").detail).toContain("15%");
    expect(row(report, "landscape").detail).toContain("181.7㎡");
  });
  it("separates established rule/text from still-unapproved site permits", () => {
    const report = buildLegalReviewReport(site, null);
    expect(row(report, "use").status).toBe("conditional");
    expect(row(report, "height").status).toBe("conditional");
    expect(row(report, "height").detail).toContain("동작대로");
    expect(row(report, "relax").status).toBe("conditional");
    expect(row(report, "relax").detail).toContain("500%");
    expect(row(report, "plan").status).toBe("conditional");
    expect(row(report, "sun").status).toBe("conditional");
    expect(row(report, "setback").status).toBe("conditional");
    expect(row(report, "road").status).toBe("conditional");
    expect(row(report, "special-parking").detail).toContain("0.3대");
    expect(row(report, "nuri-lh7").status).toBe("source");
    expect(row(report, "nuri-parking-ramp").detail).toContain("6m");
  });
  it("never grants parcel-specific Nuriflex legal claims to a neighboring lot or assembled site", () => {
    const neighbor = buildLegalReviewReport({ ...site, address:"서울 서초구 방배동 750-15" }, null);
    expect(row(neighbor, "bcr").detail).not.toContain("726.7㎡");
    expect(neighbor.rows.some((x)=>x.id==="nuri-lh7")).toBe(false);
    const combined = buildLegalReviewReport({ ...site, multipleParcels:true, parcelList:"서울 서초구 방배동 750-15" }, null);
    expect(combined.rows.some((x)=>x.id==="nuri-lh7")).toBe(false);
  });
});
