import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

/**
 * 근거 부록 '원본 이미지판': 공식 PDF(공고문·별표·고시)의 해당 쪽을 PNG로 렌더링한다.
 * 공공기관 HTTPS 주소만 허용 (*.go.kr, *.or.kr 의 LH·법령·토지이음 등).
 */
const ALLOW = /^https:\/\/([a-z0-9-]+\.)*(go\.kr|lh\.or\.kr)\//i;
const cache = new Map<string, { at: number; png: Uint8Array }>();

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? "";
  const page = Math.max(1, Math.min(400, Number(request.nextUrl.searchParams.get("page") ?? "1") || 1));
  if (!ALLOW.test(url)) return NextResponse.json({ error: "공공기관 PDF 주소만 렌더링합니다." }, { status: 400 });
  const key = `${url}#${page}`;
  const hit = cache.get(key);
  if (hit && Date.now() - hit.at < 6 * 3600_000) return png(hit.png);
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15_000), headers: { Accept: "application/pdf,application/octet-stream" } });
    if (!res.ok) throw new Error(`원본 PDF HTTP ${res.status}`);
    const data = new Uint8Array(await res.arrayBuffer());
    if (data.length > 15 * 1024 * 1024) throw new Error("PDF 용량 초과");
    if (!(data[0] === 0x25 && data[1] === 0x50 && data[2] === 0x44 && data[3] === 0x46)) throw new Error("PDF가 아닙니다");
    const { CanvasFactory } = await import("pdf-parse/worker");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data, CanvasFactory });
    try {
      const shot = await parser.getScreenshot({ partial: [page], desiredWidth: 1240, imageDataUrl: false, imageBuffer: true } as never) as unknown as { pages: Array<{ data: Uint8Array }> };
      const out = shot.pages[0]?.data;
      if (!out) throw new Error("해당 쪽을 렌더링하지 못했습니다");
      cache.set(key, { at: Date.now(), png: out });
      if (cache.size > 60) cache.delete(cache.keys().next().value!);
      return png(out);
    } finally {
      await parser.destroy();
    }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "원본 렌더링 실패" }, { status: 502 });
  }
}

function png(data: Uint8Array) {
  return new NextResponse(data as unknown as BodyInit, { headers: { "Content-Type": "image/png", "Cache-Control": "public, max-age=21600" } });
}
