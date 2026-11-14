/**
 * 토지이음(eum.go.kr) 고시정보에서 지구단위계획·정비계획 결정고시를 직접 찾아 읽는다.
 *
 * - 검색: gvGosiList.jsp?zonenm=<검색어(EUC-KR)>&selSggCd=<시군구코드> (최신순 10건/쪽)
 * - 상세: gvGosiDet.jsp?seq=… (고시번호·고시일·담당기관·고시문 본문·첨부파일)
 * - 첨부: POST /web/FileDownload.do (file, gosi=Y, seq) → PDF/HWPX만 본문 추출 (구형 HWP는 링크만)
 *
 * 공식 Open API가 아니라 공식 화면을 읽는 방식이다. 찾은 고시는 "후보"이며 이 필지·획지 적용은 판정하지 않는다.
 */
import { extractDocumentText, parseUploadedDocument, type DocumentCandidate } from "./document-parser";

const BASE = "https://www.eum.go.kr";
const UA = "Mozilla/5.0 (compatible; LH-Plan-Lab/0.8; +https://lh-plan-lab.vercel.app)";
const MAX_FILE = 8 * 1024 * 1024;

// ───────── EUC-KR 퍼센트 인코딩 (토지이음 검색어는 EUC-KR만 인식) ─────────
let eucTable: Map<string, string> | null = null;
function buildEucTable() {
  const table = new Map<string, string>();
  const decoder = new TextDecoder("euc-kr");
  for (let lead = 0x81; lead <= 0xfe; lead++) {
    for (let trail = 0x41; trail <= 0xfe; trail++) {
      const ch = decoder.decode(new Uint8Array([lead, trail]));
      if (ch.length === 1 && ch !== "�" && !table.has(ch)) {
        table.set(ch, "%" + lead.toString(16).toUpperCase() + "%" + trail.toString(16).toUpperCase());
      }
    }
  }
  return table;
}
export function eucKrEncode(value: string): string {
  eucTable ??= buildEucTable();
  let out = "";
  for (const ch of value) {
    if (/^[A-Za-z0-9\-_.~]$/.test(ch)) out += ch;
    else if (ch === " ") out += "+";
    else if (ch.charCodeAt(0) < 0x80) out += encodeURIComponent(ch);
    else out += eucTable.get(ch) ?? "";
  }
  return out;
}

function decodeText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<br\s*\/?>|<\/p>|<\/tr>|<\/li>|<\/div>/gi, "\n")
    .replace(/<\/t[dh]>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, "&")
    .replace(/[ \t ]+/g, " ")
    .replace(/\s*\n\s*/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function timed(url: string, init: RequestInit = {}, ms = 10_000) {
  const response = await fetch(url, { ...init, cache: "no-store", signal: AbortSignal.timeout(ms), headers: { "User-Agent": UA, ...(init.headers ?? {}) } });
  if (!response.ok) throw new Error(`토지이음 HTTP ${response.status}`);
  return response;
}
async function getHtml(url: string) {
  const response = await timed(url);
  return new TextDecoder("euc-kr").decode(await response.arrayBuffer());
}

// ───────── 목록 ─────────
export interface GosiListRow { seq: string; date: string | null; gosiNo: string; title: string; agency: string }
export function parseGosiList(html: string): GosiListRow[] {
  const rows: GosiListRow[] = [];
  for (const tr of html.split(/<tr class="center">/).slice(1)) {
    const link = tr.match(/gvGosiDet\.jsp\?seq=(\d+)[^'"]*['"]\s*title=['"]([^'"]*)['"]/);
    if (!link) continue;
    const date = tr.match(/<td class="mb">\s*(\d{4}-\d{2}-\d{2})\s*<\/td>/)?.[1] ?? null;
    const titles = [...tr.matchAll(/<td class="left mb" title="([^"]*)"/g)].map((m) => m[1].trim());
    rows.push({ seq: link[1], date, gosiNo: titles[0] ?? "", title: link[2].replace(/\s+/g, " ").trim(), agency: titles.at(-1) ?? "" });
  }
  return rows;
}

export async function searchGosi(keyword: string, sggCd: string | null, pages = 1): Promise<GosiListRow[]> {
  const out: GosiListRow[] = [];
  for (let page = 1; page <= pages; page++) {
    const qs = `zonenm=${eucKrEncode(keyword)}&selSggCd=${sggCd ?? ""}&pageNo=${page}`;
    const rows = parseGosiList(await getHtml(`${BASE}/web/gs/gv/gvGosiList.jsp?${qs}`));
    out.push(...rows);
    if (rows.length < 10) break;
  }
  return out;
}

// ───────── 상세 ─────────
export interface GosiDetail {
  seq: string; title: string; gosiNo: string; agency: string; date: string | null;
  body: string; attachments: Array<{ name: string; path: string; ext: string }>;
}
export function parseGosiDetail(html: string, seq: string): GosiDetail {
  const cell = (label: string) => {
    const m = html.match(new RegExp(`>${label}</th>\\s*<td[^>]*>([\\s\\S]*?)</td>`));
    return m ? decodeText(m[1]) : "";
  };
  const title = decodeText(html.match(/<thead>\s*<tr>\s*<th[^>]*>([\s\S]*?)<\/th>/)?.[1] ?? "");
  const attachments = [...html.matchAll(/download\('\/web\/FileDownload\.do',\s*'([^']+)'\)/g)].map((m) => {
    const path = m[1];
    const name = path.split("/").pop() ?? path;
    return { name, path, ext: (name.split(".").pop() ?? "").toLowerCase() };
  });
  const editView = html.indexOf('class="edit_view"');
  let body = "";
  if (editView >= 0) {
    const rest = html.slice(editView);
    const end = rest.search(/목록으로|class="btn_list|<!--\s*\/\/\s*edit_view/);
    body = decodeText("<div " + rest.slice(0, end > 0 ? end : 60_000));
  }
  return { seq, title, gosiNo: cell("고시번호"), agency: cell("담당기관"), date: cell("고시일") || null, body, attachments };
}

export function gosiUrl(seq: string) {
  return `${BASE}/web/gs/gv/gvGosiDet.jsp?seq=${seq}`;
}

async function downloadAttachment(seq: string, path: string): Promise<Uint8Array> {
  const body = new URLSearchParams({ file: path, gosi: "Y", seq, mobile_yn: "" });
  const response = await timed(`${BASE}/web/FileDownload.do`, {
    method: "POST", body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: gosiUrl(seq) },
  }, 15_000);
  const length = Number(response.headers.get("content-length") || 0);
  if (length > MAX_FILE) throw new Error("첨부 용량 제한 초과");
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.length > MAX_FILE) throw new Error("첨부 용량 제한 초과");
  return data;
}

// ───────── 대상지 기준 수집 ─────────
export interface EumPlanDocument {
  kind: "district-plan";
  title: string;
  sourceUrl: string;
  landingPage: string | null;
  status: "analyzed" | "link-only" | "failed";
  format: "pdf" | "hwpx" | "xlsx" | "html" | null;
  textLength: number;
  pageCount: number | null;
  preview: string;
  /** 고시문 본문·첨부 추출 텍스트 (근거 부록용, 최대 12,000자) */
  text?: string;
  gosiNo?: string;
  gosiDate?: string | null;
  agency?: string;
  /** 고시문에 대상지 동·지번이 직접 나오는지 */
  siteMention?: boolean;
  attachments?: Array<{ name: string; analyzed: boolean; pages: number | null }>;
  candidates: DocumentCandidate[];
  warnings: string[];
  siteMatchVerified: false;
  applicable: false;
}

export interface EumSearchContext {
  /** PNU 앞 5자리 시군구 코드 */
  sggCd: string | null;
  /** 성남시 분당구 정자동 178-1 → 정자동 / 178-1 */
  dong: string | null;
  lot: string | null;
  /** 지구단위계획 이름 후보 (분당, 판교 … / VWorld 결정명) */
  planNames: string[];
  /** 노후계획도시·정비구역 관련 고시도 찾을지 */
  renewal: boolean;
}

const PLAN_TITLE = /지구단위계획|지구단위|시행지침/;
const RENEWAL_TITLE = /특별정비|정비계획|정비구역|노후계획도시/;

/** 목록 행에 대상지 관련도 점수를 매긴다. 0이면 제외. */
export function scoreGosi(row: GosiListRow, ctx: EumSearchContext): number {
  const t = row.title.replace(/\s+/g, "");
  const isPlan = PLAN_TITLE.test(t);
  const isRenewal = ctx.renewal && RENEWAL_TITLE.test(t);
  if (!isPlan && !isRenewal) return 0;
  if (/열람|공람|입안|주민의견/.test(t)) return 0; // 결정 전 공람 공고는 제외
  let score = isPlan ? 10 : 6;
  // 같은 동이라도 다른 지번 고시가 많다: 동 이름만 맞으면 소폭, 동+지번이 맞으면 크게 가점.
  if (ctx.dong && t.includes(ctx.dong.replace(/\s+/g, ""))) score += ctx.lot && new RegExp(`${ctx.dong}(?:산)?${ctx.lot.split("-")[0]}(?:-|번지|$|\\D)`).test(t) ? 30 : 4;
  const names = ctx.planNames.map((n) => n.replace(/\s+/g, "")).filter(Boolean);
  if (names.some((n) => t.includes(n))) score += 15;
  // 다른 이름의 지구단위계획만 다룬 고시(예: 분당 대상지에 '위례 지구단위계획')는 낮춘다.
  const otherPlan = t.match(/([가-힣0-9]{2,12})(?:지구)?지구단위계획/)?.[1];
  if (otherPlan && names.length && !names.some((n) => otherPlan.includes(n) || n.includes(otherPlan)) && !(ctx.dong && t.includes(ctx.dong))) score -= 8;
  if (/결정|변경|지형도면/.test(t)) score += 2;
  return Math.max(score, 0);
}

async function analyzeGosi(row: GosiListRow, ctx: EumSearchContext): Promise<EumPlanDocument> {
  const url = gosiUrl(row.seq);
  const base: EumPlanDocument = {
    kind: "district-plan", title: row.title, sourceUrl: url, landingPage: url, status: "link-only", format: "html",
    textLength: 0, pageCount: null, preview: "", candidates: [], warnings: [], gosiNo: row.gosiNo, gosiDate: row.date, agency: row.agency,
    siteMatchVerified: false, applicable: false,
  };
  try {
    const detail = parseGosiDetail(await getHtml(url), row.seq);
    const parts: string[] = [];
    const attachments: NonNullable<EumPlanDocument["attachments"]> = [];
    let pages = 0;
    if (detail.body) parts.push(detail.body);
    // 결정조서·시행지침·고시문 PDF/HWPX 우선, 지형도면(도면)은 뒤로. 최대 2개.
    const files = detail.attachments
      .filter((a) => ["pdf", "hwpx"].includes(a.ext))
      .sort((a, b) => Number(/조서|지침|고시문|결정/.test(b.name)) - Number(/조서|지침|고시문|결정/.test(a.name)) || Number(/도면|고시도/.test(a.name)) - Number(/도면|고시도/.test(b.name)))
      .slice(0, 2);
    for (const file of files) {
      try {
        const data = await downloadAttachment(row.seq, file.path);
        const magicOk = file.ext === "pdf" ? data[0] === 0x25 && data[1] === 0x50 : data[0] === 0x50 && data[1] === 0x4b;
        if (!magicOk) throw new Error("첨부 형식 불일치");
        const parsed = await extractDocumentText(data, file.ext as "pdf" | "hwpx", 8_000);
        if (parsed.text) parts.push(`[첨부: ${file.name}]\n${parsed.text}`);
        pages += parsed.pageCount ?? 0;
        attachments.push({ name: file.name, analyzed: parsed.text.length > 0, pages: parsed.pageCount });
      } catch (error) {
        attachments.push({ name: file.name, analyzed: false, pages: null });
        base.warnings.push(`${file.name}: ${error instanceof Error ? error.message : "첨부 분석 실패"}`);
      }
    }
    for (const other of detail.attachments.filter((a) => !files.includes(a))) attachments.push({ name: other.name, analyzed: false, pages: null });
    const text = parts.join("\n\n").slice(0, 12_000);
    const analysis = text ? await parseUploadedDocument(new File([text], "gosi.txt")) : null;
    const compact = text.replace(/\s+/g, "");
    const siteMention = !!(ctx.dong && compact.includes(ctx.dong.replace(/\s+/g, "")) && (!ctx.lot || compact.includes(ctx.lot)));
    return {
      ...base,
      title: detail.title || row.title,
      gosiNo: detail.gosiNo || row.gosiNo,
      gosiDate: detail.date ?? row.date,
      agency: detail.agency || row.agency,
      status: text ? "analyzed" : "link-only",
      format: files.length && attachments.some((a) => a.analyzed) ? (files[0].ext as "pdf" | "hwpx") : "html",
      textLength: text.length,
      pageCount: pages || null,
      preview: text.slice(0, 500),
      text,
      siteMention,
      attachments,
      candidates: analysis?.candidates.slice(0, 25) ?? [],
      warnings: [
        ...base.warnings,
        siteMention ? "고시문에 대상지 지번이 직접 기재됨 · 결정내용 확인" : "토지이음 공식 고시 · 대상 필지·획지 포함 여부는 결정도로 확인",
        ...(detail.attachments.some((a) => a.ext === "hwp") ? ["구형 HWP 첨부는 자동 분석 불가 · 토지이음에서 열람"] : []),
      ],
    };
  } catch (error) {
    return { ...base, status: "failed", warnings: [error instanceof Error ? error.message.slice(0, 200) : "고시 조회 실패"] };
  }
}

/**
 * 대상지 시군구의 지구단위계획(+노후계획도시·정비) 결정고시를 토지이음에서 찾아 최대 limit건 분석한다.
 * 검색어: 지구단위 / 동 이름 / 계획 이름(분당 등) / (노후계획도시면) 특별정비
 */
export async function collectEumPlanDocuments(ctx: EumSearchContext, limit = 3): Promise<{ documents: EumPlanDocument[]; errors: string[] }> {
  const keywords = [
    "지구단위",
    ...(ctx.dong ? [ctx.dong] : []),
    ...ctx.planNames.slice(0, 2),
    ...(ctx.renewal ? ["특별정비"] : []),
  ];
  const settled = await Promise.allSettled(keywords.map((k, i) => searchGosi(k, ctx.sggCd, i === 0 ? 3 : 2)));
  const errors = settled.flatMap((s) => s.status === "rejected" ? [s.reason instanceof Error ? s.reason.message : "토지이음 고시 검색 실패"] : []);
  const rows = new Map<string, GosiListRow>();
  for (const s of settled) if (s.status === "fulfilled") for (const r of s.value) rows.set(r.seq, r);
  const ranked = [...rows.values()]
    .map((r) => ({ r, score: scoreGosi(r, ctx) }))
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || Number(b.r.seq) - Number(a.r.seq))
    .slice(0, limit);
  const documents = await Promise.all(ranked.map((x) => analyzeGosi(x.r, ctx)));
  return { documents, errors };
}
