export type BusinessMode = "direct" | "purchase" | "other" | "undecided";
export type EvidenceStatus = "verified" | "user" | "unknown" | "review";
export type ParkingMode = "self" | "mechanical";
export type UseType = "apartment" | "officetel";
export type LhSupplyType = "undecided" | "newlywed" | "youth" | "general" | "senior";
export type ParkingRelaxationStatus = "not-reviewed" | "conditional" | "approved" | "rejected";
export type AlternativeEligibilityStatus = "eligible" | "conditional" | "ineligible" | "unknown";

export interface ProjectInput {
  projectName: string;
  address: string;
  multipleParcels: boolean;
  parcelList: string;
  province: string;
  district: string;
  zone: string;
  districtPlan: boolean;
  businessMode: BusinessMode;
  lhSupplyType: LhSupplyType;
  regionalOffice: string;
  userPlanNotes: string;
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
  specialParkingApproval: ParkingRelaxationStatus;
  purchaseAgreementConfirmed: boolean;
  specialParkingUseScopeConfirmed: boolean;
  specialParkingLhConfirmed: boolean;
  lhParkingRatioVerified: boolean;
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
  originalLegalRatio: number;
  originalLegalCount: number;
  legalRatio: number;
  lhRatio: number;
  lhRequirementVerified: boolean;
  appliedRatio: number;
  legalCount: number;
  lhCount: number;
  relaxedRatio: number | null;
  relaxedCount: number | null;
  fallbackCount: number;
  conditionalCount: number | null;
  finalCount: number;
  selfCount: number;
  mechanicalCount: number;
  accessibleCount: number;
  evCount: number;
  area: number;
  basementFloors: number;
  specialApplied: boolean;
  specialEligible: boolean;
  relaxationStatus: ParkingRelaxationStatus;
  status: EvidenceStatus;
}

export interface CalculationContext {
  planningEvidence: EvidenceStatus;
  usePermissions: Record<UseType, AlternativeEligibilityStatus>;
  lhPurchaseEligibility: Record<UseType, AlternativeEligibilityStatus>;
  mechanicalParkingEligibility: AlternativeEligibilityStatus;
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
  eligibility: AlternativeEligibilityStatus;
  recommendable: boolean;
  blockingReasons: string[];
  conditionalReasons: string[];
}

export interface UploadedDocument {
  id: string;
  name: string;
  size: number;
  category: string;
  status: "analyzing" | "analyzed" | "failed" | "needs-integration";
  uploadedAt: string;
  analysis?: {
    format: "pdf" | "hwpx" | "docx" | "xlsx" | "txt";
    pageCount: number | null;
    textLength: number;
    preview: string;
    candidates: Array<{
      topic: string;
      quote: string;
      value: number | null;
      unit: string | null;
      verified: false;
    }>;
    warnings: string[];
  };
  error?: string;
}

export interface SiteReviewResult {
  status: "verified" | "partial" | "integration-required";
  reviewStage: "source-discovery" | "content-analysis" | "application-assessment";
  sourceDiscoveryComplete: boolean;
  applicationAssessmentComplete: boolean;
  checkedAt: string;
  location: {
    address: string;
    parcelAddress: string | null;
    x: string;
    y: string;
  } | null;
  landUse: Array<{
    category: string;
    name: string;
    code: string;
    source: string;
    status: "verified";
  }>;
  parcel: {
    area: number | null;
    landCategory: string | null;
    pnu: string | null;
    source: string;
    approximate: boolean;
  } | null;
  planningStandards: {
    zone: string;
    buildingCoverageRatio: number;
    far: number;
    source: string;
  } | null;
  districtPlan: boolean | null;
  mixedUseZones: boolean;
  parcels: Array<{
    inputAddress: string;
    location: {
      address: string;
      parcelAddress: string | null;
      x: string;
      y: string;
    } | null;
    parcel: {
      area: number | null;
      landCategory: string | null;
      pnu: string | null;
      source: string;
      approximate: boolean;
    } | null;
    landUse: Array<{
      category: string;
      name: string;
      code: string;
      source: string;
      status: "verified";
    }>;
    errors: string[];
  }>;
  laws: Array<{
    name: string;
    promulgationDate: string | null;
    enforcementDate: string | null;
    ministry: string | null;
    link: string;
    retrievalStatus: "metadata-only" | "full-text";
    applicationStatus: "not-assessed" | "applicable" | "not-applicable" | "conditional";
  }>;
  ordinances: Array<{
    name: string;
    localGovernment: string | null;
    promulgationDate: string | null;
    enforcementDate: string | null;
    link: string;
    retrievalStatus: "metadata-only" | "full-text";
    applicationStatus: "not-assessed" | "applicable" | "not-applicable" | "conditional";
  }>;
  nationalArticleCandidates?: Array<{
    sourceTitle: string;
    sourceUrl: string;
    topic: string;
    article: string;
    excerpt: string;
    verified: false;
  }>;
  ordinanceArticleCandidates?: Array<{
    sourceTitle: string;
    sourceUrl: string;
    topic: string;
    article: string;
    excerpt: string;
    verified: false;
  }>;
  ruleFindings: Array<{
    id: string;
    topic: string;
    outcome: "applicable" | "not-applicable" | "conditional" | "unresolved";
    value: number | string | null;
    unit: string | null;
    sourceTitle: string;
    article: string | null;
    sourceUrl: string;
    effectiveDate: string | null;
    conditions: string[];
    verified: boolean;
  }>;
  webSearch: {
    status: "completed" | "not-configured" | "failed";
    provider: "Brave Search" | null;
    searchedAt: string;
    results: Array<{
      title: string;
      url: string;
      description: string;
      query: string;
      sourceDomain: string;
      official: true;
    }>;
    errors: string[];
  };
  missing: string[];
  errors: string[];
  unresolved: string[];
}

export interface SiteLookupDetails {
  id: string;
  province: string;
  district: string;
  siteArea: number;
  landCategory: string;
  zone: string;
  districtPlan: boolean;
  publicPricePerSqm: number;
  publicPriceBase: string;
  roads: string[];
  planningRoadWidth: number;
  restrictions: string[];
  landscape: string;
  buildingCoverageRatioAssumption: number;
  farAssumption: number;
  source: string;
  confirmedAt: string;
  warnings: string[];
}
