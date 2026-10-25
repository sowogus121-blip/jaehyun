import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/site-review/route";

function request(headers: Record<string, string> = {}, address = "경기도 의정부시 가능동 75-1") {
  return new NextRequest("http://127.0.0.1:3000/api/site-review", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({ address }),
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
});
