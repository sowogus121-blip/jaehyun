import { describe, expect, it } from "vitest";
import type { SiteReviewResult } from "../lib/types";
import { buildRows, mergeRows } from "../lib/review/build-rows";
import { zoneRatio } from "../lib/review/articles";
import { resolveParams, candidateParams } from "../lib/review/params";
import type { ReviewRow, SiteInput } from "../lib/review/types";
import { DEFAULT_ASSUMPTIONS, defaultScenario, runScenario, summaryRows } from "../lib/massing/engine";
import { emphasizeNumbers, highlightRuns } from "../lib/report/format";
import { loadProjects, migrateLegacy, newProject, applyReview, STORE_KEY, MIGRATED_KEY } from "../lib/project/store";

function review(opts: { address: string; zone: string; area: number; districtPlan?: boolean; articles?: SiteReviewResult["ordinanceArticleCandidates"]; ordinances?: string[] }): SiteReviewResult {
  return {
    status: "partial", reviewStage: "source-discovery", sourceDiscoveryComplete: true, applicationAssessmentComplete: false,
    checkedAt: "2026-11-13T00:00:00.000Z",
    location: { address: opts.address, parcelAddress: opts.address, x: "127", y: "37" },
    landUse: [
      { category: "용도지역", name: opts.zone, code: "LT_C_UQ111", source: "VWorld", status: "verified" },
      ...(opts.districtPlan ? [{ category: "도시계획", name: "지구단위계획구역", code: "LT_C_UPISUQ161", source: "VWorld", status: "verified" as const }] : []),
    ],
    parcel: { area: opts.area, landCategory: "대", pnu: "1", source: "국가공간정보포털 VWorld 지적속성", approximate: false },
    planningStandards: null, districtPlan: Boolean(opts.districtPlan), mixedUseZones: false,
    parcels: [{ inputAddress: opts.address, location: null, parcel: null, landUse: [], errors: [] }],
    laws: [], ordinances: (opts.ordinances ?? []).map((name) => ({ name, localGovernment: null, promulgationDate: null, enforcementDate: "20260101", link: "https://www.law.go.kr/x", retrievalStatus: "full-text" as const, applicationStatus: "not-assessed" as const })),
    ordinanceArticleCandidates: opts.articles ?? [], ruleFindings: [], lhNotice: null,
    webSearch: { status: "not-configured", provider: null, searchedAt: "", results: [], errors: [] },
    missing: [], errors: [], unresolved: [],
  };
}
const site = (address: string, extra: Partial<SiteInput> = {}): SiteInput => ({ address, extraParcels: [], business: "lh-purchase", uses: ["apartment", "officetel"], supplies: ["youth"], ...extra });
const row = (rows: ReviewRow[], id: string) => rows.find((r) => r.id === id)!;
const promote = (rows: ReviewRow[], id: string): ReviewRow[] => rows.map((r) => (r.id === id ? { ...r, status: "user", edited: true } : r));

describe("조례 조문 수치 추출", () => {
  it("용도지역별 수치를 정확한 용도지역 이름 뒤에서만 읽는다", () => {
    const art = { sourceTitle: "의정부시 도시계획 조례", sourceUrl: "", topic: "용적률", article: "제46조 · 용도지역안에서의 용적률", excerpt: "제1종일반주거지역:200퍼센트 제2종일반주거지역:250퍼센트 제3종일반주거지역:300퍼센트", verified: false as const };
    expect(zoneRatio(art, "제2종일반주거지역")?.value).toBe(250);
    expect(zoneRatio(art, "제3종일반주거지역")?.value).toBe(300);
    const commercial = { ...art, excerpt: "일반상업지역 : 1천300퍼센트 이하 근린상업지역: 900퍼센트" };
    expect(zoneRatio(commercial, "일반상업지역")?.value).toBe(1300);
    expect(zoneRatio({ ...art, excerpt: "일반상업지역: 1천퍼센트 이하" }, "일반상업지역")?.value).toBe(1000);
    expect(zoneRatio(art, "준주거지역")).toBeNull();
  });
});

describe("사례 B — 서울 금천구 독산동 151-10 (준공업지역)", () => {
  const addr = "서울특별시 금천구 독산동 151-10";
  const rows = buildRows(site(addr), review({ address: addr, zone: "준공업지역", area: 1093.6 }));

  it("서울시 조례 근거로 건폐율 60%·용적률 250%를 확정하고 300%는 별도 후보로 둔다", () => {
    expect(row(rows, "plan.bcrfar").status).toBe("verified");
    expect(row(rows, "plan.bcrfar").params).toEqual({ bcr: 60, far: 250 });
    expect(row(rows, "plan.relax").status).toBe("candidate");
    const resolved = resolveParams(rows);
    expect(resolved.far?.value).toBe(250);
    expect(resolved.relaxedFar).toBeUndefined();
    expect(candidateParams(rows).relaxedFar?.value).toBe(300);
  });
  it("준공업지역 공장부지 공동주택 허용기준 행을 자동 추가한다", () => {
    expect(row(rows, "extra.factory").law).toContain("별표 17");
    expect(row(rows, "plan.use").params?.useApartment).toBe("conditional");
  });
  it("250% 기본안과 300% 완화안을 구분하고, 완화 근거 확정 전에는 완화안을 계산하지 않는다", () => {
    const params = resolveParams(rows);
    const base = runScenario({ params, scenario: defaultScenario("officetel", "b", { farMode: "base" }), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    const relaxed = runScenario({ params, candidates: candidateParams(rows), scenario: defaultScenario("officetel", "r", { farMode: "relaxed" }), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    const relaxedNoCandidate = runScenario({ params, scenario: defaultScenario("officetel", "r0", { farMode: "relaxed" }), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    expect(relaxedNoCandidate.missing.join(" ")).toContain("완화 용적률");
    expect(base.farApplied).toBe(250);
    expect(base.plannedFar).toBeLessThanOrEqual(250);
    expect(base.units).toBeGreaterThan(0);
    // 완화 근거가 후보 단계면 참고 계산하되 조건으로 표시
    expect(relaxed.farApplied).toBe(300);
    expect(relaxed.conditions.join(" ")).toContain("후보");
    const r400 = runScenario({ params, candidates: candidateParams(rows), scenario: defaultScenario("officetel", "r4", { farMode: "relaxed", relaxedFar: 400 }), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    expect(r400.farApplied).toBe(400);
    expect(r400.farLabel).toContain("추가공급");
    const confirmed = resolveParams(promote(rows, "plan.relax"));
    const relaxed2 = runScenario({ params: confirmed, scenario: defaultScenario("officetel", "r", { farMode: "relaxed" }), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    expect(relaxed2.farApplied).toBe(300);
    expect(relaxed2.legalMaxFloorArea).toBeCloseTo(1093.6 * 3, 1);
    expect(relaxed2.units).toBeGreaterThan(base.units);
  });
});

describe("사례 A — 청주시 오송읍 봉산리 992 (일반상업지역 · 오송바이오폴리스 C04)", () => {
  const addr = "충청북도 청주시 흥덕구 오송읍 봉산리 992";
  const r = review({ address: addr, zone: "일반상업지역", area: 2310, districtPlan: true, ordinances: ["청주시 주차장 조례"],
    articles: [{ sourceTitle: "청주시 도시계획 조례", sourceUrl: "https://law.go.kr", topic: "용적률", article: "제67조 · 용도지역 안에서의 용적률", excerpt: "일반상업지역: 1천퍼센트 이하", verified: false }] });

  it("획지번호 확인 전에는 구역 포함만으로 획지 기준·조례 일반값을 계산에 쓰지 않는다", () => {
    const rows = buildRows(site(addr), r);
    expect(row(rows, "plan.district").status).toBe("candidate");
    expect(row(rows, "plan.district").missing).toContain("획지번호");
    expect(row(rows, "plan.bcrfar").status).toBe("candidate");
    expect(resolveParams(rows).far).toBeUndefined();
    const res = runScenario({ params: resolveParams(rows), scenario: defaultScenario("apartment", "a"), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    expect(res.feasibility).toBe("insufficient");
  });
  it("C04 지정 시 허용·불허용도와 층수 제한을 적용하고 공동주택·오피스텔을 규모검토에서 제외한다", () => {
    const rows = buildRows(site(addr, { blockNo: "C04" }), r);
    const params = resolveParams(rows);
    expect(params.useApartment?.value).toBe("prohibited");
    expect(params.useOfficetel?.value).toBe("prohibited");
    expect(params.maxFloors?.value).toBe(15);
    expect(params.far?.value).toBe(1000);
    for (const use of ["apartment", "officetel", "urban"] as const) {
      const res = runScenario({ params, scenario: defaultScenario(use, use), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
      expect(res.feasibility).toBe("blocked");
      expect(res.units).toBe(0);
    }
    expect(resolveParams(buildRows(site(addr, { blockNo: "C08" }), r)).maxFloors?.value).toBe(10);
  });
  it("청주시 기계식 기준(30대 이상)은 조례 행으로, LH 인수 기준은 별도 행으로 둔다", () => {
    const rows = buildRows(site(addr, { blockNo: "C04" }), r);
    expect(row(rows, "park.mech.ord").params?.mechMinStalls).toBe(30);
    expect(row(rows, "park.mech.ord").status).toBe("verified");
    expect(row(rows, "park.mech.lh").id).toBe("park.mech.lh");
    expect(row(rows, "park.mech.lh").params).toBeUndefined();
  });
});

describe("의정부시 가능동 75-1 (사용자 법규검토표 양식)", () => {
  const addr = "경기도 의정부시 가능동 75-1";
  const rows = buildRows(site(addr), review({ address: addr, zone: "제2종일반주거지역", area: 1467 }));
  const params = resolveParams(rows);

  it("법규검토표의 구분 행이 납품 양식 순서와 일치한다", () => {
    const groups = rows.map((r) => r.group);
    const order = ["위치", "구역면적", "용도지역·지구", "건축행위 가능 여부", "건폐율 / 용적률", "공공임대 용적률 완화", "최고높이", "정북일조", "대지안의공지", "기계식주차", "주차"];
    const idx = order.map((g) => groups.indexOf(g));
    expect(idx.every((i) => i >= 0)).toBe(true);
    expect([...idx].sort((a, b) => a - b)).toEqual(idx);
    expect(row(rows, "park.mech.ord").sub).toBe("조례");
    expect(row(rows, "park.mech.lh").sub).toBe("LH 기준");
    expect(row(rows, "site.area").content).toContain("1,467㎡");
  });
  it("공동주택 기계식 불가·20% 이하·20대 미만 불가를 계산에 반영한다", () => {
    expect(params.mechApartment?.value).toBe("prohibited");
    const apt = runScenario({ params, scenario: defaultScenario("apartment", "a", { parking: "mixed", mechanicalShare: 50 }), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    expect(apt.feasibility).toBe("blocked");
    const office = runScenario({ params, scenario: defaultScenario("officetel", "o", { parking: "mixed", mechanicalShare: 50 }), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    expect(office.parking.mechanicalCap === null || office.parking.mechanicalCap <= 20).toBe(true);
    expect(office.parking.mechanical === 0 || office.parking.mechanical >= 20).toBe(true);
  });
  it("공동주택 46㎡ 자주식 기본안 건축개요를 산정한다", () => {
    const apt = runScenario({ params, scenario: defaultScenario("apartment", "a"), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    expect(apt.farApplied).toBe(250);
    expect(apt.plannedFar).toBeLessThanOrEqual(250);
    expect(apt.plannedBcr).toBeLessThanOrEqual(60);
    expect(apt.parking.legal).toBe(apt.units);
    expect(apt.floorsBelow).toBeGreaterThanOrEqual(1);
    const summary = Object.fromEntries(summaryRows(apt));
    expect(summary["대지면적"]).toBe("1,467㎡");
    expect(summary["세대수"]).toBe(`${apt.units}세대`);
    expect(summary["계획주차대수"]).toContain("자주식");
  });
});

describe("행 상태와 계산 연동", () => {
  it("후보·근거누락 행의 수치는 계산에 쓰지 않고, 검토자가 확정하면 반영한다", () => {
    const rows: ReviewRow[] = [
      { id: "a", group: "x", section: "extra", content: "", law: "", note: "", status: "candidate", sources: [], origin: "auto", params: { far: 400 } },
      { id: "b", group: "y", section: "extra", content: "", law: "", note: "", status: "verified", sources: [], origin: "auto", params: { far: 250 } },
    ];
    expect(resolveParams(rows).far?.value).toBe(250);
    expect(resolveParams(promote(rows, "a")).far?.value).toBe(400);
  });
  it("재조회 시 검토자가 수정한 행은 유지한다", () => {
    const addr = "경기도 의정부시 가능동 75-1";
    const first = buildRows(site(addr), null);
    const edited = first.map((r) => (r.id === "plan.height" ? { ...r, content: "최고높이 40m", status: "user" as const, edited: true, params: { maxHeight: 40 } } : r));
    const merged = mergeRows(edited, buildRows(site(addr), review({ address: addr, zone: "제2종일반주거지역", area: 1467 })));
    expect(row(merged, "plan.height").content).toBe("최고높이 40m");
    expect(row(merged, "site.area").content).toContain("1,467");
  });
  it("0.3대 특례는 LH 사업·30㎡ 미만·청년형 역세권 입지가 모두 확인돼야 적용된다", () => {
    const addr = "서울특별시 금천구 독산동 151-10";
    const rows = promote(buildRows(site(addr), review({ address: addr, zone: "준공업지역", area: 1000 })), "park.lh03")
      .map((r) => (r.id === "park.officetel" ? { ...r, status: "user" as const, params: { parkingOfficetel: 0.6 } } : r));
    const params = resolveParams(rows);
    const scen = defaultScenario("officetel", "o", { apply03: true });
    const noTransit = runScenario({ params, scenario: scen, assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    expect(noTransit.parking.special03).toBeNull();
    expect(noTransit.conditions.join(" ")).toContain("500m");
    const ok = runScenario({ params, scenario: scen, assumptions: DEFAULT_ASSUMPTIONS, site: site(addr, { transitWithin500m: true }) });
    expect(ok.parking.special03).toBe(Math.ceil(ok.units * 0.3));
    expect(ok.parking.applied).toBe(ok.parking.special03);
    const big = runScenario({ params, scenario: { ...scen, types: [{ id: "t", name: "36", exclusive: 36, share: 100 }] }, assumptions: DEFAULT_ASSUMPTIONS, site: site(addr, { transitWithin500m: true }) });
    expect(big.parking.special03).toBeNull();
  });
  it("타입 구성비대로 세대수를 배분하고 합계를 유지한다", () => {
    const addr = "경기도 의정부시 가능동 75-1";
    const params = resolveParams(buildRows(site(addr), review({ address: addr, zone: "제2종일반주거지역", area: 1467 })));
    const res = runScenario({ params, scenario: defaultScenario("apartment", "m", { types: [{ id: "a", name: "36A", exclusive: 36, share: 60 }, { id: "b", name: "46A", exclusive: 46, share: 40 }] }), assumptions: DEFAULT_ASSUMPTIONS, site: site(addr) });
    expect(res.types.reduce((s, t) => s + t.count, 0)).toBe(res.units);
    expect(Math.abs(res.types[0].count - res.units * 0.6)).toBeLessThanOrEqual(1);
  });
});

describe("저장·마이그레이션", () => {
  it("v1 프로젝트의 검토자 확인값은 '검토자 입력', 화면 입력값은 '후보'로 옮긴다", () => {
    const p = migrateLegacy({
      input: { projectName: "가능동", address: "경기도 의정부시 가능동 75-1", siteArea: 1467, baseFar: 250, buildingCoverageRatio: 60, businessMode: "purchase", lhSupplyType: "youth" },
      reviewedRules: [{ field: "baseFar", value: 250, sourceTitle: "의정부시 도시계획 조례", sourceUrl: "https://www.law.go.kr/x" }],
    })!;
    expect(p.name).toBe("가능동");
    expect(p.site.business).toBe("lh-purchase");
    expect(row(p.rows, "legacy.rule.baseFar").status).toBe("user");
    expect(row(p.rows, "legacy.inputs").status).toBe("candidate");
    expect(resolveParams(p.rows).far?.value).toBe(250);
    expect(resolveParams(p.rows).bcr).toBeUndefined();
  });
  it("기존 v1 키를 한 번만 이전하고 원본은 보존한다", () => {
    const mem = new Map<string, string>([["lh-plan-lab-project", JSON.stringify({ input: { address: "서울특별시 금천구 독산동 151-10" } })]]);
    const storage = { getItem: (k: string) => mem.get(k) ?? null, setItem: (k: string, v: string) => { mem.set(k, v); } };
    expect(loadProjects(storage)).toHaveLength(1);
    expect(mem.get(MIGRATED_KEY)).toBeTruthy();
    expect(mem.has("lh-plan-lab-project")).toBe(true);
    expect(JSON.parse(mem.get(STORE_KEY)!)).toHaveLength(1);
    expect(loadProjects(storage)).toHaveLength(1);
  });
  it("조회 결과 저장 시 인용되지 않은 조문 전문은 제거한다", () => {
    const addr = "경기도 의정부시 가능동 75-1";
    const r = review({ address: addr, zone: "제2종일반주거지역", area: 1467, articles: [
      { sourceTitle: "의정부시 도시계획 조례", sourceUrl: "", topic: "용적률", article: "제46조 · 용도지역안에서의 용적률", excerpt: "제2종일반주거지역:250퍼센트", fullText: "제2종일반주거지역:250퍼센트 이하", verified: false },
      { sourceTitle: "의정부시 도시계획 조례", sourceUrl: "", topic: "완화", article: "제99조 · 기타", excerpt: "무관", fullText: "무관한 긴 조문", verified: false },
    ] });
    const p = applyReview(newProject({ address: addr }), r);
    const cands = p.review!.ordinanceArticleCandidates!;
    expect(cands.find((a) => a.article.startsWith("제46조"))?.fullText).toBeTruthy();
    expect(cands.find((a) => a.article.startsWith("제99조"))?.fullText).toBeUndefined();
  });
});

describe("출력 서식", () => {
  it("내용 셀의 수치를 강조 구간으로 분리한다", () => {
    const runs = emphasizeNumbers("건폐율 60% 이하\n주차대수의 20% 이하, 기계식 20대 미만 설치 불가");
    expect(runs.filter((r) => r.emphasis).map((r) => r.text)).toEqual(["60%", "20%", "20대"]);
  });
  it("근거 발췌의 형광펜 구간을 공백 차이와 무관하게 찾는다", () => {
    const runs = highlightRuns("제2종일반주거지역 : 250 퍼센트 이하", ["250퍼센트"]);
    expect(runs.find((r) => r.emphasis)?.text).toBe("250 퍼센트");
  });
});

describe("개통 예정역 (신독산역)", () => {
  const addr = "서울특별시 금천구 독산동 151-10";
  const planned = [{ id: "sinansan-sindoksan", name: "신독산역", line: "신안산선", status: "공사 중", distance: 380, verdict: "within" as const,
    anchorAddress: "서울특별시 금천구 독산동 1030-1", anchorBasis: "특별계획구역", openingSummary: "2027년 개통 예정(서울시 발표)", openingYear: 2027,
    timeline: [{ label: "실시계획", value: "공사기간 2019~2026년", source: "국토교통부 고시 제2026-410호", page: 3, official: true }] }];
  const base = review({ address: addr, zone: "준공업지역", area: 900 });
  const r = { ...base, transit: { station: null, university: null, verdict: "outside" as const, basis: "독산역 역사 중심까지 직선 908m", checkedAt: "", errors: [], planned } };
  it("예정역 제외 시 현행 역 기준으로 불가, 예정역은 참고로 표기", () => {
    const rows = buildRows(site(addr, { countPlannedStations: false }), r);
    expect(row(rows, "park.lh03").note).toContain("불가(청년형)");
    expect(row(rows, "park.lh03").note).toContain("신독산역");
    expect(row(rows, "park.lh03").sources.some((s) => s.title.includes("2026-410"))).toBe(true);
  });
  it("기본(개통 예정역 포함)이면 예정역 거리로 조건부 충족", () => {
    const rows = buildRows(site(addr), r);
    expect(row(rows, "park.lh03").note).toContain("조건부 충족");
    expect(row(rows, "park.lh03").note).toContain("LH 지역본부 확인");
  });
});

describe("역세권 경계 50m = 검토요망", () => {
  const addr = "서울특별시 금천구 독산동 151-10";
  const base = review({ address: addr, zone: "준공업지역", area: 900 });
  const r = { ...base, transit: { station: { name: "독산역", distance: 530, kind: "station" as const }, university: null, verdict: "outside" as const, basis: "독산역 역사 중심까지 직선 530m", checkedAt: "", errors: [] } };
  it("530m는 경계로 보고 비고에 검토요망", () => {
    const rows = buildRows(site(addr), r);
    expect(row(rows, "park.lh03").note).toMatch(/^검토요망/);
    expect(row(rows, "park.lh03").params?.transitReview).toBe("review");
  });
  it("560m는 미충족", () => {
    const r2 = { ...r, transit: { ...r.transit, station: { ...r.transit.station, distance: 560 } } };
    expect(row(buildRows(site(addr), r2), "park.lh03").note).toContain("불가(청년형)");
  });
});
