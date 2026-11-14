import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const preferredRegion = "icn1";

/** 공식 PDF(공고문 등)에서 검색어가 든 줄을 쪽 번호와 함께 돌려준다 (원문 대조용). */
const ALLOW = /^https:\/\/([a-z0-9-]+\.)*(go\.kr|lh\.or\.kr)\//i;

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get("url") ?? "";
  const q = (request.nextUrl.searchParams.get("q") ?? "").slice(0, 120);
  if (!ALLOW.test(url) || !q) return NextResponse.json({ error: "공공기관 PDF 주소와 검색어가 필요합니다." }, { status: 400 });
  let re: RegExp;
  try { re = new RegExp(q); } catch { return NextResponse.json({ error: "검색어 형식 오류" }, { status: 400 }); }
  try {
    const res = await fetch(url, { cache: "no-store", redirect: "follow", signal: AbortSignal.timeout(15_000) });
    if (!res.ok) throw new Error(`원본 PDF HTTP ${res.status}`);
    const data = new Uint8Array(await res.arrayBuffer());
    if (!(data[0] === 0x25 && data[1] === 0x50)) throw new Error("PDF가 아닙니다");
    const { PDFParse } = await import("pdf-parse");
    const parser = new PDFParse({ data });
    try {
      const r = await parser.getText() as unknown as { pages?: Array<{ num: number; text: string }> };
      const hits: Array<{ page: number; line: string }> = [];
      for (const p of r.pages ?? []) for (const line of p.text.split(/\n/)) if (re.test(line)) hits.push({ page: p.num, line: line.trim().slice(0, 400) });
      return NextResponse.json({ pages: r.pages?.length ?? 0, hits: hits.slice(0, 80) });
    } finally { await parser.destroy(); }
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "추출 실패" }, { status: 502 });
  }
}
