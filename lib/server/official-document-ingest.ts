import { parseUploadedDocument, type DocumentCandidate } from "./document-parser";
import type { OfficialSearchResult } from "./official-search";

export type OfficialDocumentKind = "district-plan" | "lh-notice";
export interface OfficialDocumentEvidence {
  kind: OfficialDocumentKind;
  title: string;
  sourceUrl: string;
  landingPage: string | null;
  status: "analyzed" | "link-only" | "failed";
  format: "pdf" | "hwpx" | "xlsx" | null;
  textLength: number;
  pageCount: number | null;
  preview: string;
  candidates: DocumentCandidate[];
  warnings: string[];
  siteMatchVerified: false;
  applicable: false;
}

export interface OfficialDocumentCollection {
  checkedAt: string;
  documents: OfficialDocumentEvidence[];
  errors: string[];
  totalCandidates: number;
  analysisComplete: false;
}

const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PER_KIND = 2;
const MAX_HTML = 400_000;
const EXTENSION = /\.(pdf|hwpx|xlsx)(?:$|[?#])/i;

export function isSafeOfficialDocumentUrl(value: string): boolean {
  try {
    const uri = new URL(value);
    const host = uri.hostname.toLowerCase();
    return uri.protocol === "https:" && !uri.username && !uri.password &&
      (uri.port === "" || uri.port === "443") &&
      (host === "lh.or.kr" || host.endsWith(".lh.or.kr") ||
       host === "eum.go.kr" || host.endsWith(".eum.go.kr") ||
       host === "molit.go.kr" || host.endsWith(".molit.go.kr") ||
       host.endsWith(".go.kr"));
  } catch {
    return false;
  }
}

function formatFromUrl(value: string): "pdf" | "hwpx" | "xlsx" | null {
  try {
    const parsed = new URL(value);
    const match = parsed.pathname.match(/\.(pdf|hwpx|xlsx)$/i);
    return match ? match[1].toLowerCase() as "pdf" | "hwpx" | "xlsx" : null;
  } catch {
    return null;
  }
}

function norm(value: string) {
  return value.replace(/\s+/g, "").toLowerCase();
}

export function selectOfficialDocumentSources(
  results: OfficialSearchResult[],
  localGovernment: string,
): Array<{ result: OfficialSearchResult; kind: OfficialDocumentKind }> {
  const location = norm(localGovernment.split(/\s+/).at(-1) ?? "");
  const selected: Array<{ result: OfficialSearchResult; kind: OfficialDocumentKind }> = [];
  const seen = new Set<string>();
  for (const result of results) {
    if (seen.has(result.url) || !isSafeOfficialDocumentUrl(result.url)) continue;
    const title = norm(result.title + " " + result.description);
    const domain = new URL(result.url).hostname.toLowerCase();
    const query = result.query;
    let kind: OfficialDocumentKind | null = null;
    if (/(?:^|\.)lh\.or\.kr$/.test(domain) && query.includes("LH") &&
      /매입약정|매입임대|공공주택|설계지침|시공지침|가이드라인|모집공고/.test(title)) {
      kind = "lh-notice";
    } else if (query.includes("지구단위계획") &&
      /지구단위계획|시행지침|결정고시/.test(title) &&
      (!location || title.includes(location))) {
      kind = "district-plan";
    }
    if (kind) {
      seen.add(result.url);
      selected.push({ result, kind });
    }
  }
  return selected.sort((a, b) =>
    Number(Boolean(formatFromUrl(b.result.url))) - Number(Boolean(formatFromUrl(a.result.url))));
}

async function readLimited(response: Response, limit: number): Promise<Uint8Array> {
  const advertised = Number(response.headers.get("content-length") || 0);
  if (advertised > limit) throw new Error("파일 용량 제한 초과");
  if (!response.body) throw new Error("빈 다운로드 응답");
  const reader = response.body.getReader();
  const chunks: Uint8Array[] = [];
  let length = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      length += value.byteLength;
      if (length > limit) throw new Error("다운로드 크기 제한 초과");
      chunks.push(value);
    }
  } finally {
    await reader.cancel().catch(() => undefined);
  }
  const bytes = new Uint8Array(length);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  return bytes;
}

async function getOfficial(url: string, maxBytes: number): Promise<{ data: Uint8Array; mime: string }> {
  if (!isSafeOfficialDocumentUrl(url)) throw new Error("공식기관 HTTPS 허용목록 외 URL");
  const response = await fetch(url, {
    redirect: "manual",
    signal: AbortSignal.timeout(7_000),
    cache: "no-store",
    headers: { Accept: "application/pdf,application/octet-stream,application/zip,text/html;q=0.5" },
  });
  if (response.status >= 300 && response.status < 400) throw new Error("외부 리다이렉트 자동 추적 차단");
  if (!response.ok) throw new Error("공식문서 HTTP " + response.status);
  return { data: await readLimited(response, maxBytes), mime: response.headers.get("content-type")?.toLowerCase() ?? "" };
}

function decodeHtml(data: Uint8Array): string {
  return new TextDecoder("utf-8").decode(data);
}

export function discoverAttachmentLinks(html: string, landingPage: string): string[] {
  if (!isSafeOfficialDocumentUrl(landingPage)) return [];
  const links = new Set<string>();
  for (const found of html.matchAll(/href\s*=\s*["']([^"']+)["']/gi)) {
    const raw = found[1].replace(/&amp;/gi, "&").trim();
    if (!EXTENSION.test(raw)) continue;
    try {
      const link = new URL(raw, landingPage);
      if (isSafeOfficialDocumentUrl(link.href) &&
          link.hostname === new URL(landingPage).hostname &&
          formatFromUrl(link.href)) links.add(link.href);
    } catch { /* skip invalid attachment */ }
    if (links.size >= 5) break;
  }
  return [...links];
}

async function analyzeOne(
  result: OfficialSearchResult,
  kind: OfficialDocumentKind,
): Promise<OfficialDocumentEvidence> {
  const base: OfficialDocumentEvidence = {
    kind, title: result.title, sourceUrl: result.url,
    landingPage: null, status: "link-only", format: null, textLength: 0,
    pageCount: null, preview: "", candidates: [], warnings: [],
    siteMatchVerified: false, applicable: false,
  };
  try {
    let fileUrl = result.url;
    let format = formatFromUrl(fileUrl);
    if (!format) {
      // Relevant public-board landing pages: follow only same-host, directly
      // linked PDF/HWPX/XLSX files, never Javascript download handlers.
      const page = await getOfficial(fileUrl, MAX_HTML);
      if (!page.mime.includes("text/html")) {
        return { ...base, warnings: ["첨부 파일의 확장자를 판별할 수 없어 자동 분석을 생략했습니다."] };
      }
      const links = discoverAttachmentLinks(decodeHtml(page.data), fileUrl);
      if (!links.length) return { ...base, warnings: ["공식 게시글을 찾았지만 직접 다운로드 가능한 PDF/HWPX/XLSX 첨부파일이 없습니다."] };
      fileUrl = links[0];
      format = formatFromUrl(fileUrl);
      base.landingPage = result.url;
      base.sourceUrl = fileUrl;
    }
    if (!format) return base;
    const payload = await getOfficial(fileUrl, MAX_BYTES);
    if (payload.mime.includes("text/html")) throw new Error("문서 대신 HTML이 반환됨");
    const pdfMagic = payload.data[0] === 37 && payload.data[1] === 80 && payload.data[2] === 68 && payload.data[3] === 70;
    const zipMagic = payload.data[0] === 80 && payload.data[1] === 75;
    if (format === "pdf" ? !pdfMagic : !zipMagic) throw new Error("파일 형식과 실제 데이터 불일치");
    const filename = "official." + format;
    const file = new File([new Uint8Array(payload.data)], filename, { type: payload.mime });
    const parsed = await parseUploadedDocument(file);
    return {
      ...base, status: parsed.textLength > 0 ? "analyzed" : "link-only",
      format, textLength: parsed.textLength, pageCount: parsed.pageCount,
      preview: parsed.preview.slice(0, 500), candidates: parsed.candidates.slice(0, 25),
      warnings: [...parsed.warnings, "검색으로 발견된 공식문서이며 대상 필지 적용여부·최신 고시·LH 대상사업 여부는 검증 전입니다."],
    };
  } catch (error) {
    return {
      ...base, status: "failed",
      warnings: [error instanceof Error ? error.message.slice(0, 200) : "문서 분석 실패"],
    };
  }
}

export async function collectOfficialDocuments(
  results: OfficialSearchResult[],
  localGovernment: string,
): Promise<OfficialDocumentCollection> {
  const selected = selectOfficialDocumentSources(results, localGovernment);
  const picked: typeof selected = [];
  for (const kind of ["district-plan", "lh-notice"] as const) {
    picked.push(...selected.filter((item) => item.kind === kind).slice(0, MAX_PER_KIND));
  }
  const documents = await Promise.all(picked.map((item) => analyzeOne(item.result, item.kind)));
  return {
    checkedAt: new Date().toISOString(),
    documents, errors: documents.filter((item) => item.status === "failed").map((item) =>
      item.title + ": " + (item.warnings[0] ?? "분석 실패")),
    totalCandidates: documents.reduce((sum, item) => sum + item.candidates.length, 0),
    analysisComplete: false,
  };
}
