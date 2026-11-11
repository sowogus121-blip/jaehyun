import { describe, expect, it } from "vitest";
import { getParcelMassingReview } from "./parcel-massing-reviews";

describe("Osong and Doksan conditional site massing", () => {
  it("refuses residential counts for an Osong C-block while preserving commercial envelope comparison", () => {
    const review = getParcelMassingReview("충북 청주시 오송읍 봉산리 992");
    expect(review?.category).toBe("commercial-only");
    expect(review?.siteArea).toBe(1265.7);
    expect(review?.scenarios.map(s => s.maxFloors)).toEqual([15, 10]);
    expect(review?.scenarios.map(s => Math.round(s.conditionalUpperArea))).toEqual([12657,10126]);
    expect(review?.scenarios.every(s => s.apt46Theoretical === null && s.officetel25Theoretical === null)).toBe(true);
  });
  it("separates Doksan 250 / conditional 300 / conditional 400 rather than applying 400 in project input", () => {
    const review = getParcelMassingReview("서울 금천구 독산동 151-10");
    expect(review?.category).toBe("conditional-residential");
    expect(review?.scenarios.map(s => s.farPercent)).toEqual([250, 300, 400]);
    expect(review?.scenarios.map(s => Math.round(s.farArea))).toEqual([2734,3281,4374]);
    expect(review?.scenarios.map(s => s.apt46Theoretical)).toEqual([42,50,67]);
    expect(review?.scenarios.map(s => s.officetel25Theoretical)).toEqual([72,87,116]);
    expect(review?.existingPermit).toContain("71호/0세대");
    expect(review?.legalGate).toContain("2008");
  });
  it("does not invent scenario data for neighboring parcels", () => {
    expect(getParcelMassingReview("충북 청주시 오송읍 봉산리 993")).toBeNull();
    expect(getParcelMassingReview("서울 금천구 독산동 151-11")).toBeNull();
  });
});
