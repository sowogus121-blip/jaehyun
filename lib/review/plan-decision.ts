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
  list(address: string, names: string[]): Promise<ListResult>;
  scan(seq: string, place: string, lot: string, label: string | null): Promise<ScanResult>;
}
type Post = (body: Record<string, unknown>) => Promise<unknown>;
/** 서버 API(/api/plan-decision) 백엔드 */
export function serverBackend(post: Post): DecisionBackend {
  return {
    list: async (address, names) => await post({ step: "list", address, names }) as ListResult,
    scan: async (seq, place, lot, label) => await post({ step: "scan", seq, place, lot, label }) as ScanResult,
  };
}

/** "충청북도 청주시 흥덕구 오송읍 만수리 866" → { place: 만수리, lot: 866 } */
export function placeLotOf(address: string): { place: string; lot: string } | null {
  const m = address.match(/([가-힣0-9]+(?:동|가|리))\s+(산\s?\d+(?:-\d+)?|\d+(?:-\d+)?)\s*(?:번지)?\s*$/);
  return m ? { place: m[1], lot: m[2].replace(/\s+/g, "") } : null;
}

export async function resolvePlanDecision(backend: DecisionBackend, address: string, names: string[], maxScan = 12): Promise<PlanDecision> {
  const pl = placeLotOf(address);
  const base: PlanDecision = { checkedAt: new Date().toISOString(), place: pl?.place ?? "", lot: pl?.lot ?? "", keywords: [], parcel: null, rule: null, checked: [], status: "not-found" };
  if (!pl) return { ...base, status: "error", error: "지번 주소 형식이 아님" };
  let list: ListResult;
  try { list = await backend.list(address, names); } catch (e) { return { ...base, status: "error", error: e instanceof Error ? e.message : "고시 목록 조회 실패" }; }
  if (list.error) return { ...base, status: "error", error: list.error };
  base.keywords = list.keywords ?? [];
  const ref = (r: ScanResult): GosiRef => ({ seq: r.seq, gosiNo: r.gosiNo, title: r.title, date: r.date, url: r.url });
  let label: string | null = null;
  const seenBeforeLabel: string[] = [];
  const scan = async (seq: string) => {
    try { return await backend.scan(seq, pl.place, pl.lot, label); } catch { return null; }
  };
  let scanned = 0;
  for (const row of list.rows ?? []) {
    if (scanned >= maxScan) break;
    scanned++;
    const r = await scan(row.seq);
    if (!r || r.error) { base.checked.push({ seq: row.seq, gosiNo: row.gosiNo, title: row.title, date: row.date, url: "", parcel: false, rule: "error" }); continue; }
    if (r.parcel && !base.parcel) {
      base.parcel = { ...r.parcel, gosi: ref(r) };
      label = r.parcel.label;
      // 가구명을 알기 전에 지나친 (같은 지역) 고시를 가구명으로 다시 본다 — 더 최근 결정이 있을 수 있음
      for (const seq of seenBeforeLabel) {
        const again = await scan(seq);
        if (again?.rule && !base.rule) base.rule = { ...again.rule, gosi: ref(again) };
      }
    }
    if (!label && r.placeMention) seenBeforeLabel.push(row.seq);
    if (label && r.rule && !base.rule) base.rule = { ...r.rule, gosi: ref(r) };
    base.checked.push({ ...ref(r), parcel: !!r.parcel, rule: r.rule ? "found" : r.ruleUnchanged ? "unchanged" : "none" });
    if (base.parcel && base.rule) break;
  }
  base.status = base.parcel && base.rule ? "resolved" : base.parcel ? "parcel-only" : "not-found";
  return base;
}
