import { describe, expect, it } from "vitest";
import {
  ALTERNATIVES,
  DEFAULT_INPUT,
  EXAMPLE_INPUT,
  calculateAll,
  calculateAlternative,
  calculateFacilities,
  getEvidenceStatus,
  getGrossAreaPerUnit,
  isSpecialParkingEligible,
  resetSiteDependentInput,
} from "../lib/calculator";

describe("LH Plan Lab calculation engine", () => {
  it("calculates 46㎡ apartment at 75% efficiency", () => {
    expect(getGrossAreaPerUnit(46, 0.75)).toBeCloseTo(61.3333, 3);
  });

  it("calculates 25㎡ officetel at 45% efficiency", () => {
    expect(getGrossAreaPerUnit(25, 0.45)).toBeCloseTo(55.5556, 3);
  });

  it("calculates four alternatives independently", () => {
    const results = calculateAll(EXAMPLE_INPUT);
    expect(results.map((result) => result.definition.id)).toEqual(["A-1", "A-2", "B-1", "B-2"]);
    expect(results).toHaveLength(4);
    expect(results[0]).not.toBe(results[1]);
  });

  it("respects FAR and building coverage limits", () => {
    const result = calculateAlternative(EXAMPLE_INPUT, ALTERNATIVES[0]);
    expect(result.farCountedArea).toBeLessThanOrEqual(result.farLimitArea);
    expect(result.plannedBcr).toBeLessThanOrEqual(EXAMPLE_INPUT.buildingCoverageRatio);
  });

  it("rounds parking demand upward", () => {
    const input = { ...EXAMPLE_INPUT, apartmentParkingRatio: 0.73, lhApartmentParkingRatio: 0 };
    const result = calculateAlternative(input, ALTERNATIVES[0]);
    expect(result.parking.legalCount).toBe(Math.ceil(result.unitCount * 0.73));
  });

  it("applies 0.3 special only to eligible purchase officetel", () => {
    const eligible = { ...EXAMPLE_INPUT, businessMode: "purchase" as const, specialParkingEnabled: true };
    expect(isSpecialParkingEligible(eligible, ALTERNATIVES[2])).toBe(true);
    expect(isSpecialParkingEligible(eligible, ALTERNATIVES[0])).toBe(false);
    expect(isSpecialParkingEligible({ ...eligible, businessMode: "undecided" }, ALTERNATIVES[2])).toBe(false);
  });

  it("recalculates facilities across unit thresholds", () => {
    const before = calculateFacilities("apartment", 49).reduce((sum, item) => sum + item.area, 0);
    const after = calculateFacilities("apartment", 50).reduce((sum, item) => sum + item.area, 0);
    expect(after).toBeGreaterThan(before);
  });

  it("separates total floor area from FAR-counted area", () => {
    const result = calculateAlternative(EXAMPLE_INPUT, ALTERNATIVES[0]);
    expect(result.totalFloorArea).toBeGreaterThan(result.farCountedArea);
    expect(result.belowGroundArea).toBeGreaterThan(0);
  });

  it("warns and falls back when mechanical parking is unavailable", () => {
    const result = calculateAlternative({ ...EXAMPLE_INPUT, mechanicalAllowed: false }, ALTERNATIVES[1]);
    expect(result.parking.mechanicalCount).toBe(0);
    expect(result.parking.selfCount).toBe(result.parking.finalCount);
    expect(result.warnings.some((warning) => warning.includes("전량 자주식"))).toBe(true);
  });

  it("marks missing legal evidence as unknown", () => {
    expect(getEvidenceStatus(false)).toBe("unknown");
    expect(getEvidenceStatus(false, true)).toBe("user");
  });

  it("uses an available floor limit without treating unknown height as zero", () => {
    const provisional = calculateAlternative({ ...EXAMPLE_INPUT, maxHeight: 0, maxFloors: 12 }, ALTERNATIVES[0]);
    expect(provisional.unitCount).toBeGreaterThan(0);
    expect(provisional.legalMaxFloors).toBe(12);
    expect(provisional.eligibility).not.toBe("eligible");
    expect(provisional.conditionalReasons.some((reason) => reason.includes("최고층수 또는 최고높이"))).toBe(true);
    const noLimits = calculateAlternative({ ...EXAMPLE_INPUT, maxHeight: 0, maxFloors: 0 }, ALTERNATIVES[0]);
    expect(noLimits.unitCount).toBe(0);
  });

  it("starts a new project without carrying over a demo site's legal values", () => {
    expect(DEFAULT_INPUT.address).toBe("");
    expect(DEFAULT_INPUT.siteArea).toBe(0);
    expect(DEFAULT_INPUT.buildingCoverageRatio).toBe(0);
    expect(DEFAULT_INPUT.baseFar).toBe(0);
  });

  it("clears site-dependent values when an address changes", () => {
    const changed = resetSiteDependentInput(EXAMPLE_INPUT, "부산광역시 해운대구 새 주소 1");
    expect(changed.address).toBe("부산광역시 해운대구 새 주소 1");
    expect(changed.siteArea).toBe(0);
    expect(changed.zone).toBe("미확인");
    expect(changed.baseFar).toBe(0);
    expect(changed.maxHeight).toBe(0);
    expect(changed.officetelParkingRatio).toBe(0);
  });

  it("keeps an unapproved 0.3 parking relaxation separate from the fallback count", () => {
    const input = {
      ...EXAMPLE_INPUT,
      businessMode: "purchase" as const,
      specialParkingEnabled: true,
      specialParkingApproval: "conditional" as const,
      officetelParkingRatio: 0.5,
      lhOfficetelParkingRatio: 0.5,
      lhParkingRatioVerified: false,
    };
    const parking = calculateAlternative(input, ALTERNATIVES[2]).parking;
    expect(parking.finalCount).toBe(parking.fallbackCount);
    expect(parking.conditionalCount).toBeLessThan(parking.fallbackCount);
    expect(parking.specialApplied).toBe(false);
  });

  it("does not let an unverified LH assumption cancel an approved relaxation", () => {
    const input = {
      ...EXAMPLE_INPUT,
      businessMode: "purchase" as const,
      specialParkingEnabled: true,
      specialParkingApproval: "approved" as const,
      officetelParkingRatio: 0.5,
      lhOfficetelParkingRatio: 0.5,
      lhParkingRatioVerified: false,
    };
    const parking = calculateAlternative(input, ALTERNATIVES[2]).parking;
    expect(parking.finalCount).toBe(parking.relaxedCount);
    expect(parking.finalCount).toBeLessThan(parking.lhCount);
    expect(parking.specialApplied).toBe(true);
  });

  it("blocks score-only recommendation when legal applicability is unknown", () => {
    const results = calculateAll(EXAMPLE_INPUT);
    expect(results.every((result) => !result.recommendable)).toBe(true);
    expect(results.every((result) => result.eligibility === "unknown")).toBe(true);
  });
});
