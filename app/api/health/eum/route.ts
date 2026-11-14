import { NextResponse } from "next/server";
import { eucKrEncode } from "../../../../lib/server/eum-gosi";

export const runtime = "nodejs";
export const preferredRegion = "icn1";
export const dynamic = "force-dynamic";

/** 토지이음 고시정보 연결 점검 (응답시간·상태). 키·개인정보 없음. */
export async function GET() {
  const url = `https://www.eum.go.kr/web/gs/gv/gvGosiList.jsp?zonenm=${eucKrEncode("지구단위")}&selSggCd=41410&pageNo=1`;
  const variants: Array<[string, Record<string, string>]> = [
    ["app-ua", { "User-Agent": "Mozilla/5.0 (compatible; LH-Plan-Lab/0.8; +https://lh-plan-lab.vercel.app)" }],
    ["browser-ua", { "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0 Safari/537.36", "Accept-Language": "ko-KR,ko;q=0.9" }],
  ];
  const results = [];
  for (const [name, headers] of variants) {
    const t0 = Date.now();
    try {
      const r = await fetch(url, { headers, cache: "no-store", signal: AbortSignal.timeout(15_000) });
      const len = (await r.arrayBuffer()).byteLength;
      results.push({ name, status: r.status, bytes: len, ms: Date.now() - t0 });
    } catch (e) {
      results.push({ name, error: e instanceof Error ? e.message : String(e), ms: Date.now() - t0 });
    }
  }
  return NextResponse.json({ region: process.env.VERCEL_REGION ?? null, results });
}
