import { describe, expect, it } from "vitest";
import { getParcelLegalGuide, PARCEL_LEGAL_GUIDES } from "./parcel-legal-guides";

describe("parcel legal evidence boundaries", () => {
  it("matches only the two precisely identified parcels", () => {
    expect(getParcelLegalGuide("충청북도 청주시 흥덕구 오송읍 봉산리 992")?.id).toBe("osong-bongsan-992");
    expect(getParcelLegalGuide("서울특별시 금천구 독산동 151-10")?.id).toBe("seoul-doksan-151-10");
    expect(getParcelLegalGuide("오송읍 봉산리 991")).toBeNull();
    expect(getParcelLegalGuide("서울 금천구 독산동 151-11")).toBeNull();
    expect(getParcelLegalGuide("")).toBeNull();
  });
  it("keeps parcel mapping and LH exceptions pending while linking sources", () => {
    expect(PARCEL_LEGAL_GUIDES).toHaveLength(2);
    for (const guide of PARCEL_LEGAL_GUIDES) {
      expect(guide.rules.length).toBeGreaterThan(5);
      expect(guide.rules.some((r) => r.status === "parcel-check")).toBe(true);
      expect(guide.rules.every((r) => r.sourceUrl.startsWith("https://"))).toBe(true);
    }
  });
  it("captures the Osong officetel exclusion and the Doksan 250% baseline without permitting auto-calculation", () => {
    const osong=getParcelLegalGuide("오송읍 봉산리 992")!;
    const doksan=getParcelLegalGuide("독산동 151-10")!;
    expect(osong.rules.some(r=>r.detail.includes("오피스텔 용도는 불허"))).toBe(true);
    expect(doksan.rules.some(r=>r.detail.includes("250% 이하"))).toBe(true);
    expect(osong.rules.find(r=>r.title.includes("허용용도"))?.status).toBe("parcel-check");
  });
});
