/**
 * 대지 현황 자동 수집 (규모검토 전 현장 확인 항목)
 * - VWorld 토지특성정보: 공부 면적, 지목, 도로접면, 지형
 * - VWorld 도시계획시설(도로)·도로명주소 도로구간: 인접 도로명·규모·도로폭
 * - 국토교통부 건축HUB(공공데이터포털): 건축물대장 표제부, 건축인허가 기본개요
 * 모든 값은 공공 데이터 원본이며, 건축선·진출입 허가 여부는 판정하지 않는다.
 */
import { fetchJson } from "./law-api";

export interface RoadInfo { name: string; widthText: string; minWidth: number | null; source: string }
export interface BuildingRecord { name: string; use: string; totalArea: number | null; floors: string; approvedAt: string | null; households: number | null; source: string }
export interface PermitRecord { use: string; totalArea: number | null; permittedAt: string | null; startedAt: string | null; approvedAt: string | null; source: string }
export interface SiteFacts {
  land: { officialArea: number | null; landCategory: string | null; roadSide: string | null; terrainHeight: string | null; terrainShape: string | null; publicPrice: number | null; year: string | null } | null;
  roads: RoadInfo[];
  buildings: BuildingRecord[] | null;   // null: 조회 불가(키 없음·실패)
  permits: PermitRecord[] | null;
  notes: string[];
}

/** 도시·군계획시설의 결정·구조 및 설치기준에 관한 규칙 제9조 도로 규모별 폭 */
const ROAD_CLASS: Record<string, [number, number | null]> = {
  "광로1류": [70, null], "광로2류": [50, 70], "광로3류": [40, 50],
  "대로1류": [35, 40], "대로2류": [30, 35], "대로3류": [25, 30],
  "중로1류": [20, 25], "중로2류": [15, 20], "중로3류": [12, 15],
  "소로1류": [10, 12], "소로2류": [8, 10], "소로3류": [0, 8],
};
export function roadClassWidth(name: string): { text: string; min: number | null } | null {
  const m = name.replace(/\s+/g, "").match(/(광로|대로|중로|소로)([123])류/);
  if (!m) return null;
  const [lo, hi] = ROAD_CLASS[m[1] + m[2] + "류"];
  return { text: hi === null ? `폭 ${lo}m 이상` : lo === 0 ? `폭 ${hi}m 미만` : `폭 ${lo}~${hi}m`, min: lo || null };
}

const text = (o: Record<string, unknown>, keys: string[]) => {
  for (const k of keys) { const v = o[k]; if (v !== undefined && v !== null && String(v).trim()) return String(v).trim(); }
  return null;
};
const num = (v: string | null) => { const n = v ? Number(v.replace(/,/g, "")) : NaN; return Number.isFinite(n) ? n : null; };

function findObjects(value: unknown, test: (o: Record<string, unknown>) => boolean, out: Record<string, unknown>[] = [], depth = 0): Record<string, unknown>[] {
  if (depth > 8 || value === null || typeof value !== "object") return out;
  if (Array.isArray(value)) { value.forEach((v) => findObjects(v, test, out, depth + 1)); return out; }
  const o = value as Record<string, unknown>;
  if (test(o)) out.push(o);
  Object.values(o).forEach((v) => findObjects(v, test, out, depth + 1));
  return out;
}

async function landCharacteristics(pnu: string, key: string, domain: string): Promise<SiteFacts["land"]> {
  const year = new Date().getFullYear();
  for (const stdrYear of [String(year), String(year - 1), ""]) {
    const params = new URLSearchParams({ key, domain, pnu, format: "json", numOfRows: "10", pageNo: "1" });
    if (stdrYear) params.set("stdrYear", stdrYear);
    const data = await fetchJson(`https://api.vworld.kr/ned/data/getLandCharacteristics?${params.toString()}`);
    const rows = findObjects(data, (o) => "lndpclAr" in o || "pnu" in o && "lndcgrCodeNm" in o);
    const row = rows.sort((a, b) => String(b.stdrYear ?? "").localeCompare(String(a.stdrYear ?? "")))[0];
    if (row) return {
      officialArea: num(text(row, ["lndpclAr"])), landCategory: text(row, ["lndcgrCodeNm"]),
      roadSide: text(row, ["roadSideCodeNm"]), terrainHeight: text(row, ["tpgrphHgCodeNm"]), terrainShape: text(row, ["tpgrphFrmCodeNm"]),
      publicPrice: num(text(row, ["pblntfPclnd"])), year: text(row, ["stdrYear"]),
    };
  }
  return null;
}

async function nearbyFeatures(layer: string, bbox: [number, number, number, number], key: string, domain: string) {
  const params = new URLSearchParams({
    service: "data", request: "GetFeature", data: layer, key, domain, format: "json",
    geometry: "false", attribute: "true", size: "20", crs: "EPSG:4326", geomFilter: `BOX(${bbox.join(",")})`,
  });
  const data = await fetchJson(`https://api.vworld.kr/req/data?${params.toString()}`);
  return ((data?.response?.result?.featureCollection?.features ?? []) as Array<{ properties?: Record<string, unknown> }>).map((f) => f.properties ?? {});
}

/** 필지 경계에서 약 12m 바깥까지 포함하는 탐색 범위 */
export function expandBox(bbox: [number, number, number, number], meters = 12): [number, number, number, number] {
  const lat = (bbox[1] + bbox[3]) / 2;
  const dx = meters / (111_320 * Math.cos(lat * Math.PI / 180)), dy = meters / 110_540;
  return [bbox[0] - dx, bbox[1] - dy, bbox[2] + dx, bbox[3] + dy];
}

async function roads(bbox: [number, number, number, number], key: string, domain: string): Promise<RoadInfo[]> {
  const box = expandBox(bbox);
  const out: RoadInfo[] = [];
  const [planned, named] = await Promise.allSettled([nearbyFeatures("LT_C_UPISUQ151", box, key, domain), nearbyFeatures("LT_L_SPRD", box, key, domain)]);
  if (planned.status === "fulfilled") for (const p of planned.value) {
    const name = text(p, ["dgm_nm", "DGM_NM", "uname", "UNAME", "name"]) ?? "도시계획도로";
    const w = roadClassWidth(name);
    out.push({ name, widthText: w?.text ?? "규모 미표기", minWidth: w?.min ?? null, source: "VWorld 도시계획시설(도로)" });
  }
  if (named.status === "fulfilled") for (const p of named.value) {
    const name = text(p, ["rn", "RN", "rd_nm", "RD_NM", "road_nm"]) ?? "도로";
    const bt = num(text(p, ["road_bt", "ROAD_BT", "rd_bt"]));
    out.push({ name, widthText: bt ? `도로폭 ${bt}m` : "도로폭 미표기", minWidth: bt, source: "VWorld 도로명주소 도로구간" });
  }
  const seen = new Set<string>();
  return out.filter((r) => { const k = r.name + r.widthText; if (seen.has(k)) return false; seen.add(k); return true; });
}

/** PNU(19자리) → 건축HUB 조회 파라미터 */
export function pnuParams(pnu: string) {
  if (!/^\d{19}$/.test(pnu)) return null;
  return { sigunguCd: pnu.slice(0, 5), bjdongCd: pnu.slice(5, 10), platGbCd: pnu[10] === "2" ? "1" : "0", bun: pnu.slice(11, 15), ji: pnu.slice(15, 19) };
}

async function dataGoKr(paths: string[], query: Record<string, string>, serviceKey: string) {
  const keyParam = serviceKey.includes("%") ? serviceKey : encodeURIComponent(serviceKey);
  let lastError: unknown = null;
  for (const path of paths) {
    try {
      const qs = new URLSearchParams({ ...query, _type: "json", numOfRows: "30", pageNo: "1" }).toString();
      const data = await fetchJson(`https://apis.data.go.kr/1613000/${path}?serviceKey=${keyParam}&${qs}`);
      const code = String(data?.response?.header?.resultCode ?? "00");
      if (code !== "00" && code !== "000") throw new Error(String(data?.response?.header?.resultMsg ?? code));
      const items = data?.response?.body?.items?.item;
      return (Array.isArray(items) ? items : items ? [items] : []) as Record<string, unknown>[];
    } catch (e) { lastError = e; }
  }
  throw lastError ?? new Error("건축HUB 조회 실패");
}

export async function collectSiteFacts(opts: { pnu: string | null; bbox: [number, number, number, number] | null; vworldKey: string; domain: string; dataKey: string }): Promise<SiteFacts> {
  const notes: string[] = [];
  const facts: SiteFacts = { land: null, roads: [], buildings: null, permits: null, notes };
  const tasks: Promise<void>[] = [];
  if (opts.pnu && opts.vworldKey) tasks.push(landCharacteristics(opts.pnu, opts.vworldKey, opts.domain).then((v) => { facts.land = v; }).catch((e) => { notes.push("토지특성정보 조회 실패: " + (e instanceof Error ? e.message : "")); }));
  if (opts.bbox && opts.vworldKey) tasks.push(roads(opts.bbox, opts.vworldKey, opts.domain).then((v) => { facts.roads = v; }).catch((e) => { notes.push("인접 도로 조회 실패: " + (e instanceof Error ? e.message : "")); }));
  const p = opts.pnu ? pnuParams(opts.pnu) : null;
  if (p && opts.dataKey) {
    tasks.push(dataGoKr(["BldRgstHubService/getBrTitleInfo", "BldRgstService_v2/getBrTitleInfo"], p, opts.dataKey).then((items) => {
      facts.buildings = items.map((i) => ({
        name: text(i, ["bldNm"]) ?? "", use: text(i, ["mainPurpsCdNm", "etcPurps"]) ?? "", totalArea: num(text(i, ["totArea"])),
        floors: `지하 ${text(i, ["ugrndFlrCnt"]) ?? "0"} / 지상 ${text(i, ["grndFlrCnt"]) ?? "?"}`, approvedAt: text(i, ["useAprDay"]),
        households: num(text(i, ["hhldCnt"])), source: "국토교통부 건축HUB 건축물대장 표제부",
      }));
    }).catch((e) => { notes.push("건축물대장 조회 실패: " + (e instanceof Error ? e.message : "")); }));
    tasks.push(dataGoKr(["ArchPmsHubService/getApBasisOulnInfo", "ArchPmsService_v2/getApBasisOulnInfo"], p, opts.dataKey).then((items) => {
      facts.permits = items.map((i) => ({
        use: text(i, ["mainPurpsCdNm"]) ?? "", totalArea: num(text(i, ["totArea"])), permittedAt: text(i, ["archPmsDay"]),
        startedAt: text(i, ["realStcnsDay", "stcnsSchedDay"]), approvedAt: text(i, ["useAprDay"]), source: "국토교통부 건축HUB 건축인허가 기본개요",
      }));
    }).catch((e) => { notes.push("건축인허가 조회 실패: " + (e instanceof Error ? e.message : "")); }));
  } else if (p && !opts.dataKey) notes.push("DATA_GO_KR_API_KEY 미설정: 건축물대장·인허가 자동 조회 생략");
  await Promise.all(tasks);
  return facts;
}
