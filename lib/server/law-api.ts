/** 국가법령정보센터 Open API (법령·자치법규) 공용 함수 */
import { extractOrdinanceArticles, type OrdinanceArticleCandidate } from "./ordinance-articles";

export type LawRecord = {
  name: string;
  promulgationDate: string | null;
  enforcementDate: string | null;
  ministry: string | null;
  detailId: string | null;
  detailMst: string | null;
  link: string;
  retrievalStatus: "metadata-only" | "full-text";
  applicationStatus: "not-assessed" | "applicable" | "not-applicable" | "conditional";
};

export type OrdinanceRecord = {
  name: string;
  localGovernment: string | null;
  detailId: string | null;
  detailMst: string | null;
  promulgationDate: string | null;
  enforcementDate: string | null;
  link: string;
  retrievalStatus: "metadata-only" | "full-text";
  applicationStatus: "not-assessed" | "applicable" | "not-applicable" | "conditional";
};

const MAINTENANCE_MESSAGE = (url: string) => (url.includes("law.go.kr") ? "국가법령정보센터" : "공공 API") + " 시스템 점검 중";

export async function fetchJson(url: string) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": "LH-Plan-Lab/0.7" },
      cache: "no-store",
      signal: controller.signal,
    });
    const text = await response.text();
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    try {
      return JSON.parse(text);
    } catch {
      const plainText = text.replace(/<style[\s\S]*?<\/style>|<script[\s\S]*?<\/script>/gi, " ").replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
      if (/점검/.test(text)) throw new Error(MAINTENANCE_MESSAGE(url));
      throw new Error(plainText ? `JSON이 아닌 응답: ${plainText.slice(0, 120)}` : "빈 응답");
    }
  } finally {
    clearTimeout(timeout);
  }
}

export async function searchLaw(query: string, oc: string): Promise<LawRecord | null> {
  const params = new URLSearchParams({ OC: oc, target: "law", type: "JSON", query, display: "10" });
  const data = await fetchJson(`https://www.law.go.kr/DRF/lawSearch.do?${params.toString()}`);
  const root = data?.LawSearch;
  const resultCode = String(root?.resultCode ?? data?.resultCode ?? "");
  const resultMessage = String(root?.resultMsg ?? data?.resultMsg ?? "");
  if (resultCode && resultCode !== "00") throw new Error(`${resultCode} · ${resultMessage || "법령 API 요청이 거부되었습니다."}`);
  if (!root || typeof root !== "object") throw new Error("국가법령정보센터 응답 형식을 확인할 수 없습니다.");
  const raw = root.law;
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  const exact = rows.find((row: Record<string, unknown>) => String(row["법령명한글"] ?? "").replaceAll(" ", "") === query.replaceAll(" ", "")) ?? rows[0];
  if (!exact) return null;
  const detail = String(exact["법령상세링크"] ?? "");
  return {
    name: String(exact["법령명한글"] ?? query),
    promulgationDate: exact["공포일자"] ? String(exact["공포일자"]) : null,
    enforcementDate: exact["시행일자"] ? String(exact["시행일자"]) : null,
    ministry: exact["소관부처명"] ? String(exact["소관부처명"]) : null,
    detailId: exact["법령ID"] ? String(exact["법령ID"]) : null,
    detailMst: exact["법령일련번호"] ? String(exact["법령일련번호"]) : null,
    link: detail.startsWith("http") ? detail : `https://www.law.go.kr${detail}`,
    retrievalStatus: "metadata-only",
    applicationStatus: "not-assessed",
  };
}

export async function fetchNationalLawArticleCandidates(law: LawRecord, oc: string): Promise<OrdinanceArticleCandidate[]> {
  if (!law.detailId && !law.detailMst) return [];
  const params = new URLSearchParams({ OC: oc, target: "law", type: "JSON" });
  if (law.detailId) params.set("ID", law.detailId);
  else if (law.detailMst) params.set("MST", law.detailMst);
  const data = await fetchJson(`https://www.law.go.kr/DRF/lawService.do?${params.toString()}`);
  if (data?.resultCode && String(data.resultCode) !== "00") throw new Error(String(data.resultMsg ?? "법령 본문 조회 실패"));
  return extractOrdinanceArticles(data, law.name, law.link);
}

export async function searchOrdinance(query: string, oc: string, jurisdiction: string): Promise<OrdinanceRecord | null> {
  const params = new URLSearchParams({ OC: oc, target: "ordin", type: "JSON", query, display: "10" });
  const data = await fetchJson(`https://www.law.go.kr/DRF/lawSearch.do?${params.toString()}`);
  const root = data?.OrdinSearch ?? data?.LawSearch;
  const resultCode = String(root?.resultCode ?? data?.resultCode ?? "");
  const resultMessage = String(root?.resultMsg ?? data?.resultMsg ?? "");
  if (resultCode && resultCode !== "00") throw new Error(`${resultCode} · ${resultMessage || "자치법규 API 요청이 거부되었습니다."}`);
  if (!root || typeof root !== "object") throw new Error("국가법령정보센터 자치법규 응답 형식을 확인할 수 없습니다.");
  const raw = root.ordin ?? root.law;
  const rows = Array.isArray(raw) ? raw : raw ? [raw] : [];
  // Do not use the API's first hit: a different municipality's ordinance
  // can otherwise be presented as the ordinance governing this address.
  const normalize = (value: unknown) => String(value ?? "").replace(/\s+/g, "");
  const district = jurisdiction.split(/\s+/).filter(Boolean).at(-1) ?? jurisdiction;
  const fullScope = normalize(jurisdiction);
  const subject = query.includes("주차장") ? "주차장" : query.includes("도시계획") ? "도시계획" :
    query.includes("경관") ? "경관" : "건축";
  // The Law Information API indexes the local law by '의정부시 ...', not
  // '경기도 의정부시 ...'. Match the municipality + subject in the title,
  // and the entire governing agency when the API supplies it.
  const matches = rows.filter((candidate: Record<string, unknown>) => {
    const title = normalize(candidate["자치법규명"] ?? candidate["법령명한글"]);
    const office = normalize(candidate["지자체기관명"]);
    const stem=normalize(district);
    const simple=title.startsWith(fullScope) ? title.slice(fullScope.length) :
      title.startsWith(stem) ? title.slice(stem.length) : "";
    // Generic word-prefix search previously confused '남동구 건축물관리자의
    // 제설 조례' with the Building Ordinance, and '도시계획위원회 운영 조례'
    // with binding urban planning FAR standards. Only accept actual subjects.
    const subjectValid=subject==="건축" ? simple==="건축조례" :
      subject==="경관" ? simple==="경관조례" :
      subject==="도시계획" ? simple==="도시계획조례" :
      (simple==="주차장조례" || /^주차장설치및관리(?:운영에관한)?조례$/.test(simple));
    return subjectValid &&
      (!office || office === fullScope || office.endsWith(stem));
  }) as Record<string, unknown>[];
  const row = matches.find((candidate) =>
    normalize(candidate["자치법규명"] ?? candidate["법령명한글"]) === normalize(query)
  ) ?? matches[0];
  if (!row) return null;
  const detail = String(row["자치법규상세링크"] ?? row["법령상세링크"] ?? "");
  return {
    name: String(row["자치법규명"] ?? row["법령명한글"] ?? query),
    localGovernment: row["지자체기관명"] ? String(row["지자체기관명"]) : null,
    detailId: row["자치법규ID"] ? String(row["자치법규ID"]) : null,
    detailMst: row["자치법규일련번호"] ? String(row["자치법규일련번호"]) : null,
    promulgationDate: row["공포일자"] ? String(row["공포일자"]) : null,
    enforcementDate: row["시행일자"] ? String(row["시행일자"]) : null,
    link: detail.startsWith("http") ? detail : `https://www.law.go.kr${detail}`,
    retrievalStatus: "metadata-only",
    applicationStatus: "not-assessed",
  };
}

export async function fetchOrdinanceArticleCandidates(ordinance: OrdinanceRecord, oc: string): Promise<OrdinanceArticleCandidate[]> {
  if (!ordinance.detailId && !ordinance.detailMst) return [];
  const params = new URLSearchParams({ OC: oc, target: "ordin", type: "JSON" });
  if (ordinance.detailId) params.set("ID", ordinance.detailId);
  else if (ordinance.detailMst) params.set("MST", ordinance.detailMst);
  const data = await fetchJson(`https://www.law.go.kr/DRF/lawService.do?${params.toString()}`);
  if (data?.resultCode && String(data.resultCode) !== "00") {
    throw new Error(String(data.resultMsg ?? "자치법규 본문 API 오류"));
  }
  return extractOrdinanceArticles(data, ordinance.name, ordinance.link);
}

export function lawGovernmentFromAddress(address: string) {
  const parts = localGovernmentFromAddress(address).split(/\s+/).filter(Boolean);
  // Ordinances are normally enacted by Changwon-si, Suwon-si etc.,
  // not their Seongsan-gu / Yeongtong-gu subdistricts.
  if (parts.length >= 3 && parts[1]?.endsWith("시") && parts[2]?.endsWith("구"))
    return parts.slice(0,2).join(" ");
  return parts.join(" ");
}

export function localGovernmentFromAddress(address: string) {
  const parts = address.split(/\s+/).filter(Boolean);
  if (parts[0]?.includes("세종")) return parts[0];
  return parts.slice(0, parts[1]?.endsWith("시") && parts[2]?.endsWith("구") ? 3 : 2).join(" ");
}


/** 자치법규·법령 본문 원자료 (조문 검색용) */
export async function fetchLawPayload(target: "law" | "ordin", record: { detailId: string | null; detailMst: string | null }, oc: string) {
  if (!record.detailId && !record.detailMst) return null;
  const params = new URLSearchParams({ OC: oc, target, type: "JSON" });
  if (record.detailId) params.set("ID", record.detailId);
  else if (record.detailMst) params.set("MST", record.detailMst);
  const data = await fetchJson(`https://www.law.go.kr/DRF/lawService.do?${params.toString()}`);
  if (data?.resultCode && String(data.resultCode) !== "00") throw new Error(String(data.resultMsg ?? "본문 조회 실패"));
  return data;
}
