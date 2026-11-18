/**
 * 고시문(지구단위계획·산업단지계획 결정조서) 텍스트에서 대상 지번의 가구·획지와
 * 그 가구의 건축물 결정내용(용도·건폐율·용적률·높이·건축선)을 읽는다.
 *
 * 대상 서식 (토지이음 고시문 PDF, pdf.js/pdftotext 줄 단위 텍스트):
 *  - 가구·획지 조서:  "[구분] [가구명] [가구번호 가구면적(기정 변경)] 획지번호 위치(리·동 지번)[ 위치] 면적[ 면적]"
 *      예) "기정 상업4 1 2,257.3 1 연제리 832 589.6"
 *          "5  1,948.8  1,948.8  1  만수리 866  만수리 866  513.7  513.7"
 *  - 건축물 결정조서: 가구명 줄 다음에 "용도 C1 / 건폐율 80% 이하 / 용적률 1,000% 이하 / 높이(층) - / 건축선 …"
 *  - "결정조서(변경없음) : 게재생략" 은 해당 고시에서 내용이 바뀌지 않았다는 뜻 → 이전 고시 값을 그대로 쓴다.
 */

export interface ParcelBlock {
  /** 가구명 (공백 제거, 예: 상업4) */
  label: string;
  /** 가구번호 (예: 5) */
  block: string | null;
  /** 획지번호 (예: 1) */
  lot: string | null;
  /** 획지 면적(㎡) — 변경 열이 있으면 변경값 */
  area: number | null;
  /** 원문 줄 */
  line: string;
}

export interface BuildingRule {
  label: string;
  use: string | null;
  /** 허용·불허 용도 원문 (같은 칸에 적힌 경우) */
  useText: string | null;
  bcr: number | null;
  far: number | null;
  height: string | null;
  setback: string | null;
  lines: string[];
}

const num = (s: string) => Number(s.replace(/,/g, ""));
const clean = (s: string) => s.replace(/[ \t]+/g, " ").replace(/ {2,}/g, "  ").trim();
/** 가구명 토큰: 한글 1~6자(+공백)+숫자, 또는 영문+숫자 (예: 상업 4, 상업4, 단독 1, C1) */
const LABEL = "([가-힣]{1,6}\\s?\\d{1,3}|[A-Z]{1,2}\\d{1,3})";
const AREA = "(\\d{1,3}(?:,\\d{3})*(?:\\.\\d+)|\\d+\\.\\d+)";

function lotMatches(token: string, lot: string) {
  return token.replace(/^산\s*/, "") === lot.replace(/^산\s*/, "");
}

/** 가구·획지 조서에서 대상 지번(리·동 + 지번)의 가구명·가구번호·획지번호를 찾는다. */
export function findParcelBlock(text: string, place: string, lot: string): ParcelBlock | null {
  const lines = text.replace(/\r/g, "").split("\n").map(clean).filter(Boolean);
  let label: string | null = null;
  let block: string | null = null;
  // 한 줄: [구분] [가구명] [가구번호 가구면적 (가구면적)] 획지번호 위치 [위치] 면적 [면적]
  const row = new RegExp(
    `^(?:(?:기정|변경|신설|폐지)\\s+)?(?:${LABEL}\\s+)?(?:(\\d{1,3})\\s+${AREA}\\s+(?:${AREA}\\s+)?)?(\\d{1,3})\\s+([가-힣0-9]+(?:리|동|가|읍|면))\\s+(산?\\s?\\d+(?:-\\d+)?)(?:\\s+[가-힣0-9]+(?:리|동|가|읍|면)\\s+산?\\s?\\d+(?:-\\d+)?)?\\s+${AREA}(?:\\s+${AREA})?\\s*$`,
  );
  for (const line of lines) {
    const m = line.match(row);
    if (!m) {
      // 가구명만 있는 줄 (표 머리가 줄바꿈된 경우)
      const only = line.match(new RegExp(`^(?:(?:기정|변경|신설)\\s+)?${LABEL}$`));
      if (only && /[가-힣]/.test(only[1])) { label = only[1].replace(/\s+/g, ""); block = null; }
      continue;
    }
    const [, lab, blk, , , hoek, ri, lotNo, area1, area2] = m;
    if (lab) { label = lab.replace(/\s+/g, ""); block = null; }
    if (blk) block = blk;
    if (ri === place && lotMatches(lotNo, lot) && label) {
      return { label, block, lot: hoek, area: num(area2 ?? area1), line };
    }
  }
  return null;
}

/** 고시문에 '건축물 결정조서(변경없음) 게재생략'이 있는지 */
export function buildingTableUnchanged(text: string): boolean {
  return /건축물에\s*(?:대한|관한)[\s\S]{0,120}?결\s*정\s*조\s*서\s*\(?\s*변경\s*\n?\s*없음\s*\)?\s*:?\s*:?\s*게재생략/.test(text);
}

/** 건축물 결정조서에서 가구명(예: 상업4)의 용도·건폐율·용적률·높이·건축선을 읽는다. */
export function findBuildingRule(text: string, label: string): BuildingRule | null {
  const lines = text.replace(/\r/g, "").split("\n").map(clean).filter(Boolean);
  const m = label.match(/^([가-힣A-Z]+)\s?(\d+)$/);
  if (!m) return null;
  const head = new RegExp(`^(?:(?:기정|변경)\\s+)?${m[1]}\\s?${m[2]}(?![\\d])(?:\\s|$)`);
  const anyHead = new RegExp(`^(?:(?:기정|변경)\\s+)?[가-힣]{1,6}\\s?\\d{1,3}(?![\\d,.])(?:\\s+[①-⑳]|\\s*$)`);
  for (let i = 0; i < lines.length; i++) {
    if (!head.test(lines[i])) continue;
    // 가구·획지 조서 줄(지번·면적이 이어지는 줄)은 제외
    if (/[가-힣]+(?:리|동)\s+\d+.*\d+\.\d/.test(lines[i])) continue;
    const rule: BuildingRule = { label, use: null, useText: null, bcr: null, far: null, height: null, setback: null, lines: [lines[i]] };
    const useBuf: string[] = [];
    let inUse = false;
    for (let j = i + 1; j < Math.min(lines.length, i + 45); j++) {
      const l = lines[j];
      const found = rule.bcr !== null || rule.far !== null || rule.use !== null;
      if (found && anyHead.test(l) && !head.test(l)) break;
      if (/^(?:배치|형태|색채)\b/.test(l)) { inUse = false; continue; }
      const bcr = l.match(/건\s*폐\s*율\s+(\d+(?:\.\d+)?)\s*%\s*이하/);
      if (bcr) { rule.bcr = Number(bcr[1]); rule.lines.push(l); inUse = false; continue; }
      const far = l.match(/용\s*적\s*률\s+([\d,]+(?:\.\d+)?)\s*%\s*이하/);
      if (far) { rule.far = num(far[1]); rule.lines.push(l); continue; }
      const h = l.match(/^높이\S*\s+(.+)$/);
      if (h) { rule.height = h[1].trim(); rule.lines.push(l); continue; }
      const sb = l.match(/^건축선\s+(.+)$/);
      if (sb) { rule.setback = sb[1].trim(); rule.lines.push(l); if (rule.far !== null) break; continue; }
      const use = l.match(/^용도\s+([A-Z]{1,2}\d{0,2}|[가-힣·\s]{2,20})$/);
      if (use && !rule.use) { rule.use = use[1].trim(); rule.lines.push(l); continue; }
      if (/^용도$|^허용$|^불허$/.test(l)) { inUse = true; useBuf.push(l); continue; }
      if (inUse) useBuf.push(l);
    }
    if (useBuf.length) rule.useText = useBuf.join(" ").replace(/\s+/g, " ").trim();
    if (rule.bcr !== null || rule.far !== null) return rule;
  }
  return null;
}

/** 허용·불허 원문에서 공동주택 불허 여부 */
export function apartmentProhibited(useText: string | null): boolean | null {
  if (!useText) return null;
  const ban = useText.split(/불허/)[1];
  if (ban === undefined) return null;
  return /공동주택/.test(ban.split(/허용/)[0]);
}
