/**
 * 토지이음 화면 파싱·검색어 (서버·브라우저 공용, 순수 함수).
 */
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

export function decodeText(html: string) {
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

// ───────── 최신 결정고시 자동 적용 공용 ─────────
// 클라이언트가 단계별로 호출한다: list → (최신 고시부터) scan … 해당 지번의 가구·획지와 건축물 결정내용을 찾을 때까지.
// 한 번의 요청이 길어지지 않도록 고시 1건씩 처리한다.

export const DECISION_TITLE = /지구단위계획|산업단지\s*계획|산업단지계획|실시계획|개발계획|택지개발|도시개발|정비계획|결정/;
export const DECISION_EXCLUDE = /열람|공람|입안|주민의견|건축허가제한|행위제한|토지거래|보상|수용|사업인정|도로구역|교육환경|자연재해/;

/** 대상지 이름 후보: VWorld 지정명(괄호 안 이름 포함) + 읍·면 이름 + 동·리 이름 + 구 이름 */
export function decisionKeywords(address: string, names: string[]): string[] {
  const out: string[] = [];
  for (const n of names.filter((x) => /지구단위|산업단지|택지개발|도시개발|정비구역|재정비촉진/.test(x))) {
    const inner = n.match(/\(([^)]+)\)/)?.[1];
    for (const v of [inner, n.replace(/\(.*?\)/g, "")]) {
      const s = (v ?? "").replace(/지구단위계획(?:구역)?|국가산업단지|일반산업단지|산업단지|택지개발(?:예정)?지구|도시개발구역|정비구역|구역$|지구$/g, "").replace(/\d+$/, "").trim();
      if (s.length >= 2) out.push(s);
    }
  }
  const tokens = address.trim().split(/\s+/);
  const eupmyeon = tokens.find((t) => /[읍면]$/.test(t));
  if (eupmyeon) out.push(eupmyeon.replace(/[읍면]$/, ""));
  const dong = tokens.find((t, i) => i > 1 && /(?:\d*동|\d*가|리)$/.test(t) && !/[읍면]$/.test(t));
  if (dong) out.push(dong.replace(/\d*(?:동|가|리)$/, ""));
  const gu = tokens.find((t, i) => i > 0 && /구$/.test(t));
  if (gu) out.push(gu.replace(/구$/, ""));
  return [...new Set(out.filter((s) => s.length >= 2))].slice(0, 4);
}


/** 목록에서 결정고시 후보만 최신순으로 (같은 고시번호 중복 제거) */
export function pickDecisionRows(rows: GosiListRow[]): GosiListRow[] {
  const seen = new Set<string>();
  return rows
    .filter((r) => { const t = r.title.replace(/\s+/g, ""); return DECISION_TITLE.test(t) && !DECISION_EXCLUDE.test(t); })
    .sort((a, b) => (b.date ?? "").localeCompare(a.date ?? "") || Number(b.seq) - Number(a.seq))
    .filter((r) => { const k = r.gosiNo.replace(/\s+/g, "") || r.seq; if (seen.has(k)) return false; seen.add(k); return true; })
    .slice(0, 40);
}
