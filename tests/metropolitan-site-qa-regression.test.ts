import {describe,it,expect} from "vitest";
import {getOrdinanceZoneStandards,buildLegalReviewReport} from "../lib/legal-review-report";
import {DEFAULT_INPUT} from "../lib/calculator";
import type {SiteReviewResult} from "../lib/types";
import {findLhPurchaseNotice,noticeIsOpen,matchLhRegion} from "../lib/metro-annex-lh-catalog";

function ordinanceRules(city:string,bcr:number,far:number):Pick<SiteReviewResult,"ordinanceArticleCandidates"> {
  const head="도시계획 조례";
  const mk=(article:string,text:string)=>({
    sourceTitle:city+" "+head,sourceUrl:"https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2022815",
    article,topic:"용도지역",excerpt:text,verified:false as const
  });
  return {ordinanceArticleCandidates:[
    mk("제32조(용도지역 안에서의 건폐율)", "6. 준주거지역: "+bcr+"퍼센트 이하 7. 중심상업지역: 80퍼센트 이하"),
    mk("제33조(용도지역 안에서의 용적률)", "6. 준주거지역: "+far+"퍼센트 이하 7. 중심상업지역: 1,000퍼센트 이하"),
  ]};
}

describe("live metropolitan LH site review QA regressions",()=>{
  it("parses Paju actual 2025 municipal 60/300 standards rather than national 70/500 reference",()=>{
    expect(getOrdinanceZoneStandards(ordinanceRules("파주시",60,300),"준주거지역")).toEqual({bcr:60,far:300});
    expect(getOrdinanceZoneStandards(ordinanceRules("파주시",60,300),"일반상업지역")).toBeNull();
  });
  it("requires both BCR and FAR source articles, never invents missing legal limits",()=>{
    const x=ordinanceRules("파주시",60,300);
    expect(getOrdinanceZoneStandards({ordinanceArticleCandidates:x.ordinanceArticleCandidates?.slice(0,1)},"준주거지역")).toBeNull();
    expect(getOrdinanceZoneStandards({ordinanceArticleCandidates:[]},"준주거지역")).toBeNull();
    expect(getOrdinanceZoneStandards(x,"미확인")).toBeNull();
  });
  it("keeps Uiwang C1 lot-only evidence out of an assembled two-lot legal report",()=>{
    const address="경기도 의왕시 초평동 630-1";
    const body={...DEFAULT_INPUT,address,multipleParcels:true,parcelList:"경기도 의왕시 초평동 630-2"};
    const review={
      location:{parcelAddress:address,address,x:"127.0",y:"37.0"},
      parcels:[{inputAddress:address},{inputAddress:"경기도 의왕시 초평동 630-2"}],
      parcel:{area:2981,landCategory:"대",pnu:null,approximate:false,source:"합필"},
      landUse:[{category:"용도지역",name:"준주거지역",code:"LT_C_UQ111",source:"VWorld",status:"verified"}],
      ordinances:[],ordinanceArticleCandidates:[],ruleFindings:[],
    } as unknown as SiteReviewResult;
    const report=buildLegalReviewReport(body,review);
    expect(report.rows.find(x=>x.id==="uiwang-assembled-block-unverified")?.status).toBe("conditional");
    expect(report.rows.some(x=>x.id==="uiwang-use-block")).toBe(false);
    expect(report.rows.some(x=>x.id==="plan-uiwang-chopyeong-2026-308")).toBe(false);
    expect(report.rows.find(x=>x.id==="uiwang-assembled-block-unverified")?.detail).toContain("일괄 적용하지 않음");
  });
  it("keeps regional LH 2026 source routing/expiry and minimum-size distinct",()=>{
    const south=findLhPurchaseNotice("경기도 안양시 동안구 비산동 1101")!;
    expect(south.id).toBe("south-3rd-2026");
    expect(noticeIsOpen(south,"2026-11-01")).toBe(false);
    expect(south.normalMinimumHomes).toBe(30);
    const north=findLhPurchaseNotice("경기도 파주시 파주읍 봉암리 1343-2")!;
    expect(north.normalMinimumHomes).toBe(30);
    const incheon=findLhPurchaseNotice("경기도 부천시 원미구 중동 1036")!;
    expect(incheon.normalMinimumHomes).toBe(20);
    expect(matchLhRegion("경기도 하남시 덕풍동 419-32")).toBe("경기북부");
  });
});