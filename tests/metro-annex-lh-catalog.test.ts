import {describe,it,expect} from "vitest";
import {
  METRO_ANNEX_RECORDS, LH_PURCHASE_NOTICES, LH_GUIDELINE_EVIDENCE,
  findMetroAnnexRecords, findLhPurchaseNotice, findLhGuidelines,
  matchLhRegion, noticeIsOpen,
} from "../lib/metro-annex-lh-catalog";

describe("metropolitan ordinance annex source index",()=>{
  it("covers at least 4 targeted annex categories for every currently tracked municipality",()=>{
    expect(METRO_ANNEX_RECORDS.length).toBe(44);
    expect(new Set(METRO_ANNEX_RECORDS.map(r=>r.id)).size).toBe(METRO_ANNEX_RECORDS.length);
    const paju=findMetroAnnexRecords("경기도 파주시 파주읍 봉암리 1343-2");
    expect(paju.length).toBe(4);
    expect(paju.every(x=>x.city==="파주시")).toBe(true);
    expect(paju.filter(x=>x.evidence==="verified-title").map(x=>x.id)).toEqual(["paju-building-annex3"]);
    expect(paju.filter(x=>x.evidence==="lookup-only")).toHaveLength(3);
    expect(findMetroAnnexRecords("경기도 포천시 신읍동 1")).toHaveLength(0);
  });
  it("retains exact verified annex numbers only where the official article/title has been read",()=>{
    expect(findMetroAnnexRecords("서울특별시 강남구 1").find(x=>x.id==="seoul-building-annex4")?.appendix).toBe("별표 4");
    expect(findMetroAnnexRecords("서울특별시 강남구 1").find(x=>x.id==="seoul-parking-annex2")?.appendix).toBe("별표 2");
    expect(findMetroAnnexRecords("의왕시 초평동 630-1").find(x=>x.id==="uiwang-parking-annex5")?.evidence).toBe("direct-excerpt");
    expect(findMetroAnnexRecords("경기도 안양시 1").every(x=>x.appendix===null)).toBe(true);
    expect(METRO_ANNEX_RECORDS.every(x=>x.automaticApplication===false&&new URL(x.sourceUrl).hostname.endsWith("law.go.kr"))).toBe(true);
  });
});

describe("LH 2026 region-specific purchase notices and guide archive",()=>{
  it("indexes exact official regional notices with PDFs + ZIPs, without generic HQ pre-notice as application",()=>{
    expect(LH_PURCHASE_NOTICES.length).toBe(4);
    expect(new Set(LH_PURCHASE_NOTICES.map(x=>x.region)).size).toBe(4);
    for(const x of LH_PURCHASE_NOTICES){
      expect(x.noticeUrl).toMatch(/^https:\/\/apply\.lh\.or\.kr\/lhapply\/apply\/pch\/view\.do/);
      expect(x.noticePdfUrl).toMatch(/^https:\/\/apply\.lh\.or\.kr\/lhapply\/lhFile\.do\?fileid=\d+$/);
      expect(x.guidelineZipUrl).toMatch(/^https:\/\/apply\.lh\.or\.kr\/lhapply\/lhFile\.do\?fileid=\d+$/);
      expect(x.automaticApplication).toBe(false);
      expect(x.pdfPages).toBeGreaterThan(25);
    }
    const seoul=LH_PURCHASE_NOTICES.find(x=>x.region==="서울");
    expect(seoul?.noticeUrl).toContain("1745");
    expect(seoul?.noticePdfUrl).toContain("69046535");
    expect(seoul?.revisionNote).toContain("1735");
    expect(LH_PURCHASE_NOTICES.find(x=>x.region==="인천·부천")?.normalMinimumHomes).toBe(20);
    expect(LH_PURCHASE_NOTICES.find(x=>x.region==="경기남부")?.normalMinimumHomes).toBe(30);
  });
  it("resolves Gyeonggi South/North and Bucheon-Incheon without geographic collisions",()=>{
    expect(matchLhRegion("서울특별시 강남구 논현동 56-21")).toBe("서울");
    expect(matchLhRegion("인천광역시 부평구 삼산동 10")).toBe("인천·부천");
    expect(matchLhRegion("경기도 부천시 중동 100")).toBe("인천·부천");
    expect(matchLhRegion("경기도 파주시 파주읍 봉암리 1343-2")).toBe("경기북부");
    expect(matchLhRegion("경기도 하남시 덕풍동 419-32")).toBe("경기북부");
    expect(matchLhRegion("경기도 의왕시 초평동 630-1")).toBe("경기남부");
    expect(matchLhRegion("경기도 안양시 동안구 999")).toBe("경기남부");
    expect(matchLhRegion("광주광역시 서구 광천동 5")).toBe(null);
    expect(matchLhRegion("경기도 포천시 신읍동 10")).toBe("경기북부");
    expect(findLhPurchaseNotice("경기도 부천시 중동 1")?.id).toBe("incheon-3rd-2026");
  });
  it("marks expired Gyeonggi South notice and prevents it becoming current in the library",()=>{
    const seoul=findLhPurchaseNotice("서울특별시 중랑구 1")!;
    const south=findLhPurchaseNotice("경기도 안양시 1")!;
    const north=findLhPurchaseNotice("경기도 파주시 1")!;
    const inch=findLhPurchaseNotice("경기도 부천시 1")!;
    expect(noticeIsOpen(seoul,"2026-11-01")).toBe(true);
    expect(noticeIsOpen(north,"2026-11-01")).toBe(true);
    expect(noticeIsOpen(inch,"2026-11-01")).toBe(true);
    expect(noticeIsOpen(south,"2026-11-01")).toBe(false);
    expect(noticeIsOpen(seoul,"2026-11-06")).toBe(false);
  });
  it("keeps guide rules in their actual source region, never magically confers parking relief",()=>{
    expect(LH_GUIDELINE_EVIDENCE.length).toBeGreaterThanOrEqual(10);
    const north=findLhGuidelines("경기도 파주시 1");
    expect(north.find(x=>x.id==="lh-guideline-elevator-4")?.sourceLocation).toContain("G22");
    expect(north.find(x=>x.id==="lh-seoul-mechanical")).toBeUndefined();
    const south=findLhGuidelines("경기도 수원시 1");
    expect(south.find(x=>x.id==="lh-south-mechanical03")?.conditions).toContain("접수 종료");
    const seoul=findLhGuidelines("서울특별시 강남구 1");
    expect(seoul.find(x=>x.id==="lh-seoul-mechanical")?.detail).toContain("지양");
    const inch=findLhGuidelines("인천광역시 남동구 1");
    expect(inch.find(x=>x.id==="lh-incheon-minimum20")?.detail).toContain("20호");
    expect(LH_GUIDELINE_EVIDENCE.every(x=>x.automaticApplication===false)).toBe(true);
  });
});
