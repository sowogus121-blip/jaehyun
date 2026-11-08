import { describe, expect, it } from "vitest";
import { NURIFLEX_750_14 } from "../lib/nuriflex-bangbae-750-14";
import { DEFAULT_INPUT } from "../lib/calculator";
import { buildLegalReviewReport } from "../lib/legal-review-report";

describe("2026-11-08 Dongjak 1-zone height map candidate",()=>{
  it("keeps map height 60/80m separate from verified cadastral maximum",()=>{
    const record=NURIFLEX_750_14.designatedRoadHeightGIS;
    expect(record.mapCandidate).toMatchObject({
      sheet:"동작대로 1지구",block:"E",
      arterialBaseMeters:60,arterialMaxMeters:80,
      rearBaseMeters:32,rearMaxMeters:42,
      provisionalParcelMatch:true,
    });
    expect(record.heightLimitMeters).toBeNull();
  });
  it("displays explicit numeric candidate with conditional status for exact site",()=>{
    const report=buildLegalReviewReport({...DEFAULT_INPUT,address:"서울특별시 서초구 방배동 750-14"},null);
    const h=report.rows.find(x=>x.id==="height");
    expect(h?.status).toBe("conditional");
    expect(h?.detail).toContain("최고80m");
    expect(h?.note).toContain("미검증");
    expect(report.rows.find(x=>x.id==="far")?.detail).toContain("400%");
    expect(report.rows.find(x=>x.id==="sun")?.detail).toContain("정북일조");
  });
  it("does not assign E-block map candidate to a different parcel",()=>{
    const report=buildLegalReviewReport({...DEFAULT_INPUT,address:"서울특별시 서초구 방배동 750-13"},null);
    expect(report.rows.find(x=>x.id==="height")?.detail).not.toContain("최고80m");
  });
});
