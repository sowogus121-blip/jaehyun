import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/site-review/route";

function request(headers: Record<string, string> = {}, address = "경기도 의정부시 가능동 75-1", parcelAddresses: string[] = []) {
  return new NextRequest("http://127.0.0.1:3000/api/site-review", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ address, parcelAddresses }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("site review API", () => {
  it("keeps uploaded official-document land use available without credentials", async () => {
    const response = await POST(request());
    const data = await response.json();

    expect(data.status).toBe("partial");
    expect(data.landUse).toContainEqual(expect.objectContaining({
      name: "제2종일반주거지역",
      code: "OFFICIAL-DOCUMENT",
    }));
  });

  it("requests a parcel address category and returns VWorld coordinates", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/req/search")) {
        return new Response(JSON.stringify({
          response: {
            status: "OK",
            result: { items: [{ address: { parcel: "경기도 의정부시 가능동 75-1" }, point: { x: "127.039", y: "37.748" } }] },
          },
        }));
      }
      return new Response(JSON.stringify({ response: { status: "OK", result: { featureCollection: { features: [] } } } }));
    });
    vi.stubGlobal("fetch", fetchMock);

    const response = await POST(request({ "x-vworld-api-key": "test-key" }));
    const data = await response.json();
    const searchUrl = String(fetchMock.mock.calls[0][0]);

    expect(searchUrl).toContain("category=parcel");
    expect(data.location).toEqual(expect.objectContaining({ x: "127.039", y: "37.748" }));
    expect(data.landUse).toContainEqual(expect.objectContaining({ code: "OFFICIAL-DOCUMENT" }));
  });

  it("shows the reason returned by the law API instead of a generic missing-result message", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(JSON.stringify({
      LawSearch: { resultCode: "03", resultMsg: "등록되지 않은 OC" },
    }))));

    const response = await POST(request({ "x-law-api-oc": "invalid-oc" }));
    const data = await response.json();

    expect(data.errors).toContain("국가법령정보센터 11개 조회 실패: 03 · 등록되지 않은 OC");
  });

  it("auto-applies land use, parcel data, and planning standards for a new address", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("/req/search")) {
        return new Response(JSON.stringify({ response: { status: "OK", result: { items: [{ address: { road: "서울특별시 강남구 테헤란로 1" }, point: { x: "127.02", y: "37.50" } }] } } }));
      }
      if (url.includes("data=LT_C_UQ111")) {
        return new Response(JSON.stringify({ response: { status: "OK", result: { featureCollection: { features: [{ properties: { DGM_NM: "제3종일반주거지역" } }] } } } }));
      }
      if (url.includes("data=LP_PA_CBND_BUBUN")) {
        return new Response(JSON.stringify({ response: { status: "OK", result: { featureCollection: { features: [{ properties: { P_AREA: "1000", JIMOK_NM: "대", PNU: "1168010100100010000" } }] } } } }));
      }
      return new Response(JSON.stringify({ response: { status: "OK", result: { featureCollection: { features: [] } } } }));
    }));

    const response = await POST(request({ "x-vworld-api-key": "test-key" }, "서울특별시 강남구 테헤란로 1"));
    const data = await response.json();

    expect(data.landUse).toContainEqual(expect.objectContaining({ name: "제3종일반주거지역" }));
    expect(data.parcel).toEqual(expect.objectContaining({ area: 1000, landCategory: "대" }));
    expect(data.planningStandards).toEqual(expect.objectContaining({ buildingCoverageRatio: 50, far: 300 }));
  });

  it("keeps multiple parcels separate and aggregates only their confirmed areas", async () => {
    const response = await POST(request({}, "경기도 의정부시 가능동 75-1", ["경기도 의정부시 가능동 72-5"]));
    const data = await response.json();

    expect(data.parcels).toHaveLength(2);
    expect(data.parcel.area).toBe(2095);
    expect(data.mixedUseZones).toBe(false);
    expect(data.parcels.map((item: { parcel: { area: number } }) => item.parcel.area)).toEqual([1467, 628]);
  });

  it("separates source discovery from target-site application assessment", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const query = url.searchParams.get("query") || "법규";
      if (url.searchParams.get("target") === "ordin") {
        return new Response(JSON.stringify({ OrdinSearch: { resultCode: "00", ordin: [{ 자치법규명: query, 시행일자: "20260101", 자치법규상세링크: "/ordin" }] } }));
      }
      return new Response(JSON.stringify({ LawSearch: { resultCode: "00", law: [{ 법령명한글: query, 시행일자: "20260101", 법령상세링크: "/law" }] } }));
    }));

    const response = await POST(request({ "x-law-api-oc": "test-oc" }));
    const data = await response.json();

    expect(data.laws[0]).toEqual(expect.objectContaining({ retrievalStatus: "metadata-only", applicationStatus: "not-assessed" }));
    expect(data.applicationAssessmentComplete).toBe(false);
    expect(data.ruleFindings).toEqual([]);
    expect(data.status).toBe("partial");
  });

  it("retrieves matching municipality ordinance articles but does not certify applicability", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("lawService.do")) {
        return new Response(JSON.stringify({
          자치법규: { 조문: [{ 조문번호: "10", 조제목: "건폐율", 조내용: "건폐율은 관계 법령에 따라 정한다." }] },
        }));
      }
      const query = url.searchParams.get("query") ?? "건축 조례";
      if (url.searchParams.get("target") === "ordin") {
        const subject = query.includes("주차장") ? "주차장" : query.includes("도시계획") ? "도시계획" :
          query.includes("경관") ? "경관" : "건축";
        return new Response(JSON.stringify({ OrdinSearch: { resultCode: "00", ordin: [
          { 자치법규명: `서울특별시 서초구 ${subject} 조례`, 지자체기관명: "서초구", 자치법규ID: "1234" },
          { 자치법규명: `서울특별시 강남구 ${subject} 조례`, 지자체기관명: "강남구", 자치법규ID: "5678", 자치법규상세링크: "/ordin" },
        ] } }));
      }
      return new Response(JSON.stringify({ LawSearch: { resultCode: "00", law: [
        { 법령명한글: query, 시행일자: "20260101", 법령상세링크: "/law" },
      ] } }));
    }));

    const response = await POST(request({ "x-law-api-oc": "test-oc" }, "서울특별시 강남구 테헤란로 1"));
    const data = await response.json();
    expect(data.ordinances).toHaveLength(4);
    expect(data.ordinances.every((ordinance: { name: string }) => ordinance.name.includes("강남구"))).toBe(true);
    expect(data.ordinanceArticleCandidates.length).toBeGreaterThan(0);
    expect(data.ordinanceArticleCandidates.every((candidate: { verified: boolean }) => candidate.verified === false)).toBe(true);
    expect(data.ruleFindings).toEqual([]);
    expect(data.applicationAssessmentComplete).toBe(false);
  });
});
