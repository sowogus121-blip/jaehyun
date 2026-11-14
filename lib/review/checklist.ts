/**
 * 규모검토 필요자료 체크리스트 — 건축사가 개략 규모검토 전에 확보하는 자료를
 * 자동 수집 결과와 대조해 "확보 / 일부 / 미확보 / 현장·도서 확인"으로 정리한다.
 */
import type { Project, ReviewRow } from "./types";
import { districtPlanOf } from "./build-rows";

export type CheckState = "ok" | "partial" | "missing" | "manual";
export interface CheckItem { id: string; label: string; state: CheckState; detail: string; rowId?: string; link?: { label: string; url: string } }
export interface CheckGroup { title: string; items: CheckItem[] }

const EUM = "https://www.eum.go.kr/web/ar/lu/luLandDet.jsp";
const EUM_GOSI = "https://www.eum.go.kr/web/gs/gv/gvGosiList.jsp";
const SEUMTER = "https://www.eais.go.kr/";
const LH = "https://apply.lh.or.kr/lhapply/apply/pch/list.do?mi=1076";

export const CHECK_LABEL: Record<CheckState, string> = { ok: "확보", partial: "일부", missing: "미확보", manual: "직접 확인" };

export function buildChecklist(p: Project): CheckGroup[] {
  const r = p.review;
  const row = (id: string) => p.rows.find((x) => x.id === id);
  const collected = r?.collected ?? [];
  const has = (rowId: string, kind?: "ordinance" | "law") => collected.filter((c) => c.rowId === rowId && (!kind || c.kind === kind));
  const ordinance = (kw: string) => r?.ordinances.find((o) => o.name.includes(kw));
  const rowState = (x?: ReviewRow): CheckState => !x ? "missing" : x.status === "verified" || x.status === "user" ? "ok" : x.status === "candidate" ? "partial" : "missing";
  const fromCollected = (rowId: string, kind: "ordinance" | "law", what: string): CheckItem => {
    const hits = has(rowId, kind);
    const x = row(rowId);
    const state: CheckState = hits.length || (x && (x.status === "verified" || x.status === "user")) ? "ok" : "missing";
    return {
      id: rowId + "-" + kind, label: what, rowId, state,
      detail: hits.length ? hits.map((h) => `${h.title} ${h.article.split(" · ")[0]}`).join(", ") + (x && (x.status === "verified" || x.status === "user") ? "" : " · 수치는 표에서 확정")
        : state === "ok" ? (x?.law || "확정") : lawDown ? "국가법령정보센터 점검 중 · 점검 후 다시 수집" : "자동 수집 실패 · 행에서 조문 탐색",
    };
  };
  const zones = (r?.landUse ?? []).filter((l) => l.category === "용도지역").map((l) => l.name);
  const overlays = (r?.landUse ?? []).filter((l) => l.category !== "용도지역");
  const planDocs = r?.officialDocuments?.documents.filter((d) => d.kind === "district-plan") ?? [];
  const notice = r?.lhNotice;
  const lh = p.site.business === "lh-purchase";
  const lawDown = (r?.errors ?? []).some((e) => e.includes("국가법령정보센터 시스템 점검"));
  const lawFail = lawDown ? "국가법령정보센터 점검 중 · 점검 후 '자료 다시 수집'" : "국가법령정보센터 조회 실패 또는 키 미설정";

  const groups: CheckGroup[] = [
    { title: "대지 현황", items: [
      { id: "loc", label: "지번·좌표", state: r?.location ? "ok" : "missing", detail: r?.location?.parcelAddress ?? r?.location?.address ?? "VWorld 주소 조회 필요", rowId: "site.location" },
      (() => {
        const official = r?.siteFacts?.land?.officialArea;
        const area = p.site.siteAreaOverride ?? official ?? r?.parcel?.area;
        const state: CheckState = p.site.siteAreaOverride || official ? "ok" : r?.parcel?.area ? (r.parcel.approximate ? "partial" : "ok") : "missing";
        return { id: "area", label: "대지면적 (토지대장)", state, rowId: "site.area",
          detail: area ? `${area.toLocaleString()}㎡ · ${p.site.siteAreaOverride ? "검토자 입력" : official ? "토지대장 면적" : r?.parcel?.approximate ? "지적도형 환산 개략값 (토지특성 조회 실패)" : r?.parcel?.source}` : "지적 조회 실패" };
      })(),
      { id: "zone", label: "용도지역·지구·구역", state: zones.length ? (zones.length > 1 ? "partial" : "ok") : "missing", detail: [...zones, ...overlays.map((o) => o.name)].join(" · ") || "토지이용계획 미조회", rowId: "site.zone", link: { label: "토지이음", url: EUM } },
      (() => {
        const f = r?.siteFacts;
        const roads = f?.roads ?? [];
        const side = f?.land?.roadSide;
        const state: CheckState = roads.length || side ? "ok" : f ? "partial" : "missing";
        return { id: "road", label: "접도 도로 폭원·건축선", state, rowId: "site.road", link: { label: "토지이음 지적도", url: EUM },
          detail: roads.length || side ? [side ? `도로접면 ${side}` : "", ...roads.slice(0, 3).map((x) => `${x.name} ${x.widthText}`)].filter(Boolean).join(" · ") : f ? "인접 도로 레이어 미검출 · 지적도 확인" : "VWorld 조회 필요" };
      })(),
      (() => {
        const f = r?.siteFacts;
        const ok = f && (f.buildings !== null || f.permits !== null);
        const detail = ok ? [f!.buildings?.length ? `건축물대장 ${f!.buildings.length}동 (${f!.buildings.map((b) => b.use).filter(Boolean).join(", ")})` : "건축물대장 없음", f!.permits?.length ? `인허가 ${f!.permits.length}건` : "인허가 이력 없음"].join(" · ")
          : (r?.missing ?? []).includes("DATA_GO_KR_API_KEY") ? "공공데이터포털 키(DATA_GO_KR_API_KEY) 등록 시 자동 조회" : (f?.notes.find((n) => n.includes("건축")) ?? "건축HUB 조회 실패");
        return { id: "existing", label: "기존 건축물·허가 이력", state: ok ? "ok" as const : "missing" as const, detail, rowId: "site.building", link: { label: "세움터", url: SEUMTER } };
      })(),
      ...(p.site.extraParcels.length ? [{ id: "assembly", label: "합필 필지", state: (r && r.parcels.length > 1 && r.parcels.every((x) => x.parcel?.area)) ? "ok" as const : "partial" as const, detail: `${p.site.extraParcels.length + 1}필지 · 1대지 인정 요건 별도`, rowId: "site.assembly" }] : []),
    ] },
    { title: "상위계획·특별법 (토지이용계획)", items: [
      { id: "designations", label: "토지이용계획 지역·지구 전체", rowId: "site.overlay",
        state: r?.siteFacts?.designations ? "ok" as const : r?.siteFacts ? "missing" as const : "missing" as const,
        detail: r?.siteFacts?.designations ? `${r.siteFacts.designations.length}건 (국토계획법 + 다른 법령)` : "VWorld 토지이용계획 속성 조회 실패", link: { label: "토지이음", url: EUM } },
      ...p.rows.filter((x) => x.id.startsWith("zone.")).map((x) => ({
        id: x.id, label: x.sub ?? x.group, rowId: x.id,
        state: (x.status === "verified" || x.status === "user" || x.id === "zone.minor") ? "ok" as const : x.sources.some((s) => s.kind === "plan") ? "ok" as const : "partial" as const,
        detail: x.id === "zone.minor" ? `${x.content.split("\n").length}건 · 절차 해당 여부만 확인` : `${x.law}${x.sources.some((s) => s.kind === "plan") ? " · 관련 고시 검색결과 확보" : " · 결정고시·계획 원문 확인"}`,
        link: { label: "토지이음 고시", url: EUM_GOSI },
      })),
    ] },
    { title: "도시계획 (규모 상한)", items: [
      { id: "plan-ord", label: "도시계획 조례 원문", state: ordinance("도시계획") ? "ok" : "missing", detail: ordinance("도시계획") ? `${ordinance("도시계획")!.name} (시행 ${ordinance("도시계획")!.enforcementDate ?? "-"})` : lawFail },
      fromCollected("plan.use", "ordinance", "용도지역 건축제한 (허용용도)"),
      fromCollected("plan.bcrfar", "ordinance", "건폐율·용적률 조문"),
      fromCollected("plan.relax", "ordinance", "임대주택 용적률 완화"),
      ...(districtPlanOf(r ?? null) || p.site.blockNo ? [
        (() => {
          const got = planDocs.filter((d) => d.status === "analyzed");
          const gosi = got.filter((d) => d.gosiNo);
          const state: CheckState = gosi.length ? "ok" : got.length ? "partial" : "missing";
          const detail = gosi.length
            ? gosi.map((d) => `${d.gosiNo}${d.gosiDate ? "(" + d.gosiDate + ")" : ""}${d.siteMention ? " ★지번 기재" : ""}`).join(", ") + " · 토지이음 고시문" + (gosi.some((d) => d.attachments?.some((a) => a.analyzed)) ? "·첨부" : "") + " 자동 확보 · 획지는 결정도로 확인"
            : got.length ? got.map((d) => d.title).join(", ") : planDocs.length ? "고시 후보는 찾았지만 본문을 읽지 못함 · 토지이음 고시에서 열람" : "토지이음 고시에서 결정고시를 찾지 못함";
          return { id: "dp-doc", label: "지구단위계획 결정조서·결정도·시행지침", state, detail, link: { label: "토지이음 고시", url: gosi[0]?.sourceUrl ?? EUM_GOSI } };
        })(),
        { id: "dp-block", label: "획지번호", state: p.site.blockNo ? "ok" as const : "missing" as const, detail: p.site.blockNo ? `획지 ${p.site.blockNo}` : "결정도에서 확인 후 대상지 조건에 입력", rowId: "plan.district" },
      ] : []),
      { id: "height", label: "최고높이·층수 제한", rowId: "plan.height",
        state: rowState(row("plan.height")) === "ok" || (zones.length > 0 && !overlays.some((o) => o.name.includes("고도")) && !districtPlanOf(r ?? null) && !row("zone.height-district")) || has("plan.height").length ? "ok" : overlays.some((o) => o.name.includes("고도")) || districtPlanOf(r ?? null) || row("zone.height-district") ? "partial" : "missing",
        detail: row("zone.height-district") ? `${row("zone.height-district")!.sub} · 결정 높이 확인` : overlays.some((o) => o.name.includes("고도")) ? "고도지구 지정 · 결정내용(높이) 확인" : districtPlanOf(r ?? null) ? "지구단위계획 높이 기준 확인" : zones.length ? "고도지구·지구단위계획 미검출 → 정북일조·인동거리로 층수 결정" : "용도지구 조회 필요" },
    ] },
    { title: "건축 (배치·면적)", items: [
      { id: "bld-ord", label: "건축 조례 원문", state: ordinance("건축") ? "ok" : "missing", detail: ordinance("건축")?.name ?? lawFail },
      fromCollected("bld.sunlight", "law", "정북일조 (건축법 시행령 제86조)"),
      fromCollected("bld.sunlight", "ordinance", "일조 조례"),
      fromCollected("bld.setback", "ordinance", "대지 안의 공지 (조례 별표)"),
      fromCollected("bld.landscape", "ordinance", "조경 기준"),
      fromCollected("bld.openspace", "law", "공개공지 대상·비율"),
      fromCollected("bld.amenity", "law", "부대복리시설 (주택건설기준)"),
    ] },
    { title: "주차", items: [
      { id: "park-ord", label: "주차장 조례 원문", state: ordinance("주차장") ? "ok" : "missing", detail: ordinance("주차장")?.name ?? lawFail },
      fromCollected("park.ordinance", "ordinance", "부설주차장 설치기준 (별표)"),
      { id: "park-ratio", label: "용도별 법정 주차대수 (대/세대·호)", rowId: "park.apartment",
        state: ["park.apartment", "park.urban", "park.officetel"].some((id) => rowState(row(id)) === "ok") ? "ok" : has("park.ordinance").length ? "partial" : "missing",
        detail: ["park.apartment", "park.urban", "park.officetel"].some((id) => rowState(row(id)) === "ok") ? "주차 행 확정" : has("park.ordinance").length ? "설치기준 조문 확보 · 별표 수치를 주차 행에 입력하면 지하층 산정" : "조례 별표 수치를 주차 행에 입력해야 지하층 산정" },
      fromCollected("park.mech.ord", "ordinance", "기계식주차 (조례)"),
      fromCollected("park.apartment", "law", "주택단지 주차 (주택건설기준 제27조)"),
    ] },
    ...(lh ? [{ title: "LH 매입약정", items: [
      { id: "lh-notice", label: "지역본부 최신 공고", state: notice ? (notice.isCurrent ? "ok" as const : "partial" as const) : "missing" as const, detail: notice ? `${notice.title} · ${notice.isCurrent ? "접수기간 내" : "접수 종료"}` : "공고 미확인", rowId: "lh.notice", link: { label: "LH 청약플러스", url: LH } },
      { id: "lh-pdf", label: "공고문 PDF 분석", state: notice?.rules || notice?.extractedCriteria?.length ? "ok" as const : "missing" as const, detail: notice?.rules ? "원문 검증된 기준 적용" : notice?.extractedCriteria?.length ? `주차·면적·커뮤니티 문구 ${notice.extractedCriteria.length}건 확보 (행 근거로 첨부)` : "PDF 자동 분석 실패 · 공고문 업로드 권장", link: notice?.pdfUrl ? { label: "공고문", url: notice.pdfUrl } : undefined },
      { id: "lh-guide", label: "설계·시공 가이드라인·체크리스트", state: notice?.guideUrl ? "ok" as const : "missing" as const, detail: notice?.guideUrl ? "공고 첨부(신청서식·가이드라인) 원본 확보" : "공고 첨부 확인", link: notice?.guideUrl ? { label: "첨부 받기", url: notice.guideUrl } : undefined },
      fromCollected("park.lh03", "law", "0.3대 특례 (공공주택 특별법 시행령)"),
      (() => {
        const t = r?.transit;
        const state: CheckState = p.site.transitWithin500m || t?.verdict === "within" || t?.verdict === "outside" ? "ok" : t?.verdict === "borderline" ? "partial" : "missing";
        return { id: "lh-transit", label: "0.3대 특례 입지 (역 출구·대학 500m)", rowId: "park.lh03", state,
          detail: t ? `${t.verdict === "within" ? "500m 이내" : t.verdict === "borderline" ? "경계 · 확인 필요" : t.verdict === "outside" ? "500m 밖" : "판정 실패"} · ${t.basis}${(t.planned ?? []).length ? ` · 개통예정: ${t.planned!.map((p) => `${p.name}(${p.line}) ${p.distance}m · ${p.openingSummary}`).join(", ")}` : ""}` : "자동 판정 전 · 다시 수집" };
      })(),
    ] }] : []),
  ];
  return groups;
}

export function checklistSummary(groups: CheckGroup[]) {
  const all = groups.flatMap((g) => g.items);
  return { total: all.length, ok: all.filter((i) => i.state === "ok").length, partial: all.filter((i) => i.state === "partial").length, missing: all.filter((i) => i.state === "missing").length, manual: all.filter((i) => i.state === "manual").length };
}

/** 자동 수집 출처별 상태 — 무엇이 어디서 왔고 무엇이 막혔는지 한 줄로 보여준다. */
export type SourceState = "ok" | "alt" | "fail" | "na";
export interface SourceStatus { name: string; state: SourceState; detail: string }

export function sourceStatuses(p: Project): SourceStatus[] {
  const r = p.review;
  if (!r) return [];
  const errs = r.errors ?? [];
  const f = r.siteFacts;
  const lawDown = errs.some((e) => e.includes("시스템 점검"));
  const lawCache = errs.some((e) => /국가법령 조문은 (직전 조회|다른 대상지)/.test(e));
  const lawGot = (r.collected ?? []).some((c) => c.kind === "law");
  const elis = r.ordinances.filter((o) => (o as { source?: string }).source === "elis").length;
  const docs = r.officialDocuments?.documents ?? [];
  const gosi = docs.filter((d) => d.gosiNo);
  const eumErr = (r.officialDocuments?.errors ?? []).find((e) => e.includes("토지이음"));
  const inPlan = districtPlanOf(r) || (f?.designations ?? []).some((d) => /지구단위계획|정비구역|노후계획도시/.test(d.name) && d.conflict !== "접함");
  const gosiKept = errs.some((e) => e.startsWith("지구단위계획 고시는 직전"));
  return [
    { name: "VWorld 지적·용도지역", state: r.location && r.landUse.length ? "ok" : "fail", detail: r.location ? `${r.landUse.length}건` : "주소 조회 실패" },
    { name: "토지특성·토지이용계획", state: f?.land || f?.designations ? "ok" : "fail", detail: f?.designations ? `지역·지구 ${f.designations.length}건` : "조회 실패" },
    { name: "건축HUB 대장·인허가", state: f && (f.buildings !== null || f.permits !== null) ? "ok" : "fail", detail: f && (f.buildings !== null || f.permits !== null) ? `대장 ${f.buildings?.length ?? 0} · 인허가 ${f.permits?.length ?? 0}` : (f?.notes ?? []).some((n) => n.includes("일시 장애")) ? "포털 일시 장애 · 다시 수집" : "조회 실패" },
    { name: "국가법령정보센터", state: lawGot && !lawDown ? "ok" : lawGot ? "alt" : "fail", detail: lawDown ? (lawGot ? (lawCache ? "점검 중 · 저장된 원문 사용" : "점검 중") : "점검 중 · 점검 후 다시 수집") : lawGot ? `법령 ${r.laws.length}건` : "조회 실패" },
    { name: "관할 조례", state: r.ordinances.length ? (elis ? "alt" : "ok") : "fail", detail: r.ordinances.length ? (elis ? `ELIS 대체 ${elis}건` : `${r.ordinances.length}건`) : "미확보" },
    { name: "토지이음 고시", state: !inPlan && !gosi.length ? "na" : gosi.length ? (gosiKept ? "alt" : "ok") : "fail", detail: !inPlan && !gosi.length ? "지구단위·정비구역 아님" : gosi.length ? `${gosi.length}건${gosiKept ? " · 직전 조회 유지" : ""}` : eumErr ? "연결 불가 · 잠시 후 다시 수집" : "해당 고시 없음" },
    { name: "공식기관 웹검색", state: r.webSearch.status === "completed" ? "ok" : r.webSearch.status === "not-configured" ? "na" : "fail", detail: r.webSearch.status === "completed" ? `${r.webSearch.results.length}건` : r.webSearch.status === "not-configured" ? "키 없음" : "실패" },
    ...(p.site.business === "lh-purchase" ? [{ name: "LH 매입공고", state: (r.lhNotice ? (r.lhNotice.isCurrent ? "ok" : "alt") : "fail") as SourceState, detail: r.lhNotice ? (r.lhNotice.isCurrent ? "접수 중" : "접수 종료 공고") : "미확인" }] : []),
  ];
}
