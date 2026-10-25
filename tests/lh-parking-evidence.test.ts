import { describe, it, expect } from "vitest";
import { DEFAULT_INPUT } from "../lib/calculator";
import { getLhParkingReview } from "../lib/lh-parking-review";
import type { LhNotice } from "../lib/server/lh-notice";
import { extractParkingPassages, extractRuleCandidates } from "../lib/server/document-parser";
import { buildLegalReviewReport } from "../lib/legal-review-report";
import type { SiteReviewResult } from "../lib/types";

const source=LhNoticeDummy();
function LhNoticeDummy():LhNotice {
 return {
  id:"1730",title:"(경기북부) '26-4차 민간 신축 매입약정 방식 매입 공고",
  url:"https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1730",
  pdfUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68899892",
  guideUrl:null,publishedAt:"2026.10.07",closesAt:"2026.11.06",
  matchedDistrict:"의정부시",official:true,isCurrent:true,
  rules:{excerptSource:"verified PDF p.9 p.11",minimumHomes:30,regulatedMinimumHomes:10,
   newlywedMinimumArea:36,youthMinimumArea:19,youthMaximumArea:60,newlywedRooms:2,youthRooms:1,
   communityThreshold:50,managementOfficeThreshold:150,mechanicalMaxPercent:50,
   mechanicalTransitMaxMeters:500,parking03MaxArea:30,parking03YouthMaxMeters:500},
  warnings:[],
 };
}
describe("LH parking notice analysis",()=>{
 it("shows all verified 4th notice parking and design conditions instead of no-source placeholders",()=>{
  const study=getLhParkingReview(source,{...DEFAULT_INPUT,businessMode:"purchase",lhSupplyType:"newlywed"});
  expect(study.verifiedOriginal).toBe(true);
  expect(study.clauses.length).toBeGreaterThanOrEqual(10);
  expect(study.clauses.find(c=>c.id==="machine-limit")?.detail).toContain("50%");
  expect(study.clauses.find(c=>c.id==="machine-location")?.detail).toContain("500m");
  expect(study.clauses.find(c=>c.id==="machine-use")?.detail).toContain("신혼");
  expect(study.clauses.find(c=>c.id==="machine-limit")?.conditions.join(" ")).toContain("20대");
  expect(study.clauses.find(c=>c.id==="machine-03")?.detail).toContain("지양");
  expect(study.clauses.find(c=>c.id==="parking03-scope")?.applicability).toBe("not-applicable");
  expect(study.clauses.find(c=>c.id==="machine-design")?.conditions.join(" ")).toContain("관리실");
  expect(study.clauses.every(c=>c.sourceUrl===source.pdfUrl)).toBe(true);
 });
 it("treats youth 0.3 and senior 0.3 as conditional rather than automatically approved",()=>{
  for(const kind of ["youth","senior"] as const){
    const study=getLhParkingReview(source,{...DEFAULT_INPUT,businessMode:"purchase",lhSupplyType:kind});
    expect(study.clauses.find(c=>c.id==="parking03-scope")?.applicability).toBe("conditional");
  }
  const general=getLhParkingReview(source,{...DEFAULT_INPUT,businessMode:"purchase",lhSupplyType:"general"});
  expect(general.clauses.find(c=>c.id==="parking03-scope")?.applicability).toBe("not-applicable");
 });
 it("does not borrow 경기북부 numeric rules for different Seoul notice candidates",()=>{
  const seoul:LhNotice={...source,id:"2918",title:"서울지역 6차",
    rules:null,pdfUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=999995",
    extractedCriteria:[{topic:"LH 기계식 주차",quote:"기계식 주차 허용 대상은 공고문 제11조를 확인",value:null,unit:null,verified:false}],
    textAnalysisStatus:"text-extracted"};
  const study=getLhParkingReview(seoul,DEFAULT_INPUT);
  expect(study.verifiedOriginal).toBe(false);
  expect(study.clauses).toHaveLength(1);
  expect(study.clauses[0].status).toBe("extracted-unverified");
  expect(study.clauses[0].detail).not.toContain("50%");
 });
 it("extracts parking clauses appearing after 80 unrelated generic document matches",()=>{
  const long=Array.from({length:105},(_,i)=>"용적률 "+(100+i)+"% 이하로 제한한다.").join("\n")
    +"\n제11항 기계식 주차 비율은 전체 주차대수의 50% 이하로 계획한다.\n전용면적 30㎡ 미만 청년형 세대당 주차 0.3대 완화는 직선거리 500m 내에서 검토한다.";
  expect(extractRuleCandidates(long)).toHaveLength(80);
  const parking=extractParkingPassages(long);
  expect(parking.some(x=>x.topic==="LH 기계식 주차")).toBe(true);
  expect(parking.some(x=>x.topic==="LH 0.3대 주차특례")).toBe(true);
 });
 it("populates legal summary with LH confirmed parking PDF even with no separate discovered document",()=>{
  const review={lhNotice:source,ordinances:[],ordinanceArticleCandidates:[],landUse:[],parcel:null,parcels:[],location:null,
    officialDocuments:{documents:[]},errors:[],unresolved:[],laws:[],missing:[],
  } as unknown as SiteReviewResult;
  const report=buildLegalReviewReport({...DEFAULT_INPUT,businessMode:"purchase",lhSupplyType:"youth"},review,null,[]);
  const mechanical=report.rows.find(row=>row.id==="mechanical-lh");
  expect(mechanical?.detail).toContain("50%");
  expect(mechanical?.detail).toContain("500m");
  expect(mechanical?.status).toBe("conditional");
  expect(mechanical?.sourceUrl).toBe(source.pdfUrl);
  expect(report.rows.find(row=>row.id==="lh-parking03-terms")?.detail).toContain("고령자");
  expect(report.rows.find(row=>row.id==="lh-parking-machine-other")?.detail).toContain("20대");
 });
});
