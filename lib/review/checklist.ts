/**
 * 규모검토 필요자료 체크리스트 — 건축사가 개략 규모검토 전에 확보하는 자료를
 * 자동 수집 결과와 대조해 "확보 / 일부 / 미확보 / 현장·도서 확인"으로 정리한다.
 */
import type { Project, ReviewRow } from "./types";

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
    const state: CheckState = x && (x.status === "verified" || x.status === "user") ? "ok" : hits.length ? "partial" : "missing";
    return {
      id: rowId + "-" + kind, label: what, rowId, state,
      detail: hits.length ? hits.map((h) => `${h.title} ${h.article.split(" · ")[0]}`).join(", ") + (state === "ok" ? "" : " · 수치 확인 필요")
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
      { id: "area", label: "대지면적 (토지대장)", state: p.site.siteAreaOverride ? "ok" : r?.parcel?.area ? (r.parcel.approximate ? "partial" : "ok") : "missing",
        detail: p.site.siteAreaOverride ? `검토자 입력 ${p.site.siteAreaOverride.toLocaleString()}㎡` : r?.parcel?.area ? `${r.parcel.area.toLocaleString()}㎡ · ${r.parcel.source}${r.parcel.approximate ? " (도형 환산 개략값)" : ""}` : "지적 조회 실패", rowId: "site.area" },
      { id: "zone", label: "용도지역·지구·구역", state: zones.length ? (zones.length > 1 ? "partial" : "ok") : "missing", detail: [...zones, ...overlays.map((o) => o.name)].join(" · ") || "토지이용계획 미조회", rowId: "site.zone", link: { label: "토지이음", url: EUM } },
      { id: "road", label: "접도 도로 폭원·건축선", state: "manual", detail: "지적도·도로대장으로 폭원, 건축선 후퇴, 차량 진출입 확인", link: { label: "토지이음 지적도", url: EUM } },
      { id: "existing", label: "기존 건축물·허가 이력", state: "manual", detail: "건축물대장·기존 허가(착공·사용승인) 여부", link: { label: "세움터", url: SEUMTER } },
      ...(p.site.extraParcels.length ? [{ id: "assembly", label: "합필 필지", state: (r && r.parcels.length > 1 && r.parcels.every((x) => x.parcel?.area)) ? "ok" as const : "partial" as const, detail: `${p.site.extraParcels.length + 1}필지 · 1대지 인정 요건 별도`, rowId: "site.assembly" }] : []),
    ] },
    { title: "도시계획 (규모 상한)", items: [
      { id: "plan-ord", label: "도시계획 조례 원문", state: ordinance("도시계획") ? "ok" : "missing", detail: ordinance("도시계획") ? `${ordinance("도시계획")!.name} (시행 ${ordinance("도시계획")!.enforcementDate ?? "-"})` : lawFail },
      fromCollected("plan.use", "ordinance", "용도지역 건축제한 (허용용도)"),
      fromCollected("plan.bcrfar", "ordinance", "건폐율·용적률 조문"),
      fromCollected("plan.relax", "ordinance", "임대주택 용적률 완화"),
      ...(r?.districtPlan || p.site.blockNo ? [
        { id: "dp-doc", label: "지구단위계획 결정조서·결정도·시행지침", state: planDocs.some((d) => d.status === "analyzed") ? "partial" as const : "missing" as const, detail: planDocs.length ? planDocs.map((d) => d.title).join(", ") : "고시문·결정도서 자동 수집 실패 → 토지이음 고시에서 확보 후 업로드", link: { label: "토지이음 고시", url: EUM_GOSI } },
        { id: "dp-block", label: "획지번호", state: p.site.blockNo ? "ok" as const : "missing" as const, detail: p.site.blockNo ? `획지 ${p.site.blockNo}` : "결정도에서 확인 후 대상지 조건에 입력", rowId: "plan.district" },
      ] : []),
      { id: "height", label: "최고높이·층수 제한", state: rowState(row("plan.height")) === "ok" ? "ok" : overlays.some((o) => o.name.includes("고도")) || has("plan.height").length ? "partial" : "manual", detail: overlays.some((o) => o.name.includes("고도")) ? "고도지구 지정 · 결정내용 확인" : "고도지구·경관·비행안전구역 등 해당 시 입력", rowId: "plan.height" },
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
      { id: "park-ratio", label: "용도별 법정 주차대수 (대/세대·호)", state: ["park.apartment", "park.urban", "park.officetel"].some((id) => rowState(row(id)) === "ok") ? "ok" : "missing", detail: "조례 별표 수치를 주차 행에 입력해야 지하층 산정", rowId: "park.apartment" },
      fromCollected("park.mech.ord", "ordinance", "기계식주차 (조례)"),
      fromCollected("park.apartment", "law", "주택단지 주차 (주택건설기준 제27조)"),
    ] },
    ...(lh ? [{ title: "LH 매입약정", items: [
      { id: "lh-notice", label: "지역본부 최신 공고", state: notice ? (notice.isCurrent ? "ok" as const : "partial" as const) : "missing" as const, detail: notice ? `${notice.title} · ${notice.isCurrent ? "접수기간 내" : "접수 종료"}` : "공고 미확인", rowId: "lh.notice", link: { label: "LH 청약플러스", url: LH } },
      { id: "lh-pdf", label: "공고문 PDF 분석", state: notice?.rules ? "ok" as const : notice?.extractedCriteria?.length ? "partial" as const : "missing" as const, detail: notice?.rules ? "원문 검증된 기준 적용" : notice?.extractedCriteria?.length ? `주차·면적 등 문구 ${notice.extractedCriteria.length}건 추출 (행 근거로 첨부)` : "PDF 자동 분석 실패 · 공고문 업로드 권장" },
      { id: "lh-guide", label: "설계·시공 가이드라인·체크리스트", state: notice?.guideUrl ? "partial" as const : "missing" as const, detail: notice?.guideUrl ? "첨부 ZIP 링크 확보 · 항목 대조 필요" : "공고 첨부 확인", link: notice?.guideUrl ? { label: "첨부 받기", url: notice.guideUrl } : undefined },
      fromCollected("park.lh03", "law", "0.3대 특례 (공공주택 특별법 시행령)"),
    ] }] : []),
  ];
  return groups;
}

export function checklistSummary(groups: CheckGroup[]) {
  const all = groups.flatMap((g) => g.items);
  return { total: all.length, ok: all.filter((i) => i.state === "ok").length, partial: all.filter((i) => i.state === "partial").length, missing: all.filter((i) => i.state === "missing").length, manual: all.filter((i) => i.state === "manual").length };
}
