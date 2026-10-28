import { describe, expect, it } from "vitest";
import { ALTERNATIVES, DEFAULT_INPUT, EXAMPLE_INPUT, calculateAlternative } from "../lib/calculator";
import { deriveCalculationContext } from "../lib/regulatory-assessment";
import type { SiteReviewResult } from "../lib/types";

describe("LH Plan Lab conservative feasibility gates",()=>{
  it("does not mark one confirmed FAR clause as complete legal planning approval",()=>{
    const review = {
      ruleFindings: [{id:"far",topic:"용적률",outcome:"applicable",verified:true}],
      planningStandards: {zone:"준주거지역",far:300,buildingCoverageRatio:60},
    } as unknown as SiteReviewResult;
    expect(deriveCalculationContext(review, DEFAULT_INPUT).planningEvidence).toBe("review");
    const allTopics={...review,ruleFindings:["건폐율","용적률","높이"].map(topic=>({
      id:topic,topic,outcome:"applicable",verified:true
    }))} as SiteReviewResult;
    expect(deriveCalculationContext(allTopics,DEFAULT_INPUT).planningEvidence).toBe("verified");
    allTopics.ruleFindings[2].outcome="conditional";
    expect(deriveCalculationContext(allTopics,DEFAULT_INPUT).planningEvidence).toBe("review");
  });
  it("separates office contract-area denominator from above-ground FAR",()=>{
    const old=calculateAlternative(EXAMPLE_INPUT, ALTERNATIVES[2]);
    expect(old.grossAreaPerUnit).toBeCloseTo(25/0.45,2);
    expect(old.farGrossAreaPerUnit).toBeCloseTo(25/0.70,2);
    const newContract=calculateAlternative({...EXAMPLE_INPUT,officetelEfficiency:55}, {...ALTERNATIVES[2],efficiency:0.55});
    expect(newContract.unitCount).toBe(old.unitCount);
    const newFAR=calculateAlternative({...EXAMPLE_INPUT,officetelFarEfficiency:80},ALTERNATIVES[2]);
    expect(newFAR.unitCount).toBeGreaterThanOrEqual(old.unitCount);
    expect(newFAR.farGrossAreaPerUnit).toBeLessThan(old.farGrossAreaPerUnit);
  });
  it("does not discard mixed-use commercial area from aboveground or total FAR",()=>{
    const x={...EXAMPLE_INPUT,commercialMixShare:20,baseFar:600,maxFloors:20,maxHeight:82};
    const r=calculateAlternative(x,ALTERNATIVES[0]);
    expect(r.nonResidentialFarArea).toBeGreaterThan(0);
    expect(r.farCountedArea).toBeCloseTo(r.residentialFarArea+r.nonResidentialFarArea,1);
    expect(r.farCountedArea).toBeLessThanOrEqual(x.siteArea*6+0.001);
    expect(r.totalFloorArea).toBeCloseTo(r.farCountedArea+r.belowGroundArea,1);
    expect(r.warnings.some(w=>w.includes("비주거 주차"))).toBe(true);
  });
});
