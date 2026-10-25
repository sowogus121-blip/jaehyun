import { NextRequest, NextResponse } from "next/server";
import { findSitePreset } from "../../../lib/site-presets";

type LawRecord = {
  name: string;
  promulgationDate: string | null;
  enforcementDate: string | null;
  ministry: string | null;
  link: string;
  status: "verified";
};

const LAW_QUERIES = [
  "건축법",
  "국토의 계획 및 이용에 관한 법률",
  "주택법",
  "공공주택 특별법",
  "주차장법",
  "장애인 노인 임산부 등의 편의증진 보장에 관한 법률",
];

const LAND_USE_LAYERS = [
  { code: "LT_C_UQ111", label: "도시지역" },
  { code: "LT_C_UQ112", label: "관리지역" },
  { code: "LT_C_UQ113", label: "농림지역" },
  { code: "LT_C_UQ114", label: "자연환경보전지역" },
];

function getHeaderOrEnv(request: NextRequest, header: string, envName: string) {
  return request.headers.get(header)?.trim() || process.env[envName]?.trim() || "";
}

async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "LH-Plan-Lab/0.6" },
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
      const name = String(properties.uname || properties.UNAME || properties.name || properties.NAME || layer.label);
      return {
        category: "용도지역",
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
      const vworldLandUse = await getLandUse(location.x, location.y, vworldKey, request.nextUrl.origin);
      landUse = [...landUse, ...vworldLandUse.items].filter((item, index, all) => all.findIndex((candidate) => `${candidate.code}-${candidate.name}` === `${item.code}-${item.name}`) === index);
      if (vworldLandUse.errors.length) errors.push(`VWorld 용도지역 일부 조회 실패: ${vworldLandUse.errors.join(" / ")}`);
      if (vworldLandUse.items.length === 0 && !preset) errors.push("VWorld 좌표는 확인했지만 해당 위치의 용도지역 응답이 없습니다.");
    } catch (error) {
      errors.push(`VWorld 조회 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  }

  let laws: LawRecord[] = [];
  if (lawOc) {
    const settled = await Promise.allSettled(LAW_QUERIES.map((query) => searchLaw(query, lawOc)));
    laws = settled.flatMap((result) => result.status === "fulfilled" && result.value ? [result.value] : []);
    const failures = settled.flatMap((result) => result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : "알 수 없는 오류"]
      : result.value ? [] : ["검색 결과 없음"]);
    if (failures.length) {
      const reasons = [...new Set(failures)];
      errors.push(`국가법령정보센터 ${failures.length}개 조회 실패: ${reasons.join(" / ")}`);
    }
  }

  return NextResponse.json({
    status: missing.length === 0 && errors.length === 0 ? "verified" : laws.length || landUse.length || location ? "partial" : "integration-required",
    checkedAt: new Date().toISOString(),
    location,
    landUse,
    laws,
    missing,
    errors,
    unresolved: [
      "관할 지자체 건축·주차장 조례 원문",
      "지구단위계획 결정도서 및 시행지침",
      "해당 연도 LH 지역본부 매입공고",
      "일조·인동거리·소방활동공간 배치 검토",
    ],
  });
}
