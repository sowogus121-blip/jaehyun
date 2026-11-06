import { describe, expect, it } from "vitest";
import { MASOK_555, getMasok555RuleFindings, isMasok555, masokMassingScenario } from "./masok-555";
import { findSitePreset } from "./site-presets";
import { DEFAULT_INPUT, calculateAll } from "./calculator";
import type { CalculationContext, ProjectInput } from "./types";

const permissions: CalculationContext = {
  planningEvidence: "verified",
  usePermissions: { apartment:"conditional", officetel:"ineligible" },
  lhPurchaseEligibility: { apartment:"conditional", officetel:"ineligible" },
  mechanicalParkingEligibility: "ineligible",
};

function inputFor(conditional115:boolean): ProjectInput {
  const scenario=masokMassingScenario(conditional115);
  return {
    ...DEFAULT_INPUT,
    address: MASOK_555.address,
    siteArea: MASOK_555.approvedGrossProjectSqm,
    massingSiteArea: scenario.modelingSiteSqm,
    maxHomes: scenario.maxHomes,
    buildingCoverageRatio: MASOK_555.plan.bcrPercent,
    baseFar: MASOK_555.plan.farPercent,
    maxFloors: MASOK_555.plan.maxFloors,
    apartmentParkingRatio: 0.7, // comparison assumption only
  };
}

describe("Masok 555 independently sourced district-unit-plan screening", () => {
  it("matches only lot 555, never neighbor lots or similarly named locations", () => {
    expect(isMasok555("경기도 남양주시 화도읍 마석우리 555")).toBe(true);
    expect(isMasok555("마석우리 555번지")).toBe(true);
    expect(isMasok555("마석우리 555-1")).toBe(false);
    expect(isMasok555("경기도 남양주시 화도읍 마석우리 1555")).toBe(false);
    expect(isMasok555("경기도 남양주시 화도읍 마석우리 554")).toBe(false);
  });

  it("preserves 2024/2025 project total, housing lots and separate 50/150/3 rules", () => {
    const p=findSitePreset("남양주시 화도읍 마석우리 555");
    expect(p).not.toBeNull();
    expect(p?.siteArea).toBe(11776.2);
    expect(p?.buildingCoverageRatioAssumption).toBe(50);
    expect(p?.farAssumption).toBe(150);
    expect(MASOK_555.approvedHousingPlotSqm).toBe(9228.4);
    expect(MASOK_555.plan.maxFloors).toBe(3);
  });

  it("anchors 50-home base cap and conditional 115-home cap to official district plan", () => {
    const findings=getMasok555RuleFindings();
    expect(findings.find(f=>f.id==="masok-115-homes")).toMatchObject({outcome:"conditional",value:115,verified:true});
    expect(findings.find(f=>f.id==="masok-office-use")).toMatchObject({outcome:"not-applicable",value:"오피스텔"});
    expect(findings.find(f=>f.id==="masok-apt-use")).toMatchObject({outcome:"conditional",value:"공동주택"});
    expect(findings.find(f=>f.id==="masok-bcr")?.value).toBe(50);
    expect(findings.find(f=>f.id==="masok-far")?.value).toBe(150);
    expect(findings.find(f=>f.id==="masok-floors")?.value).toBe(3);
  });

  it("does not silently convert the 759.4sqm provisional deduction to a confirmed parcel fact", () => {
    const base=masokMassingScenario(false);
    const conditional=masokMassingScenario(true);
    expect(base.modelingSiteSqm).toBe(9228.4);
    expect(conditional.modelingSiteSqm).toBe(8469);
    expect(conditional.assumedPlotDeduction).toBe(true);
    expect(conditional.countedFarSqm).toBe(12703.5);
    expect(conditional.areaOnly46Homes).toBeGreaterThan(200); // theoretical only
  });

  it("caps calculator's dwelling outputs by the scoped limit and screens officetel out", () => {
    for (const cond of [false,true]) {
      const inp=inputFor(cond);
      const scenario=masokMassingScenario(cond);
      const results=calculateAll(inp,permissions);
      expect(results[0].unitCount).toBe(scenario.maxHomes);
      expect(results[0].unitCountByFar).toBeLessThanOrEqual(scenario.maxHomes);
      expect(results[0].unitCountByEnvelope).toBeLessThanOrEqual(scenario.maxHomes);
      expect(results[0].farLimitArea).toBe(scenario.countedFarSqm);
      expect(results[0].legalMaxFloors).toBe(3);
      expect(results[2].unitCount).toBe(0);
      expect(results[3].unitCount).toBe(0);
    }
  });

  it("does not cap unrelated address calculation", () => {
    const test=calculateAll({
      ...DEFAULT_INPUT,
      siteArea:9000,buildingCoverageRatio:60,baseFar:200,maxFloors:5,
      apartmentParkingRatio:0.7,
    },permissions);
    expect(test[0].unitCount).toBeGreaterThan(115);
  });
});
