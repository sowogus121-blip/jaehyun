import { describe, expect, it } from "vitest";
import { DEFAULT_INPUT } from "../lib/calculator";
import { getMassingReadiness, getPreliminaryOrdinanceInputs } from "../lib/massing-readiness";

describe("usable massing and report readiness", () => {
  it("does not claim 0 dwellings when address alone has been verified", () => {
    const data = getMassingReadiness({ ...DEFAULT_INPUT, siteArea: 1467 });
    expect(data.canEstimateUnits).toBe(false);
    expect(data.missing).toEqual(["건폐율", "용적률", "계획 최고층수 또는 높이"]);
    expect(data.hasApartmentParking).toBe(false);
  });
  it("allows a provisional envelope while keeping unverified parking separate", () => {
    const input = { ...DEFAULT_INPUT, siteArea: 1467, buildingCoverageRatio: 60, baseFar: 250, maxFloors: 10 };
    const ready = getMassingReadiness(input);
    expect(ready.canEstimateUnits).toBe(true);
    expect(ready.hasApartmentParking).toBe(false);
    expect(ready.hasOfficetelParking).toBe(false);
  });
  it("only accepts exact sourced ordinary zone limits for a deliberate user scenario", () => {
    const good = [
      { id: "bcr", status: "source", detail: "60% 이하 (조례 일반기준)" },
      { id: "far", status: "source", detail: "250% 이하 (조례 일반기준)" },
    ];
    expect(getPreliminaryOrdinanceInputs(good)).toEqual({ bcr: 60, far: 250 });
    expect(getPreliminaryOrdinanceInputs(good.map(x => ({...x,status:"conditional"})))).toBeNull();
    expect(getPreliminaryOrdinanceInputs([{...good[0],detail:"600% 이하 (조례 일반기준)"},good[1]])).toBeNull();
  });
});
