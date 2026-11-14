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
    return { p, i, score: hits * 3 + (nums ? 4 + Math.min(nums, 3) : -2) + zoneHit - (p.length > 260 ? 2 : 0) };
  }).filter((x) => x.score >= 3);
  scored.sort((a, b) => b.score - a.score || a.i - b.i);
  return scored.slice(0, max).sort((a, b) => a.i - b.i).map((x) => x.p.length > 320 ? x.p.slice(0, 320) : x.p);
}
