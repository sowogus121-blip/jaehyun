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

  it("enforces a verified 50% LH mechanical limit despite an editable 70% input", () => {
    const input = {
      ...EXAMPLE_INPUT, businessMode: "purchase" as const,
      mechanicalAllowed: true, mechanicalMaxRatio: 70,
      officetelParkingRatio: 0.5,
    };
    const lh = calculateAlternative(input, ALTERNATIVES[3], {
      planningEvidence: "unknown",
      usePermissions: { apartment: "unknown", officetel: "unknown" },
      lhPurchaseEligibility: { apartment: "unknown", officetel: "unknown" },
      mechanicalParkingEligibility: "conditional",
      lhPurchaseMechanicalMaxPercent: 50,
    });
    const unverified = calculateAlternative(input, ALTERNATIVES[3]);
    expect(lh.parking.mechanicalCount).toBe(Math.floor(lh.parking.finalCount * 0.5));
    expect(unverified.parking.mechanicalCount).toBe(Math.floor(unverified.parking.finalCount * 0.7));
    expect(lh.warnings.join(" ")).toContain("상한 50%");
    // The LH cap does not carry over to a self-development scheme.
    const direct = calculateAlternative({...input, businessMode: "direct"}, ALTERNATIVES[3], {
      planningEvidence: "unknown",
      usePermissions: { apartment: "unknown", officetel: "unknown" },
      lhPurchaseEligibility: { apartment: "unknown", officetel: "unknown" },
      mechanicalParkingEligibility: "conditional",
      lhPurchaseMechanicalMaxPercent: 50,
    });
    expect(direct.parking.mechanicalCount).toBe(Math.floor(direct.parking.finalCount * 0.7));
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
      lhSupplyType: "youth" as const,
      businessMode: "purchase" as const,
      specialParkingEnabled: true,
      specialParkingApproval: "approved" as const,
      purchaseAgreementConfirmed: true,
      specialParkingUseScopeConfirmed: true,
      specialParkingLhConfirmed: true,
      specialParkingLocationConfirmed: true,
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
  it("keeps project efficiency defaults 75% and 45% and updates all four alternatives", () => {
    expect(DEFAULT_INPUT.apartmentEfficiency).toBe(75);
    expect(DEFAULT_INPUT.officetelEfficiency).toBe(45);
    const base=calculateAll(EXAMPLE_INPUT);
    expect(base.map((r) => r.definition.efficiency)).toEqual([0.75,0.75,0.45,0.45]);
    const changed=calculateAll({...EXAMPLE_INPUT,apartmentEfficiency:80,officetelEfficiency:55});
    expect(changed.map((r) => r.definition.efficiency)).toEqual([0.8,0.8,0.55,0.55]);
    expect(changed[0].grossAreaPerUnit).toBeLessThan(base[0].grossAreaPerUnit);
    expect(changed[2].grossAreaPerUnit).toBeLessThan(base[2].grossAreaPerUnit);
    expect(changed[0].unitCount).toBeGreaterThanOrEqual(base[0].unitCount);
    expect(changed[2].unitCount).toBeGreaterThanOrEqual(base[2].unitCount);
    expect(changed[0].formulas.some((value)=>value.includes("80%"))).toBe(true);
    expect(changed[2].formulas.some((value)=>value.includes("55%"))).toBe(true);
  });

  it("preserves user efficiencies when changing site while clearing parcel-specific zoning", () => {
    const current={...EXAMPLE_INPUT,apartmentEfficiency:82,officetelEfficiency:49};
    const reset=resetSiteDependentInput(current,"부산광역시 수영구 광안동 10-1");
    expect(reset.apartmentEfficiency).toBe(82);
    expect(reset.officetelEfficiency).toBe(49);
    expect(reset.baseFar).toBe(0);
    expect(reset.siteArea).toBe(0);
  });

});
