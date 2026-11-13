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

export function citeLine(s: { title: string; article?: string; annex?: string; noticeNo?: string; effectiveDate?: string }) {
  return [s.title, s.article, s.annex && !s.article?.includes(s.annex) ? s.annex : "", s.noticeNo ? `고시·공고 ${s.noticeNo}` : "", s.effectiveDate ? `시행 ${s.effectiveDate}` : ""]
    .filter(Boolean).join(" · ");
}

export const fmtNum = (v: number, d = 2) => v.toLocaleString("ko-KR", { maximumFractionDigits: d });
