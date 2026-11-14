/**
 * 개략 건축규모 산정 엔진.
 * 법규 수치는 resolveParams()가 돌려준 값(원문 확인·검토자 입력 행)만 사용하고,
 * 배치·면적 효율 같은 설계 가정은 Assumptions / Scenario에서 받는다.
 * 모든 결과는 설계도서 이전의 개략 검토값이다.
 */
import { tierRatio, describeTiers } from "../review/parking-rules";
import type { ResolvedParams } from "../review/params";
import type { Assumptions, BusinessType, ParkingTier, Scenario, SiteInput, UnitType, UseKind, UseVerdict } from "../review/types";
import { USE_SHORT, UNIT_WORD } from "../review/types";

export type Feasibility = "ok" | "conditional" | "blocked" | "insufficient";

export interface TypeResult {
  type: UnitType;
  count: number;
  exclusive: number;      // 1세대(호) 전용
  supplyArea: number;     // 공동주택: 공급면적 / 오피스텔: 지상 용적률 산정면적
  contractArea: number;   // 계약면적
}

export interface ParkingBreakdown {
  ratio: number | null;
  legal: number | null;
  special03: number | null;
  applied: number | null;
  self: number;
  mechanical: number;
  accessible: number;
  area: number;
  mechanicalCap: number | null;
}

export interface Check { label: string; limit: string; planned: string; ok: boolean | null }

export interface ScenarioResult {
  scenario: Scenario;
  feasibility: Feasibility;
  blockers: string[];
  conditions: string[];
  missing: string[];
  warnings: string[];
  formulas: string[];
  checks: Check[];
  siteArea: number;
  bcrLimit: number | null;
  farApplied: number | null;
  farMode: "base" | "relaxed";
  maxBuildingArea: number;
  legalMaxFloorArea: number;      // 법규상 최대 용적률 산정 연면적
  plannedBuildingArea: number;    // 계획 건축면적 (기준층)
  units: number;
  unitsByFar: number;
  unitsByEnvelope: number | null;
  types: TypeResult[];
  exclusiveTotal: number;
  residentialCommon: number;
  amenityArea: number;
  aboveGroundArea: number;        // 계획 가능 연면적 = 용적률 산정 연면적 (지상)
  floorsAbove: number;
  legalFloors: number | null;
  heightEstimate: number;
  parking: ParkingBreakdown;
  equipmentArea: number;
  basementNeeded: number;
  basementPlate: number;
  floorsBelow: number;
  basementArea: number;
  totalFloorArea: number;
  plannedBcr: number;
  plannedFar: number;
  landscapeArea: number | null;
  exclusiveRatio: number;         // 전용률 (공동주택: 전용/공급, 오피스텔: 전용/계약)
  openSpaceRequired: boolean | null;
}

const r2 = (v: number) => Math.round(v * 100) / 100;
const fmt = (v: number, d = 1) => v.toLocaleString("ko-KR", { maximumFractionDigits: d });
const ceil = (v: number) => Math.ceil(Math.max(0, v) - 1e-9);

const VERDICT_KEY: Record<UseKind, { use: "useApartment" | "useUrban" | "useOfficetel"; mech: "mechApartment" | "mechUrban" | "mechOfficetel"; lh: "lhMechApartment" | "lhMechUrban" | "lhMechOfficetel"; parking: "parkingApartment" | "parkingUrban" | "parkingOfficetel"; tiers: "parkingApartmentTiers" | "parkingUrbanTiers" | "parkingOfficetelTiers" }> = {
  apartment: { use: "useApartment", mech: "mechApartment", lh: "lhMechApartment", parking: "parkingApartment", tiers: "parkingApartmentTiers" },
  urban: { use: "useUrban", mech: "mechUrban", lh: "lhMechUrban", parking: "parkingUrban", tiers: "parkingUrbanTiers" },
  officetel: { use: "useOfficetel", mech: "mechOfficetel", lh: "lhMechOfficetel", parking: "parkingOfficetel", tiers: "parkingOfficetelTiers" },
};

export const DEFAULT_ASSUMPTIONS: Assumptions = {
  floorPlateRatio: 85,
  basementRatio: 80,
  selfParkingArea: 33,
  mechanicalParkingArea: 16,
  mechanicalStaging: 60,
  equipmentRatio: 2.5,
  equipmentMin: 60,
  groundFloorHeight: 4.5,
  amenityApartment: 1.2,
  amenityOfficetel: 0.8,
  otherCommonRatio: 100,
};

export function defaultScenario(use: UseKind, id: string, overrides: Partial<Scenario> = {}): Scenario {
  const base: Record<UseKind, Pick<Scenario, "types" | "efficiency" | "farEfficiency" | "floorHeight">> = {
    apartment: { types: [{ id: "t1", name: "46A", exclusive: 46, share: 100, supply: "newlywed" }], efficiency: 75, farEfficiency: 75, floorHeight: 2.9 },
    urban: { types: [{ id: "t1", name: "26A", exclusive: 26, share: 100, supply: "youth" }], efficiency: 72, farEfficiency: 72, floorHeight: 2.9 },
    officetel: { types: [{ id: "t1", name: "25A", exclusive: 25, share: 100, supply: "youth" }], efficiency: 45, farEfficiency: 70, floorHeight: 3.1 },
  };
  return {
    id, name: USE_SHORT[use], use, farMode: "base", parking: "self", mechanicalShare: 0, apply03: false,
    unitsPerFloor: 0, ...base[use], ...overrides,
  };
}

function distribute(total: number, types: UnitType[]): number[] {
  const shares = types.map((t) => Math.max(0, t.share));
  const sum = shares.reduce((a, b) => a + b, 0) || 1;
  const raw = shares.map((s) => (total * s) / sum);
  const counts = raw.map(Math.floor);
  let rest = total - counts.reduce((a, b) => a + b, 0);
  const order = raw.map((v, i) => [v - Math.floor(v), i] as const).sort((a, b) => b[0] - a[0]);
  for (const [, i] of order) { if (rest <= 0) break; counts[i] += 1; rest -= 1; }
  return counts;
}

export interface MassingInput {
  params: ResolvedParams;
  scenario: Scenario;
  assumptions: Assumptions;
  site: Pick<SiteInput, "business" | "supplies" | "transitWithin500m">;
}

export function runScenario({ params, scenario, assumptions: a, site }: MassingInput): ScenarioResult {
  const blockers: string[] = [], conditions: string[] = [], missing: string[] = [], warnings: string[] = [], formulas: string[] = [];
  const keys = VERDICT_KEY[scenario.use];
  const word = UNIT_WORD[scenario.use];
  const lh = site.business === "lh-purchase";
  const A = Number(params.siteArea?.value ?? 0);
  const bcr = params.bcr?.value as number | undefined;
  const baseFar = params.far?.value as number | undefined;
  const relaxed = params.relaxedFar?.value as number | undefined;
  if (!A) missing.push("대지면적");
  if (bcr === undefined) missing.push("건폐율 (원문 확인 또는 검토자 입력)");
  if (baseFar === undefined) missing.push("기본 용적률 (원문 확인 또는 검토자 입력)");
  let farApplied: number | undefined = baseFar;
  if (scenario.farMode === "relaxed") {
    if (relaxed === undefined) missing.push("완화 용적률 (완화 요건 확인 후 법규검토표에서 확정)");
    farApplied = relaxed;
  }

  const useVerdict = params[keys.use]?.value as UseVerdict | undefined;
  if (useVerdict === "prohibited") blockers.push(`${USE_SHORT[scenario.use]}: 법규상 허용되지 않는 용도 (규모검토 대상 제외)`);
  else if (useVerdict === "conditional") conditions.push(`${USE_SHORT[scenario.use]} 허용 조건부 (법규검토표 비고 확인)`);
  else if (!useVerdict) conditions.push(`${USE_SHORT[scenario.use]} 허용 여부 근거 미확정`);

  const types = scenario.types.filter((t) => t.exclusive > 0 && t.share > 0);
  if (!types.length) missing.push("타입 구성 (전용면적·구성비)");
  const shareSum = types.reduce((s, t) => s + t.share, 0) || 1;
  const avgExclusive = types.reduce((s, t) => s + t.exclusive * t.share, 0) / shareSum;
  const farEff = Math.min(95, Math.max(20, scenario.farEfficiency || scenario.efficiency)) / 100;
  const contractEff = Math.min(95, Math.max(20, scenario.efficiency)) / 100;
  const grossPerUnit = avgExclusive > 0 ? avgExclusive / farEff : 0;

  // 높이·층수 제한
  const maxFloors = params.maxFloors?.value as number | undefined;
  const maxHeight = params.maxHeight?.value as number | undefined;
  const floorsByHeight = maxHeight && maxHeight >= a.groundFloorHeight
    ? Math.floor((maxHeight - a.groundFloorHeight) / scenario.floorHeight) + 1 : undefined;
  const legalFloors = [maxFloors, floorsByHeight].filter((v): v is number => typeof v === "number" && v > 0);
  const floorLimit = legalFloors.length ? Math.min(...legalFloors) : null;
  if (floorLimit === null) warnings.push("최고높이·층수 제한 미확정: 용적률·건폐율 기준으로만 산정 (일조·인동거리 검토 후 층수 조정 필요)");

  const empty = (): ScenarioResult => ({
    scenario, feasibility: blockers.length ? "blocked" : "insufficient", blockers, conditions, missing, warnings, formulas, checks: [],
    siteArea: A, bcrLimit: bcr ?? null, farApplied: farApplied ?? null, farMode: scenario.farMode,
    maxBuildingArea: 0, legalMaxFloorArea: 0, plannedBuildingArea: 0, units: 0, unitsByFar: 0, unitsByEnvelope: null,
    types: types.map((type) => ({ type, count: 0, exclusive: type.exclusive, supplyArea: 0, contractArea: 0 })),
    exclusiveTotal: 0, residentialCommon: 0, amenityArea: 0, aboveGroundArea: 0, floorsAbove: 0, legalFloors: floorLimit, heightEstimate: 0,
    parking: { ratio: null, legal: null, special03: null, applied: null, self: 0, mechanical: 0, accessible: 0, area: 0, mechanicalCap: null },
    equipmentArea: 0, basementNeeded: 0, basementPlate: 0, floorsBelow: 0, basementArea: 0, totalFloorArea: 0,
    plannedBcr: 0, plannedFar: 0, landscapeArea: null, exclusiveRatio: 0, openSpaceRequired: null,
  });
  if (blockers.length || missing.length) return empty();

  const bcrV = bcr as number, farV = farApplied as number;
  const maxBuildingArea = A * bcrV / 100;
  const legalMaxFloorArea = A * farV / 100;
  let plannedBuildingArea = maxBuildingArea * a.floorPlateRatio / 100;
  if (scenario.unitsPerFloor > 0) {
    const byUnits = scenario.unitsPerFloor * grossPerUnit;
    if (byUnits > maxBuildingArea) warnings.push(`기준층 ${scenario.unitsPerFloor}${word} 조합(${fmt(byUnits)}㎡)이 최대 건축면적 ${fmt(maxBuildingArea)}㎡를 초과하여 건폐율 한도로 축소`);
    plannedBuildingArea = Math.min(byUnits, maxBuildingArea);
  }

  // LH 커뮤니티 기준 (확정 수치가 있을 때만)
  const commThreshold = params.lhCommunityThreshold?.value as number | undefined;
  const commSqm = params.lhCommunitySqmPerHome?.value as number | undefined;
  const amenityPer = scenario.use === "officetel" ? a.amenityOfficetel : a.amenityApartment;
  const amenityFor = (u: number) => {
    const base = u * amenityPer;
    const lhMin = lh && commThreshold && commSqm && u >= commThreshold ? u * commSqm : 0;
    return Math.max(base, lhMin);
  };
  const solve = (limit: number) => {
    if (grossPerUnit <= 0 || !Number.isFinite(limit)) return 0;
    let u = Math.floor(limit / grossPerUnit);
    for (let i = 0; i < 20; i++) {
      const next = Math.max(0, Math.floor((limit - amenityFor(u)) / grossPerUnit));
      if (next === u) break;
      u = next;
    }
    while (u > 0 && u * grossPerUnit + amenityFor(u) > limit + 1e-6) u -= 1;
    return u;
  };
  const envelope = floorLimit !== null ? plannedBuildingArea * floorLimit : Infinity;
  const unitsByFar = solve(legalMaxFloorArea);
  const unitsByEnvelope = floorLimit !== null ? solve(envelope) : null;
  const units = Math.min(unitsByFar, unitsByEnvelope ?? Infinity);
  if (unitsByEnvelope !== null && unitsByEnvelope < unitsByFar) warnings.push(`층수 제한(${floorLimit}층)으로 용적률 한도보다 ${unitsByFar - unitsByEnvelope}${word} 적게 계획됨`);

  const counts = distribute(units, types);
  const amenityArea = units > 0 ? amenityFor(units) : 0;
  const exclusiveTotal = types.reduce((s, t, i) => s + t.exclusive * counts[i], 0);
  const residentialGross = types.reduce((s, t, i) => s + (t.exclusive / farEff) * counts[i], 0);
  const residentialCommon = residentialGross - exclusiveTotal;
  const aboveGroundArea = residentialGross + amenityArea;
  const floorsAbove = plannedBuildingArea > 0 ? ceil(aboveGroundArea / plannedBuildingArea) : 0;
  const heightEstimate = floorsAbove > 0 ? a.groundFloorHeight + (floorsAbove - 1) * scenario.floorHeight : 0;

  // 주차
  const ratio = params[keys.parking]?.value as number | undefined;
  const tiers = params[keys.tiers]?.value as ParkingTier[] | undefined;
  if (ratio === undefined && !tiers?.length) conditions.push(`${USE_SHORT[scenario.use]} 법정 주차기준(대/${word}) 미확정: 주차·지하층 산정 보류`);
  // 조례 별표의 세대(호)당 최소대수 구간: 타입별 전용면적으로 대수를 합산
  const byTiers = tiers?.length ? ceil(types.reduce((s, t, i) => s + counts[i] * tierRatio(tiers, t.exclusive), 0)) : null;
  const byRatio = ratio !== undefined ? ceil(units * ratio) : null;
  const legal = byTiers !== null || byRatio !== null ? Math.max(byTiers ?? 0, byRatio ?? 0) : null;
  if (byTiers !== null && byRatio === null) conditions.push(`법정주차 = 조례 별표 ${word}당 최소대수(${describeTiers(tiers!, word as "세대" | "호")}) 적용 · 「주택건설기준」 제27조 전용면적 합계 기준 산정치가 더 크면 그 값`);
  let special03: number | null = null;
  if (scenario.apply03) {
    const v03 = params.lhParking03?.value as UseVerdict | undefined;
    const maxArea = (params.lhParking03MaxArea?.value as number | undefined) ?? 30;
    const reasons: string[] = [];
    if (!lh) reasons.push("LH 매입약정 사업 아님");
    if (!v03 || v03 === "prohibited") reasons.push("0.3대 특례 적용 근거가 법규검토표에서 확인되지 않음");
    if (types.some((t) => t.exclusive >= maxArea)) reasons.push(`전용 ${maxArea}㎡ 이상 타입 포함`);
    if (site.supplies.includes("youth") && !site.transitWithin500m) reasons.push("청년형: 역 출구·대학 500m 입지 미확인");
    if (reasons.length) conditions.push("0.3대 특례 미적용: " + reasons.join(", "));
    else {
      special03 = ceil(units * 0.3);
      if (v03 === "conditional") conditions.push("0.3대 특례: LH 선정심의·매입약정·허가권자 협의 조건부");
    }
  }
  const applied = special03 ?? legal;
  const accessible = applied ? Math.max(1, ceil(applied * 0.03)) : 0;
  let mechanical = 0;
  let mechanicalCap: number | null = null;
  if (scenario.parking === "mixed" && applied) {
    const ord = params[keys.mech]?.value as UseVerdict | undefined;
    const lhv = params[keys.lh]?.value as UseVerdict | undefined;
    if (ord === "prohibited") blockers.push("조례상 해당 용도 기계식주차 설치 불가");
    else if (!ord) conditions.push("조례상 기계식 허용 근거 미확정: 기계식 0대(자주식)로 산정");
    if (lh && lhv === "prohibited") blockers.push("LH 기계식주차 인수 대상 아님");
    else if (lh && !lhv) conditions.push("LH 기계식 인수기준 미확정");
    if (ord && ord !== "prohibited" && !(lh && lhv === "prohibited")) {
      const caps = [scenario.mechanicalShare, params.mechMaxPercent?.value as number | undefined, lh ? params.lhMechMaxPercent?.value as number | undefined : undefined]
        .filter((v): v is number => typeof v === "number");
      mechanicalCap = Math.min(...caps);
      mechanical = Math.max(0, Math.min(applied - accessible, Math.floor(applied * mechanicalCap / 100)));
      const minStalls = params.mechMinStalls?.value as number | undefined;
      if (minStalls && mechanical < minStalls) {
        conditions.push(`조례상 기계식 최소 ${minStalls}대 미만 (${mechanical}대) → 기계식 불가, 자주식으로 산정`);
        mechanical = 0;
      }
      if (ord === "conditional") conditions.push("조례 기계식 설치 조건부 (연면적·층수 등 비고 확인)");
      if (special03 !== null && lh) warnings.push("LH: 0.3대 완화 적용 시 기계식 설치 지양 기준 확인");
    }
  }
  const self = applied ? applied - mechanical : 0;
  const parkingArea = self * a.selfParkingArea + mechanical * a.mechanicalParkingArea + (mechanical > 0 ? a.mechanicalStaging : 0);
  const equipmentArea = aboveGroundArea > 0 ? Math.max(a.equipmentMin, aboveGroundArea * a.equipmentRatio / 100) : 0;
  const basementPlate = A * a.basementRatio / 100;
  const basementNeeded = parkingArea + equipmentArea;
  const floorsBelow = applied !== null && basementPlate > 0 ? ceil(basementNeeded / basementPlate) : 0;
  const basementArea = applied !== null ? Math.max(basementNeeded, 0) : equipmentArea;
  const totalFloorArea = aboveGroundArea + basementArea;
  if (floorsBelow >= 4) warnings.push(`지하 ${floorsBelow}층 필요: 굴토·공사비 부담 및 LH 지하층 지양 기준 확인`);

  // 면적 배분 (계약면적)
  const otherCommon = (amenityArea + basementArea) * a.otherCommonRatio / 100;
  const typeResults: TypeResult[] = types.map((type, i) => {
    const supplyArea = type.exclusive / farEff;
    const contractArea = scenario.use === "officetel"
      ? type.exclusive / contractEff
      : supplyArea + (residentialGross > 0 ? otherCommon * supplyArea / residentialGross : 0);
    return { type, count: counts[i], exclusive: type.exclusive, supplyArea: r2(supplyArea), contractArea: r2(contractArea) };
  });
  const exclusiveRatio = scenario.use === "officetel" ? contractEff * 100 : farEff * 100;
  if (scenario.use === "officetel") {
    const contractSum = typeResults.reduce((s, t) => s + t.contractArea * t.count, 0);
    if (contractSum > 0 && Math.abs(contractSum - totalFloorArea) / totalFloorArea > 0.15)
      warnings.push(`오피스텔 계약면적 합계 ${fmt(contractSum)}㎡와 총연면적 ${fmt(totalFloorArea)}㎡ 차이 ${fmt(Math.abs(contractSum - totalFloorArea) / totalFloorArea * 100)}%: 전용률 가정 확인`);
  }

  const landscapeRatio = params.landscapeRatio?.value as number | undefined;
  const plannedBcr = A > 0 ? plannedBuildingArea / A * 100 : 0;
  const plannedFar = A > 0 ? aboveGroundArea / A * 100 : 0;
  const openSpaceRequired = scenario.use === "officetel" ? aboveGroundArea >= 5000 : false;
  if (openSpaceRequired) conditions.push("오피스텔 바닥면적 5,000㎡ 이상: 공개공지 대상 여부 확인 (법규검토표 공개공지 행)");

  const lhMin = params.lhMinHomes?.value as number | undefined;
  if (lh && lhMin && units < lhMin) conditions.push(`LH 최소 매입 ${lhMin}호 미달 (${units}${word})`);

  const checks: Check[] = [
    { label: "건폐율", limit: `${bcrV}% 이하`, planned: `${fmt(plannedBcr, 2)}%`, ok: plannedBcr <= bcrV + 1e-6 },
    { label: "용적률", limit: `${fmt(farV)}% 이하${scenario.farMode === "relaxed" ? " (완화)" : ""}`, planned: `${fmt(plannedFar, 2)}%`, ok: plannedFar <= farV + 1e-6 },
    { label: "층수", limit: floorLimit !== null ? `${floorLimit}층 이하` : "제한 미확정", planned: `지상 ${floorsAbove}층`, ok: floorLimit !== null ? floorsAbove <= floorLimit : null },
    ...(maxHeight ? [{ label: "높이", limit: `${maxHeight}m 이하`, planned: `${fmt(heightEstimate)}m`, ok: heightEstimate <= maxHeight }] : []),
    ...(lh && lhMin ? [{ label: "LH 최소 호수", limit: `${lhMin}호 이상`, planned: `${units}${word}`, ok: units >= lhMin }] : []),
  ];

  formulas.push(
    `최대 건축면적 = 대지 ${fmt(A, 2)}㎡ × 건폐율 ${bcrV}% = ${fmt(maxBuildingArea, 2)}㎡`,
    `법규상 최대 연면적(용적률 산정) = ${fmt(A, 2)}㎡ × ${fmt(farV)}% = ${fmt(legalMaxFloorArea, 2)}㎡`,
    scenario.unitsPerFloor > 0
      ? `계획 건축면적 = min(기준층 ${scenario.unitsPerFloor}${word} × ${fmt(grossPerUnit, 2)}㎡, 최대 건축면적) = ${fmt(plannedBuildingArea, 2)}㎡`
      : `계획 건축면적 = 최대 건축면적 × 배치효율 ${a.floorPlateRatio}% = ${fmt(plannedBuildingArea, 2)}㎡`,
    `${word}당 지상 면적 = 평균 전용 ${fmt(avgExclusive, 2)}㎡ ÷ ${fmt(farEff * 100, 0)}% = ${fmt(grossPerUnit, 2)}㎡`,
    `${word}수 = (연면적 한도 − 부대시설) ÷ ${word}당 면적 → 용적률 기준 ${unitsByFar}${word}${unitsByEnvelope !== null ? `, 층수 기준 ${unitsByEnvelope}${word}` : ""} → ${units}${word}`,
    `계획 가능 연면적(지상) = 주거 ${fmt(residentialGross, 2)}㎡ + 부대시설 ${fmt(amenityArea, 2)}㎡ = ${fmt(aboveGroundArea, 2)}㎡`,
    `지상 층수 = ${fmt(aboveGroundArea, 2)}㎡ ÷ ${fmt(plannedBuildingArea, 2)}㎡ = ${floorsAbove}층`,
    ratio !== undefined ? `법정 주차 = ${units}${word} × ${ratio}대 = ${legal}대${special03 !== null ? ` / 0.3대 특례 ${special03}대` : ""}` : "법정 주차 = 기준 미확정",
    applied !== null ? `주차면적 = 자주식 ${self}대 × ${a.selfParkingArea}㎡ + 기계식 ${mechanical}대 × ${a.mechanicalParkingArea}㎡${mechanical ? ` + 대기 ${a.mechanicalStaging}㎡` : ""} = ${fmt(parkingArea, 2)}㎡` : "주차면적 = 산정 보류",
    applied !== null
      ? `지하 소요면적 = 주차 ${fmt(parkingArea, 2)}㎡ + 기계·전기실 ${fmt(equipmentArea, 2)}㎡ = ${fmt(basementNeeded, 2)}㎡ ÷ 지하 계획면적 ${fmt(basementPlate, 2)}㎡ = 지하 ${floorsBelow}층`
      : "지하층 = 법정 주차기준 미확정으로 산정 보류",
  );

  const feasibility: Feasibility = blockers.length ? "blocked" : conditions.length ? "conditional" : "ok";
  return {
    scenario, feasibility, blockers, conditions, missing, warnings, formulas, checks,
    siteArea: A, bcrLimit: bcrV, farApplied: farV, farMode: scenario.farMode,
    maxBuildingArea: r2(maxBuildingArea), legalMaxFloorArea: r2(legalMaxFloorArea), plannedBuildingArea: r2(plannedBuildingArea),
    units, unitsByFar, unitsByEnvelope, types: typeResults,
    exclusiveTotal: r2(exclusiveTotal), residentialCommon: r2(residentialCommon), amenityArea: r2(amenityArea),
    aboveGroundArea: r2(aboveGroundArea), floorsAbove, legalFloors: floorLimit, heightEstimate: r2(heightEstimate),
    parking: { ratio: ratio ?? null, legal, special03, applied, self, mechanical, accessible, area: r2(parkingArea), mechanicalCap },
    equipmentArea: r2(equipmentArea), basementNeeded: r2(basementNeeded), basementPlate: r2(basementPlate), floorsBelow,
    basementArea: r2(basementArea), totalFloorArea: r2(totalFloorArea),
    plannedBcr: r2(plannedBcr), plannedFar: r2(plannedFar),
    landscapeArea: landscapeRatio !== undefined ? r2(A * landscapeRatio / 100) : null,
    exclusiveRatio: r2(exclusiveRatio), openSpaceRequired,
  };
}

/** 최종 건축개요표 (구분 / 계획 내용) */
export function summaryRows(res: ScenarioResult): Array<[string, string]> {
  const s = res.scenario;
  const word = UNIT_WORD[s.use];
  const ok = res.feasibility !== "insufficient" && res.feasibility !== "blocked";
  const v = (n: number, d = 2) => ok ? `${fmt(n, d)}㎡` : "—";
  return [
    ["대지면적", res.siteArea ? `${fmt(res.siteArea, 2)}㎡` : "—"],
    ["건축면적", v(res.plannedBuildingArea)],
    ["건폐율", ok ? `${fmt(res.plannedBcr, 2)}% (법정 ${res.bcrLimit}% 이하)` : "—"],
    ["용적률", ok ? `${fmt(res.plannedFar, 2)}% (${res.farMode === "relaxed" ? "완화" : "기본"} ${fmt(res.farApplied ?? 0)}% 이하)` : "—"],
    ["용적률 산정 연면적", v(res.aboveGroundArea)],
    ["법규상 최대 연면적", ok ? `${fmt(res.legalMaxFloorArea, 2)}㎡` : "—"],
    ["지상 연면적", v(res.aboveGroundArea)],
    ["지하 연면적", ok && res.parking.applied !== null ? v(res.basementArea) : "산정 보류"],
    ["총연면적", ok && res.parking.applied !== null ? v(res.totalFloorArea) : "산정 보류"],
    ["규모", ok ? `${res.parking.applied !== null ? `지하 ${res.floorsBelow}층` : "지하 미정"} / 지상 ${res.floorsAbove}층` : "—"],
    ["세대수", ok ? `${res.units}${word}` : "—"],
    ["타입별 구성", ok ? res.types.map((t) => `${t.type.name}(${fmt(t.exclusive, 2)}㎡) ${t.count}${word}`).join(", ") : "—"],
    ["법정주차대수", res.parking.legal !== null ? `${res.parking.legal}대${res.parking.special03 !== null ? ` (0.3대 특례 ${res.parking.special03}대)` : ""}` : "기준 미확정"],
    ["계획주차대수", res.parking.applied !== null ? `자주식 ${res.parking.self}대 / 기계식 ${res.parking.mechanical}대` : "—"],
    ["부대복리시설", v(res.amenityArea)],
    ["조경면적", res.landscapeArea !== null ? `${fmt(res.landscapeArea, 2)}㎡` : "기준 미확정"],
  ];
}

export const FEASIBILITY_LABEL: Record<Feasibility, string> = {
  ok: "법규 충족", conditional: "조건부", blocked: "불가", insufficient: "근거 부족",
};
