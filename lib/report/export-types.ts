import type { ReviewRow } from "../review/types";

export interface ExportScenario {
  name: string;
  feasibility: string;
  summary: Array<[string, string]>;
  types: Array<{ name: string; exclusive: number; count: number; supplyArea: number; contractArea: number }>;
  formulas: string[];
  notes: string[];
}
export interface ExportBody {
  kind: "legal" | "summary";
  projectName: string;
  address: string;
  reviewedAt?: string;
  rows?: ReviewRow[];
  scenarios?: ExportScenario[];
}

