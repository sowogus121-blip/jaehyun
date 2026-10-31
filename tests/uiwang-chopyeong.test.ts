import {describe,it,expect} from "vitest";
import { UIWANG_6301,isUiwangChopyeong6301,getUiwangC1UseFindings } from "../lib/uiwang-chopyeong-6301";
import { findSitePreset } from "../lib/site-presets";
import { deriveCalculationContext } from "../lib/regulatory-assessment";
import { calculateAll, DEFAULT_INPUT } from "../lib/calculator";
import { buildLegalReviewReport } from "../lib/legal-review-report";
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
  it("records user-map-confirmed C1 block, without asserting an unverified C1-2 sublot",()=>{
    expect(UIWANG_6301.districtUses.commercial.officetelAllowed).toBe(false);
    expect(UIWANG_6301.districtUses.commercial.apartmentAllowed).toBe(false);
    expect(UIWANG_6301.districtUses.commercial.maxFar).toBe(450);
    expect(UIWANG_6301.districtUses.commercial.maxFloors).toBe(7);
    expect(UIWANG_6301.verifiedDistrictLot).toBeNull();
    expect(UIWANG_6301.verifiedBlock).toBe("C1");
    expect(UIWANG_6301.verifiedBlockEvidenceLevel).toBe("user-map-confirmed");
    expect(UIWANG_6301.candidateDistrictLot).toBe("C1-2");
    expect(UIWANG_6301.historicalPlannedParcel).toBe("401-2");
    expect(UIWANG_6301.cadastralMappingVerified).toBe(false);
    expect(UIWANG_6301.historicalMatchingEvidence).toContain("7,280,280");
    expect(findSitePreset("의왕시 초평동 630-1")?.farAssumption).toBe(450);
    expect(findSitePreset("의왕시 초평동 630-1")?.buildingCoverageRatioAssumption).toBe(70);
    expect(findSitePreset("의왕시 초평동 630-1")?.warnings.join(" ")).toContain("획지");
  });
  it("blocks LH apartment and officetel alternatives for user map-confirmed C1, without claiming C1-2",()=>{
    const findings=getUiwangC1UseFindings();
    expect(findings).toHaveLength(2);
    expect(findings.every(item => item.conditions.join(" ").includes("사용자가"))).toBe(true);
    expect(findings.every(item => !item.conditions.join(" ").includes("C1-2로 확정"))).toBe(true);
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
    expect(results.every(r=>r.unitCount===0)).toBe(true);
    expect(results.every(r=>r.unitCountByFar===0 && r.unitCountByEnvelope===0)).toBe(true);
  });
  it("records source-verified city annex 6 distinct from C1-2 use prohibition",()=>{
    expect(UIWANG_6301.cityZoningAnnex.apartmentProhibitedInGeneralZone).toBe(false);
    expect(UIWANG_6301.cityZoningAnnex.officetelProhibitedInGeneralZone).toBe(false);
    expect(UIWANG_6301.cityZoningAnnex.salesLargeAreaSqm).toBe(3000);
    expect(UIWANG_6301.cityZoningAnnex.salesExceptionMinFrontageM).toBe(15);
    expect(UIWANG_6301.districtUses.commercial.apartmentAllowed).toBe(false);
    expect(UIWANG_6301.districtUses.commercial.officetelAllowed).toBe(false);
  });
  it("reads the city 2026 parking annex: 1 standard per dwelling, 0.3 signed-LH small home only",()=>{
    const parking=UIWANG_6301.cityParkingAnnex;
    expect(parking.apartmentOfficetelStandardSqmPerSpace).toBe(85);
    expect(parking.apartmentOfficetelMinPerHome).toBe(1);
    expect(parking.purchaseAgreementMaxExclusiveAreaSqm).toBe(30);
    expect(parking.purchaseAgreementParkingPerSmallHome).toBe(0.3);
    expect(parking.commercialParkingSqmPerSpace).toBe(100);
    expect(parking.neighborhoodParkingSqmPerSpace).toBe(120);
    expect(parking.machineMaxPercentCity).toBe(30);
    expect(parking.machineNotAllowedWhenTotalSpacesAtMost).toBe(20);
  });
  it("includes actual ordinance appendix results rather than generic unverified flags in report",()=>{
    const input={...DEFAULT_INPUT,address:UIWANG_6301.address,siteArea:1498};
    const report=buildLegalReviewReport(input,null);
    const byId=(id:string)=>report.rows.find(row=>row.id===id);
    expect(byId("uiwang-zone-appendix-6")?.detail).toContain("일반 금지목록");
    expect(byId("uiwang-c1-2")?.status).toBe("user");
    expect(byId("uiwang-c1-2")?.detail).toContain("C1 상업시설용지");
    expect(byId("uiwang-use-block")?.status).toBe("user");
    expect(byId("uiwang-use-block")?.detail).toContain("오피스텔");
    expect(byId("use")?.status).toBe("user");
    expect(byId("use")?.detail).toContain("C1 상업시설용지");
    expect(byId("uiwang-parking-appendix-5")?.detail).toContain("최소 세대·호실당 1대");
    expect(byId("uiwang-parking-03-appendix-5")?.detail).toContain("0.3대");
    expect(byId("uiwang-parking-machine-city")?.detail).toContain("30%");
    expect(byId("uiwang-commercial-parking")?.sourceUrl).toBe(UIWANG_6301.cityParkingAnnex.appendixOriginalUrl);
  });
  it("never uses expired Gyeonggi South 3rd notice as current",()=>{
    expect(UIWANG_6301.lhPurchaseThird.closesAt).toBe("2026.10.15");
    expect(UIWANG_6301.lhPurchaseThird.minimumHomesRegulated).toBe(10);
    expect(UIWANG_6301.lhPurchaseThird.minimumHomesUnregulated).toBe(30);
    expect(UIWANG_6301.lhPurchaseThird.pdfUrl).toContain("68596216");
  });
});
