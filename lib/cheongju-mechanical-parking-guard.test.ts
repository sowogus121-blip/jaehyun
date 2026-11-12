import { describe, expect, it } from "vitest";
import { getMunicipalMechanicalGuard } from "./metropolitan-parking-guards";
import type { SiteReviewResult, ProjectInput } from "./types";
import { DEFAULT_INPUT } from "./calculator";

const base = {
  location:{parcelAddress:"충청북도 청주시 흥덕구 오송읍 봉산리 992"},
  parcel:{pnu:"4311325021109920000"},
  parcels:[{address:"충청북도 청주시 흥덕구 오송읍 봉산리 992"}],
  mixedUseZones:false,
  landUse:[{category:"용도지역",name:"일반상업지역"}],
  ordinances:[{name:"청주시 주차장 조례"}],
} as unknown as SiteReviewResult;
const input = {...DEFAULT_INPUT,address:"충청북도 청주시 흥덕구 오송읍 봉산리 992"} as ProjectInput;

describe("2026 Cheongju municipality mechanical parking safeguard",()=>{
  it("holds 30 actual mechanical stalls while never inventing a 50% cap",()=>{
    const r=getMunicipalMechanicalGuard(base,input);
    expect(r?.city).toBe("청주시");
    expect(r?.minMechanicalStalls).toBe(30);
    expect(r?.maxMechanicalPercent).toBe(100); // sentinel = no verified cap
    expect(r?.note).toContain("종전 비율상한 삭제");
    expect(r?.note).toContain("의미 아님");
  });
  it("requires verified parcel/ordinance rather than trusting the address alone",()=>{
    expect(getMunicipalMechanicalGuard(null,input)).toBeNull();
    expect(getMunicipalMechanicalGuard({...base,parcels:[]} as SiteReviewResult,input)).toBeNull();
    expect(getMunicipalMechanicalGuard({...base,ordinances:[]} as SiteReviewResult,input)).toBeNull();
    expect(getMunicipalMechanicalGuard({...base,mixedUseZones:true} as SiteReviewResult,input)).toBeNull();
  });
});
