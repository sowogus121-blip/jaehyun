/**
 * 조례 별표(부설주차장 설치기준) 원문에서 공동주택·오피스텔·도시형생활주택 주차기준을 읽는다.
 * 원문 문구를 그대로 인용하고, '세대당 1대(전용 30㎡ 이하 0.5대, 60㎡ 이하 0.8대)' 같은
 * 세대(호)당 최소대수 구간만 수치로 뽑는다. 해석이 안 되는 문구는 수치 없이 인용만 한다.
 */
import type { ParkingTier } from "./types";
export type { ParkingTier };
export interface ParkingRule {
  use: "apartment" | "officetel" | "urban";
  /** 해당 항목 원문 */
  quote: string;
  /** 세대(호)당 최소대수 구간 (전용면적 이하 → 대수, 마지막은 상한 없음) */
  tiers: ParkingTier[] | null;
  /** 「주택건설기준 등에 관한 규정」 제27조 산정 대수를 함께 쓰라는 문구가 있는지 */
  refHousingStd27: boolean;
}

const num = (s: string) => Number(s.replace(/,/g, ""));

/** "세대당 1대(전용면적이 30제곱미터이하인 경우에는 0.5대, 60제곱미터이하인 경우0.8대)" → 구간 */
export function parseTiers(text: string): ParkingTier[] | null {
  const t = text.replace(/\s+/g, " ");
  const m = t.match(/(?:세대당|호실당|호당)[^0-9]{0,30}?(\d+(?:\.\d+)?)\s*대\s*\(([^)]*)\)/);
  if (!m) {
    const flat = t.match(/(?:세대당|호실당|호당)\s*(\d+(?:\.\d+)?)\s*대/);
    return flat ? [{ ratio: num(flat[1]) }] : null;
  }
  const base = num(m[1]);
  const tiers: ParkingTier[] = [];
  for (const p of m[2].matchAll(/(\d+(?:\.\d+)?)\s*(?:제곱미터|㎡|m2|m²)\s*(?:이하|미만)[^0-9]{0,12}?(\d+(?:\.\d+)?)\s*대/g)) {
    tiers.push({ maxArea: num(p[1]), ratio: num(p[2]) });
  }
  if (!tiers.length) return [{ ratio: base }];
  tiers.sort((a, b) => (a.maxArea ?? 0) - (b.maxArea ?? 0));
  return [...tiers, { ratio: base }];
}

/** 별표 본문을 번호 항목(1. 2. 2-1. …)으로 나눠 주거용도 항목을 찾는다. */
export function extractParkingRules(annexText: string): ParkingRule[] {
  const body = annexText.split(/\n\s*<?비\s*고>?/)[0];
  const items = body.split(/\n(?=\s*\d+(?:-\d+)?\s*\.)/).map((s) => s.trim()).filter(Boolean);
  const out: ParkingRule[] = [];
  for (const item of items) {
    const head = item.slice(0, 160);
    const quote = item.replace(/\s*\n\s*/g, " ").slice(0, 900);
    const tiers = parseTiers(item);
    const ref27 = /주택건설기준\s*등에\s*관한\s*규정[^\n]{0,20}제27조/.test(item);
    const headNoExcl = head.replace(/\([^)]*제외[^)]*\)/g, "");
    if (/공동주택/.test(headNoExcl)) out.push({ use: "apartment", quote, tiers, refHousingStd27: ref27 });
    if (/오피스텔/.test(headNoExcl)) out.push({ use: "officetel", quote, tiers, refHousingStd27: ref27 });
    if (/도시형\s*생활주택/.test(headNoExcl)) out.push({ use: "urban", quote, tiers, refHousingStd27: ref27 });
  }
  return out;
}

export function tierRatio(tiers: ParkingTier[], area: number) {
  return (tiers.find((t) => t.maxArea === undefined || area <= t.maxArea) ?? tiers[tiers.length - 1]).ratio;
}

export function describeTiers(tiers: ParkingTier[], word: "세대" | "호") {
  return tiers.map((t) => t.maxArea !== undefined ? `전용 ${t.maxArea}㎡ 이하 ${t.ratio}대` : `그 외 ${t.ratio}대`).join(" · ") + `/${word}`;
}
