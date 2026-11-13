import { describe, expect, it } from "vitest";
import {
  DISTRICT_PLAN_SOURCES,DISTRICT_PLAN_DISCOVERY,findDistrictPlanEvidence,
} from "../lib/district-plan-sources";
import { NATIONAL_SCREENING_RULES } from "../lib/national-screening-rules";

describe("source-backed municipal district and special-plan evidence",()=>{
 it("indexes 10 official district/special-plan notices with cautious boundary matching",()=>{
   expect(DISTRICT_PLAN_SOURCES).toHaveLength(10);
   expect(new Set(DISTRICT_PLAN_SOURCES.map(p=>p.id)).size).toBe(DISTRICT_PLAN_SOURCES.length);
   expect(DISTRICT_PLAN_DISCOVERY).toHaveLength(11);
   for (const p of DISTRICT_PLAN_SOURCES){
     expect(p.noticeNo).toMatch(/2026-\d+/);
     expect(p.noticeDate).toMatch(/^2026-\d\d-\d\d$/);
     expect(p.officialNoticeUrl).toMatch(/^https:\/\/www\.eum\.go\.kr\/web\/gs\/gv\/gvGosiDet\.jsp\?seq=\d+$/);
     expect(p.documents.length).toBeGreaterThan(0);
     expect(p.warnings.length).toBeGreaterThan(0);
   }
   expect(DISTRICT_PLAN_SOURCES.find(x=>x.id==="uiwang-chopyeong-2026-308")?.documents.some(d=>d.kind==="획지 결정도")).toBe(true);
   expect(DISTRICT_PLAN_SOURCES.find(x=>x.id==="bucheon-eunha-2026-107")?.noticeNo).toContain("2026-107");
   expect(DISTRICT_PLAN_SOURCES.find(x=>x.id==="bucheon-sangdong-2026-124")?.documents).toHaveLength(3);
   expect(DISTRICT_PLAN_SOURCES.find(x=>x.id==="hanam-antergol2-expired-2026-121")?.lifecycle).toBe("expired");
   expect(DISTRICT_PLAN_SOURCES.find(x=>x.id==="suwon-gwanggyo-2026-432")?.noticeNo).toContain("2026-432");
 });
 it("Uiwang 630-1 has user-confirmed C1 block but NOT official C1-2 sublot",()=>{
   const r=findDistrictPlanEvidence("경기도 의왕시 초평동 630-1");
   expect(r).toHaveLength(1);
   expect(r[0].level).toBe("user-map-confirmed-block");
   expect(r[0].message).toContain("세부 획지");
   expect(r[0].automaticallyApply).toBe(false);
   expect(findDistrictPlanEvidence("경기도 의왕시 초평동 630-2")).toEqual([]);
   expect(findDistrictPlanEvidence("경기도 의왕시 초평동 630-2",{includeCitySources:true})[0].level).toBe("city-only-source");
 });
 it("Bucheon Eunha and Sangdong remain district-name candidates only; no Bucheon-wide assertion",()=>{
   expect(findDistrictPlanEvidence("경기도 부천시 중동 1036")[0]?.plan.id).toBe("bucheon-eunha-2026-107");
   expect(findDistrictPlanEvidence("경기도 부천시 중동 1036-5")[0]?.level).toBe("district-name-candidate");
   expect(findDistrictPlanEvidence("경기도 부천시 상동 888")[0]?.plan.id).toBe("bucheon-sangdong-2026-124");
   expect(findDistrictPlanEvidence("경기도 부천시 원미구 중동 999")).toEqual([]);
   expect(findDistrictPlanEvidence("경기도 파주시 봉암리 1343-2")).toEqual([]);
   expect(findDistrictPlanEvidence("경기도 파주시 봉암리 1343-2",{includeCitySources:true})).toEqual([]);
   expect(findDistrictPlanEvidence("경기도 수원시 광교동 10")[0]?.level).toBe("district-name-candidate");
   expect(findDistrictPlanEvidence("경기도 하남시 덕풍동 376-9")[0]?.plan.lifecycle).toBe("expired");
   expect(findDistrictPlanEvidence("경기도 하남시 덕풍동 419-32")).toEqual([]);
 });
 it("avoids locality collision even when names coincide in other provinces",()=>{
   expect(findDistrictPlanEvidence("인천광역시 남동구 1036번지 은하마을")).toEqual([]);
   expect(findDistrictPlanEvidence("경기도 성남시 중동 1036")).toEqual([]);
 });
});

describe("national building law screening - no automatic relaxations",()=>{
 it("adds source-specific national clauses for 6 high-priority categories",()=>{
   expect(NATIONAL_SCREENING_RULES.length).toBeGreaterThanOrEqual(15);
   expect(new Set(NATIONAL_SCREENING_RULES.map(x=>x.id)).size).toBe(NATIONAL_SCREENING_RULES.length);
   expect(new Set(NATIONAL_SCREENING_RULES.map(x=>x.category)).size).toBe(6);
   for(const x of NATIONAL_SCREENING_RULES){
     expect(x.automaticApplication).toBe(false);
     expect(x.verifiedAt).toBe("2026-11-01");
     expect(new URL(x.sourceUrl).protocol).toBe("https:");
     expect(x.screeningQuestion.length).toBeGreaterThan(12);
   }
 });
 it("distinguishes sunlight exceptions, floor calculation, parking and LH community",()=>{
   expect(NATIONAL_SCREENING_RULES.find(x=>x.id==="daylight-law")?.description).toContain("정북");
   expect(NATIONAL_SCREENING_RULES.find(x=>x.id==="daylight-decree")?.description).toContain("20m");
   expect(NATIONAL_SCREENING_RULES.find(x=>x.id==="floor-area")?.screeningQuestion).toContain("기전실");
   expect(NATIONAL_SCREENING_RULES.find(x=>x.id==="community-national")?.screeningQuestion).toContain("LH");
   expect(NATIONAL_SCREENING_RULES.find(x=>x.id==="green-building-threshold")?.description).toContain("500㎡");
 });
});
