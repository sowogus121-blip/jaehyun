import {describe,it,expect} from "vitest";
import { UIWANG_6301,isUiwangChopyeong6301 } from "../lib/uiwang-chopyeong-6301";
import { findSitePreset } from "../lib/site-presets";
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
  it("records C1/C2 officetel ban as a parcel-unconfirmed district-block rule, not approved FAR",()=>{
    expect(UIWANG_6301.districtUses.commercial.officetelAllowed).toBe(false);
    expect(UIWANG_6301.districtUses.commercial.apartmentAllowed).toBe(false);
    expect(UIWANG_6301.districtUses.commercial.maxFar).toBe(450);
    expect(UIWANG_6301.districtUses.commercial.maxFloors).toBe(7);
    expect(findSitePreset("의왕시 초평동 630-1")?.farAssumption).toBe(0);
    expect(findSitePreset("의왕시 초평동 630-1")?.warnings.join(" ")).toContain("획지");
  });
  it("never uses expired Gyeonggi South 3rd notice as current",()=>{
    expect(UIWANG_6301.lhPurchaseThird.closesAt).toBe("2026.10.15");
    expect(UIWANG_6301.lhPurchaseThird.minimumHomesRegulated).toBe(10);
    expect(UIWANG_6301.lhPurchaseThird.minimumHomesUnregulated).toBe(30);
    expect(UIWANG_6301.lhPurchaseThird.pdfUrl).toContain("68596216");
  });
});
