import { describe, expect, it } from "vitest";
import { PARCEL_ANNEX_SOURCES, getParcelAnnexSources } from "./parcel-annex-library";

describe("parcel annex and LH guideline reference library", () => {
  it("keeps distinct legal and LH references for each exact parcel", () => {
    const osong = getParcelAnnexSources("충북 청주시 흥덕구 오송읍 봉산리 992");
    const doksan = getParcelAnnexSources("서울 금천구 독산동 151-10");
    expect(osong.length).toBe(18);
    expect(doksan.length).toBe(19);
    expect(osong.some(s => s.id === "osong-city-parking-annex7")).toBe(true);
    expect(doksan.some(s => s.id === "doksan-industrial-annex17")).toBe(true);
    expect(osong.some(s => s.id === "doksan-industrial-annex17")).toBe(false);
    expect(doksan.some(s => s.id === "osong-city-parking-annex7")).toBe(false);
    expect(getParcelAnnexSources("서울특별시 금천구 가산동 1").every(s => s.scope === "공통")).toBe(true);
  });
  it("links to the actual 2026 region-specific LH announcements, not the old Seoul sixth notice", () => {
    const osong = getParcelAnnexSources("오송읍 봉산리 992");
    const doksan = getParcelAnnexSources("독산동 151-10");
    expect(osong.find(s=>s.id==="osong-lh-notice-2026")?.url).toContain("pchPanSn=1632");
    expect(doksan.find(s=>s.id==="doksan-lh-notice-2026-7")?.url).toContain("pchPanSn=1754");
    expect(doksan.find(s=>s.id==="doksan-lh-zip")?.reviewStatus).toContain("미열람");
    expect(osong.find(s=>s.id==="osong-lh-zip")?.reviewStatus).toContain("미열람");
  });
  it("references valid unique official URLs and never treats annex indexing as verified site-specific eligibility", () => {
    const ids = PARCEL_ANNEX_SOURCES.map(s=>s.id);
    expect(new Set(ids).size).toBe(ids.length);
    for(const item of PARCEL_ANNEX_SOURCES) {
      expect(item.url.startsWith("https://")).toBe(true);
      expect(item.reviewStatus.length).toBeGreaterThan(10);
      expect(item.purpose.length).toBeGreaterThan(10);
    }
    expect(PARCEL_ANNEX_SOURCES.some(s=>s.id==="lh-design-2026")).toBe(true);
  });
});
