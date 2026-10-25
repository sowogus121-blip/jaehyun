import { NextRequest, NextResponse } from "next/server";
import { findSitePreset } from "@/lib/site-presets";

type VWorldItem = {
  title?: string;
  address?: { road?: string; parcel?: string };
  point?: { x?: string; y?: string };
};

function plainText(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();
}

function normalizeParcelSpacing(value: string) {
  return value.trim().replace(/([가-힣]+(?:동|읍|면|리))\s*(\d)/, "$1 $2").replace(/\s+/g, " ");
}

async function searchVWorld(query: string, type: "address" | "district", key: string, domain: string) {
  let lastError: Error | null = null;
  const categories = type === "address" ? ["parcel", "road"] : [null];
  for (const category of categories) {
    const params = new URLSearchParams({
      service: "search",
      request: "search",
      version: "2.0",
      size: "10",
      page: "1",
      query,
      type,
      format: "json",
      errorformat: "json",
      key,
      domain,
    });
    if (category) params.set("category", category);
    try {
      const response = await fetch(`https://api.vworld.kr/req/search?${params.toString()}`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      if (data?.response?.status === "ERROR") {
        const apiError = data.response.error;
        throw new Error(`${apiError?.code ? `${apiError.code} · ` : ""}${apiError?.text || "VWorld 요청이 거부되었습니다."}`);
      }
      const items = (data?.response?.result?.items ?? []) as VWorldItem[];
      if (items.length) return items;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error("알 수 없는 오류");
    }
  }
  if (lastError) throw lastError;
  return [];
}

function presetResponse(preset: NonNullable<ReturnType<typeof findSitePreset>>, point: VWorldItem["point"] | null = null) {
  return {
    status: point ? "verified" : "document-verified",
    address: preset.address,
    parcelAddress: preset.address,
    point,
    source: point ? "국가공간정보포털 VWorld + 업로드 공식문서" : preset.source,
    siteDetails: {
      id: preset.id,
      province: preset.province,
      district: preset.district,
      siteArea: preset.siteArea,
      landCategory: preset.landCategory,
      zone: preset.zone,
      districtPlan: preset.districtPlan,
      publicPricePerSqm: preset.publicPricePerSqm,
      publicPriceBase: preset.publicPriceBase,
      roads: preset.roads,
      planningRoadWidth: preset.planningRoadWidth,
      restrictions: preset.restrictions,
      landscape: preset.landscape,
      buildingCoverageRatioAssumption: preset.buildingCoverageRatioAssumption,
      farAssumption: preset.farAssumption,
      source: preset.source,
      confirmedAt: preset.confirmedAt,
      warnings: preset.warnings,
    },
  };
}

export async function GET(request: NextRequest) {
  const rawQuery = request.nextUrl.searchParams.get("query")?.trim();
  if (!rawQuery) return NextResponse.json({ error: "주소를 입력해 주세요." }, { status: 400 });

  const query = normalizeParcelSpacing(rawQuery);
  const preset = findSitePreset(query);
  const apiKey = request.headers.get("x-vworld-api-key")?.trim() || process.env.VWORLD_API_KEY;

  if (preset && !apiKey) return NextResponse.json(presetResponse(preset));
  if (!apiKey) {
    return NextResponse.json(
      { status: "integration-required", error: "일반 주소 자동보정에는 VWorld API 키가 필요합니다." },
      { status: 503 },
    );
  }

  try {
    const province = request.nextUrl.searchParams.get("province")?.trim() ?? "";
    const district = request.nextUrl.searchParams.get("district")?.trim() ?? "";
    const candidates = [preset?.address, query];
    if (province && district && !query.includes(district)) candidates.push(`${province} ${district} ${query}`);

    let item: VWorldItem | undefined;
    let resolvedQuery = query;
    for (const candidate of [...new Set(candidates.filter(Boolean) as string[])]) {
      const results = await searchVWorld(candidate, "address", apiKey, request.nextUrl.origin);
      if (results[0]) {
        item = results[0];
        resolvedQuery = candidate;
        break;
      }
    }

    if (!item) {
      const parcelMatch = query.match(/([가-힣]+(?:동|읍|면|리))\s+(\d+(?:-\d+)?)/);
      if (parcelMatch) {
        const [, neighborhood, parcel] = parcelMatch;
        const districts = await searchVWorld(neighborhood, "district", apiKey, request.nextUrl.origin);
        for (const districtItem of districts.slice(0, 10)) {
          const region = plainText(districtItem.title || districtItem.address?.parcel || "");
          if (!region) continue;
          const expanded = `${region} ${parcel}`;
          const results = await searchVWorld(expanded, "address", apiKey, request.nextUrl.origin);
          if (results[0]) {
            item = results[0];
            resolvedQuery = expanded;
            break;
          }
        }
      }
    }

    if (!item) {
      if (preset) return NextResponse.json(presetResponse(preset));
      return NextResponse.json({ error: `‘${query}’의 지번주소를 찾지 못했습니다. 시·군·구를 함께 입력해 주세요.` }, { status: 404 });
    }

    if (preset) return NextResponse.json({ ...presetResponse(preset, item.point ?? null), resolvedQuery });
    return NextResponse.json({
      status: "verified",
      address: item.address?.road || item.address?.parcel || plainText(item.title || query),
      parcelAddress: item.address?.parcel ?? null,
      point: item.point ?? null,
      source: "국가공간정보포털 VWorld",
      resolvedQuery,
      siteDetails: null,
    });
  } catch (error) {
    if (preset) return NextResponse.json(presetResponse(preset));
    return NextResponse.json(
      { status: "unknown", error: `공공 주소 API 조회 실패: ${error instanceof Error ? error.message : "알 수 없는 오류"}` },
      { status: 502 },
    );
  }
}
