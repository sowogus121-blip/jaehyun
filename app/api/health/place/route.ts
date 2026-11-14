import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

/** VWorld 장소검색 점검: 이름으로 검색해 제목·분류·좌표만 돌려준다 (키는 노출하지 않음). */
export async function GET(request: NextRequest) {
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 60);
  const type = request.nextUrl.searchParams.get("type") === "address" ? "address" : "place";
  const key = process.env.VWORLD_API_KEY ?? "";
  const domain = request.nextUrl.origin;
  if (!q || !key) return NextResponse.json({ error: "검색어 또는 서버 키 없음" }, { status: 400 });
  const params = new URLSearchParams({ service: "search", request: "search", version: "2.0", crs: "EPSG:4326", size: "30", page: "1", query: q, type, format: "json", errorformat: "json", key, domain });
  if (type === "address") params.set("category", "road");
  const res = await fetch(`https://api.vworld.kr/req/search?${params}`, { cache: "no-store", signal: AbortSignal.timeout(10_000) });
  const data = await res.json().catch(() => null) as { response?: { status?: string; result?: { items?: Array<Record<string, unknown>> } } } | null;
  const items = (data?.response?.result?.items ?? []).map((i) => ({ title: i.title, category: i.category, point: i.point, address: i.address }));
  return NextResponse.json({ status: data?.response?.status, items });
}
