import { describe,it,expect } from "vitest";
import type { SiteReviewResult, ProjectInput } from "../lib/types";
import type { LegalReviewReport } from "../lib/legal-review-report";
import { DEFAULT_INPUT } from "../lib/calculator";
import { buildDecisionDashboard } from "../lib/decision-dashboard";

const makeReview=(area:number|null):SiteReviewResult=>({
  location:area?{address:"경기도 의정부시 가능동 75-1",parcelAddress:"경기도 의정부시 가능동 75-1",x:"127",y:"37"}:null,
  parcel:area?{area,landCategory:"대",pnu:"A-1",source:"VWorld 지적",approximate:false}:null,
  parcels:[],landUse:[],ordinances:[],laws:[],errors:[],missing:[],districtPlan:null,lhNotice:null,ruleFindings:[],
} as unknown as SiteReviewResult);
const ordinary:LegalReviewReport={
  zone:"제2종일반주거지역",area:1467,confirmedSourceCount:3,conditionalCount:4,unknownCount:5,
  calculatedLimits:[],
  rows:[
    {id:"bcr",section:"건축·도시계획",label:"건폐율",detail:"60% 이하 (조례 일반기준)",citation:"의정부시 도시계획 조례",note:"지구단위계획 별도",status:"source",sourceUrl:"https://www.law.go.kr",excerpt:"제2종...60%"},
    {id:"far",section:"건축·도시계획",label:"용적률",detail:"250% 이하 (조례 일반기준)",citation:"의정부시 도시계획 조례",note:"지구단위계획 별도",status:"source",sourceUrl:"https://www.law.go.kr",excerpt:"제2종...250%"},
    {id:"sun",section:"건축·도시계획",label:"정북일조",detail:"경계·높이별 검증 필요",citation:"건축법",note:"도면 없어서 미검증",status:"conditional",sourceUrl:"https://www.law.go.kr",excerpt:null},
  ]
};
describe("one-click decision dashboard",()=>{
 it("previews four 75%/45% alternatives using actual area and ordinary ordinance evidence, with 10 floors explicitly a guess",()=>{
  const snap=buildDecisionDashboard(DEFAULT_INPUT,makeReview(1467),ordinary);
  expect(snap.canEstimate).toBe(true);
  expect(snap.ordinary).toEqual({bcr:60,far:250});
  expect(snap.estimates).toHaveLength(4);
  expect(snap.estimates[0].unitCount).toBeGreaterThan(0);
  expect(snap.applied?.floors).toBe(10);
  expect(snap.assumptions.join(" ")).toContain("10층 가정");
  expect(snap.blockers.join(" ")).toContain("허용용도");
  expect(snap.blockers.join(" ")).toContain("정북일조");
  expect(snap.blockers.join(" ")).toContain("법정 주차계수");
  expect(snap.checks.find(c=>c.id==="sun")?.status).toBe("conditional");
 });
 it("labels the original application's automatically set 10 floors as unverified",()=>{
  const snap=buildDecisionDashboard({...DEFAULT_INPUT,maxFloors:10},makeReview(1467),ordinary);
  expect(snap.assumptions.join(" ")).toContain("10층 초기 자동 가정");
  expect(snap.blockers.join(" ")).toContain("10층은 초기 자동 가정값");
 });
 it("never reuses stale user site area when a new address failed its cadastral search",()=>{
  const input:ProjectInput={...DEFAULT_INPUT,siteArea:1467,maxFloors:10,buildingCoverageRatio:60,baseFar:250};
  const snap=buildDecisionDashboard(input,makeReview(null),ordinary);
  expect(snap.area).toBeNull();
  expect(snap.estimates).toHaveLength(0);
  expect(snap.blockers.join(" ")).toContain("지적 대지면적");
 });
 it("avoids numeric estimates when no municipality ordinance ratios exist",()=>{
  const report:LegalReviewReport={...ordinary,rows:ordinary.rows.map(r=>({...r,status:"unknown" as const,detail:"원문 미확인"}))};
  const snap=buildDecisionDashboard(DEFAULT_INPUT,makeReview(1467),report);
  expect(snap.estimates).toHaveLength(0);
  expect(snap.blockers.join(" ")).toContain("조례 일반");
 });
 it("preserves editable efficiency percentages in the automatic four-way preview",()=>{
  const input={...DEFAULT_INPUT,apartmentEfficiency:80,officetelEfficiency:55};
  const snap=buildDecisionDashboard(input,makeReview(1467),ordinary);
  expect(snap.estimates.map(x=>x.definition.efficiency)).toEqual([0.8,0.8,0.55,0.55]);
 });
 it("holds conflicting merged zoning instead of assigning one district's FAR to the whole",()=>{
  const review=makeReview(1500);
  review.parcels=[
   {inputAddress:"경기도 의정부시 가능동 75-1",location:review.location,parcel:{area:1200,pnu:"one",landCategory:"대",source:"VWorld",approximate:false},
    landUse:[{category:"용도지역",name:"제2종일반주거지역",code:"a",source:"VWorld",status:"verified"}],errors:[]},
   {inputAddress:"경기도 의정부시 가능동 75-2",location:{...review.location!,parcelAddress:"경기도 의정부시 가능동 75-2"},
    parcel:{area:300,pnu:"two",landCategory:"대",source:"VWorld",approximate:false},
    landUse:[{category:"용도지역",name:"제3종일반주거지역",code:"b",source:"VWorld",status:"verified"}],errors:[]},
  ];
  const snap=buildDecisionDashboard(DEFAULT_INPUT,review,ordinary);
  expect(snap.isMerged).toBe(true);
  expect(snap.canEstimate).toBe(false);
  expect(snap.area).toBeNull();
  expect(snap.blockers.join(" ")).toContain("혼합");
 });
});
