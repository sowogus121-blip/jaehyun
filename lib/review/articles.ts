import type { SiteReviewResult } from "../types";

export type Article = NonNullable<SiteReviewResult["ordinanceArticleCandidates"]>[number] & { fullText?: string };
const compact = (s: string) => s.replace(/\s+/g, "");

export function articles(review: SiteReviewResult | null): Article[] {
  const list = (review?.ordinanceArticleCandidates ?? []) as Article[];
  const texts = new Map<string, string>();
  for (const a of list) if (a.fullText) texts.set(a.sourceTitle + "|" + a.article, a.fullText);
  return list.map((a) => (a.fullText ? a : { ...a, fullText: texts.get(a.sourceTitle + "|" + a.article) }));
}

export function findArticle(review: SiteReviewResult | null, ordinance: string, terms: string[]): Article | null {
  const rows = articles(review).filter((a) => a.sourceTitle.includes(ordinance));
  return rows.find((a) => terms.some((t) => a.article.includes(t)))
    ?? rows.find((a) => terms.some((t) => (a.fullText ?? a.excerpt).includes(t))) ?? null;
}

/** 조례 조문 본문에서 "제2종일반주거지역: 250퍼센트 이하" 형태의 수치를 추출한다. */
export function zoneRatio(article: Article | null, zone: string): { value: number; match: string } | null {
  if (!article || !zone) return null;
  const body = compact(article.fullText ?? article.excerpt);
  const zoneName = compact(zone);
  let from = 0;
  while (true) {
    const position = body.indexOf(zoneName, from);
    if (position === -1) return null;
    const after = body.slice(position + zoneName.length);
    const m = after.match(/^(?:[:：]|[은는의]|\(?[^)]{0,12}\)?[:：]?)((?:\d{1,2}천\d{1,3})|(?:\d{1,2}천)|(?:\d{1,2},\d{3})|(?:\d{1,4}(?:\.\d+)?))(?:%|퍼센트)/);
    if (m) {
      const korean = m[1].match(/^(\d{1,2})천(\d{1,3})?$/);
      const value = korean ? Number(korean[1]) * 1000 + Number(korean[2] ?? 0) : Number(m[1].replace(/,/g, ""));
      if (value > 0 && value <= 2000) return { value, match: m[1] + (after.includes(m[1] + "퍼센트") ? "퍼센트" : "%") };
    }
    from = position + zoneName.length;
  }
}


/** 단일 용도지역의 조례 일반 건폐율·용적률 (조문 자동추출). 필지 적용 판정은 별도. */
export function getOrdinanceZoneStandards(review: Pick<SiteReviewResult, "ordinanceArticleCandidates"> | null, zone: string): { bcr: number; far: number } | null {
  const r = review as SiteReviewResult | null;
  const bcr = zoneRatio(findArticle(r, "도시계획 조례", ["용도지역안에서의 건폐율", "용도지역 안에서의 건폐율"]), zone);
  const far = zoneRatio(findArticle(r, "도시계획 조례", ["용도지역안에서의 용적률", "용도지역 안에서의 용적률"]), zone);
  return bcr && far ? { bcr: bcr.value, far: far.value } : null;
}
