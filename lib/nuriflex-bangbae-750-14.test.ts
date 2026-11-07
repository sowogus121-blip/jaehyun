import { describe, expect, it } from "vitest";
import { NURIFLEX_750_14, isNuriflexBangbae, screenNuriflex } from "./nuriflex-bangbae-750-14";

describe("누리플렉스 750-14 청년형 개략검토", () => {
  it("matches the known parcel and road-name address without unrelated parcels", () => {
    expect(isNuriflexBangbae("서울특별시 서초구 방배동 750-14")).toBe(true);
    expect(isNuriflexBangbae("서초구 사평대로 16")).toBe(true);
    expect(isNuriflexBangbae("누리플렉스 반포 본사")).toBe(true);
    expect(isNuriflexBangbae("서울 서초구 방배동 750-15")).toBe(false);
  });
  it("calculates youth urban housing at 22m² across FAR assumptions", () => {
    expect(screenNuriflex("urban",22,350).homes).toBe(129);
    expect(screenNuriflex("urban",22,400).homes).toBe(147);
    const at400=screenNuriflex("urban",22,400);
    expect(at400.parking03Conditional).toBe(45);
    expect(at400.parking05).toBe(74);
    expect(screenNuriflex("urban",22,500).homes).toBe(185);
  });
  it("does not misclassify LH private purchase as automatic Seoul 500% bonus", () => {
    expect(NURIFLEX_750_14.vworldVerification.zone).toBe("준주거지역");
    expect(NURIFLEX_750_14.vworldVerification.approximateParcelSqm).toBe(1209.1);
    expect(NURIFLEX_750_14.districtPlanGIS.pointInside).toBe(false);
    expect(NURIFLEX_750_14.districtPlanGIS.nearestPlanMeters).toBe(102.5);
    expect(NURIFLEX_750_14.seoul500Scenario.minPublicRentalCountedFloorSqm).toBe(605.55);
    expect(NURIFLEX_750_14.seoul500Scenario.status).toBe("unconfirmed-for-lh-alone");
    expect(NURIFLEX_750_14.sources.lhSeoul7.closesAt).toBe("2026-11-30");
  });
  it("retains the lawful baseline parking in office comparisons", () => {
    const at400=screenNuriflex("officetel",22,400);
    expect(at400.homes).toBe(96);
    expect(at400.parking05).toBe(48);
    expect(at400.parking03Conditional).toBe(29);
    expect(at400.parking05GrossSqm).toEqual([1680,1920]);
  });
});