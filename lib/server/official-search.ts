export interface OfficialSearchResult {
  title: string;
  url: string;
  description: string;
  query: string;
  sourceDomain: string;
  official: true;
}

export interface OfficialSearchResponse {
  status: "completed" | "not-configured" | "failed";
  provider: "Brave Search" | null;
  searchedAt: string;
  results: OfficialSearchResult[];
  errors: string[];
}

type SearchContext = {
  address: string;
  localGovernment: string;
  businessMode?: string;
  regionalOffice?: string;
};

const CACHE_TTL = 6 * 60 * 60 * 1000;
const cache = new Map<string, { expiresAt: number; results: OfficialSearchResult[] }>();

function isOfficialUrl(value: string) {
  try {
    const hostname = new URL(value).hostname.toLowerCase();
    return hostname === "law.go.kr"
      || hostname.endsWith(".law.go.kr")
      || hostname === "eum.go.kr"
      || hostname.endsWith(".eum.go.kr")
      || hostname === "lh.or.kr"
      || hostname.endsWith(".lh.or.kr")
      || hostname === "molit.go.kr"
      || hostname.endsWith(".molit.go.kr")
      || hostname.endsWith(".go.kr");
  } catch {
    return false;
  }
}

function buildQueries(context: SearchContext) {
  const local = context.localGovernment || context.address;
  return [
    `${context.address.startsWith(local) ? context.address : `${local} ${context.address}`} 지구단위계획 결정 고시 시행지침`,
    `${local} 건축조례 주차장조례 도시계획조례 별표`,
    `${local} 공공주택 용적률 완화 역세권 인센티브 고시`,
    `LH ${context.regionalOffice || local} ${context.businessMode === "purchase" ? "신축매입약정" : "공공임대주택"} 공고 설계지침`,
    `${local} 건축선 도시계획시설 경관 고도 제한 고시`,
  ];
}

async function searchBrave(query: string, apiKey: string) {
  const cached = cache.get(query);
  if (cached && cached.expiresAt > Date.now()) return cached.results;

  const params = new URLSearchParams({ q: query, count: "10", country: "KR", search_lang: "ko", safesearch: "off" });
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
      headers: { Accept: "application/json", "X-Subscription-Token": apiKey },
      cache: "no-store",
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const data = await response.json();
    const results = (data?.web?.results ?? []).flatMap((item: { title?: string; url?: string; description?: string }) => {
      if (!item.url || !isOfficialUrl(item.url)) return [];
      return [{
        title: item.title || item.url,
        url: item.url,
        description: item.description || "",
        query,
        sourceDomain: new URL(item.url).hostname,
        official: true as const,
      }];
    });
    cache.set(query, { expiresAt: Date.now() + CACHE_TTL, results });
    return results;
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchOfficialSources(context: SearchContext): Promise<OfficialSearchResponse> {
  const apiKey = process.env.BRAVE_SEARCH_API_KEY?.trim();
  if (!apiKey) {
    return {
      status: "not-configured",
      provider: null,
      searchedAt: new Date().toISOString(),
      results: [],
      errors: ["BRAVE_SEARCH_API_KEY가 없어 공식 웹 후속검색을 실행하지 않았습니다."],
    };
  }

  const settled = await Promise.allSettled(buildQueries(context).map((query) => searchBrave(query, apiKey)));
  const results = settled.flatMap((result) => result.status === "fulfilled" ? result.value : []);
  const deduplicated = results.filter((item, index, all) => all.findIndex((candidate) => candidate.url === item.url) === index);
  const errors = settled.flatMap((result) => result.status === "rejected"
    ? [result.reason instanceof Error ? result.reason.message : "알 수 없는 검색 오류"]
    : []);
  return {
    status: errors.length === settled.length ? "failed" : "completed",
    provider: "Brave Search",
    searchedAt: new Date().toISOString(),
    results: deduplicated,
    errors,
  };
}
