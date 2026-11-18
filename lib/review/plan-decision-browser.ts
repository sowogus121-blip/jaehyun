/**
 * 브라우저에서 토지이음(eum.go.kr)을 직접 읽는 결정고시 백엔드.
 * 토지이음은 서버(클라우드 IP) 접속을 막는 경우가 있지만 사용자 브라우저에서는 열리고,
 * 목록·상세·첨부 다운로드 모두 교차 출처 읽기가 허용된다.
 * - PDF: pdf.js(CDN)로 브라우저에서 바로 텍스트 추출
 * - HWP/HWPX: 서버(/api/plan-decision step=text)로 보내 추출
 */
import { eucKrEncode, parseGosiList, parseGosiDetail, decisionKeywords, pickDecisionRows } from "./eum-shared";
import { findParcelBlock, findBuildingRule, buildingTableUnchanged } from "./gosi-decision";
import type { DecisionBackend, ScanResult } from "./plan-decision";

const EUM = "https://www.eum.go.kr";
const PDFJS = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.min.mjs";
const PDFJS_WORKER = "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.2.67/build/pdf.worker.min.mjs";

async function getEuc(url: string, ms = 20_000): Promise<string> {
  const r = await fetch(url, { signal: AbortSignal.timeout(ms) });
  if (!r.ok) throw new Error(`토지이음 HTTP ${r.status}`);
  return new TextDecoder("euc-kr").decode(await r.arrayBuffer());
}

async function download(seq: string, path: string): Promise<Uint8Array> {
  const body = `file=${eucKrEncode(path).replace(/%2F/g, "/")}&gosi=Y&seq=${seq}&mobile_yn=`;
  const r = await fetch(`${EUM}/web/FileDownload.do`, { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body, signal: AbortSignal.timeout(60_000) });
  if (!r.ok) throw new Error(`첨부 HTTP ${r.status}`);
  return new Uint8Array(await r.arrayBuffer());
}

type PdfJs = {
  GlobalWorkerOptions: { workerSrc: string };
  getDocument(src: { data: Uint8Array }): { promise: Promise<{ numPages: number; getPage(n: number): Promise<{ getTextContent(): Promise<{ items: Array<{ str: string; transform: number[] }> }> }> }> };
};
let pdfjs: PdfJs | null = null;
async function loadPdfJs(): Promise<PdfJs> {
  if (pdfjs) return pdfjs;
  // 번들러가 CDN 주소를 묶지 않도록 런타임 import
  const dynImport = new Function("u", "return import(u)") as (u: string) => Promise<PdfJs>;
  const m = await dynImport(PDFJS);
  m.GlobalWorkerOptions.workerSrc = PDFJS_WORKER;
  pdfjs = m;
  return m;
}

/** pdf.js 글자 조각을 y좌표 기준으로 줄 단위로 묶는다 (결정조서 표의 한 행 = 한 줄) */
export async function pdfToText(bytes: Uint8Array): Promise<string> {
  const lib = await loadPdfJs();
  const doc = await lib.getDocument({ data: bytes }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const content = await (await doc.getPage(i)).getTextContent();
    const lines: string[] = [];
    let cur = "";
    let lastY: number | null = null;
    for (const it of content.items) {
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 2) { lines.push(cur); cur = ""; }
      cur += (cur && !cur.endsWith(" ") ? " " : "") + it.str;
      lastY = y;
    }
    lines.push(cur);
    pages.push(lines.join("\n"));
  }
  return pages.join("\n");
}

async function serverText(bytes: Uint8Array, name: string): Promise<string> {
  const form = new FormData();
  form.append("file", new Blob([bytes as BlobPart]), name);
  const r = await fetch("/api/plan-decision?step=text", { method: "POST", body: form });
  const j = await r.json() as { text?: string; error?: string };
  if (!r.ok || j.error) throw new Error(j.error ?? `HTTP ${r.status}`);
  return j.text ?? "";
}

const textCache = new Map<string, { text: string; title: string; gosiNo: string; date: string | null; errors: string[] }>();

async function gosiText(seq: string) {
  const hit = textCache.get(seq);
  if (hit) return hit;
  const detail = parseGosiDetail(await getEuc(`${EUM}/web/gs/gv/gvGosiDet.jsp?seq=${seq}`), seq);
  const errors: string[] = [];
  const texts = [detail.body];
  const files = detail.attachments
    .filter((a) => ["pdf", "hwpx", "hwp"].includes(a.ext) && !/도면|고시도|위치도|계획도|결정도|조감도/.test(a.name))
    .sort((a, b) => Number(/고시문|조서|지침|결정/.test(b.name)) - Number(/고시문|조서|지침|결정/.test(a.name)))
    .slice(0, 3);
  for (const a of files) {
    try {
      const bytes = await download(seq, a.path);
      texts.push(a.ext === "pdf" ? await pdfToText(bytes) : await serverText(bytes, a.name));
    } catch (e) { errors.push(`${a.name}: ${e instanceof Error ? e.message : "실패"}`); }
  }
  const value = { text: texts.join("\n"), title: detail.title, gosiNo: detail.gosiNo, date: detail.date, errors };
  if (!errors.length) textCache.set(seq, value);
  return value;
}

export const browserBackend: DecisionBackend = {
  async list(address, names) {
    const keywords = decisionKeywords(address, names);
    const rows = new Map<string, ReturnType<typeof parseGosiList>[number]>();
    for (const kw of keywords.slice(0, 3)) {
      for (let page = 1; page <= 3; page++) {
        const html = await getEuc(`${EUM}/web/gs/gv/gvGosiList.jsp?zonenm=${eucKrEncode(kw)}&selSggCd=&pageNo=${page}`);
        const got = parseGosiList(html);
        for (const r of got) rows.set(r.seq, r);
        if (got.length < 10) break;
      }
    }
    return { keywords, rows: pickDecisionRows([...rows.values()]) };
  },
  async scan(seq, place, lot, label): Promise<ScanResult> {
    const g = await gosiText(seq);
    const parcel = findParcelBlock(g.text, place, lot);
    const useLabel = label ?? parcel?.label ?? null;
    return {
      seq, gosiNo: g.gosiNo, title: g.title, date: g.date, url: `${EUM}/web/gs/gv/gvGosiDet.jsp?seq=${seq}`,
      parcel, rule: useLabel ? findBuildingRule(g.text, useLabel) : null, ruleUnchanged: buildingTableUnchanged(g.text),
      placeMention: g.text.replace(/\s+/g, "").includes(place), errors: g.errors,
    };
  },
};

/** 브라우저에서 토지이음을 직접 읽을 수 있는지 (교차 출처 읽기 허용 여부) */
export async function browserCanReachEum(): Promise<boolean> {
  try { const r = await fetch(`${EUM}/web/gs/gv/gvGosiList.jsp?pageNo=1`, { signal: AbortSignal.timeout(10_000) }); return r.ok; } catch { return false; }
}
