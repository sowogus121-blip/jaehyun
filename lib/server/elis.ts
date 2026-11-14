/**
 * 행정안전부 자치법규정보시스템(ELIS, www.elis.go.kr) 대체 경로.
 *
 * 국가법령정보센터(law.go.kr)가 점검·장애일 때 관할 조례의 제목 검색과 본문(조문)을
 * ELIS 공식 화면에서 직접 읽는다. 공식 Open API가 아니므로 HTML 구조가 바뀌면
 * 빈 결과를 돌려주고(오류 메시지 포함) 수치를 추정하지 않는다.
 */
import { ordinanceTitleMatches, type OrdinanceRecord } from "./law-api";
import { extractHwpText } from "./hwp";
import { extractDocumentText } from "./document-parser";

const BASE = "https://www.elis.go.kr";
const UA = "Mozilla/5.0 (compatible; LH-Plan-Lab/0.8; +https://lh-plan-lab.vercel.app)";

export type ElisHit = { tag: string; alrNo: string; histNo: string; title: string; date: string; kind: string };

function decode(html: string) {
  return html
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/p>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

async function timed(url: string, init: RequestInit = {}, ms = 12_000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  try {
    const response = await fetch(url, { ...init, cache: "no-store", signal: controller.signal, headers: { "User-Agent": UA, ...(init.headers ?? {}) } });
    const text = await response.text();
    if (!response.ok) throw new Error(`ELIS HTTP ${response.status}`);
    if (/시스템\s*점검/.test(text) && !/자치법규/.test(text.slice(0, 3000))) throw new Error("자치법규정보시스템 점검 중");
    return { response, text };
  } finally {
    clearTimeout(timer);
  }
}

function cookiesOf(response: Response) {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const list = headers.getSetCookie?.() ?? (response.headers.get("set-cookie") ? [response.headers.get("set-cookie") as string] : []);
  return list.map((c) => c.split(";")[0]).filter(Boolean).join("; ");
}

/** ELIS 검색 결과 HTML → 목록 (현=현행, 예=시행예정) */
export function parseElisList(html: string): ElisHit[] {
  const out: ElisHit[] = [];
  const re = /tagset[^>]*>([^<]*)<\/span>\s*<a[^>]*fnSrchDtls\('(\d+)','(\d+)'\)[^>]*>([\s\S]*?)<\/a>\s*<\/td>\s*<td>([^<]*)<\/td>\s*<td>([^<]*)</g;
  for (const m of html.matchAll(re)) {
    out.push({ tag: m[1].trim(), alrNo: m[2], histNo: m[3], title: decode(m[4]), date: m[5].trim(), kind: m[6].trim() });
  }
  return out;
}

export async function elisSearch(keyword: string): Promise<ElisHit[]> {
  const first = await timed(`${BASE}/allalr/allAlrList`);
  const csrf = first.text.match(/name="_csrf" value="([^"]+)"/)?.[1];
  if (!csrf) throw new Error("ELIS 검색 화면 형식 변경(_csrf 없음)");
  const cookie = cookiesOf(first.response);
  const body = new URLSearchParams({ _csrf: csrf, curPage: "1", nwYn: "1", srchKwd: keyword, pageSize: "20", menuNm: "allalr" });
  const { text } = await timed(`${BASE}/allalr/allAlrList`, {
    method: "POST",
    body: body.toString(),
    headers: { "Content-Type": "application/x-www-form-urlencoded", Referer: `${BASE}/allalr/allAlrList`, ...(cookie ? { Cookie: cookie } : {}) },
  });
  return parseElisList(text);
}

export function elisLink(alrNo: string, histNo: string) {
  return `${BASE}/allalr/selectAlrBdtOne?alrNo=${alrNo}&histNo=${histNo}&menuNm=main`;
}

/** law-api.searchOrdinance와 같은 판정 규칙으로 ELIS에서 관할 조례를 찾는다. */
export async function searchOrdinanceElis(query: string, jurisdiction: string): Promise<OrdinanceRecord | null> {
  // ELIS 검색어는 제목 단어를 모두 포함해야 걸린다. '…주차장 설치 및 관리 조례'로 못 찾으면 '…주차장 조례'로 다시 찾는다(청주시 주차장 조례 등).
  const pick = (hits: ElisHit[]) => hits.filter((h) => (h.tag === "현" || h.tag === "예") && h.kind === "조례" && ordinanceTitleMatches(h.title, query, jurisdiction));
  let current = pick(await elisSearch(query));
  const short = query.replace(/\s*설치\s*및\s*관리\s*조례$/, " 조례").trim();
  if (!current.length && short !== query) current = pick(await elisSearch(short));
  const norm = (v: string) => v.replace(/\s+/g, "");
  // 같은 조례가 현·예 두 줄로 나오면 현행을 우선한다. 예(시행예정)만 있으면 본문 연혁에서 현행 판본을 다시 고른다.
  const ranked = [...current].sort((a, b) => Number(norm(b.title) === norm(query)) - Number(norm(a.title) === norm(query)) || Number(b.tag === "현") - Number(a.tag === "현"));
  const hit = ranked[0];
  if (!hit) return null;
  return {
    name: hit.title,
    localGovernment: jurisdiction,
    detailId: null,
    detailMst: null,
    promulgationDate: hit.date ? hit.date.replaceAll("-", "") : null,
    enforcementDate: null,
    link: elisLink(hit.alrNo, hit.histNo),
    retrievalStatus: "metadata-only",
    applicationStatus: "not-assessed",
    source: "elis",
    elis: { alrNo: hit.alrNo, histNo: hit.histNo },
  };
}

/**
 * ELIS 본문 HTML → 국가법령정보센터 JSON과 같은 모양({조문:[{조문번호, 조문가지번호, 조제목, 조문내용}]}).
 * 그래야 findArticlesByKeyword / extractOrdinanceArticles 를 그대로 쓸 수 있다.
 */
export function parseElisBody(html: string) {
  const articles: Array<Record<string, string>> = [];
  // 부칙(BUC…)·스크립트가 마지막 조문에 붙지 않도록 잘라낸다.
  const clean = html.replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi, " ");
  const blocks = clean.split(/<div class="txt" id="\d{7}">/).slice(1);
  for (const block of blocks) {
    const end = block.search(/<div class="txt|<\/section|id="cms-footer"/);
    const chunk = end > 0 ? block.slice(0, end) : block.slice(0, 8000);
    const head = chunk.match(/<strong class="color-jo">\s*제(\d+)조(?:의(\d+))?\s*(?:\(([^)]*)\))?/);
    if (!head) continue;
    const text = decode(chunk);
    if (/^제\d+조(?:의\d+)?\s*\(삭제/.test(text)) continue;
    articles.push({ 조문번호: head[1], 조문가지번호: head[2] ?? "", 조제목: (head[3] ?? "").trim(), 조문내용: text.slice(0, 4000), 조문여부: "조문" });
  }
  return { 조문: articles, history: parseElisHistory(html) };
}

/** 본문 화면의 연혁 목록: 이력번호별 시행일 */
export function parseElisHistory(html: string) {
  const out: Array<{ alrNo: string; histNo: string; enforcementDate: string }> = [];
  const re = /lawPopup\('자치법규','','','(\d+)','(\d+)'\)[\s\S]{0,200}?\[시행\s*(\d{4})\.\s*(\d{1,2})\.\s*(\d{1,2})\.?\]/g;
  for (const m of html.matchAll(re)) out.push({ alrNo: m[1], histNo: m[2], enforcementDate: `${m[3]}${m[4].padStart(2, "0")}${m[5].padStart(2, "0")}` });
  return out;
}

function koreaToday() {
  return new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10).replaceAll("-", "");
}

/**
 * 본문을 읽는다. 검색 결과가 시행예정(예) 이력이면 연혁에서 오늘 기준 현행 이력으로 바꿔 다시 읽는다.
 * 돌려주는 histNo/enforcementDate 가 실제 읽은 판본이다.
 */
export async function fetchOrdinanceElis(alrNo: string, histNo: string, today = koreaToday(), subject: string | null = null, zones: string[] = []) {
  let { text } = await timed(elisLink(alrNo, histNo), {}, 15_000);
  let parsed = parseElisBody(text);
  const inForce = parsed.history.filter((h) => h.alrNo === alrNo && h.enforcementDate <= today)
    .sort((a, b) => b.enforcementDate.localeCompare(a.enforcementDate) || b.histNo.localeCompare(a.histNo))[0];
  let used = histNo;
  if (inForce && inForce.histNo !== histNo) {
    ({ text } = await timed(elisLink(alrNo, inForce.histNo), {}, 15_000));
    parsed = parseElisBody(text);
    used = inForce.histNo;
  }
  if (!parsed.조문.length) throw new Error("ELIS 본문에서 조문을 읽지 못했습니다(화면 형식 변경 가능)");
  const enforcementDate = parsed.history.find((h) => h.histNo === used)?.enforcementDate ?? inForce?.enforcementDate ?? null;
  // 별표(부설주차장 설치기준 등): 규모검토에 필요한 것만 내려받아 본문 JSON에 '별표내용'으로 붙인다.
  const annexes: Array<Record<string, string>> = [];
  const annexErrors: string[] = [];
  if (subject) {
    for (const a of pickAnnexes(parseElisAnnexList(text), subject, zones)) {
      try {
        const body = await fetchElisAnnexText(alrNo, used, a.sn);
        if (body.trim()) annexes.push({ 별표번호: String(Number(a.sn)), 별표제목: a.title, 별표내용: body.slice(0, 20_000) });
      } catch (error) {
        annexErrors.push(`${a.title}: ${error instanceof Error ? error.message : "별표 읽기 실패"}`);
      }
    }
  }
  return { payload: { 조문: parsed.조문, 별표: annexes }, histNo: used, enforcementDate, link: elisLink(alrNo, used), annexErrors };
}

// ───────── 별표·서식 (HWP/HWPX/PDF 첨부) ─────────
export interface ElisAnnex { sn: string; title: string }

/** 본문 화면의 별표·서식 목록 (fnAttListDown) */
export function parseElisAnnexList(html: string): ElisAnnex[] {
  const out = new Map<string, string>();
  for (const m of html.matchAll(/fnAttListDown\('\d+','\d+','(\d+)'\)"[^>]*>\s*(?:<span[^>]*>[^<]*<\/span>)?\s*([^<]+)</g)) {
    const title = m[2].replace(/\s+/g, " ").trim();
    if (title && !out.has(m[1])) out.set(m[1], title);
  }
  return [...out].map(([sn, title]) => ({ sn, title }));
}

/** 별표 파일을 내려받아 텍스트로. HWP(OLE)·HWPX(zip)·PDF 자동 판별. */
export async function fetchElisAnnexText(alrNo: string, histNo: string, sn: string): Promise<string> {
  const { response } = await timedRaw(`${BASE}/allalr/attListDown?alrNo=${alrNo}&histNo=${histNo}&attlistSn=${sn}&chkTime=${Date.now()}`);
  const data = new Uint8Array(await response.arrayBuffer());
  if (data.length > 8 * 1024 * 1024) throw new Error("별표 파일 용량 초과");
  if (data[0] === 0xd0 && data[1] === 0xcf) return extractHwpText(data);
  if (data[0] === 0x50 && data[1] === 0x4b) return (await extractDocumentText(data, "hwpx", 30_000)).text;
  if (data[0] === 0x25 && data[1] === 0x50) return (await extractDocumentText(data, "pdf", 30_000)).text;
  throw new Error("별표 파일 형식을 알 수 없음");
}

async function timedRaw(url: string, ms = 15_000) {
  const response = await fetch(url, { cache: "no-store", signal: AbortSignal.timeout(ms), headers: { "User-Agent": UA } });
  if (!response.ok) throw new Error(`ELIS 별표 HTTP ${response.status}`);
  return { response };
}

/** 주제별로 필요한 별표만 고른다 (예: 주차장 조례 → 부설주차장 설치기준, 설치제한 기준). */
export function pickAnnexes(list: ElisAnnex[], subject: string, zones: string[] = []): ElisAnnex[] {
  if (subject === "도시계획" && zones.length) {
    const z = zones.map((x) => x.replace(/\s+/g, ""));
    return list.filter((a) => z.some((name) => a.title.replace(/\s+/g, "").includes(name))).slice(0, 3);
  }
  const want = subject === "주차장" ? /부설주차장.*(설치기준|설치대상)|설치제한|기계식/
    : subject === "건축" ? /대지\s*안?의\s*공지(?!.*(안내판|관리대장))/
    : subject === "도시계획" ? /용도지역|건축제한|건축할\s*수|용적률|건폐율/
    : null;
  return want ? list.filter((a) => want.test(a.title)).slice(0, 3) : [];
}
