import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/site-review/route";

// Site-review tests focus on zoning/cadastre; regional LH board is validated in lh-notice.test.ts.
vi.mock("../lib/server/lh-notice", () => ({ findLatestLhPurchaseNotice: vi.fn().mockResolvedValue(null) }));

function request(headers: Record<string, string> = {}, address = "경기도 의정부시 가능동 75-1", parcelAddresses: string[] = []) {
  return new NextRequest("http://127.0.0.1:3000/api/site-review", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ address, parcelAddresses }),
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("multi-parcel API request validation", () => {
  it("rejects requests exceeding 20 total lots instead of truncating them", async()=>{
    const addresses=Array.from({length:20},(_,i)=>"경기도 의정부시 가능동 "+(100+i)+"-1");
    const res=await POST(request({},"경기도 의정부시 가능동 75-1",addresses));
    expect(res.status).toBe(400);
    const data=await res.json();
    expect(data.error).toContain("최대 20필지");
  });
});

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

    expect(data.errors).toContain("국가법령정보센터 12개 조회 실패: 03 · 등록되지 않은 OC");
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

  it("requests the current VWorld district-unit-plan layer instead of invalid LT_C_UQ171", async () => {
    const dataCodes: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.includes("/req/search")) return new Response(JSON.stringify({
        response: { status: "OK", result: { items: [{
          address: { parcel: "경기도 의정부시 다른동 10-3" },
          point: { x: "127.05", y: "37.75" },
        }] } },
      }));
      const code = url.searchParams.get("data");
      if (code) dataCodes.push(code);
      const features = code === "LT_C_UPISUQ161"
        ? [{ properties: { DGM_NM: "세부 도시관리계획" } }] : [];
      return new Response(JSON.stringify({ response: {
        status: "OK", result: { featureCollection: { features } },
      } }));
    }));
    const response = await POST(request({ "x-vworld-api-key": "test-key" }, "경기도 의정부시 다른동 10-3"));
    const review = await response.json();
    expect(dataCodes).toContain("LT_C_UPISUQ161");
    expect(dataCodes).toContain("LT_C_UPISUQ171");
    expect(dataCodes).toContain("LT_C_UQ124");
    expect(dataCodes).toContain("LT_C_UQ126");
    expect(dataCodes).toContain("LT_C_UD801");
    expect(dataCodes).not.toContain("LT_C_UQ171");
    expect(dataCodes).not.toContain("LT_C_UQ141");
    expect(review.districtPlan).toBe(true);
    expect(review.landUse).toContainEqual(expect.objectContaining({
      code: "LT_C_UPISUQ161", category: "도시계획",
    }));
    expect(review.errors).toEqual([]);
  });

  it("keeps multiple parcels separate and aggregates only their confirmed areas", async () => {
    const response = await POST(request({}, "경기도 의정부시 가능동 75-1", ["경기도 의정부시 가능동 72-5"]));
    const data = await response.json();

    expect(data.parcels).toHaveLength(2);
    expect(data.parcel.area).toBe(2095);
    expect(data.mixedUseZones).toBe(false);
    expect(data.parcels.map((item: { parcel: { area: number } }) => item.parcel.area)).toEqual([1467, 628]);
  });

  it("reads official national 0.3-parking clause as an unverified candidate, not auto-approval", async () => {
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      if (url.pathname.endsWith("lawService.do")) {
        return new Response(JSON.stringify({
          법령: { 조문: [{ 조문번호: "37", 조문내용: "공공주택사업자에게 매도하기로 약정을 체결한 주택 중 세대당 전용면적이 30제곱미터 미만인 세대는 주차대수 기준을 0.3대로 적용할 수 있다." }] },
        }));
      }
      if (url.searchParams.get("target") === "ordin") {
        return new Response(JSON.stringify({ OrdinSearch: { resultCode: "00", ordin: [] } }));
      }
      const query = url.searchParams.get("query") || "";
      return new Response(JSON.stringify({ LawSearch: { resultCode: "00", law: [{
        법령명한글: query, 법령ID: query === "공공주택 특별법 시행령" ? "000123" : "",
        시행일자: "20260908", 법령상세링크: "/LSW/",
      }] } }));
    }));
    const response = await POST(request({ "x-law-api-oc": "test-oc" }));
    const data = await response.json();
    expect(data.nationalArticleCandidates.some((item: { excerpt: string }) => item.excerpt.includes("0.3대"))).toBe(true);
    expect(data.nationalArticleCandidates.every((item: { verified: boolean }) => item.verified === false)).toBe(true);
    expect(data.applicationAssessmentComplete).toBe(false);
    expect(data.ruleFindings).toEqual([]);
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

  it("queries enacted municipal ordinance names without the province prefix", async () => {
    const searched: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = new URL(String(input));
      const query = url.searchParams.get("query") || "";
      if (url.searchParams.get("target") === "ordin") {
        searched.push(query);
        if (query.startsWith("경기도 ")) {
          return new Response(JSON.stringify({ OrdinSearch: { resultCode: "00", ordin: [] } }));
        }
        return new Response(JSON.stringify({ OrdinSearch: { resultCode: "00", ordin: [{
          자치법규명: query, 지자체기관명: "경기도 의정부시",
          자치법규ID: "10001", 자치법규상세링크: "/ordin",
        }] } }));
      }
      if (url.pathname.includes("lawService")) {
        return new Response(JSON.stringify({ 자치법규: { 조문: [] } }));
      }
      return new Response(JSON.stringify({ LawSearch: { resultCode: "00", law: [] } }));
    }));
    const response = await POST(request({ "x-law-api-oc": "test-oc" }));
    const data = await response.json();
    expect(searched).toContain("의정부시 도시계획 조례");
    expect(searched).toContain("의정부시 주차장 설치 및 관리 조례");
    expect(searched.every((query) => !query.startsWith("경기도 "))).toBe(true);
    expect(data.ordinances).toHaveLength(4);
    expect(data.ordinances.every((v: { localGovernment: string }) =>
      v.localGovernment === "경기도 의정부시")).toBe(true);
    expect(data.applicationAssessmentComplete).toBe(false);
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
          { 자치법규명: `서초구 ${subject} 조례`, 지자체기관명: "서울특별시 서초구", 자치법규ID: "1234" },
          { 자치법규명: `강남구 ${subject} 조례`, 지자체기관명: "서울특별시 강남구", 자치법규ID: "5678", 자치법규상세링크: "/ordin" },
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
