/**
 * Extracts review-only clause candidates from the official Law Information API.
 * A matching keyword is NOT proof that a rule applies to a particular parcel.
 */
export interface OrdinanceArticleCandidate {
  sourceTitle: string;
  sourceUrl: string;
  topic: string;
  article: string;
  excerpt: string;
  /** 조문 전체 본문 (최대 3,000자). 보고서 근거부록 형광펜 표시에 사용 */
  fullText?: string;
  verified: false;
}

const TOPICS: Array<[string, RegExp]> = [
  ["건폐율", /건폐율/],
  ["용적률", /용적률/],
  ["허용용도", /허용용도|불허용도|건축할 수 있는|건축할 수 없는/],
  ["높이", /최고높이|높이제한|최고층수/],
  ["주차", /주차장|주차대수|주차구획/],
  ["조경", /조경면적|조경의 설치|조경시설/],
  ["대지 안의 공지", /대지 안의 공지|대지안의 공지/],
  ["일조", /일조|채광|인동거리/],
  ["완화", /완화|인센티브|공공기여/],
];

function plain(value: unknown) {
  return String(value ?? "").replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

export function extractOrdinanceArticles(
  payload: unknown,
  sourceTitle: string,
  sourceUrl: string,
): OrdinanceArticleCandidate[] {
  const candidates: OrdinanceArticleCandidate[] = [];
  const seen = new Set<string>();
  const withText = new Set<string>();
  let visited = 0;

  function visit(value: unknown): void {
    if (visited++ > 12000 || candidates.length >= 120 || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) {
      for (const item of value) visit(item);
      return;
    }
    const record = value as Record<string, unknown>;
    const heading = plain(record["조제목"] ?? record["조문제목"] ?? record["별표제목"]);
    const number = plain(record["조문번호"] ?? record["조번호"] ?? record["별표번호"]);
    const article = [number ? `제${number}조` : "", heading].filter(Boolean).join(" · ") || "조문";
    // Only official clause/appendix fields; do not mistake search-result metadata for the law text.
    for (const key of ["조내용", "조문내용", "항내용", "호내용", "별표내용"]) {
      const text = plain(record[key]);
      if (text.length < 8) continue;
      for (const [topic, regex] of TOPICS) {
        const match = regex.exec(text);
        if (!match) continue;
        const begin = Math.max(0, match.index - 65);
        const excerpt = text.slice(begin, begin + 270);
        const id = [sourceTitle, article, topic, excerpt].join("|");
        if (!seen.has(id)) {
          seen.add(id);
          const textKey = sourceTitle + "|" + article + "|" + text.slice(0, 40);
          const fullText = withText.has(textKey) ? undefined : text.slice(0, 2000);
          withText.add(textKey);
          candidates.push({ sourceTitle, sourceUrl, topic, article, excerpt, fullText, verified: false });
        }
        if (candidates.length >= 120) return;
      }
    }
    for (const nested of Object.values(record)) {
      if (nested && typeof nested === "object") visit(nested);
      if (candidates.length >= 120) return;
    }
  }

  visit(payload);
  return candidates;
}

export interface ArticleText { article: string; text: string }

/** 조문(또는 별표) 본문에 검색어가 포함된 항목을 그대로 돌려준다. 적용 판정은 하지 않는다. */
export function findArticlesByKeyword(payload: unknown, terms: string[], limit = 8): ArticleText[] {
  const out: ArticleText[] = [];
  const seen = new Set<string>();
  const needles = terms.map((t) => t.replace(/\s+/g, "")).filter(Boolean);
  let visited = 0;
  function visit(value: unknown): void {
    if (visited++ > 20000 || out.length >= limit || value === null || typeof value !== "object") return;
    if (Array.isArray(value)) { for (const item of value) visit(item); return; }
    const record = value as Record<string, unknown>;
    const heading = plain(record["조제목"] ?? record["조문제목"] ?? record["별표제목"]);
    const number = plain(record["조문번호"] ?? record["조번호"] ?? record["별표번호"]);
    const isAnnex = record["별표내용"] !== undefined;
    const article = [number ? (isAnnex ? `별표 ${number}` : `제${number}조`) : "", heading].filter(Boolean).join(" · ") || "조문";
    for (const key of ["조문내용", "조내용", "별표내용"]) {
      const own = plain(record[key]);
      if (own.length < 4) continue;
      const nested = plain(JSON.stringify(record["항"] ?? "")).replace(/["{}[\]:,]|항내용|호내용|목내용|항번호|호번호|목번호/g, " ").replace(/\s+/g, " ");
      const text = (own + " " + nested).trim().slice(0, 4000);
      const compactText = text.replace(/\s+/g, "");
      if (needles.some((n) => compactText.includes(n)) && !seen.has(article)) {
        seen.add(article);
        out.push({ article, text });
      }
    }
    for (const nested of Object.values(record)) if (nested && typeof nested === "object") visit(nested);
  }
  visit(payload);
  return out;
}
