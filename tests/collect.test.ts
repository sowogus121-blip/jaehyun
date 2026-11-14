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
    const prev = { ...base, checkedAt: "2026-11-13T00:00:00Z", ordinances: [{ name: "서울특별시 도시계획 조례" }], collected: [{ rowId: "plan.bcrfar", kind: "ordinance" }, { rowId: "bld.sunlight", kind: "law" }] } as unknown as SiteReviewResult;
    const next = { ...base, checkedAt: "2026-11-13T01:00:00Z", ordinances: [], collected: [], errors: ["국가법령정보센터 14개 조회 실패: 국가법령정보센터 시스템 점검 중"] } as unknown as SiteReviewResult;
    const kept = keepPreviousLawData(prev, next)!;
    expect(kept.ordinances).toHaveLength(1);
    expect(kept.collected).toHaveLength(2);
    expect(kept.errors.some((e) => e.includes("직전 조회"))).toBe(true);
  });
  it("조례는 ELIS로 받고 국가법령만 못 받으면 다른 대상지 국가법령 캐시로 채운다", () => {
    const base = { location: { address: "b", parcelAddress: "경기도 성남시 분당구 정자동 1", x: "1", y: "1" }, laws: [], ordinanceArticleCandidates: [], nationalArticleCandidates: [] } as unknown as SiteReviewResult;
    const next = { ...base, checkedAt: "2026-11-14T01:00:00Z", ordinances: [{ name: "성남시 건축 조례", source: "elis" }], collected: [{ rowId: "bld.setback", kind: "ordinance" }], errors: ["국가법령정보센터 14개 조회 실패: 국가법령정보센터 시스템 점검 중"] } as unknown as SiteReviewResult;
    const cache = { savedAt: "2026-11-12T00:00:00Z", laws: [{ name: "건축법 시행령" }], collected: [{ rowId: "bld.sunlight", kind: "law" }] } as never;
    const out = keepPreviousLawData(null, next, cache)!;
    expect(out.ordinances).toHaveLength(1);
    expect(out.collected!.map((c) => c.kind).sort()).toEqual(["law", "ordinance"]);
    expect(out.laws).toHaveLength(1);
    expect(out.errors.some((e) => e.includes("받아둔 공식 원문"))).toBe(true);
  });
});

import { parseElisList, parseElisBody, parseElisHistory } from "../lib/server/elis";
import { ordinanceTitleMatches } from "../lib/server/law-api";
describe("자치법규정보시스템(ELIS) 대체 경로", () => {
  const list = `<td><span class="tagset bg-nice-04">예</span> <a class="a-link ellipsis" href="javascript:void(0)" onclick="fnSrchDtls('43990229333006','017'); return false;"> 청주시 <hword>주차장</hword> 조례 </a> </td> <td>2026-11-06</td> <td>조례</td>
  <td><span class="tagset bg-nice-01">현</span> <a class="a-link ellipsis" href="javascript:void(0)" onclick="fnSrchDtls('11650112215006','010'); return false;"> 서울특별시 서초구 도시계획조례 </a> </td> <td>2024-12-05</td> <td>조례</td>`;
  it("검색 결과에서 현행/예정 구분·alrNo·histNo·제목을 읽는다", () => {
    const hits = parseElisList(list);
    expect(hits).toHaveLength(2);
    expect(hits[0]).toMatchObject({ tag: "예", alrNo: "43990229333006", histNo: "017", title: "청주시 주차장 조례", kind: "조례" });
    expect(hits[1].title).toBe("서울특별시 서초구 도시계획조례");
  });
  it("관할·주제 판정은 국가법령정보센터와 같은 규칙", () => {
    expect(ordinanceTitleMatches("청주시 주차장 조례", "청주시 주차장 설치 및 관리 조례", "충청북도 청주시")).toBe(true);
    expect(ordinanceTitleMatches("서울특별시 서초구 도시계획조례", "서울특별시 서초구 도시계획 조례", "서울특별시 서초구")).toBe(true);
    expect(ordinanceTitleMatches("성남시 건축물관리 조례", "성남시 건축 조례", "경기도 성남시")).toBe(false);
    expect(ordinanceTitleMatches("진천군 주차장 조례", "청주시 주차장 설치 및 관리 조례", "충청북도 청주시")).toBe(false);
  });
  it("본문 HTML을 조문 JSON으로 바꾸고 연혁의 시행일을 읽는다", () => {
    const html = `<a onclick="lawPopup('자치법규','','','43990229333006','017')" class="t2false"><strong>청주시 주차장 조례</strong><br /> [시행 2027.01.01] </a>
    <a onclick="lawPopup('자치법규','','','43990229333006','015')" class="t2false"><strong>청주시 주차장 조례</strong><br /> [시행 2025.07.11] </a>
    <div class="txt" id="0014006"><strong class="color-jo">제14조(삭제 2015. 2. 27.)</strong></div>
    <div class="txt" id="0015006"><p class="p-01"><strong class="color-jo">제15조(부설주차장의 설치대상시설물 및 설치기준)</strong>&nbsp;① 부설주차장의 설치기준은 별표 7과 같다.</p><p class="p-02">③ 1. 부설주차장의 기계식주차장은 30대 이상 설치하는 경우에만 허용하며</p></div>
    <div class="txt" id="0002026"><p><strong class="color-jo">제2조의2(주차장 수급실태조사)</strong> 내용</p></div>`;
    const body = parseElisBody(html);
    expect(body.조문).toHaveLength(2);
    expect(body.조문[0]).toMatchObject({ 조문번호: "15", 조제목: "부설주차장의 설치대상시설물 및 설치기준" });
    expect(body.조문[0].조문내용).toContain("30대 이상");
    expect(body.조문[1]).toMatchObject({ 조문번호: "2", 조문가지번호: "2" });
    expect(parseElisHistory(html).map((h) => h.enforcementDate)).toEqual(["20270101", "20250711"]);
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

import { eucKrEncode, parseGosiList, parseGosiDetail, scoreGosi } from "../lib/server/eum-gosi";
describe("토지이음 고시정보 자동 수집", () => {
  it("검색어를 EUC-KR로 인코딩한다", () => {
    expect(eucKrEncode("분당 지구단위")).toBe("%BA%D0%B4%E7+%C1%F6%B1%B8%B4%DC%C0%A7");
  });
  const list = `<tr class="center"> <td class="mb">2026-06-15</td> <td class="left mb" title="경기도 성남시 고시 제2026-121호"> 경기도 성남시 고시 제2026-121호 </td> <td class="left"> <a href='gvGosiDet.jsp?seq=638968&pageNo=1&zonenm=분당' title='성남 도시관리계획(학교, 주차장, 녹지, 분당지구단위계획) 결정(변경) 및 지형도면 고시' > [변경] … </a> </td> <td class="left mb" title="경기도 성남시 도시주택국 도시계획과">경기도 성남시 도시주택국 도시계획과</td> </tr>
  <tr class="center"> <td class="mb">2026-06-01</td> <td class="left mb" title="경기도 성남시 고시 제2026-90호"> x </td> <td class="left"> <a href='gvGosiDet.jsp?seq=638971' title='성남 도시관리계획(위례지구단위계획)결정(변경) 및 지형도면 고시' >x</a></td><td class="left mb" title="경기도 성남시">x</td></tr>
  <tr class="center"> <td class="mb">2026-05-01</td> <td class="left mb" title="경기도 성남시 공고 제2026-1호"> x </td> <td class="left"> <a href='gvGosiDet.jsp?seq=638000' title='성남 도시관리계획(분당지구단위계획) 결정(변경)(안) 주민의견 청취 공람 공고' >x</a></td><td class="left mb" title="경기도 성남시">x</td></tr>`;
  it("목록에서 고시번호·고시일·제목을 읽고 대상지 관련도로 순위를 매긴다", () => {
    const rows = parseGosiList(list);
    expect(rows[0]).toMatchObject({ seq: "638968", date: "2026-06-15", gosiNo: "경기도 성남시 고시 제2026-121호" });
    const ctx = { sggCd: "41135", dong: "정자동", lot: "178-1", planNames: ["분당", "정자"], renewal: true };
    const scores = rows.map((r) => scoreGosi(r, ctx));
    expect(scores[0]).toBeGreaterThan(scores[1]); // 분당 > 위례
    expect(scores[2]).toBe(0); // 공람 공고는 결정 전이라 제외
  });
  it("상세 화면에서 고시문 본문과 첨부 목록을 읽는다", () => {
    const html = `<thead> <tr> <th scope="row" colspan="4">성남 도시관리계획(분당지구단위계획) 결정(변경) 고시</th></tr></thead>
    <th class="bg" scope="row">고시번호</th> <td class="left" colspan="3">경기도 성남시 고시 제2026-121호</td>
    <th class="bg" id="tb1_cel_4_1">고시일</th> <td class="left" headers="tb1_cel_4_1"> 2026-06-15 </td>
    <a href="javascript:download('/web/FileDownload.do', '/2026/08/03/630000/638968/고시문(게재용).pdf')">고시문</a>
    <a href="javascript:download('/web/FileDownload.do', '/x/고시문_1.hwp')">hwp</a>
    <div class="edit_view"><p>1. 정자동 178-1번지 일원 분당 지구단위계획 결정(변경)</p><p>용적률 400% 이하</p></div> 목록으로`;
    const d = parseGosiDetail(html, "638968");
    expect(d.gosiNo).toBe("경기도 성남시 고시 제2026-121호");
    expect(d.date).toBe("2026-06-15");
    expect(d.attachments.map((a) => a.ext)).toEqual(["pdf", "hwp"]);
    expect(d.body).toContain("용적률 400% 이하");
  });
});

import { sourceStatuses } from "../lib/review/checklist";
describe("수집 출처 상태 표시", () => {
  it("점검 중 국가법령·ELIS 대체 조례·토지이음 연결 실패를 구분한다", () => {
    const p = newProject({ address: "경기도 성남시 분당구 정자동 178-1" });
    p.review = {
      location: { address: "a", parcelAddress: "경기도 성남시 분당구 정자동 178-1", x: "1", y: "1" }, landUse: [{ category: "용도지역", name: "중심상업지역", code: "x", source: "v", status: "verified" }],
      laws: [], ordinances: [{ name: "성남시 건축 조례", source: "elis" }], collected: [], districtPlan: true,
      siteFacts: { land: null, designations: [{ name: "지구단위계획구역", conflict: "포함" }], buildings: [], permits: [], roads: [], notes: [] },
      officialDocuments: { documents: [], errors: ["토지이음 고시: 토지이음 서버 연결 불가"] },
      webSearch: { status: "completed", results: [] }, errors: ["국가법령정보센터 20개 조회 실패: 국가법령정보센터 시스템 점검 중"],
    } as never;
    const s = Object.fromEntries(sourceStatuses(p).map((x) => [x.name, x.state]));
    expect(s["국가법령정보센터"]).toBe("fail");
    expect(s["관할 조례"]).toBe("alt");
    expect(s["토지이음 고시"]).toBe("fail");
  });
});

import { extractParkingRules, parseTiers } from "../lib/review/parking-rules";
import { parseElisAnnexList } from "../lib/server/elis";
import { defaultScenario, DEFAULT_ASSUMPTIONS } from "../lib/massing/engine";
describe("조례 별표 주차기준 자동 판독", () => {
  const annex = `■ 서울특별시 주차장 설치 및 관리 조례 [별표 2]
부설주차장의 설치대상 시설물 종류 및 설치기준 (제20조제1항 관련)
2-1.업무시설(외국공관및    오피스텔을 제외한다)
일반업무시설 : 시설면적 100㎡당 1대
4. 단독주택(다가구주택을 제외한다)
시설면적 50㎡초과 150㎡  이하 : 1대
5. 다가구주택, 공동주택(외국공관안의 주택 등의 시설물 및 기숙사를 제외한다) 및 업무시설 중 오피스텔
「주택건설기준 등에 관한 규정」 제27조제1항에 따라 산정된 주차대수로 하되, 주차대수가 세대당 1대에 미달되는 경우에는 세대당(오피스텔에서 호실별로 구분되는 경우에는 호실당) 1대(전용면적이 30제곱미터이하인 경우에는 0.5대, 60제곱미터이하인 경우0.8대)이상으로 한다.
6. 골프장
<비고>
1. 시설물의 종류는`;
  it("공동주택·오피스텔 세대(호)당 최소대수 구간을 읽고 제외 괄호는 무시한다", () => {
    const rules = extractParkingRules(annex);
    expect(rules.map((r) => r.use)).toEqual(["apartment", "officetel"]);
    expect(rules[0].tiers).toEqual([{ maxArea: 30, ratio: 0.5 }, { maxArea: 60, ratio: 0.8 }, { ratio: 1 }]);
    expect(rules[0].refHousingStd27).toBe(true);
    expect(parseTiers("호실당 0.7대 이상")).toEqual([{ ratio: 0.7 }]);
  });
  it("ELIS 별표 목록을 읽는다", () => {
    const html = `<li><a id="t12" href="javascript:fnAttListDown('11000071000010','080','002')" class="t1false"> <span class="color-blue">[서식 ]</span> 부설주차장의 설치대상 시설물 종류 및 설치기준 (제20조제1항 관련) </a></li>`;
    expect(parseElisAnnexList(html)).toEqual([{ sn: "002", title: "부설주차장의 설치대상 시설물 종류 및 설치기준 (제20조제1항 관련)" }]);
  });
  it("별표가 수집되면 오피스텔 주차 행이 원문 확인으로 바뀌고 규모검토가 타입별 면적으로 법정대수를 산정한다", () => {
    const site = { address: "서울특별시 금천구 독산동 151-10", extraParcels: [], business: "lh-purchase", uses: ["officetel"], supplies: ["youth"] } as never;
    const review = {
      location: { address: "a", parcelAddress: "서울특별시 금천구 독산동 151-10", x: "1", y: "1" },
      landUse: [{ category: "용도지역", name: "준공업지역", code: "x", source: "v", status: "verified" }],
      parcel: { area: 1093.6 }, parcels: [], laws: [], ordinances: [{ name: "서울특별시 주차장 설치 및 관리 조례", enforcementDate: "20251001", link: "u" }],
      ordinanceArticleCandidates: [], nationalArticleCandidates: [], errors: [], missing: [], webSearch: { status: "completed", results: [] },
      collected: [{ topic: "부설주차장 설치기준", rowId: "park.ordinance", title: "서울특별시 주차장 설치 및 관리 조례", url: "u", effectiveDate: "20251001", article: "별표 2 · 부설주차장의 설치대상 시설물 종류 및 설치기준", text: annex, kind: "ordinance" }],
    } as never;
    const rows = buildRows(site, review);
    const r = rows.find((x) => x.id === "park.officetel")!;
    expect(r.status).toBe("verified");
    expect(r.params?.parkingOfficetelTiers).toEqual([{ maxArea: 30, ratio: 0.5 }, { maxArea: 60, ratio: 0.8 }, { ratio: 1 }]);
    const params = resolveParams(rows);
    const res = runScenario({ params, scenario: defaultScenario("officetel", "s"), assumptions: DEFAULT_ASSUMPTIONS, site });
    if (res.units > 0) expect(res.parking.legal).toBeGreaterThan(0);
  });
});

describe("지자체별 주차 별표 표현 차이", () => {
  it("의정부: 전용면적 합계 ㎡당 기준 + 세대당 1대 미달 보정", () => {
    const t = `6. 공동주택(기숙사를 제외한다), 업무시설 중 오피스텔
○ 전용면적을 기준으로 85㎡이하인 경우 전용면적의 합계를 기준으로 70㎡당 1대, 전용 면적이 85㎡를 초과하는 경우 전용면적의 합계를 기준으로 65㎡당 1대로 한다. 다만, 전체 주차대수가 세대 당 또는 호실당 1대에 미달 되는 경우에는 세대 또는 호실 당 1대 이상이 되도록 하여야 한다.
○ 「주택건설기준 등에 관한 규정」 제27조제1항제2호에 따른 도시형 생활주택은 세대당 주차대수를 1대(세대당 전용면적이 30㎡ 이상 60㎡ 이하인 경우에는 0.9대, 세대당 전용면적이 30㎡미만인 경우에는 0.7대)이상이 되도록 주차장을 설치한다.
7. 골프장
비 고
1. 용도가`;
    const r = extractParkingRules(t);
    expect(r.find((x) => x.use === "apartment")!.tiers).toEqual([{ maxArea: 85, sqmPerStall: 70, ratio: 1 }, { sqmPerStall: 65, ratio: 1 }]);
    expect(r.find((x) => x.use === "urban")!.tiers).toEqual([{ maxArea: 30, strict: true, ratio: 0.7 }, { maxArea: 60, ratio: 0.9 }, { ratio: 1 }]);
  });
  it("청주: 전용면적 구간별 세대당 대수", () => {
    const t = `5. 공동주택(기숙사를 제외한다), 업무시설 중 오피스텔,생활숙박시설,다가구주택, 도시형 생활주택
ㆍ(전용면적  60㎡ 이하)
세대(호실) 당 1.05대 이상
ㆍ(전용면적 60㎡ 초과  ~ 85㎡ 이하)
세대(호실) 당 1.5대 이상
ㆍ(전용면적 85㎡초과 )
전용면적 60㎡ 당 1대 (다만, 세대(호실)당 1.7대 이상)
ㆍ다가구주택의 경우 「주택건설기준 등에 관한 규정」 제27조제1항에 따라 산정된 주차면수
ㆍ「주택법 시행령」 제10조제1항에 따른 도시형 생활주택의 전용면적이 30㎡ 이상  60㎡ 이하인 경우 세대(호실)당 주차대수 0.9대(전용면적이 30㎡ 미만인 경우 0.7대)이상
6. 골프장
비고
1. 시설물의`;
    const r = extractParkingRules(t);
    expect(r.find((x) => x.use === "officetel")!.tiers).toEqual([{ maxArea: 60, ratio: 1.05 }, { maxArea: 85, ratio: 1.5 }, { sqmPerStall: 60, ratio: 1.7 }]);
    expect(r.find((x) => x.use === "urban")!.tiers).toEqual([{ maxArea: 30, strict: true, ratio: 0.7 }, { ratio: 0.9 }]);
  });
});

import { extractLhMechRule } from "../lib/review/parking-rules";
describe("LH 공고문 기계식주차 인수기준 자동 추출", () => {
  it("허용요건 3가지와 비율 50%를 읽고 공동주택은 제외로 본다", () => {
    const r = extractLhMechRule([
      "⑤ 기계식 주차 설치 허용기준 ㅇ (대상요건) (1) 서울·인천·경기도 역세권(GTX역 포함 도시철도역 출구로부터 직선거리 500m 내), (2) 청년용, 신혼·신생아Ⅰ,Ⅱ용",
      "(3) 주거용오피스텔 또는 도시형생활주택(3가지 요건 모두 충족 시) ㅇ 기계식 주차 비율 * 150세대 이상 : 총 주차대수의 50% 이하로 계획",
      "ㅇ 기계식 주차 비율 * 150세대 이상 : 총 주차대수의 50% 이하로 계획 ** 150세대 미만 : 총 주차대수의 50% 이하로 계획하되, 기계식 주차 대수가 20대 미만인 경우 우대",
    ])!;
    expect(r.maxPercent).toBe(50);
    expect(r.apartmentExcluded).toBe(true);
    expect(r.requirement).toContain("충족 시)");
    expect(r.ratioText).toContain("20대 미만인 경우 우대");
  });
});

import { checkTransit } from "../lib/server/transit";
describe("LH 0.3대 특례 입지 자동 판정", () => {
  it("역 출구 거리로 500m 이내를 판정한다", async () => {
    const original = globalThis.fetch;
    // 대상지 (127.0, 37.5) 기준: 출구 약 330m, 대학 약 1.1km
    globalThis.fetch = (async (input: string | URL | Request) => {
      const q = new URL(String(input)).searchParams.get("query");
      const items = q === "출입구" ? [{ title: "독산역2번출입구", category: "도로시설 > 지하철역입구", point: { x: "127.0", y: "37.503" } }, { title: "더카페독산역1번출구점", category: "주점업 > 카페", point: { x: "127.0", y: "37.501" } }]
        : q === "지하철역" ? [{ title: "독산역", category: "철도시설 > 철도/지하철 > 지하철역", point: { x: "127.0", y: "37.506" } }]
        : [{ title: "한국대학교", category: "중앙행정기관 > 교육부 > 대학교", point: { x: "127.0", y: "37.51" } }];
      return new Response(JSON.stringify({ response: { status: "OK", result: { items } } }));
    }) as typeof fetch;
    try {
      const r = await checkTransit(127.0, 37.5, "k", "d");
      expect(r.station?.kind).toBe("exit");
      expect(r.station!.distance).toBeGreaterThan(300);
      expect(r.station!.distance).toBeLessThan(360);
      expect(r.verdict).toBe("within");
    } finally { globalThis.fetch = original; }
  });
});
