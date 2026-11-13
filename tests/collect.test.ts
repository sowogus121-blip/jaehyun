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
    expect(items.find((i) => i.id === "road")?.state).toBe("missing");
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

import { collectSiteFacts, roadClassWidth, pnuParams } from "../lib/server/site-facts";
describe("대지 현황 자동 수집 (토지특성·도로·건축물대장)", () => {
  it("도시계획도로 규모를 폭으로 환산하고 PNU를 건축HUB 파라미터로 바꾼다", () => {
    expect(roadClassWidth("소로2류")?.text).toBe("폭 8~10m");
    expect(roadClassWidth("중로 1류")?.min).toBe(20);
    expect(roadClassWidth("소로3류")?.text).toBe("폭 8m 미만");
    expect(pnuParams("1154510200101510010")).toEqual({ sigunguCd: "11545", bjdongCd: "10200", platGbCd: "0", bun: "0151", ji: "0010" });
    expect(pnuParams("1154510200201510010")?.platGbCd).toBe("1");
  });
  it("공부 면적·도로접면·인접 도로·건축물대장·인허가를 모아 법규검토표 행으로 만든다", async () => {
    const original = globalThis.fetch;
    globalThis.fetch = (async (input: string | URL | Request) => {
      const url = String(input);
      if (url.includes("getLandCharacteristics")) return new Response(JSON.stringify({ landCharacteristicss: { field: [{ pnu: "1154510200101510010", stdrYear: "2026", lndpclAr: "1093.6", lndcgrCodeNm: "공장용지", roadSideCodeNm: "소로한면", tpgrphHgCodeNm: "평지", tpgrphFrmCodeNm: "사다리형" }] } }));
      if (url.includes("LT_C_UPISUQ151")) return new Response(JSON.stringify({ response: { status: "OK", result: { featureCollection: { features: [{ properties: { dgm_nm: "소로2류" } }] } } } }));
      if (url.includes("LT_L_SPRD")) return new Response(JSON.stringify({ response: { status: "OK", result: { featureCollection: { features: [{ properties: { rn: "독산로", road_bt: "8" } }] } } } }));
      if (url.includes("getBrTitleInfo")) return new Response(JSON.stringify({ response: { header: { resultCode: "00" }, body: { items: { item: { mainPurpsCdNm: "공장", totArea: "812.4", grndFlrCnt: "2", ugrndFlrCnt: "0", useAprDay: "19890512" } } } } }));
      if (url.includes("getApBasisOulnInfo")) return new Response(JSON.stringify({ response: { header: { resultCode: "00" }, body: { items: { item: [{ mainPurpsCdNm: "업무시설", totArea: "3732.21", archPmsDay: "20250310" }] } } } }));
      throw new Error("unexpected " + url);
    }) as typeof fetch;
    try {
      const facts = await collectSiteFacts({ pnu: "1154510200101510010", bbox: [126.9, 37.47, 126.901, 37.471], vworldKey: "k", domain: "http://x", dataKey: "d" });
      expect(facts.land?.officialArea).toBe(1093.6);
      expect(facts.roads.map((r) => r.widthText)).toEqual(["폭 8~10m", "도로폭 8m"]);
      expect(facts.buildings?.[0].use).toBe("공장");
      expect(facts.permits?.[0].permittedAt).toBe("20250310");
      const addr = "서울특별시 금천구 독산동 151-10";
      const review = { location: { address: addr, parcelAddress: addr, x: "1", y: "1" }, landUse: [{ category: "용도지역", name: "준공업지역", code: "x", source: "VWorld", status: "verified" }],
        parcel: { area: 1080.9, landCategory: "공장용지", pnu: "1", source: "VWorld 지적도형", approximate: true }, districtPlan: false, mixedUseZones: false, parcels: [], laws: [], ordinances: [],
        ruleFindings: [], lhNotice: null, siteFacts: facts, errors: [], missing: [], unresolved: [], webSearch: { status: "completed", provider: null, searchedAt: "", results: [], errors: [] } } as unknown as SiteReviewResult;
      const rows = buildRows({ address: addr, extraParcels: [], business: "lh-purchase", uses: ["apartment"], supplies: [] }, review);
      const area = rows.find((r) => r.id === "site.area")!;
      expect(area.status).toBe("verified");
      expect(area.params?.siteArea).toBe(1093.6);
      expect(rows.find((r) => r.id === "site.road")?.content).toContain("소로한면");
      expect(rows.find((r) => r.id === "site.building")?.content).toContain("허가 20250310");
      const p = applyReview(newProject({ address: addr, uses: ["apartment"] }), review);
      const items = buildChecklist(p).flatMap((g) => g.items);
      expect(items.find((i) => i.id === "road")?.state).toBe("ok");
      expect(items.find((i) => i.id === "existing")?.state).toBe("ok");
      expect(items.find((i) => i.id === "area")?.state).toBe("ok");
      expect(items.some((i) => i.state === "manual")).toBe(false);
    } finally { globalThis.fetch = original; }
  });
});

import { classifyDesignations } from "../lib/review/special-zones";
describe("상위계획·다른 법령에 따른 지역·지구 자동 연결", () => {
  const designations = [
    { name: "제2종일반주거지역", conflict: "포함", code: "UQA122" },
    { name: "노후계획도시 특별정비예정구역", conflict: "포함", code: null },
    { name: "지구단위계획구역", conflict: "포함", code: "UQQ300" },
    { name: "과밀억제권역", conflict: "포함", code: null },
    { name: "비행안전제5구역", conflict: "저촉", code: null },
    { name: "어떤특수구역", conflict: "접합", code: null },
  ];
  it("지정명을 근거 법률로 분류하고 용도지역 자체는 제외한다", () => {
    const m = classifyDesignations(designations);
    const ids = m.map((x) => x.rule?.id ?? "other");
    expect(ids).toContain("aging-new-town");
    expect(ids).toContain("district-plan");
    expect(ids).toContain("capital-region");
    expect(ids).toContain("military");
    expect(ids).toContain("other");
    expect(m.flatMap((x) => x.designations.map((d) => d.name))).not.toContain("제2종일반주거지역");
    expect(m.find((x) => x.rule?.id === "aging-new-town")?.rule?.law).toBe("노후계획도시 정비 및 지원에 관한 특별법");
  });
  it("법규검토표에 상위계획·특별법 행과 토지이용계획 전체 행을 만든다", () => {
    const addr = "경기도 성남시 분당구 정자동 1";
    const review = { location: { address: addr, parcelAddress: addr, x: "1", y: "1" }, landUse: [{ category: "용도지역", name: "제2종일반주거지역", code: "x", source: "VWorld", status: "verified" }],
      parcel: { area: 1000, landCategory: "대", pnu: "1", source: "VWorld 지적속성", approximate: false }, districtPlan: true, mixedUseZones: false, parcels: [],
      laws: [{ name: "노후계획도시 정비 및 지원에 관한 특별법", enforcementDate: "20240427", link: "https://www.law.go.kr/x" }], ordinances: [], ruleFindings: [], lhNotice: null,
      siteFacts: { land: null, roads: [], buildings: null, permits: null, designations, notes: [] },
      errors: [], missing: [], unresolved: [], webSearch: { status: "completed", provider: null, searchedAt: "", results: [{ title: "분당 노후계획도시 특별정비예정구역 지정 고시", url: "https://www.seongnam.go.kr/x", description: "고시", query: "", sourceDomain: "seongnam.go.kr", official: true }], errors: [] } } as unknown as SiteReviewResult;
    const rows = buildRows({ address: addr, extraParcels: [], business: "lh-purchase", uses: ["apartment"], supplies: [] }, review);
    const aging = rows.find((r) => r.id === "zone.aging-new-town")!;
    expect(aging.group).toBe("상위계획·특별법");
    expect(aging.law).toContain("노후계획도시");
    expect(aging.sources.some((s) => s.effectiveDate === "20240427")).toBe(true);
    expect(aging.sources.some((s) => s.kind === "plan")).toBe(true);
    expect(rows.find((r) => r.id === "site.overlay")?.content).toContain("과밀억제권역");
    expect(rows.find((r) => r.id === "zone.military")?.content).toContain("저촉");
    expect(rows.find((r) => r.id === "zone.minor")?.content).toContain("어떤특수구역");
    expect(rows.find((r) => r.id === "zone.minor")?.content).toContain("과밀억제권역");
    expect(rows.some((r) => r.id === "zone.capital-region")).toBe(false);
    expect(rows.some((r) => r.id === "zone.aging-hint")).toBe(false);
    const p = applyReview(newProject({ address: addr, uses: ["apartment"] }), review);
    const items = buildChecklist(p).flatMap((g) => g.items);
    expect(items.find((i) => i.id === "designations")?.state).toBe("ok");
    expect(items.find((i) => i.id === "zone.aging-new-town")?.state).toBe("ok");
  });
});

import simFixture from "./fixtures/sim-2026-11-14.json";
import { resolveParams } from "../lib/review/params";
import { runScenario } from "../lib/massing/engine";
describe("운영 서버 실데이터 회귀 (2026-11-14 수도권 시뮬레이션)", () => {
  const run = (key: keyof typeof simFixture) => {
    const review = simFixture[key] as unknown as SiteReviewResult;
    const p = applyReview(newProject({ address: review.location!.parcelAddress!, uses: ["apartment", "officetel"], supplies: ["youth"] }), review);
    const params = resolveParams(p.rows);
    return { p, params, results: p.scenarios.map((s) => runScenario({ params, scenario: s, assumptions: p.assumptions, site: p.site })) };
  };
  it("분당 정자동 178-1: 토지이용계획의 지구단위계획구역(포함)을 구역으로 보고 획지 확인 전 계산을 막는다", () => {
    const { p, params, results } = run("bundang");
    expect(p.rows.find((r) => r.id === "plan.district")).toBeDefined();
    expect(params.far).toBeUndefined();
    expect(results.every((r) => r.feasibility === "insufficient")).toBe(true);
    expect(p.rows.find((r) => r.id === "site.area")?.params?.siteArea).toBe(6600);
    expect(p.rows.find((r) => r.id === "site.road")?.content).toContain("대로1류");
    expect(p.rows.some((r) => r.id === "zone.aging-hint")).toBe(true);
    expect(p.rows.filter((r) => r.group === "상위계획·특별법").length).toBeLessThanOrEqual(6);
  });
  it("독산동 151-10: 서울 준공업 250% 기준으로 규모를 산정하고 가로구역 최고높이 지정을 높이 행으로 연결한다", () => {
    const { p, params, results } = run("doksan");
    expect(params.far?.value).toBe(250);
    expect(params.siteArea?.value).toBe(1093.6);
    expect(results[0].units).toBeGreaterThan(0);
    expect(results[0].plannedFar).toBeLessThanOrEqual(250);
    expect(p.rows.some((r) => r.id === "zone.height-district")).toBe(true);
    expect(p.rows.some((r) => r.id === "zone.district-plan")).toBe(false);
    expect(p.rows.find((r) => r.id === "zone.minor")?.content).toContain("지구단위계획구역 (접함)");
  });
  it("상계동 701-1: 공공청사(포함) 도시계획시설과 교육환경보호구역을 규모 영향 행으로 표시한다", () => {
    const { p } = run("sanggye");
    expect(p.rows.find((r) => r.id === "zone.urban-facility")?.content).toContain("공공청사");
    expect(p.rows.some((r) => r.id === "zone.education")).toBe(false);
    expect(p.rows.find((r) => r.id === "zone.minor")?.content).toContain("절대보호구역");
  });
});
