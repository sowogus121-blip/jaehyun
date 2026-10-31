import {describe,it,expect} from "vitest";
import { UIWANG_6301,isUiwangChopyeong6301 } from "../lib/uiwang-chopyeong-6301";
import { findSitePreset } from "../lib/site-presets";
import { deriveCalculationContext } from "../lib/regulatory-assessment";
import { calculateAll, DEFAULT_INPUT } from "../lib/calculator";
import type { SiteReviewResult } from "../lib/types";
describe("Uiwang Chopyeong 630-1 source evidence",()=>{
  it("recognizes exact parcel only",()=>{
    expect(isUiwangChopyeong6301("경기도 의왕시 초평동 630-1")).toBe(true);
    expect(isUiwangChopyeong6301("의왕시 초평동 630-1")).toBe(true);
    expect(isUiwangChopyeong6301("초평동 630-1")).toBe(true);
    expect(isUiwangChopyeong6301("의왕시 초평동 630")).toBe(false);
    expect(isUiwangChopyeong6301("수원시 초평동 630-1")).toBe(false);
  });
  it("keeps live 준주거 area distinct from historic general-commercial supply purpose",()=>{
    const site=findSitePreset("경기도 의왕시 초평동 630-1");
    expect(site?.zone).toBe("준주거지역");
    expect(site?.districtPlan).toBe(true);
    expect(site?.siteArea).toBe(1498);
    expect(site?.publicPricePerSqm).toBe(0);
    expect(UIWANG_6301.supply2023Category).toBe("일반상업용지");
    expect(UIWANG_6301.pnu).toBe("4143011100106300001");
  });
  it("maps exact parcel to C1-2 and prevents a generic 500% pure residential assumption",()=>{
    expect(UIWANG_6301.districtUses.commercial.officetelAllowed).toBe(false);
    expect(UIWANG_6301.districtUses.commercial.apartmentAllowed).toBe(false);
    expect(UIWANG_6301.districtUses.commercial.maxFar).toBe(450);
    expect(UIWANG_6301.districtUses.commercial.maxFloors).toBe(7);
    expect(UIWANG_6301.verifiedDistrictLot).toBe("C1-2");
    expect(UIWANG_6301.verifiedBlock).toBe("C1");
    expect(UIWANG_6301.historicalMatchingEvidence).toContain("7,280,280");
    expect(findSitePreset("의왕시 초평동 630-1")?.farAssumption).toBe(450);
    expect(findSitePreset("의왕시 초평동 630-1")?.warnings.join(" ")).toContain("획지");
  });
  it("labels apartment and youth officetel infeasible when exact C1-2 source findings are loaded",()=>{
    const findings=["공동주택","오피스텔"].map((use)=>({
      id:use, topic:"허용용도", outcome:"not-applicable" as const, value:use, unit:null,
      sourceTitle:"초평동 C1-2 "+use,article:"표Ⅱ-4-2",sourceUrl:UIWANG_6301.districtGuidelineUrl,
      effectiveDate:"2026-06-30",conditions:[use+" 불허"],verified:true,
    }));
    const site={ruleFindings:findings} as unknown as SiteReviewResult;
    const input={...DEFAULT_INPUT,address:"경기도 의왕시 초평동 630-1",
      siteArea:1498,buildingCoverageRatio:70,baseFar:450,maxFloors:7,maxHeight:26,
      apartmentParkingRatio:0.8,officetelParkingRatio:0.5,
    };
    const context=deriveCalculationContext(site,input);
    expect(context.usePermissions).toEqual({apartment:"ineligible",officetel:"ineligible"});
    const results=calculateAll(input,context);
    expect(results.every(r=>r.eligibility==="ineligible")).toBe(true);
    expect(results.every(r=>!r.recommendable)).toBe(true);
  });
  it("never uses expired Gyeonggi South 3rd notice as current",()=>{
    expect(UIWANG_6301.lhPurchaseThird.closesAt).toBe("2026.10.15");
    expect(UIWANG_6301.lhPurchaseThird.minimumHomesRegulated).toBe(10);
    expect(UIWANG_6301.lhPurchaseThird.minimumHomesUnregulated).toBe(30);
    expect(UIWANG_6301.lhPurchaseThird.pdfUrl).toContain("68596216");
  });
});
