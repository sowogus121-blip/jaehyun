/**
 * 개통 예정(공사 중) 도시철도역 레지스트리.
 * VWorld 장소검색에는 미개통 역이 없어서, 공식 문서로 위치 기준점(필지)과 개통 시기를 확인한 역만 싣는다.
 * - 위치 기준점: 역 출입구·역세권사업이 결정된 필지(지구단위계획·실시계획 고시)를 VWorld 지번 좌표로 변환
 * - 개통 시기: 실시계획(공식 공사기간) / 지자체 발표 / 언론 보도(지연)를 구분해 표기
 */
export interface PlannedStationSource { label: string; value: string; source: string; url?: string; page?: number; official: boolean }
export interface PlannedStation {
  id: string;
  name: string;
  line: string;
  status: string;
  /** 거리 계산 기준 필지 (VWorld 지번 좌표) */
  anchorAddress: string;
  anchorBasis: string;
  /** 표로 보여줄 개통 시기 요약 (예: "2027년 개통 예정(서울시) · 2028~29년 지연 보도") */
  openingSummary: string;
  /** 대표 개통 예정연도 (지자체·사업자 공식 발표 기준) */
  openingYear?: number;
  timeline: PlannedStationSource[];
}

const SINANSAN_PLAN = { source: "국토교통부 고시 제2026-410호 신안산선 복선전철 민간투자사업 실시계획 변경(7차), 2026-07-31", url: "https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=639979" };
const SINANSAN_DELAY: PlannedStationSource = {
  label: "언론 보도", value: "광명 터널 붕괴사고(2025.4) 후 2028~2029년으로 지연 전망 · 사업자 공사기간 80→104개월 연장 검토",
  source: "SBS Biz 2025-12-02", url: "https://biz.sbs.co.kr/amp/article/20000275878", official: false,
};

export const PLANNED_STATIONS: PlannedStation[] = [
  {
    id: "sinansan-sindoksan",
    name: "신독산역",
    line: "신안산선",
    status: "공사 중 (실시계획상 정거장명 '독산역')",
    anchorAddress: "서울특별시 금천구 독산동 1030-1",
    anchorBasis: "신독산역 역세권 활성화사업 특별계획구역(독산동 1030-1·-4, 4,879.3㎡) · 서울특별시고시 제2023-513호 독산 지구단위계획 p.1·3",
    openingSummary: "2027년 개통 예정(서울시 발표) · 실시계획 공사기간 2019~2026 · 2028~29년 지연 보도",
    openingYear: 2027,
    timeline: [
      { label: "실시계획", value: "공사기간 2019~2026년 (공사착수일부터 80개월, 시운전 포함) · 7차 변경에서도 '변경없음'", ...SINANSAN_PLAN, page: 3, official: true },
      { label: "지구단위계획", value: "독산 지구단위계획구역 내 '개통예정인 신독산역(신안산선)' 역세권 기능강화", source: "서울특별시고시 제2023-513호 (도시관리계획 독산 지구단위계획·신독산역 역세권 활성화사업 특별계획구역)", url: "https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=581284", page: 1, official: true },
      { label: "서울시 발표", value: "2027년 신안산선 신독산역 개통 예정 (독산 지구단위계획 수정가결, 2025.7.9 도시·건축공동위원회)", source: "서울시 보도자료 인용 기사(잡뉴스 2025)", url: "https://www.kjob.news/news/396466", official: false },
      SINANSAN_DELAY,
    ],
  },
];

export function plannedStationsNear(lat: number, lon: number, coords: Map<string, { x: number; y: number }>, radius = 1200) {
  const out: Array<PlannedStation & { distance: number }> = [];
  for (const s of PLANNED_STATIONS) {
    const c = coords.get(s.id);
    if (!c) continue;
    const d = Math.round(haversine(lat, lon, c.y, c.x));
    if (d <= radius) out.push({ ...s, distance: d });
  }
  return out.sort((a, b) => a.distance - b.distance);
}

export function haversine(lat1: number, lon1: number, lat2: number, lon2: number) {
  const R = 6371008.8;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const a = Math.sin(toRad(lat2 - lat1) / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(toRad(lon2 - lon1) / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** 기준 필지 좌표까지 거리 → 판정 (필지 대표점이라 역사 중심과 같은 보수 기준: 400m 충족·650m 경계) */
export function plannedVerdict(distance: number): "within" | "borderline" | "outside" {
  return distance <= 400 ? "within" : distance <= 650 ? "borderline" : "outside";
}
