/** 법규검토표 공통 서식: 수치 강조(빨간 글씨)·형광펜 구간 분리 */

const NUMBER_PATTERN = /(?<![제\d.,])(\d[\d,]*(?:\.\d+)?\s*(?:퍼센트|%|㎡|m²|m|대\/세대|대\/호|대|층|세대|호실|호|배)(?![가-힣a-zA-Z])|\d+(?:천|만)\s*(?:제곱미터|㎡)|H\/2|1\/2)/g;

export interface TextRun { text: string; emphasis: boolean }

/** 내용 셀 문자열을 일반/강조 구간으로 나눈다 (엑셀 richText·화면 공용) */
export function emphasizeNumbers(text: string): TextRun[] {
  const runs: TextRun[] = [];
  let last = 0;
  for (const m of text.matchAll(NUMBER_PATTERN)) {
    const i = m.index ?? 0;
    if (i > last) runs.push({ text: text.slice(last, i), emphasis: false });
    runs.push({ text: m[0], emphasis: true });
    last = i + m[0].length;
  }
  if (last < text.length) runs.push({ text: text.slice(last), emphasis: false });
  return runs.length ? runs : [{ text, emphasis: false }];
}

const ZONE_NAMES = ["제1종전용주거지역", "제2종전용주거지역", "제1종일반주거지역", "제2종일반주거지역", "제3종일반주거지역", "준주거지역",
  "중심상업지역", "일반상업지역", "근린상업지역", "유통상업지역", "전용공업지역", "일반공업지역", "준공업지역",
  "보전녹지지역", "생산녹지지역", "자연녹지지역", "보전관리지역", "생산관리지역", "계획관리지역", "농림지역", "자연환경보전지역"];
const squash = (t: string) => t.replace(/\s+/g, "");
/** 문장·항목 단위로 자르기 (줄, 마침표, ①, 1., 가. 등) — 원문 위치 보존 */
function segments(text: string): Array<{ start: number; end: number; text: string }> {
  const out: Array<{ start: number; end: number; text: string }> = [];
  const re = /\n+|(?<=[.。])\s+|(?=[①-⑳])|(?<=\s)(?=\d{1,2}\.\s)|(?<=\s)(?=[가-하]\.\s)/g;
  let last = 0;
  const push = (a: number, b: number) => {
    const raw = text.slice(a, b);
    const lead = raw.length - raw.trimStart().length;
    const t = raw.trim();
    if (t.length >= 4) out.push({ start: a + lead, end: a + lead + t.length, text: t });
  };
  for (const m of text.matchAll(re)) { const i = m.index ?? 0; if (i > last) push(last, i); last = i + m[0].length; }
  push(last, text.length);
  return out;
}
const zonesIn = (t: string) => { const c = squash(t); return ZONE_NAMES.filter((z) => c.includes(z) && !(z.startsWith("준") === false && c.includes("준" + z))); };

/**
 * 형광펜 정리: 짧은 낱말(예: "60퍼센트", "건축할 수 있는")은 원문 모든 곳에 칠하지 않고,
 * 그 낱말이 든 문장 하나로 넓혀 칠한다. 다른 용도지역만 언급한 문장은 제외하고,
 * 대상지 용도지역이 든 문장을 우선한다. 결과는 원문 문장 그대로(최대 4개).
 */
export function resolveHighlights(text: string, highlights: string[] = [], zones: string[] = []): string[] {
  if (!text) return [];
  const segs = segments(text);
  const site = zones.map(squash).filter(Boolean);
  const relevant = (t: string) => {
    if (!site.length) return true;
    const named = zonesIn(t);
    return named.length === 0 || named.some((z) => site.includes(z));
  };
  const hasSite = (t: string) => site.length > 0 && zonesIn(t).some((z) => site.includes(z));
  const picked: Array<{ start: number; text: string }> = [];
  const add = (sg: { start: number; text: string }) => { if (!picked.some((p) => p.start === sg.start)) picked.push(sg); };
  for (const h of highlights.filter((x) => x && x.trim().length > 1)) {
    const hc = squash(h);
    const cands = segs.filter((sg) => squash(sg.text).includes(hc));
    if (!cands.length) {
      // 원문에 문장 그대로 없으면(조각 인용) 문장 매칭 시도 생략, 길이가 충분할 때만 그대로 사용
      if (hc.length >= 20 && relevant(h) && squash(text).includes(hc)) picked.push({ start: squash(text).indexOf(hc), text: h });
      continue;
    }
    const good = cands.filter((sg) => relevant(sg.text));
    if (!good.length) continue;
    const bySite = good.filter((sg) => hasSite(sg.text));
    // 짧은 낱말은 대상지 용도지역 문장 우선, 없으면 첫 문장 하나만
    if (hc.length < 20) (bySite.length ? bySite.slice(0, 2) : good.slice(0, 1)).forEach(add);
    else good.slice(0, 1).forEach(add);
  }
  return picked.sort((a, b) => a.start - b.start).slice(0, 4).map((p) => p.text);
}

/** 근거 발췌문에서 형광펜 구간을 찾는다. 공백 차이는 무시한다. */
export function highlightRuns(text: string, highlights: string[] = []): TextRun[] {
  const marks: Array<[number, number]> = [];
  for (const h of highlights.filter((x) => x && x.trim().length > 0)) {
    const chars = [...h.replace(/\s+/g, "")].map((c) => c.replace(/[.*+?^${}()|[\]\\/]/g, "\\$&"));
    const pattern = new RegExp(chars.join("\\s*"), "g");
    for (const m of text.matchAll(pattern)) marks.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  }
  marks.sort((a, b) => a[0] - b[0]);
  const merged: Array<[number, number]> = [];
  for (const m of marks) {
    const prev = merged[merged.length - 1];
    if (prev && m[0] <= prev[1]) prev[1] = Math.max(prev[1], m[1]);
    else merged.push([...m]);
  }
  const runs: TextRun[] = [];
  let last = 0;
  for (const [s, e] of merged) {
    if (s > last) runs.push({ text: text.slice(last, s), emphasis: false });
    runs.push({ text: text.slice(s, e), emphasis: true });
    last = e;
  }
  if (last < text.length) runs.push({ text: text.slice(last), emphasis: false });
  return runs;
}

export function citeLine(s: { title: string; article?: string; annex?: string; noticeNo?: string; effectiveDate?: string; page?: number | number[] }) {
  const pages = s.page === undefined ? [] : Array.isArray(s.page) ? [...new Set(s.page)].sort((a, b) => a - b) : [s.page];
  return [s.title, s.article, s.annex && !s.article?.includes(s.annex) ? s.annex : "", pages.length ? `p.${pages.join(", ")}` : "", s.noticeNo ? `고시·공고 ${s.noticeNo}` : "", s.effectiveDate ? `시행 ${s.effectiveDate}` : ""]
    .filter(Boolean).join(" · ");
}

export const fmtNum = (v: number, d = 2) => v.toLocaleString("ko-KR", { maximumFractionDigits: d });

/**
 * 형광펜 대상 문장 고르기: 원문을 문장·항목(①, 1., 가.) 단위로 나누고,
 * 그 행에 필요한 핵심어 + 수치가 함께 든 문장을 통째로 칠한다(낱말 단위로 듬성듬성 칠하지 않음).
 */
export function keySentencesFor(text: string, keywords: string[], max = 3, zone?: string): string[] {
  const clean = text.replace(/\r/g, "");
  const parts = clean
    .split(/(?<=[.。])\s+|\n+|(?=\s[①-⑳]\s?)|(?=\s\d{1,2}\.\s)|(?=\s[가-하]\.\s)|(?=\s[-ㆍ○•]\s)/)
    .map((p) => p.trim())
    .filter((p) => p.length >= 6);
  const kw = keywords.map((k) => k.replace(/\s+/g, "")).filter(Boolean);
  const scored = parts.map((p, i) => {
    const c = p.replace(/\s+/g, "");
    const hits = kw.filter((k) => c.includes(k)).length;
    const nums = (p.match(NUMBER_PATTERN) ?? []).length + (p.match(/\d+(?:\.\d+)?\s*(?:미터|퍼센트|제곱미터)/g) ?? []).length;
    const zoneHit = zone && c.includes(zone.replace(/\s+/g, "")) ? 2 : 0;
    // 수치가 든 문장(기준)을 제목·정의 문장보다 우선
    const named = zonesIn(p);
    const otherZoneOnly = !!zone && named.length > 0 && !named.includes(squash(zone));
    return { p, i, hits, zoneHit, otherZoneOnly, score: hits * 3 + (nums ? 4 + Math.min(nums, 3) : -2) + zoneHit - (p.length > 260 ? 2 : 0) };
  }).filter((x) => !x.otherZoneOnly && (x.hits > 0 || x.zoneHit > 0) && x.score >= 3);
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, max).sort((a, b) => a.i - b.i).map((x) => x.p.length > 320 ? x.p.slice(0, 320) : x.p);
}
