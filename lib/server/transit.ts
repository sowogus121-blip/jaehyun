/**
 * LH 0.3대 주차특례 입지(도시철도역 출구 또는 대학교 교문 직선거리 500m) 자동 판정용.
 * VWorld 장소검색(bbox 한정)으로 대상지 주변 역 출구·역사·대학교를 찾아 직선거리를 잰다.
 * 역 출구가 검색되면 출구 기준, 없으면 역사 중심점 기준(경계 구간은 '확인 필요').
 * 대학은 주소 대표점 기준이라 교문까지 거리와 다를 수 있어 경계 구간은 '확인 필요'.
 */
export interface NearbyPlace { name: string; distance: number; kind: "exit" | "station" | "university"; address?: string }
export interface TransitCheck {
  station: NearbyPlace | null;
  university: NearbyPlace | null;
  /** within: 500m 이내 확인 / borderline: 경계(현장·도면 확인) / outside: 500m 밖 */
  verdict: "within" | "borderline" | "outside" | "unknown";
  basis: string;
  checkedAt: string;
  errors: string[];
}

function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

type VItem = { title?: string; category?: string; point?: { x?: string | number; y?: string | number }; address?: { road?: string; parcel?: string } };

async function searchPlace(query: string, x: number, y: number, radius: number, key: string, domain: string): Promise<VItem[]> {
  const dLat = radius / 111_320;
  const dLon = radius / (111_320 * Math.cos((y * Math.PI) / 180));
  const params = new URLSearchParams({
    service: "search", request: "search", version: "2.0", crs: "EPSG:4326",
    bbox: `${x - dLon},${y - dLat},${x + dLon},${y + dLat}`,
    size: "100", page: "1", query, type: "place", format: "json", errorformat: "json", key, domain,
  });
  const res = await fetch(`https://api.vworld.kr/req/search?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const data = await res.json().catch(() => null) as { response?: { status?: string; result?: { items?: VItem[] }; error?: { text?: string } } } | null;
  if (!data?.response) throw new Error(`VWorld 장소검색 HTTP ${res.status}`);
  if (data.response.status === "NOT_FOUND") return [];
  if (data.response.status !== "OK") throw new Error(data.response.error?.text ?? `VWorld 장소검색 ${data.response.status}`);
  return data.response.result?.items ?? [];
}

const STATION_CATEGORY = /지하철|전철|도시철도|철도역|역사|경전철|GTX/;
const UNIV_CATEGORY = /대학|학교/;

function nearest(items: VItem[], x: number, y: number, accept: (i: VItem) => NearbyPlace["kind"] | null): NearbyPlace | null {
  let best: NearbyPlace | null = null;
  for (const i of items) {
    const kind = accept(i);
    const px = Number(i.point?.x);
    const py = Number(i.point?.y);
    if (!kind || !Number.isFinite(px) || !Number.isFinite(py)) continue;
    const d = Math.round(haversine(y, x, py, px));
    if (!best || d < best.distance) best = { name: String(i.title ?? ""), distance: d, kind, address: i.address?.road || i.address?.parcel };
  }
  return best;
}

export async function checkTransit(x: number, y: number, key: string, domain: string): Promise<TransitCheck> {
  const errors: string[] = [];
  const run = (q: string) => searchPlace(q, x, y, 1200, key, domain).catch((e) => { errors.push(`${q}: ${e instanceof Error ? e.message : "검색 실패"}`); return [] as VItem[]; });
  const [exits, stations, univs] = await Promise.all([run("출구"), run("역"), run("대학교")]);
  const exit = nearest(exits, x, y, (i) => /역\s*\d+\s*번?\s*출구|출구\s*\d+/.test(String(i.title ?? "")) && (STATION_CATEGORY.test(String(i.category ?? "")) || /역/.test(String(i.title ?? ""))) ? "exit" : null);
  const station = nearest(stations, x, y, (i) => {
    const t = String(i.title ?? "");
    const c = String(i.category ?? "");
    return STATION_CATEGORY.test(c) && /역$|역\s*\(|역\s*\d+호선/.test(t) && !/버스|정류장|주유소|역전|매표/.test(t) ? "station" : null;
  });
  const university = nearest(univs, x, y, (i) => {
    const t = String(i.title ?? "");
    return /대학교$|대학교\s|대학$/.test(t) && UNIV_CATEGORY.test(String(i.category ?? "")) && !/병원|부속|어린이|유치원|사이버|평생교육|기숙사|주차장|도서관|연구소/.test(t) ? "university" : null;
  });
  const stationPick = exit ?? station;
  // 출구 기준 500m 이내 → 충족. 역사 중심점만 있으면 400m 이내 충족·650m 이내 경계.
  // 대학은 주소 대표점 기준이라 400m 이내 충족·700m 이내 경계.
  const stationVerdict = !stationPick ? null
    : stationPick.kind === "exit" ? (stationPick.distance <= 500 ? "within" : stationPick.distance <= 600 ? "borderline" : "outside")
    : stationPick.distance <= 400 ? "within" : stationPick.distance <= 650 ? "borderline" : "outside";
  const univVerdict = !university ? null : university.distance <= 400 ? "within" : university.distance <= 700 ? "borderline" : "outside";
  const order = ["within", "borderline", "outside"] as const;
  const verdicts = [stationVerdict, univVerdict].filter(Boolean) as Array<(typeof order)[number]>;
  const verdict = verdicts.length ? order.find((v) => verdicts.includes(v))! : errors.length ? "unknown" : "outside";
  const basis = [
    stationPick ? `${stationPick.name} ${stationPick.kind === "exit" ? "출구" : "역사 중심"}까지 직선 ${stationPick.distance}m` : "반경 1.2km 내 도시철도역 없음",
    university ? `${university.name} 주소점까지 직선 ${university.distance}m` : "반경 1.2km 내 대학교 없음",
  ].join(" · ");
  return { station: stationPick, university, verdict, basis, checkedAt: new Date().toISOString(), errors };
}
