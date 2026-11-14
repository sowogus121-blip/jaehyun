/**
 * 상세 설계개요(개요표) — 사용자 실무 엑셀 양식(설계개요·층별/용도별 면적·타입별 면적·전체사업 면적개요)에
 * 규모검토 결과를 채워 넣을 셀 값을 만든다. 셀 주소는 lib/templates/overview-template 의 양식과 1:1로 맞춘다.
 * 수치는 모두 규모검토 엔진 결과에서 오며, 이 파일은 배치(층별 배분)만 한다.
 */
import type { ScenarioResult } from "../massing/engine";
import type { Project } from "../review/types";
import { USE_SHORT, UNIT_WORD } from "../review/types";
import { describeTiers } from "../review/parking-rules";
import type { ParkingTier } from "../review/types";

export type CellValue = string | number | null;
export interface OverviewSheet { name: string; cells: Record<string, CellValue>; notes: string[] }

const PY = 0.3025;
const r4 = (v: number) => Math.round(v * 10000) / 10000;
const ABOVE_ROWS = 22;   // 템플릿 지상층 행: 8~29 (29행 = 지상1층)
const BELOW_ROWS = 5;    // 지하층 행: 31~35

const USE_LABEL = { apartment: "공동주택", urban: "도시형생활주택", officetel: "오피스텔" } as const;

export function buildDetailedOverview(project: Project, r: ScenarioResult, extra: { parkingRule?: string; zones?: string } = {}): OverviewSheet {
  const s = r.scenario;
  const word = UNIT_WORD[s.use];
  const useLabel = USE_LABEL[s.use];
  const address = project.review?.location?.parcelAddress || project.site.address;
  const title = `${address} 일대 LH 공공임대 규모검토 (${s.name})`;
  const cells: Record<string, CellValue> = {};
  const notes: string[] = [];
  const set = (addr: string, v: CellValue) => { cells[addr] = v; };
  const A = r.siteArea;

  // ── 층별 배분: 지상1층 = 부대시설(남는 면적은 주거), 이후 주거 균등, 최상층에 나머지 ──
  const floors = Math.max(r.floorsAbove, 1);
  const plate = r.plannedBuildingArea;
  const amenityFloors = r.amenityArea > 0 && plate > 0 ? Math.max(1, Math.ceil(r.amenityArea / plate)) : 0;
  const resFloors = Math.max(1, floors - (r.amenityArea > 0 && r.amenityArea >= plate * 0.6 ? amenityFloors : 0));
  const firstRes = floors - resFloors + 1;
  const perFloor = Math.ceil(r.units / resFloors);
  const unitsOn = (f: number) => {
    if (f < firstRes) return 0;
    const idx = f - firstRes;
    const before = idx * perFloor;
    return Math.max(0, Math.min(perFloor, r.units - before));
  };
  const avgExclusive = r.units ? r.exclusiveTotal / r.units : 0;
  const avgCommon = r.units ? r.residentialCommon / r.units : 0;
  let amenityLeft = r.amenityArea;

  if (floors > ABOVE_ROWS) notes.push(`지상 ${floors}층 중 ${ABOVE_ROWS}층까지만 층별 표에 표시 (양식 행 수 제한)`);
  if (r.floorsBelow > BELOW_ROWS) notes.push(`지하 ${r.floorsBelow}층 중 ${BELOW_ROWS}층까지만 표시`);

  let sumM = 0, sumO = 0, sumR = 0, sumT = 0, sumUnits = 0;
  for (let i = 0; i < ABOVE_ROWS; i++) {
    const row = 29 - i;
    const f = i + 1;
    if (f > floors) { set(`L${row}`, null); continue; }
    set(`L${row}`, `지상${f}층`);
    const u = unitsOn(f);
    const amen = f <= amenityFloors ? Math.min(amenityLeft, plate) : 0;
    amenityLeft -= amen;
    const m = r4(u * avgExclusive), rr = r4(u * avgCommon);
    const o = amen ? r4(amen * 0.7) : 0, t = amen ? r4(amen - amen * 0.7) : 0;
    set(`M${row}`, m || null); set(`O${row}`, o || null); set(`Q${row}`, r4(m + o) || null);
    set(`R${row}`, rr || null); set(`T${row}`, t || null); set(`V${row}`, r4(rr + t) || null);
    set(`Y${row}`, r4(m + o + rr + t) || null);
    set(`Z${row}`, f === 1 ? project.assumptions.groundFloorHeight : s.floorHeight);
    set(`AA${row}`, u || null);
    sumM += m; sumO += o; sumR += rr; sumT += t; sumUnits += u;
  }
  set("M30", r4(sumM)); set("O30", r4(sumO)); set("Q30", r4(sumM + sumO));
  set("R30", r4(sumR)); set("T30", r4(sumT)); set("V30", r4(sumR + sumT));
  set("W30", 0); set("X30", 0); set("Y30", r4(sumM + sumO + sumR + sumT)); set("AA30", sumUnits);

  // 지하층: 주차장·기전실을 층별 균등 배분
  const bFloors = Math.max(0, r.floorsBelow);
  let sumW = 0, sumX = 0;
  for (let i = 0; i < BELOW_ROWS; i++) {
    const row = 31 + i;
    if (i >= bFloors) { set(`L${row}`, null); continue; }
    set(`L${row}`, `지하${i + 1}층`);
    const w = r4(r.equipmentArea / bFloors), x = r4(r.parking.area / bFloors);
    set(`W${row}`, w); set(`X${row}`, x); set(`Y${row}`, r4(w + x));
    sumW += w; sumX += x;
  }
  if (!bFloors && r.equipmentArea) { set("L31", "지하1층"); set("W31", r4(r.equipmentArea)); set("Y31", r4(r.equipmentArea)); sumW = r.equipmentArea; }
  set("W36", r4(sumW)); set("X36", r4(sumX)); set("Y36", r4(sumW + sumX));
  set("M37", r4(sumM)); set("O37", r4(sumO)); set("Q37", r4(sumM + sumO)); set("R37", r4(sumR)); set("T37", r4(sumT)); set("V37", r4(sumR + sumT));
  set("W37", r4(sumW)); set("X37", r4(sumX)); set("Y37", r4(sumM + sumO + sumR + sumT + sumW + sumX));

  // 헤더 이름
  set("M6", useLabel); set("R6", useLabel); set("T6", "부대시설"); set("AA6", `${useLabel} ${word}수`);

  // ── 설계개요 (좌측) ──
  set("B2", title); set("C5", title); set("C7", address);
  set("C10", extra.zones ?? (project.review?.landUse ?? []).map((l) => l.name).join(", "));
  if (project.site.blockNo) set("C13", `획지 ${project.site.blockNo}`);
  set("D13", r4(A)); set("D15", r4(A));
  set("C18", useLabel); set("D18", resFloors === floors ? `지상1층~지상${floors}층` : `지상${firstRes}층~지상${floors}층`);
  set("H18", `${r.units} ${word}`); set("I18", "100%");
  set("C19", r.amenityArea ? "부대시설" : null); set("D19", r.amenityArea ? (amenityFloors > 1 ? `지상1층~지상${amenityFloors}층` : "지상1층") : null);
  set("C20", null); set("D20", null);
  set("D23", `${bFloors ? `지하${bFloors}층~` : ""}지상${floors}층`); set("H23", `${r.units} ${word}`);
  set("C24", r4(r.plannedBuildingArea)); set("C25", r4(r.aboveGroundArea)); set("C26", r4(r.basementArea));
  set("C27", r4(r.totalFloorArea)); set("F27", `(${(r.totalFloorArea * PY).toLocaleString("ko-KR", { maximumFractionDigits: 2 })} 평)`);
  set("C28", r4(r.aboveGroundArea));
  set("C29", A ? r.plannedBuildingArea / A : null); set("F29", `(법정 : ${r.bcrLimit ?? "-"}%)`);
  set("C30", A ? r.aboveGroundArea / A : null); set("F30", `(법정 : ${r.farApplied ?? "-"}%${r.farMode === "base" ? "" : ` · ${r.farLabel}`})`);
  set("H30", `${useLabel} 용적률`); set("I30", A ? (r.exclusiveTotal + r.residentialCommon) / A : null);
  set("C32", `${bFloors ? `지하${bFloors}층~` : ""}지상${floors}층`); set("F32", `최고높이 : ${r.heightEstimate}m (추정)`);
  const openRatio = project.rows.find((x) => x.id === "bld.openspace")?.params?.publicOpenSpaceRatio;
  if (r.openSpaceRequired && openRatio) { set("D33", r4(A * openRatio / 100)); set("D34", r4(A * openRatio / 100)); set("F33", `(법정 : ${openRatio}%)`); }
  else { set("D33", "-"); set("D34", "-"); set("F33", r.openSpaceRequired === false ? "(대상 아님)" : "(대상 여부 확인)"); }
  if (r.landscapeArea !== null) { set("D35", r.landscapeArea); set("D36", r.landscapeArea); set("F35", `(법정 : ${A ? Math.round(r.landscapeArea / A * 1000) / 10 : "-"}%)`); }
  else { set("D35", "-"); set("D36", "-"); set("F35", "(조경 기준 확인)"); }

  // 주차장
  const p = r.parking;
  set("C39", useLabel);
  set("D39", p.special03 !== null ? `${word}당 0.3대(전용 30㎡ 미만 완화조건)` : extra.parkingRule ?? (p.ratio ? `${word}당 ${p.ratio}대` : "조례 기준"));
  set("F39", p.legal ?? p.special03); set("G39", p.applied); set("H39", p.applied && (p.special03 ?? p.legal) ? p.applied / (p.special03 ?? p.legal)! : null);
  set("C40", p.mechanical ? "(기계식 포함)" : null); set("D40", p.mechanical ? `자주식 ${p.self}대 / 기계식 ${p.mechanical}대` : null);
  set("F43", p.special03 ?? p.legal); set("G43", p.applied);

  // 비고
  const remark = [...r.blockers.map((b) => "불가: " + b), ...r.conditions, ...r.missing.map((m) => "근거 필요: " + m), ...notes].slice(0, 12);
  set("C48", remark.length ? remark.map((x) => "· " + x).join("\n") : null);

  // ── 타입별 면적 (오피스텔/공동주택) ──
  set("K39", `■ ${useLabel}`);
  const totalSupply = r.types.reduce((a, t) => a + t.supplyArea * t.count, 0);
  const otherTotal = Math.max(0, r.types.reduce((a, t) => a + t.contractArea * t.count, 0) - totalSupply - r.parking.area - r.amenityArea);
  r.types.slice(0, 4).forEach((t, i) => {
    const row = 42 + i;
    const share = totalSupply ? (t.supplyArea * t.count) / totalSupply : 0;
    const per = (v: number) => (t.count ? r4((v * share) / t.count) : 0);
    const common = r4(t.supplyArea - t.exclusive);
    const other = per(otherTotal), amen = per(r.amenityArea), park = per(r.parking.area);
    const contract = r4(t.supplyArea + other + amen + park);
    set(`L${row}`, t.type.name); set(`M${row}`, t.count); set(`N${row}`, r.units ? t.count / r.units : 0);
    set(`O${row}`, t.exclusive); set(`P${row}`, `(${(t.exclusive * PY).toFixed(2)} 평)`);
    set(`Q${row}`, common); set(`R${row}`, `(${(common * PY).toFixed(2)} 평)`);
    set(`S${row}`, r4(t.supplyArea)); set(`T${row}`, `(${(t.supplyArea * PY).toFixed(2)} 평)`);
    set(`U${row}`, other); set(`V${row}`, `(${(other * PY).toFixed(2)} 평)`);
    set(`W${row}`, amen); set(`X${row}`, park); set(`Y${row}`, `(${(park * PY).toFixed(2)} 평)`);
    set(`Z${row}`, contract); set(`AA${row}`, `(${(contract * PY).toFixed(2)} 평)`);
    set(`AB${row}`, contract ? t.exclusive / contract : null);
  });
  if (r.types.length > 4) notes.push(`타입 ${r.types.length}개 중 4개까지만 타입 표에 표시`);
  const totEx = r.exclusiveTotal, totCo = r.residentialCommon;
  for (const row of [46, 47]) {
    set(`M${row}`, r.units); set(`N${row}`, 1); set(`O${row}`, r4(totEx)); set(`Q${row}`, r4(totCo));
    set(`S${row}`, r4(totEx + totCo)); set(`T${row}`, r4((totEx + totCo) * PY));
    set(`U${row}`, r4(otherTotal)); set(`X${row}`, r4(r.parking.area)); set(`Z${row}`, r4(totEx + totCo + otherTotal + r.parking.area + (row === 47 ? r.amenityArea : 0)));
  }
  set("W47", r4(r.amenityArea)); set("R47", r4(totCo * PY)); set("V47", r4(otherTotal * PY)); set("Y47", r4(r.parking.area * PY));
  set("AA47", r4((totEx + totCo + otherTotal + r.parking.area + r.amenityArea) * PY));

  // ── 전체사업 면적개요 ──
  const total = r.totalFloorArea || 1;
  const amenEquip = r.aboveGroundArea ? r.equipmentArea * (r.amenityArea / r.aboveGroundArea) : 0;
  const mainEquip = r.equipmentArea - amenEquip;
  const mainTotal = totEx + totCo + mainEquip + r.parking.area;
  set("B57", useLabel); set("C57", r4(totEx)); set("D57", r4(totCo)); set("E57", r4(totEx + totCo)); set("F57", r4(mainEquip)); set("G57", r4(r.parking.area)); set("H57", r4(mainTotal)); set("I57", mainTotal / total);
  for (const [col, v] of [["C", totEx], ["D", totCo], ["E", totEx + totCo], ["F", mainEquip], ["G", r.parking.area], ["H", mainTotal]] as const) set(`${col}58`, r4(v * PY));
  set("B59", null);
  const amenTotal = r.amenityArea + amenEquip;
  set("C61", r4(r.amenityArea * 0.7)); set("D61", r4(r.amenityArea * 0.3)); set("E61", r4(r.amenityArea)); set("F61", r4(amenEquip)); set("G61", 0); set("H61", r4(amenTotal)); set("I61", amenTotal / total);
  for (const [col, v] of [["C", r.amenityArea * 0.7], ["D", r.amenityArea * 0.3], ["E", r.amenityArea], ["F", amenEquip], ["H", amenTotal]] as const) set(`${col}62`, r4(v * PY));
  const sums = { C: totEx + r.amenityArea * 0.7, D: totCo + r.amenityArea * 0.3, E: totEx + totCo + r.amenityArea, F: r.equipmentArea, G: r.parking.area, H: mainTotal + amenTotal };
  for (const [col, v] of Object.entries(sums)) { set(`${col}67`, r4(v)); set(`${col}68`, r4(v * PY)); }
  set("I67", (mainTotal + amenTotal) / total);
  set("K59", "■ 근린생활시설 (계획 없음)");

  // 시트 이름: "공동주택 400%" 처럼 짧게 (엑셀 31자 제한)
  const short = `${USE_SHORT[s.use]} ${r.farMode === "base" ? "기본" : `${r.farApplied ?? ""}%`}${s.parking === "mixed" ? " 기계식" : ""}${s.apply03 ? " 0.3대" : ""}`;
  return { name: short.replace(/[\\/?*[\]:]/g, " ").slice(0, 28), cells, notes };
}

/** 주차 기준 문구 (개요표 주차장 '법규' 칸) */
export function parkingRuleText(project: Project, use: "apartment" | "urban" | "officetel") {
  const key = use === "apartment" ? "parkingApartmentTiers" : use === "urban" ? "parkingUrbanTiers" : "parkingOfficetelTiers";
  const row = project.rows.find((r) => r.params?.[key]);
  const tiers = row?.params?.[key] as ParkingTier[] | undefined;
  return tiers ? describeTiers(tiers, UNIT_WORD[use]) : undefined;
}

export { USE_SHORT };
