import { NextRequest, NextResponse } from "next/server";
import { findZoningStandard } from "../../../lib/zoning-standards";
import { searchOfficialSources } from "../../../lib/server/official-search";
import { collectOfficialDocuments } from "../../../lib/server/official-document-ingest";
import { findLatestLhPurchaseNotice } from "../../../lib/server/lh-notice";
import { normalizeAssemblyAddresses, MAX_EXTRA_PARCELS } from "../../../lib/parcel-assembly";
import type { OrdinanceArticleCandidate } from "../../../lib/server/ordinance-articles";
import { fetchJson, fetchLawPayload, searchLaw, searchOrdinance, lawGovernmentFromAddress, localGovernmentFromAddress, type LawRecord, type OrdinanceRecord } from "../../../lib/server/law-api";
import { extractOrdinanceArticles, findArticleByNumber, findArticlesByKeyword } from "../../../lib/server/ordinance-articles";
import { collectSiteFacts } from "../../../lib/server/site-facts";
import { classifyDesignations } from "../../../lib/review/special-zones";
import { NATIONAL_ARTICLES, NATIONAL_LAWS, ORDINANCE_TOPICS, type CollectedArticle } from "../../../lib/review/collect-topics";
import { findLhPurchaseNotice, noticeIsOpen, koreaLocalDay } from "../../../lib/metro-annex-lh-catalog";

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
  "주차장법 시행령",
  "주차장법 시행규칙",
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
      const items = (data?.response?.result?.items ?? []) as Array<{point?:{x?:number|string;y?:number|string};address?:{road?:string;parcel?:string};title?:string}>;
      // A postcode/parcel query can return a nearby address as its first VWorld hit.
      // Never infer geometry and FAR for a *different cadastral lot*.
      const parseLot = (raw: string) => {
        const m = raw.trim().match(/([가-힣0-9]+(?:동\d*가|동|읍|면|리|가))\s+(산\s*)?(\d+(?:-\d+)?)$/);
        return m ? {dong:m[1],mountain:Boolean(m[2]),lot:m[3]} : null;
      };
      const expectedLot=parseLot(address);
      // Require district + cadastral-dong + 산번지 flag + main/sub lot number.
      // Same number in 공덕동 and 아현동, or 산 1-1 vs 1-1, is a different parcel.
      const expectedDistrict=address.replace(/\s+/g,"").split(expectedLot?.dong ?? "\u0000")[0];
      const candidateMatches=(candidate: typeof items[number])=>{
        if(!candidate.point?.x || !candidate.point?.y)return false;
        if(!expectedLot)return true; // road address fallback
        const returned=candidate.address?.parcel||"";
        const actual=parseLot(returned);
        if(!actual || actual.dong!==expectedLot.dong || actual.lot!==expectedLot.lot ||
          actual.mountain!==expectedLot.mountain)return false;
        const compact=returned.replace(/\s+/g,"");
        // Short VWorld cadastral labels do not include parent district; otherwise
        // don't allow a same-named dong from a different 시군구.
        if(returned.includes(" ") && (returned.includes("특별시")||returned.includes("광역시")||returned.includes("경기도")||returned.includes("경상")||returned.includes("충청"))){
          if(expectedDistrict && !compact.startsWith(expectedDistrict))return false;
        }
        return true;
      };
      const item=items.find(candidateMatches);
      if (!item?.point?.x || !item?.point?.y) {
        if (expectedLot && items.length) lastError = new Error(`VWorld의 조회 결과가 입력한 ${expectedLot.dong} ${expectedLot.mountain?"산 ":""}${expectedLot.lot}과 다릅니다. 다른 법정동 또는 산번지의 면적·법규를 합산하지 않았습니다.`);
        continue;
      }
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
  // VWorld LT_C_UQ111 returns both a broad '도시지역' and a detailed
  // 용도지역 at the same point. These are hierarchy, not mixed zoning.
  const detailedZone=values.some(v=>v.category==="용도지역" && !["도시지역","관리지역","농림지역","자연환경보전지역"].includes(v.name));
  const specificValues=detailedZone ? values.filter(v=>v.category!=="용도지역" ||
    !["도시지역","관리지역","농림지역","자연환경보전지역"].includes(v.name)) : values;
  const errors = results.flatMap((result) => result.status === "rejected"
    ? [result.reason instanceof Error ? result.reason.message : "알 수 없는 오류"]
    : []);
  return {
    items: specificValues.filter((item, index) => specificValues.findIndex((candidate) => `${candidate.code}-${candidate.name}` === `${item.code}-${item.name}`) === index),
    errors: [...new Set(errors)],
  };
}

function geometryBox(geometry: { coordinates?: unknown } | undefined): [number, number, number, number] | undefined {
  const points: number[][] = [];
  const walk = (v: unknown) => { if (Array.isArray(v) && typeof v[0] === "number") points.push(v as number[]); else if (Array.isArray(v)) v.forEach(walk); };
  walk(geometry?.coordinates);
  if (!points.length) return undefined;
  return [Math.min(...points.map((p) => p[0])), Math.min(...points.map((p) => p[1])), Math.max(...points.map((p) => p[0])), Math.max(...points.map((p) => p[1]))];
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
        bbox: geometryBox(feature.geometry),
      };
    } catch {
      // Some VWorld keys do not include cadastral data access; continue with land-use review.
    }
  }
  return null;
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { address?: string; parcelAddresses?: string[]; businessMode?: string; regionalOffice?: string; lhSupplyType?: string } | null;
  const address = body?.address?.trim();
  if (!address) return NextResponse.json({ error: "검토할 주소가 필요합니다." }, { status: 400 });

  const vworldKey = getHeaderOrEnv(request, "x-vworld-api-key", "VWORLD_API_KEY");
  const lawOc = getHeaderOrEnv(request, "x-law-api-oc", "LAW_OPEN_API_OC");
  const missing: string[] = [];
  const errors: string[] = [];
  if (!vworldKey) missing.push("VWORLD_API_KEY");
  if (!lawOc) missing.push("LAW_OPEN_API_OC");

  let location: Awaited<ReturnType<typeof geocode>> | null = null;
  let parcel: Awaited<ReturnType<typeof getParcelInfo>> = null;
  let landUse: ParcelReview["landUse"] = [];
  if (vworldKey) {
    try {
      location = await geocode(address, vworldKey, request.nextUrl.origin);
      const [vworldLandUse, vworldParcel] = await Promise.all([
        getLandUse(location.x, location.y, vworldKey, request.nextUrl.origin),
        getParcelInfo(location.x, location.y, vworldKey, request.nextUrl.origin),
      ]);
      parcel = vworldParcel;
      // The live zoning layer takes precedence over a cached preset; never mix historically conflicting zone names.
      landUse = vworldLandUse.items;
      if (vworldLandUse.errors.length) errors.push(`VWorld 용도지역 일부 조회 실패: ${vworldLandUse.errors.join(" / ")}`);
      if (vworldLandUse.items.length === 0) errors.push("VWorld 좌표는 확인했지만 해당 위치의 용도지역 응답이 없습니다.");
    } catch (error) {
      errors.push(`VWorld 조회 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}`);
    }
  }

  // 대지 현황 자동 수집: 토지특성(공부 면적·도로접면), 인접 도로, 건축물대장·인허가
  const dataKey = process.env.DATA_GO_KR_API_KEY?.trim() ?? "";
  const siteFactsPromise = collectSiteFacts({ pnu: parcel?.pnu ?? null, bbox: parcel?.bbox ?? null, vworldKey, domain: request.nextUrl.origin, dataKey });

  // "독산동 151-10"처럼 시·도를 생략한 입력도 VWorld가 돌려준 전체 지번주소로 관할 지자체·LH 본부를 판정한다.
  const fullAddress = location?.parcelAddress && location.parcelAddress.trim().split(/\s+/).length >= 3 ? location.parcelAddress.trim() : address;
  const parcels: ParcelReview[] = [{ inputAddress: address, location, parcel, landUse, errors: [] }];
  const rawAdditional = Array.isArray(body?.parcelAddresses) ? body.parcelAddresses : [];
  if (rawAdditional.some(item => typeof item !== "string")) return NextResponse.json({error:"합필 대상 주소는 문자열 목록이어야 합니다."},{status:400});
  const additionalAddresses = normalizeAssemblyAddresses(fullAddress, rawAdditional);
  if (additionalAddresses.length > MAX_EXTRA_PARCELS) return NextResponse.json({error:`합필은 대표 필지를 포함해 최대 ${MAX_EXTRA_PARCELS + 1}필지까지 검토할 수 있습니다. 현재 추가 필지 ${additionalAddresses.length}개입니다.`},{status:400});
  const inspectAdditionalParcel = async (parcelAddress: string): Promise<ParcelReview> => {
    if (!vworldKey) return { inputAddress: parcelAddress, location: null, parcel: null, landUse: [], errors: ["VWorld API 키가 없어 필지를 조회하지 못했습니다."] };
    try {
      const additionalLocation = await geocode(parcelAddress, vworldKey, request.nextUrl.origin);
      const [additionalUse, cadastral] = await Promise.all([
        getLandUse(additionalLocation.x, additionalLocation.y, vworldKey, request.nextUrl.origin),
        getParcelInfo(additionalLocation.x, additionalLocation.y, vworldKey, request.nextUrl.origin),
      ]);
      return { inputAddress: parcelAddress, location: additionalLocation, parcel: cadastral, landUse: additionalUse.items, errors: additionalUse.errors };
    } catch (error) {
      return { inputAddress: parcelAddress, location: null, parcel: null, landUse: [], errors: [error instanceof Error ? error.message : "필지 조회 실패"] };
    }
  };
  // Limit concurrent VWorld calls; a 20-parcel request could otherwise fan out
  // hundreds of national spatial API calls and cause rate limiting.
  const additionalReviews: ParcelReview[] = [];
  for (let offset = 0; offset < additionalAddresses.length; offset += 5) {
    const batch = await Promise.all(additionalAddresses.slice(offset, offset+5).map(inspectAdditionalParcel));
    additionalReviews.push(...batch);
  }
  parcels.push(...additionalReviews);
  if (additionalReviews.length) {
    landUse = parcels.flatMap((item) => item.landUse).filter((item, index, all) => all.findIndex((candidate) => `${candidate.category}-${candidate.name}` === `${item.category}-${item.name}`) === index);
    const seenPnus = new Set<string>();
    let duplicatePnu = false;
    for (const item of parcels) {
      const pnu = item.parcel?.pnu;
      if (pnu) {
        if (seenPnus.has(pnu)) { duplicatePnu = true; item.errors.push("이미 포함된 동일 PNU 필지"); }
        seenPnus.add(pnu);
      }
    }
    const mainMunicipality = localGovernmentFromAddress(fullAddress);
    const mixedJurisdiction = parcels.some(item => localGovernmentFromAddress(item.location?.parcelAddress ?? item.location?.address ?? item.inputAddress) !== mainMunicipality);
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
        bbox: undefined,
      };
    } else {
      // Never leak the primary parcel area into a supposedly combined feasibility study.
      parcel = null;
    }
  }

  const zoneNames = [...new Set(landUse.filter((item) => item.category === "용도지역").map((item) => item.name))];
  const mixedUseZones = zoneNames.length > 1;
  const planningStandards = mixedUseZones ? null : findZoningStandard(zoneNames);
  const districtPlan = landUse.some((item) => item.code === "LT_C_UPISUQ161" || item.name.includes("지구단위계획"));
  const localGovernment = lawGovernmentFromAddress(fullAddress);
  const districtForLh = localGovernment.split(/\s+/).filter(Boolean).at(-1) ?? "";
  const lhNoticePromise = findLatestLhPurchaseNotice(districtForLh, localGovernment)
    .then((notice) => ({ notice, error: null as string | null }))
    .catch((error: unknown) => ({ notice: null, error: error instanceof Error ? error.message : "LH 공고 조회 실패" }));
  const webSearchPromise = siteFactsPromise.then((facts) => {
    const matches = classifyDesignations(facts.designations ?? []);
    const extraQueries = matches.filter((m) => m.rule?.search).flatMap((m) => m.designations.slice(0, 1).map((d) => `${localGovernment} ${d.name} ${m.rule!.search}`));
    return searchOfficialSources({ address: fullAddress, localGovernment, businessMode: body?.businessMode, regionalOffice: body?.regionalOffice, extraQueries });
  });

  let laws: LawRecord[] = [];
  let ordinances: OrdinanceRecord[] = [];
  if (lawOc) {
    const district = localGovernment.split(/\s+/).filter(Boolean).at(-1) ?? localGovernment;
    const metro = localGovernment.split(/\s+/)[0];
    const metropolitan = /(?:특별시|광역시|특별자치시)$/.test(metro);
    const kinds = ["건축 조례", "주차장 설치 및 관리 조례", "도시계획 조례", "경관 조례"];
    // The metropolitan ordinance governs urban planning and commonly parking,
    // while borough-level ordinances can add separate local restrictions.
    // Ask both authorities rather than searching for '서구 도시계획 조례' alone.
    const ordinanceQueries = metropolitan
      ? [
          ...kinds.map(suffix=>({query:`${localGovernment} ${suffix}`,jurisdiction:localGovernment})),
          ...kinds.map(suffix=>({query:`${metro} ${suffix}`,jurisdiction:metro})),
        ]
      : kinds.map(suffix=>({query:`${district} ${suffix}`,jurisdiction:localGovernment}));
    const specialLaws = classifyDesignations((await siteFactsPromise).designations ?? [])
      .flatMap((m) => m.rule ? m.rule.law.split(" · ").map((x) => x.replace(/\s*제\d.*$/, "").trim()) : [])
      .filter((name) => name && !LAW_QUERIES.includes(name) && !/조례/.test(name));
    const [settled, ordinanceSettled] = await Promise.all([
      Promise.allSettled([...LAW_QUERIES, ...new Set(specialLaws)].map((query) => searchLaw(query, lawOc))),
      Promise.allSettled(ordinanceQueries.map(({query,jurisdiction}) => searchOrdinance(query, lawOc, jurisdiction))),
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
    // Optional metro / borough ordinance subjects may not exist locally.
    // A successful 0-result search is not a service failure.
    const ordinanceFailures=ordinanceSettled.flatMap(result=>result.status==="rejected"
      ? [result.reason instanceof Error?result.reason.message:"알 수 없는 오류"] : []);
    if(ordinanceFailures.length)
      errors.push(`관할 자치법규 요청 ${ordinanceFailures.length}건 오류: ${[...new Set(ordinanceFailures)].join(" / ")}`);
    if(!ordinances.length && !ordinanceFailures.length)
      errors.push("관할 도시계획·건축·주차장 조례를 찾지 못해 용적률·건폐율 확정을 보류했습니다.");
  }
  // 규모검토 필요 조문 자동 수집: 국가법령 핵심 조항 + 관할 조례 주제별 조문 (원문 그대로, 적용 판정 없음)
  const collected: CollectedArticle[] = [];
  let nationalArticleCandidates: OrdinanceArticleCandidate[] = [];
  if (lawOc) {
    const targets = laws.filter((item) => NATIONAL_LAWS.includes(item.name) || ["공공주택 특별법 시행령", "주택건설기준 등에 관한 규정"].includes(item.name));
    const results = await Promise.allSettled(targets.map((item) => fetchLawPayload("law", item, lawOc)));
    results.forEach((result, index) => {
      if (result.status !== "fulfilled" || !result.value) return;
      const law = targets[index];
      law.retrievalStatus = "full-text";
      if (["공공주택 특별법 시행령", "주택건설기준 등에 관한 규정"].includes(law.name))
        nationalArticleCandidates.push(...extractOrdinanceArticles(result.value, law.name, law.link));
      for (const target of NATIONAL_ARTICLES.filter((a) => a.law === law.name)) {
        const found = findArticleByNumber(result.value, target.no, target.branch);
        if (found) collected.push({ topic: target.label, rowId: target.rowId, title: law.name, url: law.link, effectiveDate: law.enforcementDate, article: found.article, text: found.text.slice(0, 2500), kind: "law" });
      }
    });
    const failed = results.filter((result) => result.status === "rejected");
    if (failed.length) errors.push(`국가법령 본문 조회 ${failed.length}건 실패`);
    nationalArticleCandidates = nationalArticleCandidates.slice(0, 120);
  }
  // Reading the official full text is a separate step from finding its title.
  // Keyword matches remain unverified candidates; applicability is NOT inferred.
  let ordinanceArticleCandidates: OrdinanceArticleCandidate[] = [];
  if (lawOc && ordinances.length) {
    const detailResults = await Promise.allSettled(ordinances.map((ordinance) => fetchLawPayload("ordin", ordinance, lawOc)));
    const detailErrors = detailResults.flatMap((result) => result.status === "rejected"
      ? [result.reason instanceof Error ? result.reason.message : "자치법규 원문 요청 오류"]
      : []);
    if (detailErrors.length) errors.push(`자치법규 본문 조회 ${detailErrors.length}건 실패: ${[...new Set(detailErrors)].join(" / ")}`);
    detailResults.forEach((result, index) => {
      if (result.status !== "fulfilled" || !result.value) return;
      const ordinance = ordinances[index];
      ordinance.retrievalStatus = "full-text";
      ordinanceArticleCandidates.push(...extractOrdinanceArticles(result.value, ordinance.name, ordinance.link));
      const subject = ordinance.name.includes("주차장") ? "주차장" : ordinance.name.includes("도시계획") ? "도시계획" : ordinance.name.replace(/\s+/g, "").endsWith("건축조례") ? "건축" : null;
      for (const topic of ORDINANCE_TOPICS.filter((t) => t.ordinance === subject)) {
        for (const found of findArticlesByKeyword(result.value, topic.terms, 2)) {
          if (collected.some((c) => c.title === ordinance.name && c.article === found.article && c.rowId === topic.rowId)) continue;
          collected.push({ topic: topic.label, rowId: topic.rowId, title: ordinance.name, url: ordinance.link, effectiveDate: ordinance.enforcementDate, article: found.article, text: found.text.slice(0, 2500), kind: "ordinance" });
        }
      }
    });
  }
  const webSearch = await webSearchPromise;
  const discoveredDocuments = await collectOfficialDocuments(webSearch.results, localGovernment, fullAddress);
  const officialDocuments = discoveredDocuments;
  const lhNoticeResult = await lhNoticePromise;
  // The live LH board search can miss closed South notices or an abbreviated
  // municipality list. Fall back only to a municipality-matched, exact official
  // PDF and ZIP in the verified archival catalog. Never inherit detailed rules.
  const regionalArchivedNotice = findLhPurchaseNotice(fullAddress);
  const archivedNoticeOpen = regionalArchivedNotice ? noticeIsOpen(regionalArchivedNotice, koreaLocalDay()) : false;
  const archivalNotice = regionalArchivedNotice ? {
    id: new URL(regionalArchivedNotice.noticeUrl).searchParams.get("pchPanSn") ?? regionalArchivedNotice.id,
    title: regionalArchivedNotice.title + (archivedNoticeOpen ? " (공고기간 내 · 지역별 자격 별도확인)" : " (접수 종료 · 기준 참고용)"),
    url: regionalArchivedNotice.noticeUrl,
    pdfUrl: regionalArchivedNotice.noticePdfUrl,
    guideUrl: regionalArchivedNotice.guidelineZipUrl,
    publishedAt: regionalArchivedNotice.publishedAt.replaceAll("-", "."),
    closesAt: regionalArchivedNotice.closeDate.replaceAll("-", "."),
    matchedDistrict: districtForLh,
    official: true as const,
    isCurrent: archivedNoticeOpen,
    rules: null,
    textAnalysisStatus: "not-extracted" as const,
    warnings: [
      "LH 공식 지역본부 공고 PDF/ZIP를 확인한 참고자료입니다. 이 필지의 LH 실제 매입 적합성 또는 시·군별 세부 공고 포함은 미확인.",
      archivedNoticeOpen ? "접수기간 중이어도 가구유형·매입가능 지역·완화조건은 원문 검토 대상입니다."
        : regionalArchivedNotice.closeDate+" 접수 종료: 이 공고를 신규 신청에 자동 적용할 수 없습니다.",
      regionalArchivedNotice.revisionNote,
    ],
  } : null;
  const lhNotice = lhNoticeResult.notice ?? archivalNotice;
  // 국토계획법 시행령 일반 상한은 참고값이다. 필지 적용 수치는 클라이언트 법규검토표에서
  // 조례 조문 추출·검증 근거 라이브러리·검토자 확인을 거쳐서만 확정된다.
  const resolvedPlanningStandards = planningStandards;
  const siteFacts = await siteFactsPromise;
  if (!dataKey) missing.push("DATA_GO_KR_API_KEY");
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
    planningStandards: resolvedPlanningStandards,
    // VWorld 지구단위계획 레이어가 비어도 토지이용계획에 '지구단위계획구역(포함·저촉)'이 있으면 구역으로 본다.
    districtPlan: districtPlan || (siteFacts.designations ?? []).some((d) => /지구단위계획/.test(d.name) && d.conflict !== "접함"),
    mixedUseZones,
    parcels,
    laws,
    ordinances,
    ordinanceArticleCandidates,
    nationalArticleCandidates,
    collected,
    siteFacts,
    // C1 use restriction is sourced to the 2026 LH guideline and user-
    // confirmed C1 map placement. It does NOT assert an official C1-2 sublot.
    ruleFindings: [],
    webSearch,
    officialDocuments,
    lhNotice,
    missing,
    deployEnv: process.env.VERCEL_ENV ?? null,
    errors,
    unresolved: [
      ordinances.length ? "관할 조례 일반 수치와 별개로 지구단위계획·주거복합 별표·특례 적용 여부 검토 필요" : "관할 지자체 건축·주차장 조례 원문",
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
