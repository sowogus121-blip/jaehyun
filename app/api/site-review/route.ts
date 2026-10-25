import { NextRequest, NextResponse } from "next/server";
import { findSitePreset } from "../../../lib/site-presets";
import { findZoningStandard } from "../../../lib/zoning-standards";
import { searchOfficialSources } from "../../../lib/server/official-search";
import { collectOfficialDocuments } from "../../../lib/server/official-document-ingest";
import { findLatestLhPurchaseNotice } from "../../../lib/server/lh-notice";
import { normalizeAssemblyAddresses } from "../../../lib/parcel-assembly";
import { extractOrdinanceArticles, type OrdinanceArticleCandidate } from "../../../lib/server/ordinance-articles";

type LawRecord = {
  name: string;
  promulgationDate: string | null;
  enforcementDate: string | null;
  ministry: string | null;
  detailId: string | null;
  detailMst: string | null;
  link: string;
  retrievalStatus: "metadata-only" | "full-text";
  applicationStatus: "not-assessed" | "applicable" | "not-applicable" | "conditional";
};

type OrdinanceRecord = {
  name: string;
  localGovernment: string | null;
  detailId: string | null;
  detailMst: string | null;
  promulgationDate: string | null;
  enforcementDate: string | null;
  link: string;
  retrievalStatus: "metadata-only" | "full-text";
  applicationStatus: "not-assessed" | "applicable" | "not-applicable" | "conditional";
};

type ParcelReview = {
  inputAddress: string;
  location: Awaited<ReturnType<typeof geocode>> | null;
  parcel: Awaited<ReturnType<typeof getParcelInfo>>;
  landUse: Array<{ category: string; name: string; code: string; source: string; status: "verified" }>;
  errors: string[];
};

const LAW_QUERIES = [
  "건축법",
  "국토의 계획 및 이용에 관한 법률",
  "주택법",
  "공공주택 특별법",
  "공공주택 특별법 시행령",
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
  { code: "LT_C_UQ124", category: "용도지구", label: "방화지구" },
  { code: "LT_C_UQ126", category: "용도지구", label: "보호지구" },
  { code: "LT_C_UD801", category: "용도구역", label: "개발제한구역" },
  { code: "LT_C_UQ162", category: "용도구역", label: "도시자연공원구역" },
  { code: "LT_C_UPISUQ161", category: "도시계획", label: "지구단위계획구역" },
  { code: "LT_C_UPISUQ171", category: "도시계획", label: "개발행위허가제한지역" },
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
    detailId: exact["법령ID"] ? String(exact["법령ID"]) : null,
    detailMst: exact["법령일련번호"] ? String(exact["법령일련번호"]) : null,
    link: detail.startsWith("http") ? detail : `https://www.law.go.kr${detail}`,
    retrievalStatus: "metadata-only",
    applicationStatus: "not-assessed",
  };
}

async function fetchNationalLawArticleCandidates(law: LawRecord, oc: string): Promise<OrdinanceArticleCandidate[]> {
  if (!law.detailId && !law.detailMst) return [];
  const params = new URLSearchParams({ OC: oc, target: "law", type: "JSON" });
  if (law.detailId) params.set("ID", law.detailId);
  else if (law.detailMst) params.set("MST", law.detailMst);
  const data = await fetchJson(`https://www.law.go.kr/DRF/lawService.do?${params.toString()}`);
  if (data?.resultCode && String(data.resultCode) !== "00") throw new Error(String(data.resultMsg ?? "법령 본문 조회 실패"));
  return extractOrdinanceArticles(data, law.name, law.link);
}

async function searchOrdinance(query: string, oc: string, jurisdiction: string): Promise<OrdinanceRecord | null> {
  const params = new URLSearchParams({ OC: oc, target: "ordin", type: "JSON", query, display: "10" });
  const data = await fetchJson(`https://www.law.go.kr/DRF/lawSearch.do?${params.toString()}`);
  const root = data?.OrdinSearch ?? data?.LawSearch;
  const resultCode = String(root?.resultCode ?? data?.resultCode ?? "");
  const resultMessage = String(root?.resultMsg ?? data?.resultMsg ?? "");
  if (resultCode && resultCode !== "00") throw new Error(`${resultCode} · ${resultMessage || "자치법규 API 요청이 거부되었습니다."}`);
  if (!root || typeof root !== "object") throw new Error("국가법령정보센터 자치법규 응답 형식을 확인할 수 없습니다.");
  const raw = root.ordin ?? root.law;
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // Do not use the API's first hit: a different municipality's ordinance
  // can otherwise be presented as the ordinance governing this address.
  const normalize = (value: unknown) => String(value ?? "").replace(/\s+/g, "");
  const district = jurisdiction.split(/\s+/).filter(Boolean).at(-1) ?? jurisdiction;
  const fullScope = normalize(jurisdiction);
  const subject = query.includes("주차장") ? "주차장" : query.includes("도시계획") ? "도시계획" :
    query.includes("경관") ? "경관" : "건축";
  // The Law Information API indexes the local law by '의정부시 ...', not
  // '경기도 의정부시 ...'. Match the municipality + subject in the title,
  // and the entire governing agency when the API supplies it.
  const matches = rows.filter((candidate: Record<string, unknown>) => {
    const title = normalize(candidate["자치법규명"] ?? candidate["법령명한글"]);
    const office = normalize(candidate["지자체기관명"]);
    return title.startsWith(normalize(district + subject)) &&
      title.includes("조례") && !title.includes("시행규칙") &&
      (!office || office === fullScope || office.endsWith(normalize(district)));
  }) as Record<string, unknown>[];
  const row = matches.find((candidate) =>
    normalize(candidate["자치법규명"] ?? candidate["법령명한글"]) === normalize(query)
  ) ?? matches[0];
  if (!row) return null;
  const detail = String(row["자치법규상세링크"] ?? row["법령상세링크"] ?? "");
  return {
    name: String(row["자치법규명"] ?? row["법령명한글"] ?? query),
    localGovernment: row["지자체기관명"] ? String(row["지자체기관명"]) : null,
    detailId: row["자치법규ID"] ? String(row["자치법규ID"]) : null,
    detailMst: row["자치법규일련번호"] ? String(row["자치법규일련번호"]) : null,
    promulgationDate: row["공포일자"] ? String(row["공포일자"]) : null,
    enforcementDate: row["시행일자"] ? String(row["시행일자"]) : null,
    link: detail.startsWith("http") ? detail : `https://www.law.go.kr${detail}`,
    retrievalStatus: "metadata-only",
    applicationStatus: "not-assessed",
  };
}

async function fetchOrdinanceArticleCandidates(ordinance: OrdinanceRecord, oc: string): Promise<OrdinanceArticleCandidate[]> {
  if (!ordinance.detailId && !ordinance.detailMst) return [];
  const params = new URLSearchParams({ OC: oc, target: "ordin", type: "JSON" });
  if (ordinance.detailId) params.set("ID", ordinance.detailId);
  else if (ordinance.detailMst) params.set("MST", ordinance.detailMst);
  const data = await fetchJson(`https://www.law.go.kr/DRF/lawService.do?${params.toString()}`);
  if (data?.resultCode && String(data.resultCode) !== "00") {
    throw new Error(String(data.resultMsg ?? "자치법규 본문 API 오류"));
  }
  return extractOrdinanceArticles(data, ordinance.name, ordinance.link);
}

function localGovernmentFromAddress(address: string) {
  const parts = address.split(/\s+/).filter(Boolean);
  if (parts[0]?.includes("세종")) return parts[0];
  return parts.slice(0, 2).join(" ");
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { address?: string; parcelAddresses?: string[]; businessMode?: string; regionalOffice?: string; lhSupplyType?: string } | null;
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

  const parcels: ParcelReview[] = [{ inputAddress: address, location, parcel, landUse, errors: [] }];
  const additionalAddresses = normalizeAssemblyAddresses(address, body?.parcelAddresses ?? []);
  const additionalReviews = await Promise.all(additionalAddresses.map(async (parcelAddress): Promise<ParcelReview> => {
    const parcelPreset = findSitePreset(parcelAddress);
    let additionalLandUse: ParcelReview["landUse"] = parcelPreset ? [{
      category: "용도지역",
      name: parcelPreset.zone,
      code: "OFFICIAL-DOCUMENT",
      source: parcelPreset.source,
      status: "verified",
    }] : [];
    let additionalParcel: ParcelReview["parcel"] = parcelPreset ? {
      area: parcelPreset.siteArea,
      landCategory: parcelPreset.landCategory,
      pnu: null,
      source: parcelPreset.source,
      approximate: false,
    } : null;
    if (!vworldKey) return {
      inputAddress: parcelAddress,
      location: null,
      parcel: additionalParcel,
      landUse: additionalLandUse,
      errors: parcelPreset ? [] : ["VWorld API 키가 없어 필지를 조회하지 못했습니다."],
    };
    try {
      const additionalLocation = await geocode(parcelPreset?.address ?? parcelAddress, vworldKey, request.nextUrl.origin);
      const [additionalUse, cadastral] = await Promise.all([
        getLandUse(additionalLocation.x, additionalLocation.y, vworldKey, request.nextUrl.origin),
        getParcelInfo(additionalLocation.x, additionalLocation.y, vworldKey, request.nextUrl.origin),
      ]);
      additionalLandUse = [...additionalLandUse, ...additionalUse.items].filter((item, index, all) => all.findIndex((candidate) => `${candidate.code}-${candidate.name}` === `${item.code}-${item.name}`) === index);
      if (!parcelPreset && cadastral) additionalParcel = cadastral;
      else if (additionalParcel && cadastral?.pnu) additionalParcel.pnu = cadastral.pnu;
      return { inputAddress: parcelAddress, location: additionalLocation, parcel: additionalParcel, landUse: additionalLandUse, errors: additionalUse.errors };
    } catch (error) {
      return { inputAddress: parcelAddress, location: null, parcel: additionalParcel, landUse: additionalLandUse, errors: [error instanceof Error ? error.message : "필지 조회 실패"] };
    }
  }));
  parcels.push(...additionalReviews);
  if (additionalReviews.length) {
    landUse = parcels.flatMap((item) => item.landUse).filter((item, index, all) => all.findIndex((candidate) => `${candidate.code}-${candidate.name}` === `${item.code}-${item.name}`) === index);
    const seenPnus = new Set<string>();
    let duplicatePnu = false;
    for (const item of parcels) {
      const pnu = item.parcel?.pnu;
      if (pnu) {
        if (seenPnus.has(pnu)) { duplicatePnu = true; item.errors.push("이미 포함된 동일 PNU 필지"); }
        seenPnus.add(pnu);
      }
    }
    const mainMunicipality = localGovernmentFromAddress(preset?.address ?? address);
    const mixedJurisdiction = parcels.some(item => item.location && localGovernmentFromAddress(item.location.parcelAddress ?? item.location.address) !== mainMunicipality);
    if (duplicatePnu) errors.push("합필 대상 필지 중 동일 PNU가 중복되므로 면적을 합산할 수 없습니다.");
    if (mixedJurisdiction) errors.push("서로 다른 시·군·구 필지가 포함되어 관할 지자체·LH 인수기준을 일괄 적용할 수 없습니다.");
    const failedParcels = additionalReviews.filter((item) => item.errors.length);
    if (failedParcels.length) errors.push(`복수 필지 ${failedParcels.length}개 일부 조회 실패`);
    if (!duplicatePnu && !mixedJurisdiction && parcels.every((item) => item.parcel?.area && item.parcel.area > 0 && item.errors.length === 0)) {
      parcel = {
        area: parcels.reduce((sum, item) => sum + (item.parcel?.area ?? 0), 0),
        landCategory: [...new Set(parcels.map((item) => item.parcel?.landCategory).filter(Boolean))].join(" · ") || null,
        pnu: null,
        source: "복수 필지 개별 조회 합계",
        approximate: parcels.some((item) => item.parcel?.approximate),
      };
    } else {
      // Never leak the primary parcel area into a supposedly combined feasibility study.
      parcel = null;
    }
  }

  const zoneNames = [...new Set(landUse.filter((item) => item.category === "용도지역").map((item) => item.name))];
  const mixedUseZones = zoneNames.length > 1;
  const planningStandards = mixedUseZones ? null : findZoningStandard(zoneNames);
  const districtPlan = landUse.some((item) => item.code === "LT_C_UPISUQ161" || item.name.includes("지구단위계획")) || (preset ? preset.districtPlan : null);
  const localGovernment = localGovernmentFromAddress(preset?.address ?? address);
  const districtForLh = localGovernment.split(/\s+/).filter(Boolean).at(-1) ?? "";
  const lhNoticePromise = findLatestLhPurchaseNotice(districtForLh, localGovernment)
    .then((notice) => ({ notice, error: null as string | null }))
    .catch((error: unknown) => ({ notice: null, error: error instanceof Error ? error.message : "LH 공고 조회 실패" }));
  const webSearchPromise = searchOfficialSources({
    address: preset?.address ?? address,
    localGovernment,
    businessMode: body?.businessMode,
    regionalOffice: body?.regionalOffice,
  });

  let laws: LawRecord[] = [];
  let ordinances: OrdinanceRecord[] = [];
  if (lawOc) {
    const district = localGovernment.split(/\s+/).filter(Boolean).at(-1) ?? localGovernment;
    // Search by enacted ordinance title. Adding the province to 'query'
    // yields zero results on the real official API for e.g. 의정부시.
    const ordinanceQueries = [
      `${district} 건축 조례`,
      `${district} 주차장 설치 및 관리 조례`,
      `${district} 도시계획 조례`,
      `${district} 경관 조례`,
    ];
    const [settled, ordinanceSettled] = await Promise.all([
      Promise.allSettled(LAW_QUERIES.map((query) => searchLaw(query, lawOc))),
      Promise.allSettled(ordinanceQueries.map((query) => searchOrdinance(query, lawOc, localGovernment))),
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
  // Read two core national parking laws; never equate a search hit with applicability.
  let nationalArticleCandidates: OrdinanceArticleCandidate[] = [];
  if (lawOc) {
    const targets = laws.filter((item) => ["공공주택 특별법 시행령", "주택건설기준 등에 관한 규정"].includes(item.name));
    const results = await Promise.allSettled(targets.map((item) => fetchNationalLawArticleCandidates(item, lawOc)));
    nationalArticleCandidates = results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) errors.push(`국가법령 본문 조회 ${failed.length}건 실패`);
    results.forEach((result, index) => {
      if (result.status === "fulfilled" && result.value.length > 0) targets[index].retrievalStatus = "full-text";
    });
  }
  // Reading the official full text is a separate step from finding its title.
  // Keyword matches remain unverified candidates; applicability is NOT inferred.
  let ordinanceArticleCandidates: OrdinanceArticleCandidate[] = [];
  if (lawOc && ordinances.length) {
    const detailResults = await Promise.allSettled(ordinances.map((ordinance) => fetchOrdinanceArticleCandidates(ordinance, lawOc)));
    const detailErrors = detailResults.flatMap((result) => result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : "자치법규 원문 요청 오류"]
      : []);
    if (detailErrors.length) errors.push(`자치법규 본문 조회 ${detailErrors.length}건 실패: ${[...new Set(detailErrors)].join(" / ")}`);
    ordinanceArticleCandidates = detailResults.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  }
  const webSearch = await webSearchPromise;
  const officialDocuments = await collectOfficialDocuments(webSearch.results, localGovernment, preset?.address ?? address);
  const lhNoticeResult = await lhNoticePromise;
  const lhNotice = lhNoticeResult.notice;
  if (lhNoticeResult.error) errors.push("LH 지역별 공식 공고 조사: " + lhNoticeResult.error);
  if (webSearch.status === "not-configured") missing.push("BRAVE_SEARCH_API_KEY");
  if (webSearch.status === "failed") errors.push(`공식 웹 후속검색 실패: ${webSearch.errors.join(" / ")}`);

  return NextResponse.json({
    status: laws.length || ordinances.length || landUse.length || location ? "partial" : "integration-required",
    reviewStage: "source-discovery",
    sourceDiscoveryComplete: missing.length === 0 && errors.length === 0,
    applicationAssessmentComplete: false,
    checkedAt: new Date().toISOString(),
    location,
    landUse,
    parcel,
    planningStandards,
    districtPlan,
    mixedUseZones,
    parcels,
    laws,
    ordinances,
    ordinanceArticleCandidates,
    nationalArticleCandidates,
    ruleFindings: [],
    webSearch,
    officialDocuments,
    lhNotice,
    missing,
    errors,
    unresolved: [
      ordinances.length ? "관할 자치법규 조문 후보는 확보했으나 대상 필지별 적용 여부·별표 검증 필요" : "관할 지자체 건축·주차장 조례 원문",
      ...(mixedUseZones ? ["복수 필지 혼합 용도지역별 적용면적 및 규제 분리"] : []),
      officialDocuments.documents.some((item) => item.kind === "district-plan" && item.status === "analyzed")
        ? "지구단위계획 관련 문서를 추출했지만 해당 필지·획지별 결정도서와 변경고시 검증 필요"
        : "지구단위계획 결정도서 및 시행지침 원문 확보 필요",
      lhNotice?.rules || officialDocuments.documents.some((item) => item.kind === "lh-notice" && item.status === "analyzed")
        ? "LH 관련 문서를 추출했지만 해당 지역본부·공급유형·공고 연도와 인수기준 대조 필요"
        : "해당 연도 LH 지역본부 매입공고 원문 확보 필요",
      "일조·인동거리·소방활동공간 배치 검토",
    ],
  });
}
