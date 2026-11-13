import { describe, expect, it } from "vitest";
import { NextRequest } from "next/server";
import { POST } from "../app/api/site-review/route";
import { buildRows } from "../lib/review/build-rows";
import { buildChecklist } from "../lib/review/checklist";
import { newProject, applyReview } from "../lib/project/store";
import type { SiteReviewResult } from "../lib/types";

const ADDRESS = "경기도 의정부시 가능동 75-1";
const ordinancePayload = (name: string) => {
  if (name.includes("도시계획")) return { 조문: { 조: [
    { 조문번호: "42", 조제목: "용도지역안에서의 건폐율", 조내용: "제42조(용도지역안에서의 건폐율) 제2종일반주거지역: 60퍼센트 이하" },
    { 조문번호: "46", 조제목: "용도지역안에서의 용적률", 조내용: "제46조(용도지역안에서의 용적률) ① 제2종일반주거지역: 250퍼센트 이하", 항: [{ 항내용: "③ 임대주택을 건설하는 경우 120퍼센트 이하" }] },
  ] } };
  if (name.includes("주차장")) return { 조문: { 조: [{ 조문번호: "11", 조제목: "기계식주차장", 조내용: "제11조의2(기계식주차장의 설치기준) 기계식주차장은 주차대수의 100분의 20 이하" }] } };
  return { 조문: { 조: [{ 조문번호: "43", 조제목: "일조 등의 확보", 조내용: "제43조(일조 등의 확보를 위한 건축물의 높이 제한) 정북방향 일조" }] } };
};
const lawPayload = { 법령: { 조문: { 조문단위: [
  { 조문번호: "86", 조문여부: "조문", 조문제목: "일조 등의 확보를 위한 건축물의 높이 제한", 조문내용: "제86조(일조 등의 확보를 위한 건축물의 높이 제한) ① 높이 10미터 이하인 부분: 인접 대지경계선으로부터 1.5미터 이상" },
  { 조문번호: "80", 조문가지번호: "2", 조문여부: "조문", 조문제목: "대지 안의 공지", 조문내용: "제80조의2(대지 안의 공지) 별표 2에 따라" },
] } } };

function mockFetch() {
  const original = globalThis.fetch;
  globalThis.fetch = (async (input: string | URL | Request) => {
    const url = new URL(String(input));
    if (url.hostname.includes("law.go.kr") && url.pathname.includes("lawSearch")) {
      const query = url.searchParams.get("query") ?? "";
      if (url.searchParams.get("target") === "ordin") {
        const subject = query.includes("주차장") ? "주차장 설치 및 관리 조례" : query.includes("도시계획") ? "도시계획 조례" : query.includes("경관") ? "경관 조례" : "건축 조례";
        const name = "의정부시 " + subject;
        return new Response(JSON.stringify({ OrdinSearch: { resultCode: "00", ordin: [{ 자치법규명: name, 자치법규ID: subject, 지자체기관명: "경기도 의정부시", 시행일자: "20260101", 자치법규상세링크: "/ordin" }] } }));
      }
      return new Response(JSON.stringify({ LawSearch: { resultCode: "00", law: [{ 법령명한글: query, 법령ID: query, 시행일자: "20260101", 법령상세링크: "/law" }] } }));
    }
    if (url.pathname.includes("lawService")) {
      const id = url.searchParams.get("ID") ?? "";
      return new Response(JSON.stringify(url.searchParams.get("target") === "ordin" ? ordinancePayload(id) : lawPayload));
    }
    throw new Error("offline");
  }) as typeof fetch;
  return () => { globalThis.fetch = original; };
}

describe("대상지 입력 시 규모검토 필요 조문 자동 수집", () => {
  it("조례 주제별 조문과 국가법령 핵심 조항을 원문 그대로 수집하고 행 근거로 첨부한다", async () => {
    const restore = mockFetch();
    process.env.LAW_OPEN_API_OC = "test";
    try {
      const res = await POST(new NextRequest("http://127.0.0.1/api/site-review", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address: ADDRESS }) }));
      const data = await res.json() as SiteReviewResult;
      const collected = data.collected ?? [];
      expect(collected.some((c) => c.rowId === "plan.bcrfar" && c.text.includes("250퍼센트"))).toBe(true);
      expect(collected.some((c) => c.rowId === "plan.relax" && c.text.includes("임대주택"))).toBe(true);
      expect(collected.some((c) => c.rowId === "park.mech.ord" && c.text.includes("100분의 20"))).toBe(true);
      expect(collected.some((c) => c.rowId === "bld.sunlight" && c.kind === "law" && c.article.startsWith("제86조"))).toBe(true);
      expect(collected.some((c) => c.rowId === "bld.setback" && c.article.startsWith("제80조의2"))).toBe(true);

      const withZone: SiteReviewResult = { ...data, landUse: [{ category: "용도지역", name: "제2종일반주거지역", code: "x", source: "VWorld", status: "verified" }], location: { address: ADDRESS, parcelAddress: ADDRESS, x: "1", y: "1" } };
      const rows = buildRows({ address: ADDRESS, extraParcels: [], business: "lh-purchase", uses: ["apartment"], supplies: [] }, withZone);
      const mech = rows.find((r) => r.id === "park.mech.ord")!;
      expect(mech.sources.some((s) => s.verbatim && (s.excerpt ?? "").includes("100분의 20"))).toBe(true);
      const sun = rows.find((r) => r.id === "bld.sunlight")!;
      expect(sun.sources.some((s) => s.verbatim && (s.article ?? "").startsWith("제86조"))).toBe(true);
    } finally { restore(); delete process.env.LAW_OPEN_API_OC; }
  });

  it("필요자료 체크리스트가 확보·미확보·직접확인 항목을 구분한다", () => {
    const review = {
      status: "partial", reviewStage: "source-discovery", sourceDiscoveryComplete: false, applicationAssessmentComplete: false, checkedAt: "",
      location: { address: ADDRESS, parcelAddress: ADDRESS, x: "1", y: "1" },
      landUse: [{ category: "용도지역", name: "제2종일반주거지역", code: "x", source: "VWorld", status: "verified" }],
      parcel: { area: 1467, landCategory: "대", pnu: "1", source: "VWorld 지적속성", approximate: false },
      planningStandards: null, districtPlan: false, mixedUseZones: false, parcels: [], laws: [], ordinances: [], ruleFindings: [], lhNotice: null,
      collected: [{ topic: "기계식주차장", rowId: "park.mech.ord", title: "의정부시 주차장 조례", url: "https://law.go.kr", effectiveDate: null, article: "제11조의2", text: "기계식", kind: "ordinance" }],
      webSearch: { status: "not-configured", provider: null, searchedAt: "", results: [], errors: [] }, missing: [], errors: [], unresolved: [],
    } as unknown as SiteReviewResult;
    const p = applyReview(newProject({ address: ADDRESS, uses: ["apartment"] }), review);
    const items = buildChecklist(p).flatMap((g) => g.items);
    expect(items.find((i) => i.id === "area")?.state).toBe("ok");
    expect(items.find((i) => i.id === "road")?.state).toBe("manual");
    expect(items.find((i) => i.id === "lh-notice")?.state).toBe("missing");
    expect(items.find((i) => i.label.startsWith("기계식주차"))?.state).not.toBe("missing");
  });
});

import { keepPreviousLawData } from "../lib/project/store";
import { fetchJson } from "../lib/server/law-api";
describe("국가법령정보센터 점검 대응", () => {
  it("점검 HTML 페이지를 짧은 점검 안내로 바꾼다", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async () => new Response("<html><style>html,body{width:100%}</style><body>시스템 점검 안내</body></html>")) as typeof fetch;
    let message = "";
    try { await fetchJson("https://www.law.go.kr/DRF/lawSearch.do"); } catch (e) { message = e instanceof Error ? e.message : ""; }
    try { expect(message).toBe("국가법령정보센터 시스템 점검 중"); }
    finally { globalThis.fetch = original; }
  });
  it("점검으로 법령을 못 받으면 같은 대상지의 직전 조례·수집 조문을 유지한다", () => {
    const base = { location: { address: "a", parcelAddress: "서울특별시 금천구 독산동 151-10", x: "1", y: "1" }, laws: [], ordinanceArticleCandidates: [], nationalArticleCandidates: [], errors: [] } as unknown as SiteReviewResult;
    const prev = { ...base, checkedAt: "2026-11-13T00:00:00Z", ordinances: [{ name: "서울특별시 도시계획 조례" }], collected: [{ rowId: "plan.bcrfar" }] } as unknown as SiteReviewResult;
    const next = { ...base, checkedAt: "2026-11-13T01:00:00Z", ordinances: [], collected: [], errors: ["국가법령정보센터 14개 조회 실패: 국가법령정보센터 시스템 점검 중"] } as unknown as SiteReviewResult;
    const kept = keepPreviousLawData(prev, next)!;
    expect(kept.ordinances).toHaveLength(1);
    expect(kept.collected).toHaveLength(1);
    expect(kept.errors.some((e) => e.includes("직전 조회"))).toBe(true);
  });
});
