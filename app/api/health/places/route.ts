import { NextRequest, NextResponse } from "next/server";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
/** 임시 점검: 대상지 주변 VWorld 장소검색 결과의 이름·분류만 */
export async function GET(req: NextRequest) {
  const x = Number(req.nextUrl.searchParams.get("x")); const y = Number(req.nextUrl.searchParams.get("y"));
  const q = req.nextUrl.searchParams.get("q") ?? "역";
  const key = process.env.VWORLD_API_KEY ?? "";
  const r = 1200, dLat = r / 111320, dLon = r / (111320 * Math.cos(y * Math.PI / 180));
  const params = new URLSearchParams({ service: "search", request: "search", version: "2.0", crs: "EPSG:4326", bbox: `${x - dLon},${y - dLat},${x + dLon},${y + dLat}`, size: "100", page: "1", query: q, type: "place", format: "json", errorformat: "json", key, domain: req.nextUrl.origin });
  const data = await (await fetch(`https://api.vworld.kr/req/search?${params}`, { cache: "no-store" })).json();
  const items = (data?.response?.result?.items ?? []).map((i: { title: string; category: string; point: { x: string; y: string } }) => [i.title, i.category, Math.round(Math.hypot((Number(i.point.x) - x) * 111320 * Math.cos(y * Math.PI / 180), (Number(i.point.y) - y) * 111320))]);
  return NextResponse.json({ status: data?.response?.status, total: data?.response?.record?.total, items: items.sort((a: number[], b: number[]) => a[2] - b[2]).slice(0, 40) });
}
