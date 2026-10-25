import type { SiteReviewResult } from "./types";

/**
 * Conservative text-only pre-screening for one parcel, one zoning class.
 * Suggestions never become verified legal values automatically: the original
 * table, amendments, municipality and district plan require checking.
 */
export interface ZoningCandidate {
  zone: string;
  topic: "건폐율" | "용적률";
  value: number;
  status: "conditional";
  sourceTitle: string;
  sourceUrl: string;
  article: string;
  articleIndex: number;
  evidence: string;
  needsDistrictPlanReview: boolean;
}

const ZONE_LABEL = /(?:제[123]종(?:전용|일반)주거지역|준주거지역|중심상업지역|일반상업지역|근린상업지역|유통상업지역|전용공업지역|일반공업지역|준공업지역|보전녹지지역|생산녹지지역|자연녹지지역)/;

function normalize(text: string) {
  return text.replace(/\s+/g, "");
}

export function suggestZoningRules(review: SiteReviewResult | null): ZoningCandidate[] {
  if (!review || review.mixedUseZones) return [];
  const zones = [...new Set(review.landUse
    .filter((entry) => entry.category === "용도지역")
    .map((entry) => normalize(entry.name))
    .filter((name) => ZONE_LABEL.test(name)))];
  if (zones.length !== 1) return [];
  const zone = zones[0];
  const rows = review.ordinanceArticleCandidates ?? [];
  const matched: ZoningCandidate[] = [];
  for (let i = 0; i < rows.length; i++) {
    const entry = rows[i];
    if (!["건폐율", "용적률"].includes(entry.topic)) continue;
    const compact = normalize(entry.excerpt);
    if (!compact.includes(zone)) continue;
    // Match an itemised zone row only ("제2종...: 250퍼센트").
    // Never take an unrelated percentage from a paragraph or the next zone.
    const position = compact.indexOf(zone);
    const after = compact.slice(position + zone.length);
    const match = after.match(/^(?:[:：]|[은는])(\d{1,4}(?:\.\d+)?)\s*(?:%|퍼센트)/);
    if (!match) continue;
    const value = Number(match[1]);
    if (!Number.isFinite(value) || value <= 0 ||
        value > (entry.topic === "건폐율" ? 100 : 2000)) continue;
    matched.push({
      zone, topic: entry.topic as ZoningCandidate["topic"],
      value, status: "conditional",
      sourceTitle: entry.sourceTitle, sourceUrl: entry.sourceUrl,
      article: entry.article, articleIndex: i,
      evidence: entry.excerpt, needsDistrictPlanReview: review.districtPlan !== false,
    });
  }
  // Conflicting ordinance sections can describe basic, permitted, special or
  // transitional FARs: retain all and never silently select the maximum.
  return matched;
}
