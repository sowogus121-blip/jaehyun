import { describe, it, expect } from "vitest";
import { ALTERNATIVES, DEFAULT_INPUT, DEFAULT_CALCULATION_CONTEXT, calculateAlternative, calculateParking } from "../lib/calculator";
import { deriveCalculationContext } from "../lib/regulatory-assessment";
import { getMunicipalMechanicalGuard, METROPOLITAN_MECHANICAL_REFERENCES,screenRegionalLhHomes } from "../lib/metropolitan-parking-guards";
import { buildLegalReviewReport } from "../lib/legal-review-report";
import type { SiteReviewResult } from "../lib/types";

function mockSite(address:string,zone:string,pnu:string,city:string):SiteReviewResult {
 return {
  location:{address,parcelAddress:address,x:"127",y:"37"},
  parcel:{pnu,area:1467,landCategory:"대",source:"VWorld",approximate:false},
  landUse:[{category:"용도지역",name:zone,code:"LT_C_UQ111",source:"VWorld",status:"verified"}],
  ordinances:[{name:city+" 주차장 설치 및 관리 조례",link:"https://www.law.go.kr",localGovernment:"경기도 "+city,promulgationDate:null,enforcementDate:null,retrievalStatus:"full-text",applicationStatus:"not-assessed"}],
  parcels:[{inputAddress:address,location:null,parcel:null,landUse:[],errors:[]}],
  ruleFindings:[],mixedUseZones:false,
  lhNotice:{id:"1730",isCurrent:true,official:true,rules:null},
 } as unknown as SiteReviewResult;
}
describe("municipal statute x LH purchase parking strictness",()=>{
 it("documents official city-by-city sources without granting parking ratios",()=>{
  expect(METROPOLITAN_MECHANICAL_REFERENCES.map(x=>x.maxMechanicalPercent)).toEqual([30,20]);
  expect(METROPOLITAN_MECHANICAL_REFERENCES.every(x=>x.sourceUrl.startsWith("https://"))).toBe(true);
 });
 it("scopes Uijeongbu 2nd residential mechanical apartment ban to exact cadastral city",()=>{
  const addr="경기도 의정부시 가능동 75-1";
  const site=mockSite(addr,"제2종일반주거지역","4115011000100750001","의정부시");
  const input={...DEFAULT_INPUT,address:addr,businessMode:"purchase" as const,mechanicalAllowed:true,apartmentParkingRatio:1,
    siteArea:1467,baseFar:250,buildingCoverageRatio:60,maxFloors:10};
  const guard=getMunicipalMechanicalGuard(site,input);
  expect(guard).toEqual(expect.objectContaining({city:"의정부시",maxMechanicalPercent:20,minMechanicalStalls:20,apartmentProhibited:true}));
  const ctx=deriveCalculationContext(site,input);
  expect(ctx.municipalApartmentMechanicalExcluded).toBe(true);
  const apt=calculateAlternative(input,ALTERNATIVES[1],ctx);
  expect(apt.parking.mechanicalCount).toBe(0);
  expect(apt.blockingReasons.some(x=>x.includes("공동주택 기계식주차 제외"))).toBe(true);
  expect(apt.eligibility).toBe("ineligible");
  const other=mockSite("경기도 파주시 파주읍 봉암리 1343-2","준주거지역","4148025324113430002","파주시");
  expect(getMunicipalMechanicalGuard(other,input)).toEqual(expect.objectContaining({city:"파주시",maxMechanicalPercent:30}));
  const merged={...site,parcels:[...site.parcels,...site.parcels]};
  expect(getMunicipalMechanicalGuard(merged,input)).toBeNull();
  expect(getMunicipalMechanicalGuard({...site,parcel:null},input)).toBeNull();
 });
 it("enforces the local 20% cap and disallows a 1-19 machine-stall design even when LH permits 50%",()=>{
  const context={...DEFAULT_CALCULATION_CONTEXT,municipalMechanicalMaxPercent:20,
    municipalMechanicalMinStalls:20,lhPurchaseMechanicalMaxPercent:50,
    regionalLhNoticeId:"1730"};
  const input={...DEFAULT_INPUT,address:"경기도 의정부시 가능동 75-1",businessMode:"purchase" as const,
    officetelParkingRatio:1,mechanicalAllowed:true,mechanicalMaxRatio:70};
  const below=calculateParking(input,ALTERNATIVES[3],80,context);
  expect(below.finalCount).toBe(80);
  expect(below.mechanicalCount).toBe(0);
  expect(below.selfCount).toBe(80);
  const valid=calculateParking(input,ALTERNATIVES[3],120,context);
  expect(valid.mechanicalCount).toBe(24);
  expect(valid.selfCount).toBe(96);
  expect(valid.mechanicalCount).toBeLessThanOrEqual(Math.floor(valid.finalCount*0.2));
 });
 it("applies Paju 30% even under an LH 50% rule, but does not call the use legally approved",()=>{
  const address="경기도 파주시 파주읍 봉암리 1343-2";
  const site=mockSite(address,"준주거지역","4148025324113430002","파주시");
  const input={...DEFAULT_INPUT,address,businessMode:"purchase" as const,officetelParkingRatio:1,
    mechanicalMaxRatio:70,mechanicalAllowed:true};
  const ctx={...deriveCalculationContext(site,input),lhPurchaseMechanicalMaxPercent:50};
  expect(ctx.municipalMechanicalMaxPercent).toBe(30);
  const park=calculateParking(input,ALTERNATIVES[3],100,ctx);
  expect(park.mechanicalCount).toBe(30);
  expect(ctx.mechanicalParkingEligibility).toBe("unknown");
  const worksheet=buildLegalReviewReport(input,site);
  expect(worksheet.rows.find(x=>x.id==="municipal-machine-cap")?.detail).toContain("30%");
  expect(worksheet.rows.find(x=>x.id==="municipal-machine-cap")?.status).toBe("conditional");
 });
 it("separates LH region normal vs regulated minimum housing and expired South sources",()=>{
  const north="경기도 의정부시 가능동 75-1";
  expect(screenRegionalLhHomes(north,"1730",5,"2026-11-01").status).toBe("below-smallest-threshold");
  expect(screenRegionalLhHomes(north,"1730",18,"2026-11-01").status).toBe("regulated-area-check");
  expect(screenRegionalLhHomes(north,"1730",35,"2026-11-01").status).toBe("count-clears-general-minimum");
  expect(screenRegionalLhHomes("경기도 부천시 원미구 중동 1036","1741",25,"2026-11-01").status).toBe("count-clears-general-minimum");
  expect(screenRegionalLhHomes("경기도 안양시 동안구 비산동 1101","1716",40,"2026-11-01").status).toBe("reference-only");
  expect(screenRegionalLhHomes(north,"1741",100,"2026-11-01").status).toBe("reference-only");
 });
});