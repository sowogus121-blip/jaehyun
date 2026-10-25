import { NextRequest, NextResponse } from "next/server";
import { findSitePreset } from "../../../lib/site-presets";
import { findZoningStandard } from "../../../lib/zoning-standards";

type LawRecord = {
  name: string;
  promulgationDate: string | null;
  enforcementDate: string | null;
  ministry: string | null;
  link: string;
  status: "verified";
};

type OrdinanceRecord = {
  name: string;
  localGovernment: string | null;
  promulgationDate: string | null;
  enforcementDate: string | null;
  link: string;
  status: "verified";
};

const LAW_QUERIES = [
  "건축법",
  "국토의 계획 및 이용에 관한 법률",
  "주택법",
  "공공주택 특별법",
  "주차장법",
  "건축법 시행령",
  "국토의 계획 및 이용에 관한 법률 시행령",
  "주택건설기준 등에 관한 규정",
  "소방시설 설치 및 관리에 관한 법률",
  "건축물의 피난ㆍ방화구조 등의 기준에 관한 규칙",
  "장애인ㆍ노인ㆍ임산부 등의 편의증진 보장에 관한 법률",
];

const LAND_USE_LAYERS = [
  { code: "LT_C_UQ111", category: "용도지역", label: "도시지역" },
  { code: "LT_C_UQ112", category: "용도지역", label: "관리지역" },
  { code: "LT_C_UQ113", category: "용도지역", label: "농림지역" },
  { code: "LT_C_UQ114", category: "용도지역", label: "자연환경보전지역" },
  { code: "LT_C_UQ121", category: "용도지구", label: "경관지구" },
  { code: "LT_C_UQ123", category: "용도지구", label: "고도지구" },
  { code: "LT_C_UQ126", category: "용도지구", label: "방화지구" },
  { code: "LT_C_UQ141", category: "용도구역", label: "개발제한구역" },
  { code: "LT_C_UQ162", category: "용도구역", label: "도시자연공원구역" },
  { code: "LT_C_UQ171", category: "도시계획", label: "지구단위계획구역" },
];

function getHeaderOrEnv(request: NextRequest, header: string, envName: string) {
  return request.headers.get(header)?.trim() || process.env[envName]?.trim() || "";
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "LH-Plan-Lab/0.7" },
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    try {
      return JSON.parse(text);
    } catch {
      const summary = text.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim().slice(0, 160);
      throw new Error(summary ? `JSON이 아닌 응답: ${summary}` : "빈 응답");
    }
  } finally {
    clearTimeout(timeout);
  }
}

function assertVWorldResponse(data: Record<string, unknown>) {
  const response = data?.response as { status?: string; error?: { code?: string; text?: string } } | undefined;
  if (response?.status !== "ERROR") return;
  const code = response.error?.code ? `${response.error.code} · ` : "";
  throw new Error(`${code}${response.error?.text || "VWorld 요청이 거부되었습니다."}`);
}

function propertyText(properties: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = properties[key];
    if (value !== undefined && value !== null && String(value).trim()) return String(value).trim();
  }
  return null;
}

function geometryArea(geometry: { type?: string; coordinates?: unknown } | undefined) {
  if (!geometry?.coordinates) return null;
  const ringArea = (ring: number[][]) => {
    if (ring.length < 3) return 0;
    const meanLat = ring.reduce((sum, point) => sum + point[1], 0) / ring.length;
    const xScale = 111_320 * Math.cos(meanLat * Math.PI / 180);
    const yScale = 110_540;
    let sum = 0;
    for (let index = 0; index < ring.length; index += 1) {
      const current = ring[index];
      const next = ring[(index + 1) % ring.length];
      sum += current[0] * xScale * next[1] * yScale - next[0] * xScale * current[1] * yScale;
    }
    return Math.abs(sum) / 2;
  };
  const polygonArea = (rings: number[][][]) => rings.reduce((sum, ring, index) => sum + ringArea(ring) * (index === 0 ? 1 : -1), 0);
  if (geometry.type === "Polygon") return polygonArea(geometry.coordinates as number[][][]);
  if (geometry.type === "MultiPolygon") return (geometry.coordinates as number[][][][]).reduce((sum, polygon) => sum + polygonArea(polygon), 0);
  return null;
}

async function geocode(address: string, key: string, domain: string) {
  let lastError: Error | null = null;
  for (const category of ["parcel", "road"] as const) {
    const params = new URLSearchParams({
      service: "search",
      request: "search",
      version: "2.0",
      size: "5",
      page: "1",
      query: address,
      type: "address",
      category,
      format: "json",
      errorformat: "json",
      key,
      domain,
    });
    try {
      const data = await fetchJson(`https://api.vworld.kr/req/search?${params.toString()}`);
      assertVWorldResponse(data);
      const item = data?.response?.result?.items?.[0];
      if (!item?.point?.x || !item?.point?.y) continue;
      return {
        address: item.address?.road || item.address?.parcel || item.title,
        parcelAddress: item.address?.parcel || null,
        x: String(item.point.x),
        y: String(item.point.y),
      };
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("알 수 없는 오류");
    }
  }
  throw lastError ?? new Error("주소에 해당하는 좌표를 찾지 못했습니다.");
}

async function getLandUse(x: string, y: string, key: string, domain: string) {
  const results = await Promise.allSettled(LAND_USE_LAYERS.map(async (layer) => {
    const params = new URLSearchParams({
      service: "data",
      request: "GetFeature",
      data: layer.code,
      key,
      domain,
      format: "json",
      geometry: "false",
      attribute: "true",
      size: "20",
      crs: "EPSG:4326",
      geomFilter: `POINT(${x} ${y})`,
    });
    const data = await fetchJson(`https://api.vworld.kr/req/data?${params.toString()}`);
    assertVWorldResponse(data);
    const features = data?.response?.result?.featureCollection?.features ?? [];
    return features.map((feature: { properties?: Record<string, unknown> }) => {
      const properties = feature.properties ?? {};
      const name = propertyText(properties, ["dgm_nm", "DGM_NM", "uname", "UNAME", "name", "NAME", "label", "LABEL"]) || layer.label;
      return {
        category: layer.category,
        name,
        code: layer.code,
        source: "국가공간정보포털 VWorld",
        status: "verified" as const,
      };
    });
  }));
  const values = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const errors = results.flatMap((result) => result.status === "rejected"
    ? [result.reason instanceof Error ? result.reason.message : "알 수 없는 오류"]
    : []);
  return {
    items: values.filter((item, index) => values.findIndex((candidate) => `${candidate.code}-${candidate.name}` === `${item.code}-${item.name}`) === index),
    errors: [...new Set(errors)],
  };
}

async function getParcelInfo(x: string, y: string, key: string, domain: string) {
  for (const dataCode of ["LP_PA_CBND_BUBUN", "LP_PA_CBND_BONBUN"]) {
    const params = new URLSearchParams({
      service: "data",
      request: "GetFeature",
      data: dataCode,
      key,
      domain,
      format: "json",
      geometry: "true",
      attribute: "true",
      size: "1",
      crs: "EPSG:4326",
      geomFilter: `POINT(${x} ${y})`,
    });
    try {
      const data = await fetchJson(`https://api.vworld.kr/req/data?${params.toString()}`);
      assertVWorldResponse(data);
      const feature = data?.response?.result?.featureCollection?.features?.[0] as {
        properties?: Record<string, unknown>;
        geometry?: { type?: string; coordinates?: unknown };
      } | undefined;
      if (!feature) continue;
      const properties = feature.properties ?? {};
      const rawArea = propertyText(properties, ["p_area", "P_AREA", "parcel_area", "PARCEL_AREA", "area", "AREA", "지적면적"]);
      const exactArea = rawArea ? Number(String(rawArea).replaceAll(",", "")) : NaN;
      const calculatedArea = geometryArea(feature.geometry);
      return {
        area: Number.isFinite(exactArea) && exactArea > 0 ? exactArea : calculatedArea ? Math.round(calculatedArea * 10) / 10 : null,
        landCategory: propertyText(properties, ["jimok_nm", "JIMOK_NM", "jimok", "JIMOK", "land_category", "LAND_CATEGORY", "지목"]),
        pnu: propertyText(properties, ["pnu", "PNU"]),
        source: Number.isFinite(exactArea) && exactArea > 0 ? "국가공간정보포털 VWorld 지적속성" : "국가공간정보포털 VWorld 지적도형",
        approximate: !(Number.isFinite(exactArea) && exactArea > 0),
      };
    } catch {
      // Some VWorld keys do not include cadastral data access; continue with land-use review.
    }
  }
  return null;
}

async function searchLaw(query: string, oc: string): Promise<LawRecord | null> {
  const params = new URLSearchParams({ OC: oc, target: "law", type: "JSON", query, display: "10" });
  const data = await fetchJson(`https://www.law.go.kr/DRF/lawSearch.do?${params.toString()}`);
  const root = data?.LawSearch;
  const resultCode = String(root?.resultCode ?? data?.resultCode ?? "");
  const resultMessage = String(root?.resultMsg ?? data?.resultMsg ?? "");
  if (resultCode && resultCode !== "00") throw new Error(`${resultCode} · ${resultMessage || "법령 API 요청이 거부되었습니다."}`);
  if (!root || typeof root !== "object") throw new Error("국가법령정보센터 응답 형식을 확인할 수 없습니다.");
  const raw = root.law;
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const exact = rows.find((row: Record<string, unknown>) => String(row["법령명한글"] ?? "").replaceAll(" ", "") === query.replaceAll(" ", "")) ?? rows[0];
  if (!exact) return null;
  const detail = String(exact["법령상세링크"] ?? "");
  return {
    name: String(exact["법령명한글"] ?? query),
    promulgationDate: exact["공포일자"] ? String(exact["공포일자"]) : null,
    enforcementDate: exact["시행일자"] ? String(exact["시행일자"]) : null,
    ministry: exact["소관부처명"] ? String(exact["소관부처명"]) : null,
    link: detail.startsWith("http") ? detail : `https://www.law.go.kr${detail}`,
    status: "verified",
  };
}

async function searchOrdinance(query: string, oc: string): Promise<OrdinanceRecord | null> {
  const params = new URLSearchParams({ OC: oc, target: "ordin", type: "JSON", query, display: "10" });
  const data = await fetchJson(`https://www.law.go.kr/DRF/lawSearch.do?${params.toString()}`);
  const root = data?.OrdinSearch ?? data?.LawSearch;
  const resultCode = String(root?.resultCode ?? data?.resultCode ?? "");
  const resultMessage = String(root?.resultMsg ?? data?.resultMsg ?? "");
  if (resultCode && resultCode !== "00") throw new Error(`${resultCode} · ${resultMessage || "자치법규 API 요청이 거부되었습니다."}`);
  if (!root || typeof root !== "object") throw new Error("국가법령정보센터 자치법규 응답 형식을 확인할 수 없습니다.");
  const raw = root.ordin ?? root.law;
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const row = rows[0] as Record<string, unknown> | undefined;
  if (!row) return null;
  const detail = String(row["자치법규상세링크"] ?? row["법령상세링크"] ?? "");
  return {
    name: String(row["자치법규명"] ?? row["법령명한글"] ?? query),
    localGovernment: row["지자체기관명"] ? String(row["지자체기관명"]) : null,
    promulgationDate: row["공포일자"] ? String(row["공포일자"]) : null,
    enforcementDate: row["시행일자"] ? String(row["시행일자"]) : null,
    link: detail.startsWith("http") ? detail : `https://www.law.go.kr${detail}`,
    status: "verified",
  };
}

function localGovernmentFromAddress(address: string) {
  const parts = address.split(/\s+/).filter(Boolean);
  if (parts[0]?.includes("세종")) return parts[0];
  return parts.slice(0, 2).join(" ");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { address?: string } | null;
  const address = body?.address?.trim();
  if (!address) return NextResponse.json({ error: "검토할 주소가 필요합니다." }, { status: 400 });

  const vworldKey = getHeaderOrEnv(request, "x-vworld-api-key", "VWORLD_API_KEY");
  const lawOc = getHeaderOrEnv(request, "x-law-api-oc", "LAW_OPEN_API_OC");
  const preset = findSitePreset(address);
  const missing: string[] = [];
  const errors: string[] = [];
  if (!vworldKey) missing.push("VWORLD_API_KEY");
  if (!lawOc) missing.push("LAW_OPEN_API_OC");

  let location: Awaited<ReturnType<typeof geocode>> | null = null;
  let parcel: Awaited<ReturnType<typeof getParcelInfo>> = null;
  let landUse = preset ? [{
    category: "용도지역",
    name: preset.zone,
    code: "OFFICIAL-DOCUMENT",
    source: preset.source,
    status: "verified" as const,
  }] : [];
  if (vworldKey) {
    try {
      location = await geocode(preset?.address ?? address, vworldKey, request.nextUrl.origin);
      const [vworldLandUse, vworldParcel] = await Promise.all([
        getLandUse(location.x, location.y, vworldKey, request.nextUrl.origin),
        getParcelInfo(location.x, location.y, vworldKey, request.nextUrl.origin),
      ]);
      parcel = vworldParcel;
      landUse = [...landUse, ...vworldLandUse.items].filter((item, index, all) => all.findIndex((candidate) => `${candidate.code}-${candidate.name}` === `${item.code}-${item.name}`) === index);
      if (vworldLandUse.errors.length) errors.push(`VWorld 용도지역 일부 조회 실패: ${vworldLandUse.errors.join(" / ")}`);
      if (vworldLandUse.items.length === 0 && !preset) errors.push("VWorld 좌표는 확인했지만 해당 위치의 용도지역 응답이 없습니다.");
    } catch (error) {
      errors.push(`VWorld 조회 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  }

  if (preset) parcel = {
    area: preset.siteArea,
    landCategory: preset.landCategory,
    pnu: parcel?.pnu ?? null,
    source: preset.source,
    approximate: false,
  };

  const planningStandards = findZoningStandard(landUse.filter((item) => item.category === "용도지역").map((item) => item.name));
  const districtPlan = landUse.some((item) => item.name.includes("지구단위계획")) || (preset ? preset.districtPlan : null);

  let laws: LawRecord[] = [];
  let ordinances: OrdinanceRecord[] = [];
  if (lawOc) {
    const localGovernment = localGovernmentFromAddress(preset?.address ?? address);
    const ordinanceQueries = ["건축 조례", "주차장 조례", "도시계획 조례", "경관 조례"].map((name) => `${localGovernment} ${name}`);
    const [settled, ordinanceSettled] = await Promise.all([
      Promise.allSettled(LAW_QUERIES.map((query) => searchLaw(query, lawOc))),
      Promise.allSettled(ordinanceQueries.map((query) => searchOrdinance(query, lawOc))),
    ]);
    laws = settled.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
    const failures = settled.flatMap((result) => result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : "알 수 없는 오류"]
      : result.value ? [] : ["검색 결과 없음"]);
    if (failures.length) {
      const reasons = [...new Set(failures)];
      errors.push(`국가법령정보센터 ${failures.length}개 조회 실패: ${reasons.join(" / ")}`);
    }
    ordinances = ordinanceSettled.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
    const ordinanceFailures = ordinanceSettled.flatMap((result) => result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : "알 수 없는 오류"]
      : result.value ? [] : ["검색 결과 없음"]);
    if (ordinanceFailures.length) {
      errors.push(`관할 자치법규 ${ordinanceFailures.length}개 조회 실패: ${[...new Set(ordinanceFailures)].join(" / ")}`);
    }
  }

  return NextResponse.json({
    status: missing.length === 0 && errors.length === 0 ? "verified" : laws.length || landUse.length || location ? "partial" : "integration-required",
    checkedAt: new Date().toISOString(),
    location,
    landUse,
    parcel,
    planningStandards,
    districtPlan,
    laws,
    ordinances,
    missing,
    errors,
    unresolved: [
      ordinances.length ? "관할 자치법규 세부 조문별 적용 여부" : "관할 지자체 건축·주차장 조례 원문",
      "지구단위계획 결정도서 및 시행지침",
      "해당 연도 LH 지역본부 매입공고",
      "일조·인동거리·소방활동공간 배치 검토",
    ],
  });
}
