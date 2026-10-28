import { describe, expect, it } from "vitest";
import { ALTERNATIVES, EXAMPLE_INPUT, calculateParking } from "../lib/calculator";
import { screenParking03 } from "../lib/lh-parking-screen";

const candidate = {
  ...EXAMPLE_INPUT,
  businessMode: "purchase" as const,
  lhSupplyType: "youth" as const,
  specialParkingEnabled: true,
  specialParkingApproval: "approved" as const,
  officetelParkingRatio: 0.6,
};

describe("LH 0.3 parking statutory screening", () => {
  it("keeps basic legal rate when agreement, housing scope and LH guidance are unverified", () => {
    const screen = screenParking03(candidate, ALTERNATIVES[2]);
    expect(screen.status).toBe("conditional");
    expect(screen.canApply).toBe(false);
    expect(screen.checks.filter((x) => x.status === "unknown")).toHaveLength(4);
    const parking = calculateParking(candidate, ALTERNATIVES[2], 100);
    expect(parking.specialApplied).toBe(false);
    expect(parking.finalCount).toBe(60);
    expect(parking.conditionalCount).toBe(30);
  });

  it("applies 0.3 only with full documented preconditions and approved flag", () => {
    const documented = {
      ...candidate,
      purchaseAgreementConfirmed: true,
      specialParkingUseScopeConfirmed: true,
      specialParkingLhConfirmed: true,
      specialParkingLocationConfirmed: true,
    };
    const screen = screenParking03(documented, ALTERNATIVES[2]);
    expect(screen.status).toBe("confirmed");
    expect(screen.canApply).toBe(true);
    expect(calculateParking(documented, ALTERNATIVES[2], 100).finalCount).toBe(30);
    const pending = { ...documented, specialParkingApproval: "conditional" as const };
    expect(calculateParking(pending, ALTERNATIVES[2], 100).finalCount).toBe(60);
  });

  it("requires separate evidence of straight-line 500m for youth even when LH notice was checked", () => {
    const withoutLocation = {
      ...candidate, purchaseAgreementConfirmed: true,
      specialParkingUseScopeConfirmed: true, specialParkingLhConfirmed: true,
      specialParkingLocationConfirmed: false,
    };
    const check = screenParking03(withoutLocation, ALTERNATIVES[2]);
    expect(check.canApply).toBe(false);
    expect(check.checks.find(item=>item.id==="location")?.status).toBe("unknown");
    expect(calculateParking(withoutLocation, ALTERNATIVES[2], 100).finalCount).toBe(60);
    expect(screenParking03({...withoutLocation,lhSupplyType:"senior" as const},ALTERNATIVES[2]).canApply).toBe(true);
  });
  it("does not grant youth/senior 0.3 ratio to newlywed or general plans",()=>{
    const checked={...candidate,purchaseAgreementConfirmed:true,specialParkingUseScopeConfirmed:true,specialParkingLhConfirmed:true,specialParkingLocationConfirmed:true};
    expect(screenParking03({...checked,lhSupplyType:"newlywed" as const},ALTERNATIVES[2]).status).toBe("ineligible");
    expect(calculateParking({...checked,lhSupplyType:"newlywed" as const},ALTERNATIVES[2],100).finalCount).toBe(60);
    expect(screenParking03({...checked,lhSupplyType:"senior" as const},ALTERNATIVES[2]).canApply).toBe(true);
    expect(screenParking03({...checked,lhSupplyType:"undecided" as const},ALTERNATIVES[2]).canApply).toBe(false);
  });
  it("never extends this B-plan scenario to 46m2 apartment or non-purchase projects", () => {
    const allChecked = {
      ...candidate,
      purchaseAgreementConfirmed: true,
      specialParkingUseScopeConfirmed: true,
      specialParkingLhConfirmed: true,
      specialParkingLocationConfirmed: true,
    };
    expect(screenParking03(allChecked, ALTERNATIVES[0]).status).toBe("ineligible");
    expect(screenParking03({ ...allChecked, businessMode: "direct" as const }, ALTERNATIVES[2]).canApply).toBe(false);
    expect(screenParking03({ ...allChecked, specialParkingApproval: "rejected" as const }, ALTERNATIVES[2]).status).toBe("ineligible");
  });
});
