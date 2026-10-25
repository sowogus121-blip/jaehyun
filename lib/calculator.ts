import type {
  AlternativeDefinition,
  AlternativeResult,
  CalculationContext,
  EvidenceStatus,
  FacilityResult,
  ParkingResult,
  ProjectInput,
} from "./types";

export const ALTERNATIVES: AlternativeDefinition[] = [
  { id: "A-1", name: "공동주택 · 신혼형 · 자주식", shortName: "공동주택 자주식", useType: "apartment", parkingMode: "self", exclusiveArea: 46, efficiency: 0.75 },
  { id: "A-2", name: "공동주택 · 신혼형 · 기계식", shortName: "공동주택 기계식", useType: "apartment", parkingMode: "mechanical", exclusiveArea: 46, efficiency: 0.75 },
  { id: "B-1", name: "오피스텔 · 청년형 · 자주식", shortName: "오피스텔 자주식", useType: "officetel", parkingMode: "self", exclusiveArea: 25, efficiency: 0.45 },
  { id: "B-2", name: "오피스텔 · 청년형 · 기계식", shortName: "오피스텔 기계식", useType: "officetel", parkingMode: "mechanical", exclusiveArea: 25, efficiency: 0.45 },
];

export const DEFAULT_INPUT: ProjectInput = {
  projectName: "새 프로젝트",
  address: "",
  multipleParcels: false,
  parcelList: "",
  province: "",
  district: "",
  zone: "미확인",
  districtPlan: false,
  businessMode: "undecided",
  lhSupplyType: "undecided",
  regionalOffice: "",
  userPlanNotes: "",
  siteArea: 0,
  buildableSiteRatio: 88,
  siteWidth: 0,
  siteDepth: 0,
  roadWidth: 0,
  buildingCoverageRatio: 0,
  baseFar: 0,
  relaxedFar: 0,
  useRelaxedFar: false,
  maxFloors: 0,
  maxHeight: 0,
  landscapeRatio: 0,
  floorPlateRatio: 72,
  basementCoverageRatio: 75,
  selfParkingAreaPerCar: 40,
  mechanicalAreaPerCar: 8,
  apartmentParkingRatio: 0,
  officetelParkingRatio: 0,
  lhApartmentParkingRatio: 0,
  lhOfficetelParkingRatio: 0,
  specialParkingEnabled: false,
  specialParkingApproval: "not-reviewed",
  lhParkingRatioVerified: false,
  mechanicalAllowed: true,
  mechanicalMaxRatio: 70,
  apartmentFloorHeight: 3.1,
  officetelFloorHeight: 3.3,
};

export const EXAMPLE_INPUT: ProjectInput = {
  ...DEFAULT_INPUT,
  projectName: "계산 엔진 검증 예시",
  address: "서울특별시 성동구 성수동2가 일원",
  province: "서울특별시",
  district: "성동구",
  zone: "준공업지역 (검증 예시)",
  regionalOffice: "서울지역본부",
  siteArea: 1850,
  siteWidth: 37,
  siteDepth: 50,
  roadWidth: 12,
  buildingCoverageRatio: 60,
  baseFar: 250,
  relaxedFar: 300,
  maxFloors: 15,
  maxHeight: 52,
  landscapeRatio: 15,
  apartmentParkingRatio: 1,
  officetelParkingRatio: 0.5,
  lhApartmentParkingRatio: 0.9,
  lhOfficetelParkingRatio: 0.5,
};

export const DEFAULT_CALCULATION_CONTEXT: CalculationContext = {
  planningEvidence: "unknown",
  usePermissions: { apartment: "unknown", officetel: "unknown" },
  lhPurchaseEligibility: { apartment: "unknown", officetel: "unknown" },
  mechanicalParkingEligibility: "unknown",
};

export function resetSiteDependentInput(current: ProjectInput, address: string): ProjectInput {
  return {
    ...current,
    address,
    multipleParcels: false,
    parcelList: "",
    province: "",
    district: "",
    zone: "미확인",
    districtPlan: false,
    regionalOffice: "",
    userPlanNotes: "",
    siteArea: 0,
    siteWidth: 0,
    siteDepth: 0,
    roadWidth: 0,
    buildingCoverageRatio: 0,
    baseFar: 0,
    relaxedFar: 0,
    useRelaxedFar: false,
    maxFloors: 0,
    maxHeight: 0,
    landscapeRatio: 0,
    apartmentParkingRatio: 0,
    officetelParkingRatio: 0,
    lhApartmentParkingRatio: 0,
    lhOfficetelParkingRatio: 0,
    specialParkingEnabled: false,
    specialParkingApproval: "not-reviewed",
    lhParkingRatioVerified: false,
  };
}

const ceil = (value: number) => Math.ceil(Math.max(0, value));
const round = (value: number, digits = 2) => Number(value.toFixed(digits));

export function getGrossAreaPerUnit(exclusiveArea: number, efficiency: number) {
  return exclusiveArea / efficiency;
}

export function getEvidenceStatus(hasSource: boolean, manuallyEntered = false): EvidenceStatus {
  if (hasSource) return "verified";
  if (manuallyEntered) return "user";
  return "unknown";
}

export function calculateFacilities(useType: AlternativeDefinition["useType"], units: number): FacilityResult[] {
  if (useType === "apartment") {
    return [
      { name: "관리·운영공간", required: units >= 50, basis: "50세대 이상 계획 가정 · 근거 확인 필요", area: units >= 50 ? 18 + units * 0.08 : 0, location: "지상·지하", farIncluded: true },
      { name: "주민공동공간", required: units >= 100, basis: "100세대 이상 계획 가정 · LH 기준 확인 필요", area: units >= 100 ? 30 + units * 0.12 : 0, location: "지상", farIncluded: true },
      { name: "택배보관공간", required: units >= 30, basis: "실무 계획 가정 · LH 공고 확인 필요", area: units >= 30 ? 12 + units * 0.03 : 0, location: "지상", farIncluded: true },
      { name: "폐기물 보관공간", required: units > 0, basis: "계획 필수공간 · 지자체 기준 확인 필요", area: units > 0 ? 18 + units * 0.025 : 0, location: "지상", farIncluded: true },
    ];
  }
  return [
    { name: "관리·주차관리공간", required: units >= 50, basis: "운영상 계획 가정 · 매입기준 확인 필요", area: units >= 50 ? 16 + units * 0.05 : 0, location: "지상·지하", farIncluded: true },
    { name: "공용 라운지", required: false, basis: "권장시설 · LH 매입기준 확인 필요", area: units >= 100 ? 24 + units * 0.08 : 0, location: "지상", farIncluded: true },
    { name: "택배보관공간", required: units >= 30, basis: "실무 계획 가정", area: units >= 30 ? 10 + units * 0.025 : 0, location: "지상", farIncluded: true },
    { name: "폐기물 보관공간", required: units > 0, basis: "계획 필수공간 · 지자체 기준 확인 필요", area: units > 0 ? 15 + units * 0.02 : 0, location: "지상", farIncluded: true },
  ];
}

export function isSpecialParkingEligible(input: ProjectInput, definition: AlternativeDefinition) {
  return definition.useType === "officetel" && definition.exclusiveArea < 30 && input.businessMode === "purchase" && input.specialParkingEnabled;
}

export function calculateParking(input: ProjectInput, definition: AlternativeDefinition, units: number): ParkingResult {
  const originalLegalRatio = definition.useType === "apartment" ? input.apartmentParkingRatio : input.officetelParkingRatio;
  const lhRatio = definition.useType === "apartment" ? input.lhApartmentParkingRatio : input.lhOfficetelParkingRatio;
  const specialEligible = isSpecialParkingEligible(input, definition);
  const relaxationStatus = specialEligible ? input.specialParkingApproval : "not-reviewed";
  const originalLegalCount = ceil(units * originalLegalRatio);
  const lhCount = ceil(units * lhRatio);
  const relaxedRatio = specialEligible ? 0.3 : null;
  const relaxedCount = relaxedRatio === null ? null : ceil(units * relaxedRatio);
  const verifiedLhCount = input.lhParkingRatioVerified ? lhCount : 0;
  const fallbackCount = Math.max(originalLegalCount, verifiedLhCount);
  const conditionalCount = relaxedCount === null ? null : Math.max(relaxedCount, verifiedLhCount);
  const specialApplied = relaxationStatus === "approved" && conditionalCount !== null;
  const finalCount = specialApplied ? conditionalCount : fallbackCount;
  const legalRatio = specialApplied && relaxedRatio !== null ? relaxedRatio : originalLegalRatio;
  const legalCount = specialApplied && relaxedCount !== null ? relaxedCount : originalLegalCount;
  const appliedRatio = units > 0 ? finalCount / units : 0;
  const mechanicalUsable = definition.parkingMode === "mechanical" && input.mechanicalAllowed;
  const accessibleCount = finalCount > 0 ? Math.max(1, ceil(finalCount * 0.03)) : 0;
  const evCount = finalCount > 0 ? Math.max(1, ceil(finalCount * 0.05)) : 0;
  const mechanicalCount = mechanicalUsable
    ? Math.min(finalCount - accessibleCount, Math.floor(finalCount * input.mechanicalMaxRatio / 100))
    : 0;
  const selfCount = finalCount - mechanicalCount;
  const stagingArea = mechanicalCount > 0 ? 60 : 0;
  const area = selfCount * input.selfParkingAreaPerCar + mechanicalCount * input.mechanicalAreaPerCar + stagingArea;
  const availableBasementPlate = input.siteArea * input.basementCoverageRatio / 100;

  return {
    originalLegalRatio,
    originalLegalCount,
    legalRatio,
    lhRatio,
    lhRequirementVerified: input.lhParkingRatioVerified,
    appliedRatio: round(appliedRatio, 4),
    legalCount,
    lhCount,
    relaxedRatio,
    relaxedCount,
    fallbackCount,
    conditionalCount,
    finalCount,
    selfCount,
    mechanicalCount,
    accessibleCount,
    evCount,
    area: round(area),
    basementFloors: area > 0 && availableBasementPlate > 0 ? ceil(area / availableBasementPlate) : 0,
    specialApplied,
    specialEligible,
    relaxationStatus,
    status: specialApplied || relaxationStatus === "conditional" ? "review" : "user",
  };
}

function solveUnitCount(input: ProjectInput, definition: AlternativeDefinition, farLimitArea: number, envelopeArea: number) {
  const gross = getGrossAreaPerUnit(definition.exclusiveArea, definition.efficiency);
  let units = Math.floor(Math.min(farLimitArea, envelopeArea) / gross);
  for (let i = 0; i < 12; i += 1) {
    const facilities = calculateFacilities(definition.useType, units);
    const amenity = facilities.reduce((sum, item) => sum + item.area, 0);
    const equipment = Math.max(35, units * 0.35);
    const next = Math.max(0, Math.floor((Math.min(farLimitArea, envelopeArea) - amenity - equipment) / gross));
    if (next === units) break;
    units = next;
  }
  return units;
}

export function calculateAlternative(input: ProjectInput, definition: AlternativeDefinition, context: CalculationContext = DEFAULT_CALCULATION_CONTEXT): AlternativeResult {
  const appliedFar = input.useRelaxedFar ? input.relaxedFar : input.baseFar;
  const grossAreaPerUnit = getGrossAreaPerUnit(definition.exclusiveArea, definition.efficiency);
  const buildableSite = input.siteArea * input.buildableSiteRatio / 100;
  const maxBuildableArea = Math.min(input.siteArea * input.buildingCoverageRatio / 100, buildableSite);
  const plannedBuildingArea = maxBuildableArea * input.floorPlateRatio / 100;
  const floorHeight = definition.useType === "apartment" ? input.apartmentFloorHeight : input.officetelFloorHeight;
  const heightFloors = input.maxHeight > 1.2 ? Math.floor((input.maxHeight - 1.2) / floorHeight) : 0;
  const legalMaxFloors = input.maxFloors > 0 && heightFloors > 0 ? Math.min(input.maxFloors, heightFloors) : 0;
  const farLimitArea = input.siteArea * appliedFar / 100;
  const envelopeArea = plannedBuildingArea * legalMaxFloors;
  const unitCountByFar = solveUnitCount(input, definition, farLimitArea, Number.MAX_SAFE_INTEGER);
  const unitCountByEnvelope = solveUnitCount(input, definition, Number.MAX_SAFE_INTEGER, envelopeArea);
  const unitCount = solveUnitCount(input, definition, farLimitArea, envelopeArea);
  const facilities = calculateFacilities(definition.useType, unitCount);
  const amenityArea = facilities.reduce((sum, item) => sum + item.area, 0);
  const equipmentArea = unitCount > 0 ? Math.max(35, unitCount * 0.35) : 0;
  const residentialExclusiveArea = unitCount * definition.exclusiveArea;
  const grossResidentialArea = unitCount * grossAreaPerUnit;
  const residentialCommonArea = grossResidentialArea - residentialExclusiveArea;
  const farCountedArea = grossResidentialArea + amenityArea + equipmentArea;
  const recommendedFloors = plannedBuildingArea > 0 ? Math.min(legalMaxFloors, ceil(farCountedArea / plannedBuildingArea)) : 0;
  const estimatedHeight = recommendedFloors > 0 ? 1.2 + recommendedFloors * floorHeight : 0;
  const parking = calculateParking(input, definition, unitCount);
  const belowGroundArea = farCountedArea > 0 ? parking.area + Math.max(60, farCountedArea * 0.025) : 0;
  const totalFloorArea = farCountedArea + belowGroundArea;
  const physicalMaxFloors = plannedBuildingArea > 0 ? Math.min(legalMaxFloors, ceil(envelopeArea / plannedBuildingArea)) : 0;
  const warnings: string[] = [];
  const blockingReasons: string[] = [];
  const conditionalReasons: string[] = [];

  const usePermission = context.usePermissions[definition.useType];
  const lhEligibility = context.lhPurchaseEligibility[definition.useType];
  if (usePermission === "ineligible") blockingReasons.push(`${definition.useType === "apartment" ? "공동주택" : "오피스텔"} 허용용도 부적합`);
  else if (usePermission === "unknown") conditionalReasons.push("대상지 건축 허용용도 미확인");
  else if (usePermission === "conditional") conditionalReasons.push("건축 허용용도 조건부");
  if (lhEligibility === "ineligible") blockingReasons.push("LH 사업·매입 대상 부적합");
  else if (lhEligibility === "unknown") conditionalReasons.push("LH 사업·매입 가능 여부 미확인");
  else if (lhEligibility === "conditional") conditionalReasons.push("LH 사업·매입 조건부");
  if (definition.parkingMode === "mechanical") {
    if (context.mechanicalParkingEligibility === "ineligible") blockingReasons.push("기계식주차 적용 불가");
    else if (context.mechanicalParkingEligibility !== "eligible") conditionalReasons.push("기계식주차 법적 허용·LH 인수기준 미확인");
  }
  if (context.planningEvidence !== "verified") conditionalReasons.push("건폐율·용적률·높이 확정 근거 미확보");
  if (parking.originalLegalRatio <= 0) conditionalReasons.push("법정 주차계수 미확인");

  const eligibility = blockingReasons.length > 0
    ? "ineligible" as const
    : usePermission === "unknown" || lhEligibility === "unknown"
      ? "unknown" as const
      : conditionalReasons.length > 0
        ? "conditional" as const
        : "eligible" as const;
  const recommendable = eligibility === "eligible";

  if (input.useRelaxedFar) warnings.push("완화 용적률은 법적 근거와 적용요건이 확인되기 전까지 조건부 값입니다.");
  if (input.businessMode === "undecided") warnings.push("사업방식 미정: 매입약정 특례를 확정 적용하지 않았습니다.");
  if (definition.parkingMode === "mechanical" && !input.mechanicalAllowed) warnings.push("기계식주차 적용 불가 설정에 따라 전량 자주식으로 대체 계산했습니다.");
  if (definition.parkingMode === "mechanical") warnings.push("기계식 면적은 개략값이며 제조사 형식·대기공간·LH 인수기준 검토가 필요합니다.");
  if (unitCountByFar > unitCountByEnvelope) warnings.push("용적률상 가능 수량보다 높이·기준층 제약에 따른 배치 가능 수량이 작습니다.");
  if (parking.conditionalCount !== null && !parking.specialApplied) warnings.push(`0.3대 특례는 미승인 상태입니다. 기본 ${parking.fallbackCount}대와 조건부 ${parking.conditionalCount}대를 분리했습니다.`);
  warnings.push(...blockingReasons, ...conditionalReasons);
  warnings.push("대지 형상·일조·인동거리·소방활동공간 미검증으로 배치 가능성은 개략 추정입니다.");

  const parkingPenalty = parking.basementFloors * 7;
  const mechanicalPenalty = definition.parkingMode === "mechanical" ? 4 : 0;
  const score = round(unitCount * 0.55 + Math.min(30, (unitCount / Math.max(totalFloorArea, 1)) * 3000) - parkingPenalty - mechanicalPenalty, 1);

  return {
    definition,
    grossAreaPerUnit: round(grossAreaPerUnit),
    maxBuildableArea: round(maxBuildableArea),
    plannedBuildingArea: round(plannedBuildingArea),
    farLimitArea: round(farLimitArea),
    farCountedArea: round(farCountedArea),
    aboveGroundArea: round(farCountedArea),
    belowGroundArea: round(belowGroundArea),
    totalFloorArea: round(totalFloorArea),
    residentialExclusiveArea: round(residentialExclusiveArea),
    residentialCommonArea: round(residentialCommonArea),
    amenityArea: round(amenityArea),
    equipmentArea: round(equipmentArea),
    parkingArea: parking.area,
    unitCountByFar,
    unitCountByEnvelope,
    unitCount,
    legalMaxFloors,
    physicalMaxFloors,
    recommendedFloors,
    estimatedHeight: round(estimatedHeight, 1),
    plannedBcr: input.siteArea > 0 ? round(plannedBuildingArea / input.siteArea * 100, 2) : 0,
    plannedFar: input.siteArea > 0 ? round(farCountedArea / input.siteArea * 100, 2) : 0,
    landscapeArea: round(input.siteArea * input.landscapeRatio / 100),
    facilities,
    parking,
    warnings,
    formulas: [
      `세대당 계획면적 = ${definition.exclusiveArea}㎡ ÷ ${(definition.efficiency * 100).toFixed(0)}% = ${grossAreaPerUnit.toFixed(2)}㎡`,
      `용적률 한도 = ${input.siteArea.toLocaleString()}㎡ × ${appliedFar}% = ${farLimitArea.toLocaleString()}㎡`,
      `계획 기준층 = min(대지×건폐율, 건축가능대지) × ${input.floorPlateRatio}% = ${plannedBuildingArea.toFixed(1)}㎡`,
      `계획 용적률 = ${farCountedArea.toFixed(1)}㎡ ÷ ${input.siteArea.toLocaleString()}㎡ × 100 = ${(farCountedArea / input.siteArea * 100).toFixed(2)}%`,
      `기본 법정주차 = ceil(${unitCount} × ${parking.originalLegalRatio}) = ${parking.originalLegalCount}대`,
      ...(parking.conditionalCount !== null ? [`0.3대 조건부 주차 = ceil(${unitCount} × 0.3) = ${parking.conditionalCount}대 · 승인상태 ${parking.relaxationStatus}`] : []),
      `최종 적용주차 = ${parking.finalCount}대${parking.lhRequirementVerified ? " · 검증된 LH 기준 포함" : " · 미검증 LH 가정은 강제하지 않음"}`,
    ],
    score,
    eligibility,
    recommendable,
    blockingReasons,
    conditionalReasons,
  };
}

export function calculateAll(input: ProjectInput, context: CalculationContext = DEFAULT_CALCULATION_CONTEXT) {
  return ALTERNATIVES.map((alternative) => calculateAlternative(input, alternative, context));
}
