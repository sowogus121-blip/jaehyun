import { NextRequest, NextResponse } from "next/server";

export async function GET(request: NextRequest) {
  const query = request.nextUrl.searchParams.get("query")?.trim();
  if (!query) return NextResponse.json({ error: "주소를 입력해 주세요." }, { status: 400 });

  const apiKey = request.headers.get("x-vworld-api-key")?.trim() || process.env.VWORLD_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      {
        status: "integration-required",
        error: "VWorld API 키가 연결되지 않았습니다. 입력값은 유지되며 자동 판정은 수행하지 않습니다.",
      },
      { status: 503 },
    );
  }

  const params = new URLSearchParams({
    service: "search",
    request: "search",
    version: "2.0",
    size: "5",
    page: "1",
    query,
    type: "address",
    format: "json",
    errorformat: "json",
    key: apiKey,
  });

  try {
    const response = await fetch(`https://api.vworld.kr/req/search?${params.toString()}`, {
      headers: { Accept: "application/json" },
      cache: "no-store",
    });
    if (!response.ok) throw new Error(`VWorld ${response.status}`);
    const data = await response.json();
    const item = data?.response?.result?.items?.[0];
    if (!item) return NextResponse.json({ error: "일치하는 주소를 찾지 못했습니다." }, { status: 404 });
    return NextResponse.json({
      status: "verified",
      address: item.address?.road || item.address?.parcel || item.title,
      parcelAddress: item.address?.parcel ?? null,
      point: item.point ?? null,
      source: "국가공간정보포털 VWorld",
    });
  } catch {
    return NextResponse.json(
      { status: "unknown", error: "공공 주소 API 응답을 확인하지 못했습니다. 수동 입력값을 사용해 주세요." },
      { status: 502 },
    );
  }
}
