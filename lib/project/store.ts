/**
 * 프로젝트 저장 (브라우저 localStorage) 및 v1 데이터 마이그레이션.
 * v1 키(lh-plan-lab-project, lh-plan-lab-versions)는 읽기만 하고 삭제하지 않는다.
 */
import type { ProjectInput, SiteReviewResult, UploadedDocument } from "../types";
import { buildRows, mergeRows, orderRows } from "../review/build-rows";
import type { Project, ReviewRow, RuleParams, Scenario, SiteInput, UseKind, LhSupply, BusinessType } from "../review/types";
import { DEFAULT_ASSUMPTIONS, defaultScenario } from "../massing/engine";

export const STORE_KEY = "lh-plan-lab:v2:projects";
export const MIGRATED_KEY = "lh-plan-lab:v2:migrated";
export const LEGACY_PROJECT_KEY = "lh-plan-lab-project";
export const LEGACY_VERSIONS_KEY = "lh-plan-lab-versions";

export const uid = (p = "p") => p + "-" + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);
const now = () => new Date().toISOString();

export function defaultScenarios(uses: UseKind[]): Scenario[] {
  const list = (uses.length ? uses : ["apartment", "officetel"] as UseKind[]);
  const out: Scenario[] = [];
  for (const use of list) {
    out.push(defaultScenario(use, uid("s"), { name: `${defaultScenario(use, "").name} · 기본 용적률 · 자주식` }));
  }
  const first = list[0];
  out.push(defaultScenario(first, uid("s"), { name: `${defaultScenario(first, "").name} · 완화 용적률 · 기계식 혼합`, farMode: "relaxed", parking: "mixed", mechanicalShare: 50 }));
  return out;
}

export function newProject(site: Partial<SiteInput> & { address: string }, name?: string): Project {
  const fullSite: SiteInput = {
    address: site.address.trim(), extraParcels: site.extraParcels ?? [], siteAreaOverride: site.siteAreaOverride,
    business: site.business ?? "lh-purchase", uses: site.uses ?? ["apartment", "officetel"], supplies: site.supplies ?? [],
    blockNo: site.blockNo, transitWithin500m: site.transitWithin500m, memo: site.memo,
  };
  const scenarios = defaultScenarios(fullSite.uses);
  return {
    schema: 2, id: uid("p"), name: name?.trim() || fullSite.address || "새 프로젝트", createdAt: now(), updatedAt: now(),
    site: fullSite, review: null, rows: buildRows(fullSite, null), scenarios, selectedScenarioId: scenarios[0].id,
    assumptions: { ...DEFAULT_ASSUMPTIONS }, documents: [], legalDone: false, massingDone: false,
  };
}

/** 공식자료 조회 결과 반영: 검토자 수정 행은 유지 */
export function applyReview(project: Project, review: SiteReviewResult | null): Project {
  const rows = mergeRows(project.rows, buildRows(project.site, review));
  return { ...project, review: slimReview(review, rows), reviewedAt: now(), rows, updatedAt: now() };
}

/** 저장 용량 관리: 법규검토표 행이 인용한 조문만 전문을 유지하고 나머지는 발췌만 저장 */
export function slimReview(review: SiteReviewResult | null, rows: ReviewRow[]): SiteReviewResult | null {
  if (!review) return null;
  const cited = new Set(rows.flatMap((r) => r.sources.map((s) => s.title + "|" + (s.article ?? ""))));
  return {
    ...review,
    ordinanceArticleCandidates: review.ordinanceArticleCandidates?.map((a) =>
      a.fullText && !cited.has(a.sourceTitle + "|" + a.article) ? { ...a, fullText: undefined } : a),
  };
}

/** 대상지 조건 변경(획지번호 등) 시 자동 행 재생성 */
export function rebuildRows(project: Project): Project {
  return { ...project, rows: mergeRows(project.rows, buildRows(project.site, project.review)), updatedAt: now() };
}

export function duplicateProject(p: Project): Project {
  const copy: Project = JSON.parse(JSON.stringify(p));
  return { ...copy, id: uid("p"), name: p.name + " (복제)", createdAt: now(), updatedAt: now() };
}

// ───────── v1 마이그레이션 ─────────
type LegacyRule = { field: string; value: number; sourceTitle?: string; sourceUrl?: string; excerpt?: string };
const LEGACY_FIELD: Record<string, keyof RuleParams> = {
  buildingCoverageRatio: "bcr", baseFar: "far", apartmentParkingRatio: "parkingApartment",
  officetelParkingRatio: "parkingOfficetel", maxHeight: "maxHeight", maxFloors: "maxFloors",
};
const LEGACY_SUPPLY: Record<string, LhSupply | undefined> = { newlywed: "newlywed", youth: "youth", general: "general", senior: "senior" };
const LEGACY_BUSINESS: Record<string, BusinessType> = { purchase: "lh-purchase", direct: "lh-other", other: "private", undecided: "lh-purchase" };

export function migrateLegacy(raw: unknown, label = "v1 프로젝트"): Project | null {
  if (!raw || typeof raw !== "object") return null;
  const data = raw as { input?: Partial<ProjectInput>; documents?: UploadedDocument[]; reviewData?: SiteReviewResult | null; reviewedRules?: LegacyRule[]; savedAt?: string };
  const input = data.input;
  if (!input || typeof input !== "object") return null;
  const address = String(input.address ?? "").trim();
  const project = newProject({
    address,
    extraParcels: input.multipleParcels ? String(input.parcelList ?? "").split(/\r?\n/).map((s) => s.trim()).filter(Boolean) : [],
    siteAreaOverride: !data.reviewData?.parcel?.area && Number(input.siteArea) > 0 ? Number(input.siteArea) : undefined,
    business: LEGACY_BUSINESS[String(input.businessMode ?? "undecided")] ?? "lh-purchase",
    supplies: LEGACY_SUPPLY[String(input.lhSupplyType ?? "")] ? [LEGACY_SUPPLY[String(input.lhSupplyType)]!] : [],
    uses: ["apartment", "officetel"],
    memo: input.userPlanNotes,
  }, String(input.projectName ?? "") || address || label);
  let p = applyReview(project, data.reviewData ?? null);
  const extraRows: ReviewRow[] = [];
  for (const rule of Array.isArray(data.reviewedRules) ? data.reviewedRules : []) {
    const key = LEGACY_FIELD[rule.field];
    if (!key || !Number.isFinite(rule.value)) continue;
    extraRows.push({
      id: "legacy.rule." + rule.field, group: "v1 검토값", sub: rule.field, section: "extra", origin: "user", edited: true,
      content: `${rule.field} = ${rule.value}`, law: rule.sourceTitle ?? "", note: "v1에서 검토자가 확인한 값",
      status: "user", params: { [key]: rule.value } as RuleParams,
      sources: rule.sourceUrl ? [{ title: rule.sourceTitle ?? "원문", url: rule.sourceUrl, excerpt: rule.excerpt, verbatim: Boolean(rule.excerpt), kind: "other" }] : [],
    });
  }
  const assumed: RuleParams = {};
  if (Number(input.buildingCoverageRatio) > 0) assumed.bcr = Number(input.buildingCoverageRatio);
  if (Number(input.baseFar) > 0) assumed.far = Number(input.baseFar);
  if (Number(input.relaxedFar) > 0) assumed.relaxedFar = Number(input.relaxedFar);
  if (Number(input.maxFloors) > 0) assumed.maxFloors = Number(input.maxFloors);
  if (Number(input.maxHeight) > 0) assumed.maxHeight = Number(input.maxHeight);
  if (Number(input.apartmentParkingRatio) > 0) assumed.parkingApartment = Number(input.apartmentParkingRatio);
  if (Number(input.officetelParkingRatio) > 0) assumed.parkingOfficetel = Number(input.officetelParkingRatio);
  if (Object.keys(assumed).length) {
    extraRows.push({
      id: "legacy.inputs", group: "v1 계획 입력값", section: "extra", origin: "user", edited: true,
      content: Object.entries(assumed).map(([k, v]) => `${k}: ${v}`).join(" · "),
      law: "", note: "v1 화면 입력값 (근거 미확인 → 후보). 원문 확인 후 '검토자 입력'으로 바꾸면 계산에 반영",
      status: "candidate", params: assumed, sources: [],
    });
  }
  p = { ...p, rows: orderRows([...p.rows, ...extraRows]), documents: Array.isArray(data.documents) ? data.documents : [], updatedAt: data.savedAt ?? now() };
  return p;
}

/** v2 JSON 또는 v1 JSON(내보내기 파일) 불러오기 */
export function importProjectJson(text: string): Project {
  const parsed = JSON.parse(text);
  if (parsed?.schema === 2 && parsed.site && Array.isArray(parsed.rows)) return { ...parsed, id: uid("p") } as Project;
  if (parsed?.project?.schema === 2) return { ...parsed.project, id: uid("p") } as Project;
  const legacy = migrateLegacy(parsed, "불러온 v1 프로젝트");
  if (!legacy) throw new Error("LH Plan Lab 프로젝트 파일 형식이 아닙니다.");
  return legacy;
}

interface StorageLike { getItem(k: string): string | null; setItem(k: string, v: string): void }

export function loadProjects(storage: StorageLike): Project[] {
  let projects: Project[] = [];
  try {
    const parsed = JSON.parse(storage.getItem(STORE_KEY) ?? "[]");
    if (Array.isArray(parsed)) projects = parsed.filter((p) => p && p.schema === 2);
  } catch { projects = []; }
  if (!storage.getItem(MIGRATED_KEY)) {
    const migrated: Project[] = [];
    try {
      const current = storage.getItem(LEGACY_PROJECT_KEY);
      const p = current ? migrateLegacy(JSON.parse(current)) : null;
      if (p) migrated.push(p);
      const versions = JSON.parse(storage.getItem(LEGACY_VERSIONS_KEY) ?? "[]");
      if (Array.isArray(versions)) {
        versions.forEach((v: { input?: unknown; reviewedRules?: unknown; savedAt?: string }, i: number) => {
          const vp = migrateLegacy({ input: v.input, reviewedRules: v.reviewedRules, savedAt: v.savedAt });
          if (vp) migrated.push({ ...vp, name: `${vp.name} · v1 버전 ${i + 1}` });
        });
      }
    } catch { /* 손상된 v1 데이터는 건너뜀 (원본 키는 보존) */ }
    projects = [...projects, ...migrated];
    storage.setItem(MIGRATED_KEY, now());
    storage.setItem(STORE_KEY, JSON.stringify(projects));
  }
  return projects;
}

export function saveProjects(storage: StorageLike, projects: Project[]) {
  storage.setItem(STORE_KEY, JSON.stringify(projects));
}

export function projectProgress(p: Project): { label: string; tone: "new" | "legal" | "massing" | "done" } {
  if (p.legalDone && p.massingDone) return { label: "검토 완료", tone: "done" };
  if (p.legalDone) return { label: "규모검토 중", tone: "massing" };
  if (p.review) return { label: "법규검토 중", tone: "legal" };
  return { label: "신규", tone: "new" };
}
