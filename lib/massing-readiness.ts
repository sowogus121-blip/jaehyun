import type { ProjectInput } from "./types";

export interface MassingReadiness {
  canEstimateUnits: boolean;
  missing: string[];
  hasApartmentParking: boolean;
  hasOfficetelParking: boolean;
}

/** Distinguish missing input from an actual calculated zero. */
export function getMassingReadiness(input: ProjectInput): MassingReadiness {
  const missing: string[] = [];
  if (!(input.siteArea > 0)) missing.push("대지면적");
  if (!(input.buildingCoverageRatio > 0)) missing.push("건폐율");
  if (!(input.useRelaxedFar ? input.relaxedFar > 0 : input.baseFar > 0)) missing.push("용적률");
  if (!(input.maxFloors > 0 || input.maxHeight > 0)) missing.push("계획 최고층수 또는 높이");
  return {
    canEstimateUnits: missing.length === 0,
    missing,
    hasApartmentParking: input.apartmentParkingRatio > 0,
    hasOfficetelParking: input.officetelParkingRatio > 0,
  };
}

/**
 * An official ordinance's ordinary zone values can become a planning
 * hypothesis ONLY through explicit user action, never through API retrieval.
 */
export function getPreliminaryOrdinanceInputs(
  rows: Array<{ id: string; status: string; detail: string }>,
): { bcr: number; far: number } | null {
  const bcr = rows.find((row) => row.id === "bcr" && row.status === "source");
  const far = rows.find((row) => row.id === "far" && row.status === "source");
  const parse = (value?: string) => {
    const match = value?.match(/^(\d+(?:\.\d+)?)%\s*이하\s*\(조례 일반기준\)/);
    return match ? Number(match[1]) : null;
  };
  const bcrValue = parse(bcr?.detail);
  const farValue = parse(far?.detail);
  if (bcrValue === null || farValue === null || bcrValue <= 0 || bcrValue > 100 ||
      farValue <= 0 || farValue > 2000) return null;
  return { bcr: bcrValue, far: farValue };
}
