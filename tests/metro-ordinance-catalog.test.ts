import { describe, expect, it } from "vitest";
import {
  METRO_ORDINANCE_RULES, METRO_ORDINANCE_SOURCES,
  findMetroOrdinanceRules, findMetroOrdinanceSource,
} from "../lib/metro-ordinance-catalog";
import { buildLegalReviewReport } from "../lib/legal-review-report";
import { DEFAULT_INPUT } from "../lib/calculator";

describe("capital area ordinance evidence catalog",()=>{
  it("indexes all three metropolitan regions and at least 10 municipal sources",()=>{
    expect(new Set(METRO_ORDINANCE_SOURCES.map(s=>s.region))).toEqual(new Set(["서울","경기","인천"]));
    expect(METRO_ORDINANCE_SOURCES.length).toBeGreaterThanOrEqual(10);
    expect(METRO_ORDINANCE_RULES.length).toBeGreaterThanOrEqual(25);
    expect(new Set(METRO_ORDINANCE_RULES.map(r=>r.id)).size).toBe(METRO_ORDINANCE_RULES.length);
  });
  it("keeps official source, publication date, and no future effective rules",()=>{
    for(const s of METRO_ORDINANCE_SOURCES){
      expect(s.url.startsWith("https://")).toBe(true);
      expect(new URL(s.url).hostname.endsWith("law.go.kr")).toBe(true);
      expect(s.effectiveDate).toMatch(/^20\d{2}-\d{2}-\d{2}$/);
      expect(s.effectiveDate <= "2026-11-01").toBe(true);
    }
    for(const r of METRO_ORDINANCE_RULES){
      expect(METRO_ORDINANCE_SOURCES.some(s=>s.city===r.city)).toBe(true);
      expect(r.automaticApplication).toBe(false);
      expect(r.conditions.length).toBeGreaterThan(12);
    }
  });
  it("matches Seoul, Incheon and particular Gyeonggi municipalities, never another city",()=>{
    expect(findMetroOrdinanceSource("서울특별시 강남구 논현동 56-21")?.city).toBe("서울특별시");
    expect(findMetroOrdinanceSource("인천광역시 연수구 송도동 1")?.city).toBe("인천광역시");
    expect(findMetroOrdinanceSource("경기도 파주시 파주읍 봉암리 1343-2")?.city).toBe("파주시");
    expect(findMetroOrdinanceSource("경기도 안양시 동안구 비산동 999")?.city).toBe("안양시");
    expect(findMetroOrdinanceSource("경기도 의왕시 초평동 630-1")?.city).toBe("의왕시");
    expect(findMetroOrdinanceSource("경기도 포천시 아무리 10")).toBeNull();
    expect(findMetroOrdinanceRules("경기도 포천시 아무리 10")).toEqual([]);
    expect(findMetroOrdinanceRules("경기도 파주시 10").some(r=>r.city!=="파주시")).toBe(false);
  });
  it("distinguishes conditional 120% candidate from immediately granted 360% FAR",()=>{
    const paju=findMetroOrdinanceRules("경기도 파주시 봉암리 1343-2");
    const rental=paju.find(x=>x.id==="paju-public-rental-120");
    expect(rental?.detail).toContain("120%");
    expect(rental?.conditions).toContain("조건부");
    expect(rental?.automaticApplication).toBe(false);
    expect(paju.find(x=>x.id==="paju-zone-semi")?.detail).toContain("300%");
  });
  it("keeps apartment/office restrictions and mixed-use annex links explicit",()=>{
    expect(findMetroOrdinanceRules("경기도 안양시 비산동 1").find(r=>r.id==="anyang-mixed-appendix17")?.conditions).toContain("별표17");
    expect(findMetroOrdinanceRules("경기도 하남시 덕풍동 419-32").find(r=>r.id==="hanam-commercial-mixed-formula")?.detail).toContain("오피스텔");
    expect(findMetroOrdinanceRules("인천광역시 부평구 1").find(r=>r.id==="incheon-semi-residential-general")?.evidence).toBe("needs-current-recheck");
    expect(findMetroOrdinanceRules("경기도 성남시 1")[0]?.evidence).toBe("source-indexed");
  });
  it("injects city-only evidence in legal reports without approving parcel limits",()=>{
    const report=buildLegalReviewReport({...DEFAULT_INPUT,address:"경기도 파주시 파주읍 봉암리 1343-2"},null);
    expect(report.rows.find(x=>x.id==="metro-catalog-source")?.status).toBe("source");
    const paju=report.rows.find(x=>x.id==="metro-paju-public-rental-120");
    expect(paju?.status).toBe("conditional");
    expect(paju?.sourceUrl).toContain("law.go.kr");
    expect(paju?.note).toContain("자동 완화");
    expect(report.rows.some(x=>x.id==="metro-seoul-rental-long20")).toBe(false);
  });
  it("does not confuse unverified source-indexing with verified parcel entitlements",()=>{
    const report=buildLegalReviewReport({...DEFAULT_INPUT,address:"경기도 성남시 분당구 수내동 10"},null);
    expect(report.rows.find(x=>x.id==="metro-seongnam-index")?.status).toBe("unknown");
    expect(report.rows.find(x=>x.id==="metro-seongnam-index")?.note).toContain("자동 완화");
    expect(report.rows.find(x=>x.id==="metro-seongnam-index")?.sourceUrl).toContain("law.go.kr");
  });
});