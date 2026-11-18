/**
 * 최신 결정고시 자동 적용 — 단계 API(/api/plan-decision)를 차례로 불러
 * 대상 지번의 가구·획지(가장 최근 고시의 조서)와 그 가구의 건축물 결정내용(가장 최근에 실제로 결정된 고시)을 찾는다.
 *
 * - 고시는 최신순으로 본다. '건축물 결정조서(변경없음) 게재생략'이면 이전 고시로 내려간다.
 * - 가구명을 모르는 상태에서 지나친 고시는 가구명을 알게 된 뒤 다시 본다.
 */
import type { BuildingRule, ParcelBlock } from "./gosi-decision";

export interface GosiRef { seq: string; gosiNo: string; title: string; date: string | null; url: string }
export interface PlanDecision {
  checkedAt: string;
  place: string;
  lot: string;
  keywords: string[];
  parcel: (ParcelBlock & { gosi: GosiRef }) | null;
  rule: (BuildingRule & { gosi: GosiRef }) | null;
  /** 확인한 고시 (최신순) */
  checked: Array<GosiRef & { parcel: boolean; rule: "found" | "unchanged" | "none" | "error" }>;
  status: "resolved" | "parcel-only" | "not-found" | "error";
  error?: string;
}

export interface ListResult { keywords: string[]; rows: Array<{ seq: string; gosiNo: string; title: string; date: string | null }>; error?: string }
export interface ScanResult { seq: string; gosiNo: string; title: string; date: string | null; url: string; parcel: ParcelBlock | null; rule: BuildingRule | null; ruleUnchanged: boolean; placeMention: boolean; errors: string[]; error?: string }
/** 고시 목록·고시 1건 읽기를 맡는 쪽: 브라우저 직접(토지이음) 또는 서버 API */
export interface DecisionBackend {
  /** keywords를 주면 그 검색어로만 (계획 이름으로 이력 전체 찾기) */
  list(address: string, names: string[], keywords?: string[]): Promise<ListResult>;
  scan(seq: string, place: string, lot: string, label: string | null): Promise<ScanResult>;
}
type Post = (body: Record<string, unknown>) => Promise<unknown>;
/** 서버 API(/api/plan-decision) 백엔드 */
export function serverBackend(post: Post): DecisionBackend {
  return {
    list: async (address, names, keywords) => await post({ step: "list", address, names, keywords }) as ListResult,
    scan: async (seq, place, lot, label) => await post({ step: "scan", seq, place, lot, label }) as ScanResult,
  };
}

/** "충청북도 청주시 흥덕구 오송읍 만수리 866" → { place: 만수리, lot: 866 } */
export function placeLotOf(address: string): { place: string; lot: string } | null {
  const m = address.match(/([가-힣0-9]+(?:동|가|리))\s+(산\s?\d+(?:-\d+)?|\d+(?:-\d+)?)\s*(?:번지)?\s*$/);
  return m ? { place: m[1], lot: m[2].replace(/\s+/g, "") } : null;
}

type Row = ListResult["rows"][number] & { agency?: string };

/** 고시 제목에서 계획 이름 (예: "[변경] 오송생명과학단지 산업단지계획 변경 및 지형도면" → 오송생명과학단지) */
export function planNameOf(title: string): string {
  const t = title.replace(/^\s*\[[^\]]*\]\s*/, "").replace(/\s+/g, " ").trim();
  const inner = t.match(/^[가-힣\s]*도시(?:·군)?관리계획\s*[(（]([^)）]+)[)）]/);
  if (inner) return planNameOf(inner[1]);
  const cut = t.search(/\s?(?:산업단지\s?계획|산업단지|국가산업|일반산업|지구단위\s?계획|개발사업|실시계획|개발계획|택지개발|도시개발|정비계획|재정비|도시관리계획|결정|지정|구조고도화|관리기본계획)/);
  return (cut > 0 ? t.slice(0, cut) : t).replace(/[\s·()]+$/g, "").trim();
}

/** 대상지 시·도/시·군·구와 관계있는 고시만 (다른 지역 동명 고시 제외) */
export function regionRelevant(row: Row, address: string, keywords: string[]): boolean {
  const toks = address.split(/\s+/);
  const sido = toks[0] ?? "";
  const city = toks.find((t, k) => k > 0 && /[시군]$/.test(t)) ?? "";
  const hay = `${row.agency ?? ""} ${row.gosiNo} ${row.title}`;
  const central = /국토교통부|국토해양부|건설교통부|산업통상자원부|지식경제부|행정안전부/.test(hay);
  const sidoShort = sido.replace(/(특별자치도|특별자치시|특별시|광역시|도)$/, "");
  const local = (!!city && hay.includes(city)) || (!!sido && hay.includes(sido)) || (sidoShort.length >= 2 && hay.includes(sidoShort + "도"));
  return local || (central && keywords.some((k) => row.title.includes(k)));
}

export async function resolvePlanDecision(backend: DecisionBackend, address: string, names: string[], budget = 22): Promise<PlanDecision> {
  const pl = placeLotOf(address);
  const base: PlanDecision = { checkedAt: new Date().toISOString(), place: pl?.place ?? "", lot: pl?.lot ?? "", keywords: [], parcel: null, rule: null, checked: [], status: "not-found" };
  if (!pl) return { ...base, status: "error", error: "지번 주소 형식이 아님" };
  let list: ListResult;
  try { list = await backend.list(address, names); } catch (e) { return { ...base, status: "error", error: e instanceof Error ? e.message : "고시 목록 조회 실패" }; }
  if (list.error) return { ...base, status: "error", error: list.error };
  base.keywords = list.keywords ?? [];
  const rows = (list.rows as Row[]).filter((r) => regionRelevant(r, address, base.keywords));
  const ref = (r: ScanResult): GosiRef => ({ seq: r.seq, gosiNo: r.gosiNo, title: r.title, date: r.date, url: r.url });
  let used = 0;
  const scan = async (row: Row, label: string | null) => {
    if (used >= budget) return null;
    used++;
    let r: ScanResult | null = null;
    try { r = await backend.scan(row.seq, pl.place, pl.lot, label); } catch { r = null; }
    const entry = r && !r.error
      ? { ...ref(r), parcel: !!r.parcel, rule: (r.rule ? "found" : r.ruleUnchanged ? "unchanged" : "none") as "found" | "unchanged" | "none" }
      : { seq: row.seq, gosiNo: row.gosiNo, title: row.title, date: row.date, url: "", parcel: false, rule: "error" as const };
    const k = base.checked.findIndex((c) => c.seq === row.seq);
    if (k >= 0) base.checked[k] = entry; else base.checked.push(entry);
    return r && !r.error ? r : null;
  };
  // 1) 계획별로 묶어 각 계획의 최근 고시(결정조서가 실리는 종류 우선)에서 지번을 찾는다
  const groups = new Map<string, Row[]>();
  for (const r of rows) { const k = planNameOf(r.title) || r.title; groups.set(k, [...(groups.get(k) ?? []), r]); }
  const tableFirst = (a: Row, b: Row) => Number(/산업단지\s?계획|지구단위\s?계획|결정/.test(b.title)) - Number(/산업단지\s?계획|지구단위\s?계획|결정/.test(a.title)) || (b.date ?? "").localeCompare(a.date ?? "");
  let hitGroup: Row[] | null = null;
  for (const [, g] of groups) {
    for (const row of [...g].sort(tableFirst).slice(0, 2)) {
      const r = await scan(row, null);
      if (r?.parcel) {
        base.parcel = { ...r.parcel, gosi: ref(r) };
        if (r.rule) base.rule = { ...r.rule, gosi: ref(r) };
        hitGroup = g;
        break;
      }
    }
    if (hitGroup || used >= budget) break;
  }
  // 2) 같은 계획의 고시를 최신순으로: 더 최근 가구·획지 조서, 가장 최근에 실제로 결정된 건축물 결정조서
  if (hitGroup && base.parcel) {
    const label = base.parcel.label;
    // 계획 이름으로 고시 이력 전체를 다시 찾는다 (검색어 하나로는 최근 30건만 보임)
    const planName = planNameOf(base.parcel.gosi.title);
    if (planName.length >= 2) {
      try {
        const more = await backend.list(address, [], [planName]);
        const have = new Set(hitGroup.map((r) => r.seq));
        for (const r of (more.rows ?? []) as Row[]) if (!have.has(r.seq) && planNameOf(r.title) === planName) hitGroup.push(r);
      } catch { /* 기존 목록으로 */ }
    }
    const ordered = [...hitGroup].sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || Number(b.seq) - Number(a.seq));
    for (const row of ordered) {
      const r = await scan(row, label);
      if (!r) continue;
      if (r.parcel && (r.date ?? "") > (base.parcel.gosi.date ?? "")) base.parcel = { ...r.parcel, gosi: ref(r) };
      // 최신순으로 보다가 처음 나온 건축물 결정조서가 현재 유효한 결정
      if (r.rule) { base.rule = { ...r.rule, gosi: ref(r) }; break; }
    }
  }
  base.checked.sort((a, b) => (b.date ?? "").localeCompare(a.date ?? ""));
  base.status = base.parcel && base.rule ? "resolved" : base.parcel ? "parcel-only" : "not-found";
  return base;
}
