export type BusinessMode = "direct" | "purchase" | "other" | "undecided";
export type EvidenceStatus = "verified" | "user" | "unknown" | "review";
export type ParkingMode = "self" | "mechanical";
export type UseType = "apartment" | "officetel";

export interface ProjectInput {
  projectName: string;
  address: string;
  province: string;
  district: string;
  zone: string;
  districtPlan: boolean;
  businessMode: BusinessMode;
  regionalOffice: string;
  siteArea: number;
  buildableSiteRatio: number;
  siteWidth: number;
  siteDepth: number;
  roadWidth: number;
  buildingCoverageRatio: number;
  baseFar: number;
  relaxedFar: number;
  useRelaxedFar: boolean;
  maxFloors: number;
  maxHeight: number;
  landscapeRatio: number;
  floorPlateRatio: number;
  basementCoverageRatio: number;
  selfParkingAreaPerCar: number;
  mechanicalAreaPerCar: number;
  apartmentParkingRatio: number;
  officetelParkingRatio: number;
  lhApartmentParkingRatio: number;
  lhOfficetelParkingRatio: number;
  specialParkingEnabled: boolean;
  mechanicalAllowed: boolean;
  mechanicalMaxRatio: number;
  apartmentFloorHeight: number;
  officetelFloorHeight: number;
}

export interface AlternativeDefinition {
  id: "A-1" | "A-2" | "B-1" | "B-2";
  name: string;
  shortName: string;
  useType: UseType;
  parkingMode: ParkingMode;
  exclusiveArea: number;
  efficiency: number;
}

export interface FacilityResult {
  name: string;
  required: boolean;
  basis: string;
  area: number;
  location: "지상" | "지하" | "지상·지하";
  farIncluded: boolean;
}

export interface ParkingResult {
  legalRatio: number;
  lhRatio: number;
  appliedRatio: number;
  legalCount: number;
  lhCount: number;
  finalCount: number;
  selfCount: number;
  mechanicalCount: number;
  accessibleCount: number;
  evCount: number;
  area: number;
  basementFloors: number;
  specialApplied: boolean;
  status: EvidenceStatus;
}

export interface AlternativeResult {
  definition: AlternativeDefinition;
  grossAreaPerUnit: number;
  maxBuildableArea: number;
  plannedBuildingArea: number;
  farLimitArea: number;
  farCountedArea: number;
  aboveGroundArea: number;
  belowGroundArea: number;
  totalFloorArea: number;
  residentialExclusiveArea: number;
  residentialCommonArea: number;
  amenityArea: number;
  equipmentArea: number;
  parkingArea: number;
  unitCountByFar: number;
  unitCountByEnvelope: number;
  unitCount: number;
  legalMaxFloors: number;
  physicalMaxFloors: number;
  recommendedFloors: number;
  estimatedHeight: number;
  plannedBcr: number;
  plannedFar: number;
  landscapeArea: number;
  facilities: FacilityResult[];
  parking: ParkingResult;
  warnings: string[];
  formulas: string[];
  score: number;
}

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  category: string;
  status: "ready" | "needs-integration";
  uploadedAt: string;
}
