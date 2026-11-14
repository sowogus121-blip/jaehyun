/**
 * 조례 별표(부설주차장 설치기준) 원문에서 공동주택·오피스텔·도시형생활주택 주차기준을 읽는다.
 *
 * 지자체마다 표현이 달라 세 가지 형태를 모두 처리한다.
 *  - 서울: "세대당 1대(전용면적이 30제곱미터이하인 경우에는 0.5대, 60제곱미터이하인 경우0.8대)"
 *  - 의정부: "85㎡이하인 경우 전용면적의 합계를 기준으로 70㎡당 1대, 85㎡를 초과하는 경우 65㎡당 1대 … 세대당 1대에 미달되는 경우 1대 이상"
 *  - 청주: "(전용면적 60㎡ 이하) 세대(호실) 당 1.05대 이상 / (60㎡ 초과~85㎡ 이하) 1.5대 / (85㎡초과) 전용면적 60㎡ 당 1대 (다만, 1.7대 이상)"
 * 원문 문구는 그대로 인용하고, 해석이 안 되면 수치 없이 인용만 한다.
 */
import type { ParkingTier } from "./types";
export type { ParkingTier };

export interface ParkingRule {
  use: "apartment" | "officetel" | "urban";
  /** 해당 항목 원문 */
  quote: string;
  /** 전용면적 구간별 기준 (마지막은 상한 없음) */
  tiers: ParkingTier[] | null;
  /** 「주택건설기준 등에 관한 규정」 제27조 산정 대수를 함께 쓰라는 문구가 있는지 */
  refHousingStd27: boolean;
}

const num = (s: string) => Number(s.replace(/,/g, ""));
const AREA = "(?:제곱미터|㎡|m2|m²)";

function normalize(text: string) {
  return text
    .replace(/세대\s*\(\s*호실\s*\)\s*당/g, "세대당")
    .replace(/세대\s+당/g, "세대당")
    .replace(/호실\s+당/g, "호실당")
    .replace(/세대\s*또는\s*호실\s*당/g, "세대당")
    .replace(/\s+/g, " ");
}

/** 형태 1: "세대당 1대(…30㎡이하 0.5대, 60㎡이하 0.8대)" */
function parseParenthetical(t: string): ParkingTier[] | null {
  const m = t.match(new RegExp(`(?:세대당|호실당|호당)[^0-9(]{0,20}?(\\d+(?:\\.\\d+)?)\\s*대\\s*\\(([^)]*${AREA}[^)]*)\\)`));
  if (!m) return null;
  const base = num(m[1]);
  const tiers: ParkingTier[] = [];
  for (const p of m[2].matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${AREA}\\s*(이하|미만)[^0-9]{0,14}?(\\d+(?:\\.\\d+)?)\\s*대`, "g"))) {
    tiers.push({ maxArea: num(p[1]), strict: p[2] === "미만" || undefined, ratio: num(p[3]) });
  }
  if (!tiers.length) return null;
  tiers.sort((a, b) => (a.maxArea ?? 0) - (b.maxArea ?? 0));
  return [...tiers, { ratio: base }];
}

/** 형태 2·3: 구간 조건과 기준(세대당 n대 / 전용 n㎡당 1대)이 차례로 나오는 경우 */
function parseBands(t: string): ParkingTier[] | null {
  const clauses = t.split(/[,，]|\.\s|ㆍ|○|·|\n|;/).map((c) => c.trim()).filter(Boolean);
  const bands: ParkingTier[] = [];
  let current: ParkingTier | null = null;
  let globalMin: number | null = null;
  for (const c of clauses) {
    const upper = [...c.matchAll(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${AREA}\\s*(이하|미만)`, "g"))].at(-1);
    const over = new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${AREA}\\s*(?:를|을)?\\s*초과`).test(c);
    const perUnit = c.match(/(?:세대당|호실당|호당)[^0-9]{0,12}?(\d+(?:\.\d+)?)\s*대/)?.[1]
      ?? (upper || over ? c.match(/\)\s*(\d+(?:\.\d+)?)\s*대\s*이상/)?.[1] : undefined);
    const sqm = c.match(new RegExp(`(\\d+(?:\\.\\d+)?)\\s*${AREA}\\s*당\\s*1\\s*대`))?.[1];
    if (/미달/.test(c) && perUnit) { globalMin = Math.max(globalMin ?? 0, num(perUnit)); continue; }
    if (upper || over) {
      current = upper ? { maxArea: num(upper[1]), strict: upper[2] === "미만" || undefined } : {};
      bands.push(current);
    }
    if (!current && (perUnit || sqm)) { current = {}; bands.push(current); }
    if (current) {
      if (perUnit) current.ratio = Math.max(current.ratio ?? 0, num(perUnit));
      if (sqm && (!upper || Number(sqm) !== Number(upper[1]))) current.sqmPerStall = num(sqm);
    }
  }
  let usable = bands.filter((b) => b.ratio !== undefined || b.sqmPerStall !== undefined);
  if (globalMin !== null) {
    usable = usable.length ? usable.map((b) => ({ ...b, ratio: Math.max(b.ratio ?? 0, globalMin!) })) : [{ ratio: globalMin }];
  }
  if (!usable.length) return null;
  // 상한 있는 구간 → 오름차순, 상한 없는 구간은 마지막 하나로 합친다.
  const bounded = usable.filter((b) => b.maxArea !== undefined).sort((a, b) => a.maxArea! - b.maxArea!);
  const open = usable.filter((b) => b.maxArea === undefined);
  const tail = open.reduce<ParkingTier | null>((acc, b) => acc ? { ratio: Math.max(acc.ratio ?? 0, b.ratio ?? 0) || undefined, sqmPerStall: acc.sqmPerStall ?? b.sqmPerStall } : { ...b }, null);
  return tail ? [...bounded, tail] : bounded;
}

export function parseTiers(text: string): ParkingTier[] | null {
  const t = normalize(text);
  return parseParenthetical(t) ?? parseBands(t);
}

/** 별표 본문을 번호 항목(1. 2. 2-1. …)으로 나눠 주거용도 항목을 찾는다. 줄바꿈이 사라진 원문도 처리한다. */
export function extractParkingRules(annexText: string): ParkingRule[] {
  const body = annexText.split(/<\s*비\s*고\s*>|\n\s*비\s*고\s*\n|※\s*비\s*고|\s비\s?고\s+1\s*\./)[0];
  const items = body.split(/(?:^|\s)(?=\d{1,2}(?:-\d)?\s*\.\s*[가-힣「])/).map((x) => x.trim()).filter(Boolean);
  const out: ParkingRule[] = [];
  for (const item of items) {
    const headEnd = item.search(/\n|ㆍ|○|「/);
    const head = item.slice(0, headEnd > 0 ? Math.min(headEnd, 200) : 160);
    const headNoExcl = head.replace(/\([^)]*제외[^)]*\)/g, "");
    if (!/공동주택|오피스텔|도시형\s*생활주택/.test(headNoExcl)) continue;
    const quote = item.replace(/\s+/g, " ").slice(0, 900);
    const ref27 = /주택건설기준\s*등에\s*관한\s*규정[^가-힣]{0,6}제27조/.test(item);
    // 항목 안의 글머리(○, ㆍ)별로 도시형생활주택·다가구 문단을 분리
    const bullets = item.split(/(?=○|ㆍ\s*(?:다가구|「?주택법|도시형))/);
    // 첫 조각은 항목 제목을 포함하므로 도시형 문단 후보에서 뺀다.
    const urbanBullet = bullets.length > 1 ? bullets.slice(1).find((b) => /도시형\s*생활주택/.test(b) && /(\d+(?:\.\d+)?)\s*대/.test(b)) : undefined;
    const mainText = bullets.filter((b) => b !== urbanBullet && !/^\s*ㆍ?\s*다가구주택의\s*경우/.test(b)).join(" ");
    const mainTiers = parseTiers(mainText);
    if (/공동주택/.test(headNoExcl)) out.push({ use: "apartment", quote, tiers: mainTiers, refHousingStd27: ref27 });
    if (/오피스텔/.test(headNoExcl)) out.push({ use: "officetel", quote, tiers: mainTiers, refHousingStd27: ref27 });
    if (urbanBullet) out.push({ use: "urban", quote: urbanBullet.replace(/\s+/g, " ").trim().slice(0, 600), tiers: parseTiers(urbanBullet), refHousingStd27: ref27 });
    else if (/도시형\s*생활주택/.test(headNoExcl)) out.push({ use: "urban", quote, tiers: mainTiers, refHousingStd27: ref27 });
  }
  return out;
}

function tierFor(tiers: ParkingTier[], area: number) {
  return tiers.find((t) => t.maxArea === undefined || (t.strict ? area < t.maxArea : area <= t.maxArea)) ?? tiers[tiers.length - 1];
}

/** 한 세대(호)의 법정 대수(소수): 세대당 기준과 전용면적 ㎡당 기준 중 큰 값 */
export function tierRatio(tiers: ParkingTier[], area: number) {
  const t = tierFor(tiers, area);
  return Math.max(t.ratio ?? 0, t.sqmPerStall ? area / t.sqmPerStall : 0);
}

export function describeTiers(tiers: ParkingTier[], word: string) {
  return tiers.map((t) => {
    const cond = t.maxArea !== undefined ? `전용 ${t.maxArea}㎡ ${t.strict ? "미만" : "이하"}` : tiers.length > 1 ? "그 외" : "전체";
    const rule = [t.sqmPerStall ? `전용 ${t.sqmPerStall}㎡당 1대` : "", t.ratio ? `${word}당 ${t.ratio}대 이상` : ""].filter(Boolean).join(", ");
    return `${cond} ${rule}`;
  }).join(" · ");
}
