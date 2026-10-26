import { describe,it,expect } from "vitest";
import { calculateHanamCommercialMix,isHanamCommercialSite } from "../lib/hanam-commercial-mix";
import { DEFAULT_INPUT,ALTERNATIVES,calculateAlternative } from "../lib/calculator";
import { buildLegalReviewReport, getOrdinanceZoneStandards } from "../lib/legal-review-report";
import { getPreliminaryOrdinanceInputs } from "../lib/massing-readiness";
import type { SiteReviewResult } from "../lib/types";

const review={
 location:{address:"신장로 130-5",parcelAddress:"경기도 하남시 덕풍동 419-32",x:"127.203",y:"37.538"},
 mixedUseZones:false,
 landUse:[{name:"일반상업지역",category:"용도지역",code:"UQ111",source:"VWorld",status:"verified"},
  {name:"방화지구",category:"용도지구",code:"UQ122",source:"VWorld",status:"verified"}],
 ordinances:[{name:"하남시 도시계획 조례",link:"https://www.law.go.kr",localGovernment:"하남시"}],
 parcels:[],laws:[],ordinanceArticleCandidates:[],errors:[],
 parcel:{area:1316.8,landCategory:"대",pnu:"xxx",source:"VWorld",approximate:true},
} as unknown as SiteReviewResult;
describe("Hanam commercial zone 2026 Oct residential-officetel FAR",()=>{
 it("recognizes only exact Hanam commercial-zone official evidence",()=>{
  expect(isHanamCommercialSite(review)).toBe(true);
  expect(isHanamCommercialSite({...review,landUse:review.landUse.map(z=>({...z,name:"제2종일반주거지역"}))})).toBe(false);
  expect(isHanamCommercialSite({...review,location:{...review.location!,parcelAddress:"경기도 성남시 덕풍동 419-32"}})).toBe(false);
  expect(isHanamCommercialSite({...review,ordinances:[]})).toBe(false);
 });
 it("weights statutory 1300 commercial and 500 residential, not 1300 to 100% housing",()=>{
  const result=calculateHanamCommercialMix(20);
  expect(result).toMatchObject({commercialShare:20,housingShare:80,totalFar:660});
  expect(calculateHanamCommercialMix(15).totalFar).toBe(620);
  expect(calculateHanamCommercialMix(30).totalFar).toBe(740);
 });
 it("reserves commercial floor share in BOTH FAR and envelope for apartment and officetel",()=>{
  const input={...DEFAULT_INPUT,siteArea:1316.8,buildingCoverageRatio:80,maxFloors:10,
    baseFar:660,commercialMixShare:20};
  for(const definition of [ALTERNATIVES[0],ALTERNATIVES[2]]){
    const mixed=calculateAlternative(input,definition);
    const wronglyAllHousing=calculateAlternative({...input,commercialMixShare:0},definition);
    expect(mixed.unitCount).toBeLessThan(wronglyAllHousing.unitCount);
    expect(mixed.farLimitArea).toBeCloseTo(1316.8*6.6*0.8,1);
    expect(mixed.warnings.join(" ")).toContain("비주거");
  }
 });
 it("parses actual Hanam council clause spelling 1천300퍼센트 and unlocks merged-lot scenario",()=>{
  const ordinanceReview={
    ...review,ordinanceArticleCandidates:[
      // The real LH site-review API lists §36 first; it quotes §50's heading
      // but must not replace the governing §50 zoning table.
      {sourceTitle:"하남시 도시계획 조례",article:"제003600,003600조 · 경관지구 안에서의 건폐율",
        excerpt:"시가지경관지구 안에서의 건축물의 건폐율은 조례 제50조에 따른 해당 용도지역 안에서의 건폐율을 따른다.",sourceUrl:"https://www.law.go.kr",topic:"건폐율",verified:false},
      {sourceTitle:"하남시 도시계획 조례",article:"제005000,005000조 · 용도지역 안에서의 건폐율",
        excerpt:"제50조(용도지역 안에서의 건폐율) 일반상업지역: 80퍼센트 이하",sourceUrl:"https://www.law.go.kr",topic:"건폐율",verified:false},
      {sourceTitle:"하남시 도시계획 조례",article:"제005300,005300조 · 용도지역 안에서의 용적률",
        excerpt:"제53조(용도지역 안에서의 용적률) 일반상업지역 : 1천300퍼센트 이하",sourceUrl:"https://www.law.go.kr",topic:"용적률",verified:false},
    ],
  } as SiteReviewResult;
  const standards=getOrdinanceZoneStandards(ordinanceReview,"일반상업지역");
  expect(standards).toEqual({bcr:80,far:1300});
  const report=buildLegalReviewReport({...DEFAULT_INPUT,commercialMixShare:20},ordinanceReview);
  expect(getPreliminaryOrdinanceInputs(report.rows)).toEqual({bcr:80,far:1300});
  // 1300 must remain the ordinary zone cap; user-facing housing mix gets 660.
  expect(report.rows.find(r=>r.id==="hanam-use-mix")?.detail).toContain("660%");
 });
 it("places weighted ratio and donation bonus as CONDITIONAL in legal report",()=>{
  const input={...DEFAULT_INPUT,commercialMixShare:20};
  const report=buildLegalReviewReport(input,review);
  const row=report.rows.find(z=>z.id==="hanam-use-mix");
  expect(row?.detail).toContain("660%");
  expect(row?.status).toBe("conditional");
  expect(report.rows.find(z=>z.id==="hanam-use-bonus")?.detail).toContain("100%p");
 });
});
