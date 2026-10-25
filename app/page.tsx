"use client";

import { ChangeEvent, ReactNode, useEffect, useMemo, useRef, useState } from "react";
import { ALTERNATIVES, DEFAULT_INPUT, calculateAll, resetSiteDependentInput } from "@/lib/calculator";
import { calculateReviewCompleteness, deriveCalculationContext } from "@/lib/regulatory-assessment";
import { activeReviewedRules, applyReviewedRule, confirmReviewedRule, removeRuleForEditedField } from "@/lib/rule-application";
import { screenParking03 } from "@/lib/lh-parking-screen";
import { suggestZoningRules } from "@/lib/zoning-applicability";
import type { ReviewedRule, ReviewedRuleField } from "@/lib/rule-application";
import type { AlternativeResult, EvidenceStatus, ProjectInput, SiteLookupDetails, SiteReviewResult, UploadedDocument } from "@/lib/types";

type IconName = "site" | "law" | "lh" | "scale" | "report" | "search" | "upload" | "save" | "download" | "alert" | "check" | "building" | "parking" | "area" | "height" | "chevron" | "database" | "settings" | "history";

const paths: Record<IconName, ReactNode> = {
  site: <><path d="M12 21s7-5.1 7-12a7 7 0 1 0-14 0c0 6.9 7 12 7 12Z"/><circle cx="12" cy="9" r="2.5"/></>,
  law: <><path d="M12 3v18M5 6h14M7 6l-4 7h8L7 6Zm10 0-4 7h8l-4-7ZM8 21h8"/></>,
  lh: <><path d="M4 20V8l8-5 8 5v12M8 20v-6h8v6M8 10h.01M12 10h.01M16 10h.01"/></>,
  scale: <><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></>,
  report: <><path d="M6 3h9l4 4v14H6z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></>,
  search: <><circle cx="11" cy="11" r="7"/><path d="m20 20-4-4"/></>,
  upload: <><path d="M12 16V4m0 0L7 9m5-5 5 5M4 16v4h16v-4"/></>,
  save: <><path d="M5 3h12l2 2v16H5zM8 3v6h8V3M8 21v-7h8v7"/></>,
  download: <><path d="M12 4v12m0 0 5-5m-5 5-5-5M4 20h16"/></>,
  alert: <><path d="M12 3 2 21h20L12 3Z"/><path d="M12 9v5m0 3h.01"/></>,
  check: <path d="m5 12 4 4L19 6"/>,
  building: <><path d="M4 21V6h10v15M14 10h6v11M8 10h2M8 14h2M8 18h2M17 14h1M17 18h1"/></>,
  parking: <><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M9 17V7h4a3 3 0 0 1 0 6H9"/></>,
  area: <><path d="M4 4h16v16H4zM4 9h16M9 4v16"/></>,
  height: <><path d="M8 4h8M8 20h8M12 4v16m0-16-3 3m3-3 3 3m-3 13-3-3m3 3 3-3"/></>,
  chevron: <path d="m9 18 6-6-6-6"/>,
  database: <><ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v7c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 12v7c0 1.7 3.6 3 8 3s8-1.3 8-3v-7"/></>,
  settings: <><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1-2.8 2.8-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.6v.2h-4V21a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1L4.2 17l.1-.1a1.7 1.7 0 0 0 .3-1.9A1.7 1.7 0 0 0 3 14H2.8v-4H3a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9L4.2 7 7 4.2l.1.1A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-1.6v-.2h4V3a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1L19.8 7l-.1.1a1.7 1.7 0 0 0-.3 1.9 1.7 1.7 0 0 0 1.6 1h.2v4H21a1.7 1.7 0 0 0-1.6 1Z"/></>,
  history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5M12 7v5l3 2"/></>,
};

function Icon({ name, size = 20 }: { name: IconName; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>{paths[name]}</svg>;
}

const tabs = [
  { name: "대상지 입력", subtitle: "사업·대지 기본조건", icon: "site" as const },
  { name: "법규검토", subtitle: "도시계획·조례·완화", icon: "law" as const },
  { name: "LH 기준검토", subtitle: "지침·특례·의무시설", icon: "lh" as const },
  { name: "규모검토", subtitle: "4개 대안 자동산정", icon: "scale" as const },
  { name: "건축개요", subtitle: "종합비교·보고서", icon: "report" as const },
];

type RegulationItem = { name: string; value: string; status: EvidenceStatus; source: string };
type RegulationGroup = { title: string; icon: "site" | "building" | "height"; summary: string; items: RegulationItem[] };

function buildRegulationGroups(input: ProjectInput, reviewData: SiteReviewResult | null, lookupDetails: SiteLookupDetails | null): RegulationGroup[] {
  const zoneItem = reviewData?.landUse.find((item) => item.category === "용도지역");
  const zoneNames = [...new Set(reviewData?.landUse.filter((item) => item.category === "용도지역").map((item) => item.name) ?? [])];
  const zone = reviewData?.mixedUseZones ? `혼합 용도지역 · ${zoneNames.join(" / ")}` : zoneItem?.name || lookupDetails?.zone || input.zone || "미확인";
  const zoneVerified = Boolean(zoneItem || lookupDetails);
  const planning = reviewData?.planningStandards;
  const lawNames = reviewData?.laws.map((law) => law.name.replace(/\s+/g, "")) ?? [];
  const ordinances = reviewData?.ordinances ?? [];
  const ordinanceNames = ordinances.map((ordinance) => ordinance.name);
  const urbanOrdinance = ordinances.find((ordinance) => ordinance.name.includes("도시계획"));
  const buildingOrdinance = ordinances.find((ordinance) => ordinance.name.includes("건축"));
  const hasLaw = (...names: string[]) => names.some((name) => lawNames.some((law) => law.includes(name.replace(/\s+/g, ""))));
  const buildingLaw = hasLaw("건축법");
  const housingLaw = hasLaw("주택법", "공공주택 특별법");
  const fireLaw = hasLaw("소방시설 설치 및 관리에 관한 법률", "피난 방화구조");
  const heightDistrict = reviewData?.landUse.find((item) => item.name.includes("고도지구"));

  return [
    {
      title: "도시계획 및 토지이용",
      icon: "site",
      summary: reviewData ? "용도지역 확인 · 지자체 조례 및 지구단위계획 별도 적용판정" : "주소 조회 전 입력값 검토",
      items: [
        { name: "용도지역", value: zone, status: zoneVerified ? "verified" : "user", source: zoneItem?.source || lookupDetails?.source || "사용자 입력값" },
        { name: "건폐율 / 용적률", value: `${input.buildingCoverageRatio}% / ${input.baseFar}%`, status: "user", source: urbanOrdinance ? `계산값은 사용자 입력 · ${urbanOrdinance.name} 조항 대조 필요 · ${planning?.source || "일반상한 참고"}` : "계산값은 사용자 입력 · 국가·지자체 계획기준 대조 필요" },
        { name: "지구단위계획", value: reviewData?.districtPlan === true ? "VWorld 구역 검출" : reviewData?.districtPlan === false ? "VWorld에서 미검출" : input.districtPlan ? "대상 입력" : "미확인", status: reviewData?.districtPlan === true ? "verified" : "review", source: reviewData ? "VWorld 지구단위계획구역 레이어 조회 · 결정도서 별도 확인" : "결정도서·시행지침 자료 미확보" },
        { name: "건축선·공공보행통로", value: "결정도서 확인 필요", status: "unknown", source: "일반 공간 API만으로 세부 결정선은 확정할 수 없음" },
      ],
    },
    {
      title: "건축 관계법규",
      icon: "building",
      summary: reviewData?.laws.length || ordinanceNames.length ? `현행 법령 ${reviewData?.laws.length ?? 0}건 · 자치법규 ${ordinanceNames.length}건 연결` : "국가법령 원문 연결 대기",
      items: [
        { name: "공동주택", value: buildingLaw && housingLaw ? "법령 위치 확인 · 적용판정 전" : "건축법·주택법 체계", status: "review", source: buildingLaw && housingLaw ? "국가법령정보센터 제목·시행일 메타데이터 확보 · 조항/별표 분석 필요" : "현행 조문 조회 필요" },
        { name: "오피스텔", value: buildingLaw ? "법령 위치 확인 · 허용용도 미판정" : "업무시설 기준", status: "review", source: buildingLaw ? "국가법령정보센터 건축법 메타데이터 · 오피스텔 허용 여부 미판정" : "오피스텔 건축기준 및 지자체 기준 확인 필요" },
        { name: "일조·인동거리", value: buildingLaw ? `건축법 확인${buildingOrdinance ? " · 건축조례 연결" : " · 조례 필요"}` : "미확인", status: buildingLaw ? "review" : "unknown", source: buildingOrdinance ? `국가법령정보센터 · ${buildingOrdinance.name}` : "건축법령과 관할 건축조례, 배치·방위 조건을 함께 확인" },
        { name: "소방·피난", value: fireLaw ? "관련 법령 원문 연결" : "미확인", status: fireLaw ? "review" : "unknown", source: fireLaw ? "국가법령정보센터 원문 확인 · 층수·면적별 적용 검토 필요" : "층수·면적 확정 후 별도 검토" },
      ],
    },
    {
      title: "높이·외부공간",
      icon: "height",
      summary: "API 제한구역과 계획 입력값 병합",
      items: [
        { name: "최고높이 / 층수", value: heightDistrict ? heightDistrict.name : `${input.maxHeight}m / ${input.maxFloors}층`, status: heightDistrict ? "verified" : "user", source: heightDistrict?.source || "사용자 상한값 · 경관·항공 제한 별도 확인" },
        { name: "조경면적", value: `${f(input.siteArea * input.landscapeRatio / 100)}㎡ (${input.landscapeRatio}%)`, status: "user", source: buildingOrdinance ? `입력 비율 자동산정 · ${buildingOrdinance.name} 원문 연결` : "입력 비율 자동산정 · 관할 건축조례 의무비율 확인 필요" },
        { name: "대지 안의 공지", value: "조례 확인 필요", status: "unknown", source: "용도·높이·지역별 건축조례 기준 필요" },
        { name: "소방활동공간", value: fireLaw ? "관련 법령 연결 · 배치 미확정" : "면적 미반영", status: fireLaw ? "review" : "unknown", source: "건물 규모와 배치 확정 후 소방 협의 필요" },
      ],
    },
  ];
}

const statusMeta: Record<string, { label: string; className: string }> = {
  verified: { label: "원문 확인", className: "status-verified" },
  user: { label: "사용자 입력", className: "status-user" },
  review: { label: "검토 필요", className: "status-review" },
  unknown: { label: "자료 미확보", className: "status-unknown" },
  eligible: { label: "적합", className: "status-verified" },
  conditional: { label: "조건부", className: "status-review" },
  ineligible: { label: "부적합", className: "status-unknown" },
};

const numberFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 1 });
const f = (value: number) => numberFormat.format(value);

function Field({ label, hint, children, wide = false }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? "field-wide" : ""}`}><span>{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

function NumberField({ label, value, onChange, suffix, min = 0, step = 1, hint }: { label: string; value: number; onChange: (value: number) => void; suffix?: string; min?: number; step?: number; hint?: string }) {
  return <Field label={label} hint={hint}><div className="input-unit"><input type="number" value={value} min={min} step={step} onChange={(event) => onChange(Number(event.target.value) || 0)} />{suffix && <b>{suffix}</b>}</div></Field>;
}

function SectionHeader({ eyebrow, title, description, action }: { eyebrow?: string; title: string; description?: string; action?: ReactNode }) {
  return <div className="section-heading"><div>{eyebrow && <span className="eyebrow">{eyebrow}</span>}<h2>{title}</h2>{description && <p>{description}</p>}</div>{action}</div>;
}

function Metric({ label, value, suffix, sub, tone = "default" }: { label: string; value: string | number; suffix?: string; sub?: string; tone?: "default" | "navy" | "orange" }) {
  return <div className={`metric metric-${tone}`}><span>{label}</span><strong>{value}{suffix && <em>{suffix}</em>}</strong>{sub && <small>{sub}</small>}</div>;
}

function Toggle({ checked, onChange, label, note }: { checked: boolean; onChange: (checked: boolean) => void; label: string; note?: string }) {
  return <label className="toggle-row"><button type="button" role="switch" aria-checked={checked} className={`toggle ${checked ? "on" : ""}`} onClick={() => onChange(!checked)}><i /></button><span><b>{label}</b>{note && <small>{note}</small>}</span></label>;
}

function Badge({ status }: { status: string }) {
  const item = statusMeta[status] ?? statusMeta.unknown;
  return <span className={`status ${item.className}`}>{item.label}</span>;
}

function downloadBlob(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function ComparisonTable({ results, input }: { results: AlternativeResult[]; input: ProjectInput }) {
  const rows: [string, (result: AlternativeResult) => ReactNode][] = [
    ["주용도", (r) => r.definition.useType === "apartment" ? "공동주택" : "업무시설(오피스텔)"],
    ["세대·호실수", (r) => <b>{r.unitCount}{r.definition.useType === "apartment" ? "세대" : "호"}</b>],
    ["전용면적 / 전용률", (r) => `${r.definition.exclusiveArea}㎡ / ${r.definition.efficiency * 100}%`],
    ["계획 건축면적", (r) => `${f(r.plannedBuildingArea)}㎡`],
    ["계획 건폐율", (r) => `${r.plannedBcr}%`],
    ["적용 / 계획 용적률", (r) => `${input.useRelaxedFar ? input.relaxedFar : input.baseFar}% / ${r.plannedFar}%`],
    ["용적률 산정 연면적", (r) => `${f(r.farCountedArea)}㎡`],
    ["지하 / 전체 연면적", (r) => `${f(r.belowGroundArea)}㎡ / ${f(r.totalFloorArea)}㎡`],
    ["계획 규모", (r) => `지상 ${r.recommendedFloors}층 / 지하 ${r.parking.basementFloors}층`],
    ["추정 높이", (r) => `${r.estimatedHeight}m`],
    ["부대복리시설", (r) => `${f(r.amenityArea)}㎡`],
    ["조경면적", (r) => `${f(r.landscapeArea)}㎡`],
    ["원 법정 / LH 요구", (r) => `${r.parking.originalLegalCount}대 / ${r.parking.lhCount}대${r.parking.lhRequirementVerified ? "(확인)" : "(가정)"}`],
    ["최종 계획주차", (r) => <b>{r.parking.finalCount}대</b>],
    ["주차 구성", (r) => `자주 ${r.parking.selfCount} · 기계 ${r.parking.mechanicalCount}`],
    ["주차장 필요면적", (r) => `${f(r.parking.area)}㎡`],
    ["0.3대 특례", (r) => r.parking.specialApplied ? <span className="text-orange">승인 반영</span> : r.parking.conditionalCount !== null ? `조건부 ${r.parking.conditionalCount}대 / 기본 ${r.parking.fallbackCount}대` : "미적용"],
    ["법규·LH 적합성", (r) => <Badge status={r.eligibility} />],
  ];
  return <div className="table-scroll"><table className="comparison-table"><thead><tr><th>구분</th>{results.map((r) => <th key={r.definition.id}><span>{r.definition.id}</span>{r.definition.shortName}</th>)}</tr></thead><tbody>{rows.map(([label, getter]) => <tr key={label}><th>{label}</th>{results.map((r) => <td key={r.definition.id}>{getter(r)}</td>)}</tr>)}</tbody></table></div>;
}

export default function Home() {
  const [activeTab, setActiveTab] = useState(0);
  const [input, setInput] = useState<ProjectInput>(DEFAULT_INPUT);
  const [documents, setDocuments] = useState<UploadedDocument[]>([]);
  const [selectedId, setSelectedId] = useState("A-1");
  const [toast, setToast] = useState("");
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [versionCount, setVersionCount] = useState(0);
  const [vworldKey, setVworldKey] = useState("");
  const [lawOc, setLawOc] = useState("");
  const [reviewData, setReviewData] = useState<SiteReviewResult | null>(null);
  const [reviewedRules, setReviewedRules] = useState<ReviewedRule[]>([]);
  const [reviewCandidateIndex, setReviewCandidateIndex] = useState<number | null>(null);
  const [reviewRuleField, setReviewRuleField] = useState<ReviewedRuleField>("baseFar");
  const [reviewRuleValue, setReviewRuleValue] = useState("");
  const [lookupDetails, setLookupDetails] = useState<SiteLookupDetails | null>(null);
  const [isReviewing, setIsReviewing] = useState(false);
  const [apiPanelMessage, setApiPanelMessage] = useState("서버에 등록된 API 키로 통합 법규검토를 실행할 수 있습니다. 아래 입력은 로컬 진단용입니다.");
  const uploadRef = useRef<HTMLInputElement>(null);
  const projectImportRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem("lh-plan-lab-project");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        setInput({ ...DEFAULT_INPUT, ...parsed.input });
        setDocuments(parsed.documents ?? []);
        setReviewData(parsed.reviewData ?? null);
        setReviewedRules(Array.isArray(parsed.reviewedRules) ? parsed.reviewedRules : []);
        setLookupDetails(parsed.lookupDetails ?? null);
        setSavedAt(parsed.savedAt ?? null);
      } catch { /* invalid local data is ignored */ }
    }
    const versions = JSON.parse(localStorage.getItem("lh-plan-lab-versions") ?? "[]");
    setVersionCount(Array.isArray(versions) ? versions.length : 0);
    localStorage.removeItem("lh-plan-vworld-key");
    localStorage.removeItem("lh-plan-law-oc");
    sessionStorage.removeItem("lh-plan-vworld-key");
    sessionStorage.removeItem("lh-plan-law-oc");
  }, []);

  const calculationContext = useMemo(() => deriveCalculationContext(reviewData, input), [reviewData, input]);
  const activeRules = activeReviewedRules(input, reviewedRules);
  const autoZoningCandidates = suggestZoningRules(reviewData);
  const parking03 = screenParking03(input, ALTERNATIVES[2]);
  const selectedSource = reviewCandidateIndex === null ? null : reviewData?.ordinanceArticleCandidates?.[reviewCandidateIndex] ?? null;
  const results = useMemo(() => calculateAll(input, calculationContext), [input, calculationContext]);
  const selected = results.find((result) => result.definition.id === selectedId) ?? results[0];
  const recommendation = [...results].filter((result) => result.recommendable).sort((a, b) => b.score - a.score)[0] ?? null;
  const appliedFar = input.useRelaxedFar ? input.relaxedFar : input.baseFar;
  const regulationGroups = buildRegulationGroups(input, reviewData, lookupDetails);
  const reviewCompleteness = calculateReviewCompleteness(reviewData);
  const reviewSteps = [
    { label: "주소·필지 확인", done: Boolean(reviewData?.location && reviewData?.parcel), partial: Boolean(reviewData?.location || reviewData?.parcel) },
    { label: "토지이용정보 조사", done: Boolean(reviewData?.landUse.length), partial: false },
    { label: "국가법령·지자체 조례 검색", done: Boolean(reviewData?.laws.length && reviewData?.ordinances?.length), partial: Boolean(reviewData?.laws.length || reviewData?.ordinances?.length) },
    { label: "지구단위계획·고시 조사", done: Boolean(reviewData?.ruleFindings?.some((finding) => finding.topic === "지구단위계획" && finding.verified)), partial: Boolean(reviewData?.districtPlan !== null || reviewData?.officialDocuments?.documents.some((document) => document.kind === "district-plan" && document.status === "analyzed") || reviewData?.webSearch?.results?.length) },
    { label: "완화제도·특례 탐색", done: Boolean(reviewData?.ruleFindings?.some((finding) => finding.topic.includes("완화") && finding.verified)), partial: false },
    { label: "LH 공고·설계지침 검토", done: Boolean(reviewData?.ruleFindings?.some((finding) => finding.topic.includes("LH") && finding.verified)), partial: Boolean(reviewData?.officialDocuments?.documents.some((document) => document.kind === "lh-notice" && document.status === "analyzed") || reviewData?.webSearch?.results?.some((result) => result.sourceDomain.includes("lh.or.kr"))) },
    { label: "법규 적용 및 규모계산", done: Boolean(reviewData?.applicationAssessmentComplete), partial: Boolean(reviewData) },
    { label: "최종 결과 생성", done: Boolean(recommendation), partial: Boolean(reviewData) },
  ];

  useEffect(() => {
    const timer = window.setTimeout(() => {
      localStorage.setItem("lh-plan-lab-project", JSON.stringify({ input, documents, reviewData, reviewedRules, lookupDetails, savedAt: new Date().toISOString() }));
      setSavedAt(new Date().toISOString());
    }, 500);
    return () => window.clearTimeout(timer);
  }, [input, documents, reviewData, reviewedRules, lookupDetails]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(""), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const update = <K extends keyof ProjectInput>(key: K, value: ProjectInput[K]) => {
    setInput((current) => ({
      ...current, [key]: value,
      ...(key === "businessMode" || key === "lhSupplyType" ? {
        specialParkingApproval: "not-reviewed" as const,
        purchaseAgreementConfirmed: false, specialParkingUseScopeConfirmed: false, specialParkingLhConfirmed: false,
      } : {}),
    }));
    setReviewedRules((current) =>
      key === "parcelList" || key === "multipleParcels" ? [] : removeRuleForEditedField(current, key));
  };

  const applyReviewedFinding = () => {
    if (!selectedSource || !reviewRuleValue.trim()) return setToast("원문 조항과 적용 수치를 확인해 입력해 주세요.");
    const rule = confirmReviewedRule(input, reviewData, reviewRuleField, Number(reviewRuleValue), selectedSource, new Date().toISOString());
    if (!rule) return setToast("대상지·용도지역·항목·공식 출처 또는 입력 범위를 확인해 주세요. 혼합 용도지역은 개별 검토가 필요합니다.");
    setInput((current) => applyReviewedRule(current, rule));
    setReviewedRules((current) => [...current.filter((item) => item.field !== rule.field), rule]);
    setReviewCandidateIndex(null);
    setReviewRuleValue("");
    setToast("조항과 적용조건을 확인한 사용자 계획값을 규모검토에 반영했습니다. 법적 자동확정은 아닙니다.");
  };

  const updateVworldKey = (value: string) => {
    setVworldKey(value);
  };

  const updateLawOc = (value: string) => {
    setLawOc(value);
  };

  const requestSiteReview = async (address: string, navigateToReview = true) => {
    const activeVworldKey = vworldKey.trim();
    const activeLawOc = lawOc.trim();
    setVworldKey(activeVworldKey);
    setLawOc(activeLawOc);
    setIsReviewing(true);
    setApiPanelMessage("Vercel 서버 환경변수를 우선 사용합니다. 공식자료를 조회하는 중…");
    setToast("공식 API에서 대상지와 현행 법령을 조회하고 있습니다…");
    try {
      const response = await fetch("/api/site-review", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(activeVworldKey ? { "x-vworld-api-key": activeVworldKey } : {}),
          ...(activeLawOc ? { "x-law-api-oc": activeLawOc } : {}),
        },
        body: JSON.stringify({
          address,
          parcelAddresses: input.multipleParcels ? input.parcelList.split(/\r?\n/).map((item) => item.trim()).filter(Boolean).slice(0, 9) : [],
          businessMode: input.businessMode,
          regionalOffice: input.regionalOffice,
          lhSupplyType: input.lhSupplyType,
        }),
      });
      const raw = await response.text();
      let data: SiteReviewResult & { error?: string };
      try {
        data = JSON.parse(raw) as SiteReviewResult & { error?: string };
      } catch {
        throw new Error(response.status === 504
          ? "서버의 통합검토 시간이 초과되었습니다. 잠시 후 다시 실행해 주세요. (HTTP 504)"
          : `서버에서 정상 JSON 응답을 받지 못했습니다. (HTTP ${response.status}, 응답 ${raw.length}자) 서버 로그를 확인해 주세요.`);
      }
      if (!response.ok) throw new Error(data.error ?? `통합검토 요청에 실패했습니다. (HTTP ${response.status})`);
      const review = data as SiteReviewResult;
      const zoneItem = review.landUse.find((item) => item.category === "용도지역");
      const zoneNames = [...new Set(review.landUse.filter((item) => item.category === "용도지역").map((item) => item.name))];
      const zoneValue = review.mixedUseZones ? `혼합 용도지역 (${zoneNames.join(" / ")})` : zoneItem ? `${zoneItem.name} (${zoneItem.code === "OFFICIAL-DOCUMENT" ? "공식문서" : "VWorld"} 확인)` : null;
      const resolvedAddress = review.location?.parcelAddress || review.location?.address || address;
      const addressParts = resolvedAddress.split(/\s+/);
      setReviewData(review);
      setInput((current) => ({
        ...current,
        address: resolvedAddress,
        ...(addressParts[0] ? { province: addressParts[0] } : {}),
        ...(addressParts[1] ? { district: addressParts[1] } : {}),
        ...(zoneValue ? { zone: zoneValue } : {}),
        ...(review.parcel?.area ? { siteArea: review.parcel.area } : {}),
        ...(review.districtPlan !== null ? { districtPlan: review.districtPlan } : {}),
        // The generic national zoning upper limit is NOT the local ordinance
        // or district-unit-plan FAR. Display as a reference; never auto-apply.

      }));
      setToast(`공식자료 ${data.laws.length + (data.ordinances?.length ?? 0) + data.landUse.length + (data.webSearch?.results?.length ?? 0) + (data.location ? 1 : 0)}건을 확인했습니다.`);
      setApiPanelMessage(`조회 완료 · 좌표 ${data.location ? 1 : 0}건 · 토지이용 ${data.landUse.length}건 · 법령 ${data.laws.length}건 · 자치법규 ${data.ordinances?.length ?? 0}건 · 웹 원문후보 ${data.webSearch?.results?.length ?? 0}건 · 공식 첨부 분석 ${data.officialDocuments?.documents.filter((document: { status: string }) => document.status === "analyzed").length ?? 0}건${data.errors.length ? ` · 오류 ${data.errors.length}건` : ""}`);
      if (navigateToReview) setActiveTab(1);
      return review;
    } catch (error) {
      const message = error instanceof Error ? error.message : "통합 법규검토에 실패했습니다.";
      setApiPanelMessage(`조회 실패 · ${message}`);
      setToast(message);
    } finally {
      setIsReviewing(false);
    }
  };

  const lookupAddress = async () => {
    const activeVworldKey = vworldKey.trim();
    if (!input.address.trim()) return setToast("주소를 먼저 입력해 주세요.");
    setToast("주소·좌표·토지이용 정보를 조회하고 있습니다…");
    try {
      const params = new URLSearchParams({ query: input.address, province: input.province, district: input.district });
      const response = await fetch(`/api/site-lookup?${params.toString()}`, { headers: activeVworldKey ? { "x-vworld-api-key": activeVworldKey } : {} });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error);
      const details = data.siteDetails as SiteLookupDetails | null;
      const resolvedAddress = data.parcelAddress || data.address;
      setInput((current) => ({
        ...current,
        address: resolvedAddress,
        ...(details ? {
          province: details.province,
          district: details.district,
          siteArea: details.siteArea,
          zone: `${details.zone} (공식문서 확인)`,
          districtPlan: details.districtPlan,
          roadWidth: details.planningRoadWidth,
          buildingCoverageRatio: details.buildingCoverageRatioAssumption,
          baseFar: details.farAssumption,
          relaxedFar: details.farAssumption,
          useRelaxedFar: false,
        } : {}),
      }));
      setLookupDetails(details);
      await requestSiteReview(resolvedAddress, false);
    } catch (error) {
      setToast(error instanceof Error ? error.message : "주소 조회에 실패했습니다.");
    }
  };

  const runSiteReview = async () => {
    if (!input.address.trim()) {
      setApiPanelMessage("대상지 주소가 비어 있습니다. 위 대상지 위치에 주소를 입력해 주세요.");
      return setToast("검토할 주소를 먼저 입력해 주세요.");
    }
    await requestSiteReview(input.address, true);
  };

  const handleFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    const additions = files.map((file) => ({
      id: `${file.name}-${file.lastModified}`,
      name: file.name,
      size: file.size,
      category: file.name.includes("지구단위") ? "지구단위계획" : file.name.includes("공고") ? "LH 공고" : "검토자료",
      status: "analyzing" as const,
      uploadedAt: new Date().toISOString(),
    }));
    setDocuments((current) => [...current.filter((item) => !additions.some((add) => add.id === item.id)), ...additions]);
    event.target.value = "";
    setToast(`${additions.length}개 문서에서 본문과 법규수치 후보를 추출하고 있습니다…`);
    const analyzed = await Promise.all(files.map(async (file, index) => {
      const form = new FormData();
      form.append("file", file);
      try {
        const response = await fetch("/api/documents/analyze", { method: "POST", body: form });
        const data = await response.json();
        if (!response.ok) throw new Error(data.error || "문서 분석 실패");
        return { ...additions[index], status: "analyzed" as const, analysis: data.analysis };
      } catch (error) {
        return { ...additions[index], status: "failed" as const, error: error instanceof Error ? error.message : "문서 분석 실패" };
      }
    }));
    setDocuments((current) => [...current.filter((item) => !analyzed.some((document) => document.id === item.id)), ...analyzed]);
    const success = analyzed.filter((document) => document.status === "analyzed").length;
    setToast(`문서 분석 완료 · 성공 ${success}개 · 실패 ${analyzed.length - success}개 · 추출값은 검증 전 후보로 저장됩니다.`);
  };

  const saveVersion = () => {
    const version = { id: Date.now(), savedAt: new Date().toISOString(), input, reviewedRules, results };
    const versions = JSON.parse(localStorage.getItem("lh-plan-lab-versions") ?? "[]");
    const next = [version, ...(Array.isArray(versions) ? versions : [])].slice(0, 10);
    localStorage.setItem("lh-plan-lab-versions", JSON.stringify(next));
    setVersionCount(next.length);
    setToast(`검토 버전 ${next.length}을 저장했습니다.`);
  };

  const exportProject = () => downloadBlob(JSON.stringify({ schemaVersion: 3, exportedAt: new Date().toISOString(), input, documents, reviewData, reviewedRules, lookupDetails }, null, 2), "application/json", "lh-plan-lab-project.json");
  const importProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      if (!parsed?.input || typeof parsed.input !== "object") throw new Error("프로젝트 입력값이 없습니다.");
      setInput({ ...DEFAULT_INPUT, ...parsed.input });
      setDocuments(Array.isArray(parsed.documents) ? parsed.documents : []);
      setReviewData(parsed.reviewData ?? null);
      setReviewedRules(Array.isArray(parsed.reviewedRules) ? parsed.reviewedRules : []);
      setLookupDetails(parsed.lookupDetails ?? null);
      setToast("프로젝트를 불러왔습니다.");
    } catch (error) {
      setToast(`프로젝트 불러오기 실패 · ${error instanceof Error ? error.message : "파일 형식 오류"}`);
    } finally {
      event.target.value = "";
    }
  };
  const exportExcel = async () => {
    setToast("실제 XLSX 파일을 생성하고 있습니다…");
    try {
      const response = await fetch("/api/export/xlsx", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input, results, reviewData, reviewedRules: activeRules }),
      });
      if (!response.ok) throw new Error((await response.json()).error || "XLSX 생성 실패");
      downloadBlob(await response.blob(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "LH-Plan-Lab.xlsx");
      setToast("계산식과 법규근거가 포함된 XLSX를 생성했습니다.");
    } catch (error) {
      setToast(error instanceof Error ? error.message : "XLSX 생성에 실패했습니다.");
    }
  };

  return <div className="app-shell">
    <aside className="sidebar">
      <div className="brand"><span className="brand-mark"><i /><i /></span><div><b>LH PLAN LAB</b><small>Public Housing Feasibility</small></div></div>
      <div className="side-caption">PROJECT WORKFLOW</div>
      <nav>{tabs.map((tab, index) => <button key={tab.name} className={activeTab === index ? "active" : ""} onClick={() => setActiveTab(index)}><span className="nav-icon"><Icon name={tab.icon} /></span><span><b>{tab.name}</b><small>{tab.subtitle}</small></span>{index === 0 && <i className="nav-dot complete" />}{index > 0 && index < 4 && <i className="nav-dot review" />}<Icon name="chevron" size={14} /></button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="project-progress"><div className="progress-head"><span>검토 완성도</span><b>42%</b></div><div className="progress-track"><i /></div><p>법적 근거 및 지구단위계획 원문 연결이 필요합니다.</p></div>
      <button className="side-tool" onClick={() => setToast(`저장된 검토 버전 ${versionCount}개`)}><Icon name="history" size={18} /> 버전 기록 <span>{versionCount}</span></button>
      <button className="side-tool" onClick={() => setToast("환경설정은 입력 화면의 계획 가정에서 편집할 수 있습니다.")}><Icon name="settings" size={18} /> 환경설정</button>
      <div className="user-block"><span>김</span><div><b>사업기획팀</b><small>Architecture Office</small></div><i>···</i></div>
    </aside>

    <main>
      <header className="topbar"><div><span>프로젝트</span><i>/</i><b>{input.projectName || "새 프로젝트"}</b></div><div className="top-actions"><span className="build-version">v0.8.0</span><span className="autosave"><i /><b>{savedAt ? "자동 저장됨" : "저장 준비"}</b></span><input ref={projectImportRef} type="file" hidden accept=".json,application/json" onChange={importProject} /><button className="button ghost" onClick={() => projectImportRef.current?.click()}><Icon name="upload" size={17} /> 불러오기</button><button className="button ghost" onClick={saveVersion}><Icon name="save" size={17} /> 버전 저장</button><button className="button dark" onClick={() => setActiveTab(4)}><Icon name="report" size={17} /> 결과 보고서</button></div></header>

      <div className="content">
        {activeTab === 0 && <>
          <SectionHeader eyebrow="01 · SITE INPUT" title="대상지 및 사업조건" description="자동조회 정보와 사용자 입력값을 구분해 관리합니다. 입력 즉시 4개 대안이 다시 계산됩니다." action={<div className="source-legend"><Badge status="verified" /><Badge status="user" /><Badge status="unknown" /></div>} />
          <div className="summary-strip">
            <Metric label="대지면적" value={f(input.siteArea)} suffix="㎡" sub="사용자 입력" />
            <Metric label="적용 용적률" value={appliedFar} suffix="%" sub={input.useRelaxedFar ? "완화안 · 조건부" : "기본안"} tone="navy" />
            <Metric label="건폐율 상한" value={input.buildingCoverageRatio} suffix="%" sub="근거 확인 필요" />
            <Metric label="접도 폭원" value={input.roadWidth} suffix="m" sub="사용자 입력" />
            <div className="strip-status"><span>검토 상태</span><b><i /> 법규 원문 연결 전</b><small>자동 확정 판정 안 함</small></div>
          </div>

          <section className="card form-card">
            <div className="card-title"><div className="title-icon"><Icon name="building" /></div><div><h3>사업 기본정보</h3><p>프로젝트의 식별정보와 LH 사업방식을 설정합니다.</p></div><Badge status="user" /></div>
            <div className="form-grid three">
              <Field label="사업명" wide><input value={input.projectName} onChange={(e) => update("projectName", e.target.value)} /></Field>
              <Field label="사업방식"><select value={input.businessMode} onChange={(e) => update("businessMode", e.target.value as ProjectInput["businessMode"])}><option value="undecided">미정</option><option value="direct">LH 직접건설</option><option value="purchase">민간 신축매입약정</option><option value="other">기타</option></select></Field>
              <Field label="LH 공급유형"><select value={input.lhSupplyType} onChange={(e) => update("lhSupplyType", e.target.value as ProjectInput["lhSupplyType"])}><option value="undecided">미정</option><option value="newlywed">신혼형</option><option value="youth">청년형</option><option value="general">일반형</option><option value="senior">고령자형</option></select></Field>
              <Field label="적용 지역본부"><input value={input.regionalOffice} onChange={(e) => update("regionalOffice", e.target.value)} /></Field>
              <Field label="사용자 확인 계획조건" wide><input value={input.userPlanNotes} onChange={(e) => update("userPlanNotes", e.target.value)} placeholder="예: 건축한계선 3m 확인, 고도제한 협의 중" /></Field>
            </div>
            {input.businessMode === "undecided" && <div className="notice amber"><Icon name="alert" /><div><b>사업방식이 확정되지 않았습니다.</b><span>매입약정 0.3대 특례와 관련 인센티브는 자동 적용하지 않고 별도 검토사항으로 유지합니다.</span></div></div>}
          </section>

          <section className="card api-connect-card">
            <div className="card-title"><div className="title-icon teal"><Icon name="database" /></div><div><h3>공식 API 연결</h3><p>Vercel에 등록한 서버 API 키가 자동 사용됩니다. 아래 입력은 로컬 진단용으로, 비워둬도 정상입니다.</p></div><span className={`connection-pill ${vworldKey.trim() || lawOc.trim() ? "connected" : ""}`}><i />{vworldKey.trim() || lawOc.trim() ? "임시 입력됨" : "서버 자동연결"}</span></div>
            <div className="api-connect-grid">
              <Field label="VWorld API Key" hint="주소·좌표·용도지역 조회"><input id="vworld-api-key" className="secret-input" type="text" autoComplete="off" value={vworldKey} onChange={(e) => updateVworldKey(e.currentTarget.value)} placeholder="VWorld에서 발급받은 Key" /></Field>
              <Field label="국가법령정보 공동활용 OC" hint="현행 법령·시행일·원문 조회"><input id="law-api-oc" className="secret-input" type="text" autoComplete="off" value={lawOc} onChange={(e) => updateLawOc(e.currentTarget.value)} placeholder="공동활용 신청 시 등록한 OC" /></Field>
              <div className="api-links"><a href="https://www.vworld.kr/dev/v4dv_apikey_s001.do" target="_blank" rel="noreferrer">VWorld 키 발급 ↗</a><a href="https://open.law.go.kr/LSO/openApi/guideList.do" target="_blank" rel="noreferrer">법령 API 신청 ↗</a></div>
              <button type="button" className="button primary review-button" disabled={isReviewing} onClick={runSiteReview}>{isReviewing ? "공식자료 조회 중…" : "대상지 통합 법규검토"}</button>
            </div>
            <div className="api-scope"><span><Icon name="check" size={14} /> 자동조사: 주소·필지·토지이용·법령·자치법규·공식 웹 원문후보</span><span><Icon name="alert" size={14} /> 조항·별표·지구단위계획 적용판정은 원문 확보 후 완료</span></div>
            <div className={`api-panel-message ${isReviewing ? "loading" : ""}`}><i />{apiPanelMessage}</div>
            <div className="review-progress">{reviewSteps.map((step, index) => <div className={step.done ? "done" : step.partial ? "partial" : isReviewing && index === 0 ? "active" : "waiting"} key={step.label}><span>{index + 1}</span><b>{step.label}</b><small>{step.done ? "근거 확보" : step.partial ? "일부 확보" : "대기"}</small></div>)}</div>
          </section>

          <section className="card form-card">
            <div className="card-title"><div className="title-icon teal"><Icon name="site" /></div><div><h3>대상지 위치</h3><p>주소 API가 연결되면 좌표를 확인하며, 법적 조건은 원문 확인 후에만 확정합니다.</p></div><Badge status="user" /></div>
            <div className="address-row"><div className="address-input"><Icon name="search" size={18} /><input value={input.address} onChange={(e) => { const address = e.target.value; setInput((current) => resetSiteDependentInput(current, address)); setLookupDetails(null); setReviewData(null); setReviewedRules([]); setReviewCandidateIndex(null); }} placeholder="전국 도로명주소 또는 지번주소" /></div><button className="button primary" disabled={isReviewing} onClick={lookupAddress}>{isReviewing ? "통합 조회 중…" : "전국 통합 자동검토"}</button></div>
            <Toggle checked={input.multipleParcels} onChange={(value) => { update("multipleParcels", value); if (!value) update("parcelList", ""); }} label="복수 필지 통합검토" note="각 필지의 좌표·면적·용도지역을 분리 조회하며 최대 10필지" />
            {input.multipleParcels && <Field label="추가 필지 목록" hint="한 줄에 한 주소 또는 지번 · 대표 주소는 위에 입력"><textarea value={input.parcelList} onChange={(e) => update("parcelList", e.target.value)} rows={4} placeholder={"경기도 의정부시 가능동 72-5\n경기도 의정부시 가능동 75-1"} /></Field>}
            {lookupDetails && <div className="lookup-result-card">
              <div className="lookup-result-head"><Badge status="verified" /><b>{input.address}</b><span>{lookupDetails.source} · {lookupDetails.confirmedAt} 확인</span></div>
              <div className="lookup-result-grid"><span><small>대지면적</small><b>{lookupDetails.siteArea.toLocaleString()}㎡</b></span><span><small>지목</small><b>{lookupDetails.landCategory}</b></span><span><small>용도지역</small><b>{lookupDetails.zone}</b></span><span><small>개별공시지가</small><b>{lookupDetails.publicPricePerSqm.toLocaleString()}원/㎡</b></span></div>
              <div className="lookup-result-lines"><span><Icon name="site" size={14} /><b>접도</b>{lookupDetails.roads.join(" · ")}</span><span><Icon name="law" size={14} /><b>지역·구역</b>{[...lookupDetails.restrictions, lookupDetails.landscape].join(" · ")}</span></div>
              {lookupDetails.warnings.map((warning) => <div className="lookup-warning" key={warning}><Icon name="alert" size={13} />{warning}</div>)}
            </div>}
            {!lookupDetails && reviewData && (reviewData.location || reviewData.landUse.length > 0) && <div className="lookup-result-card">
              <div className="lookup-result-head"><Badge status={reviewData.location ? "verified" : "review"} /><b>{input.address}</b><span>VWorld 통합조회 · {new Date(reviewData.checkedAt).toLocaleString("ko-KR")}</span></div>
              <div className="lookup-result-grid"><span><small>대지면적</small><b>{reviewData.parcel?.area ? `${f(reviewData.parcel.area)}㎡${reviewData.parcel.approximate ? " (개략)" : ""}` : "미확보"}</b></span><span><small>지목</small><b>{reviewData.parcel?.landCategory || "미확보"}</b></span><span><small>용도지역</small><b>{reviewData.mixedUseZones ? "혼합 · 필지별 확인" : reviewData.landUse.find((item) => item.category === "용도지역")?.name || "미확보"}</b></span><span><small>좌표</small><b>{reviewData.location ? `${reviewData.location.x}, ${reviewData.location.y}` : "미확보"}</b></span></div>
              {reviewData.landUse.length > 0 && <div className="lookup-result-lines"><span><Icon name="law" size={14} /><b>토지이용</b>{reviewData.landUse.map((item) => item.name).join(" · ")}</span></div>}
              {reviewData.errors.map((error) => <div className="lookup-warning" key={error}><Icon name="alert" size={13} />{error}</div>)}
            </div>}
            <div className="form-grid three compact">
              <Field label="시·도"><input value={input.province} onChange={(e) => update("province", e.target.value)} /></Field>
              <Field label="시·군·구"><input value={input.district} onChange={(e) => update("district", e.target.value)} /></Field>
              <Field label="용도지역·지구"><input value={input.zone} onChange={(e) => update("zone", e.target.value)} /></Field>
            </div>
            <Toggle checked={input.districtPlan} onChange={(v) => update("districtPlan", v)} label="지구단위계획구역" note="체크 시 결정도서와 시행지침 원문 검토가 필수입니다." />
          </section>

          <div className="two-column">
            <section className="card form-card">
              <div className="card-title"><div className="title-icon blue"><Icon name="area" /></div><div><h3>대지 및 도로조건</h3><p>배치 가능성을 위한 개략 입력값</p></div></div>
              <div className="form-grid two compact">
                <NumberField label="대지면적" value={input.siteArea} onChange={(v) => update("siteArea", v)} suffix="㎡" />
                <NumberField label="건축가능 대지비율" value={input.buildableSiteRatio} onChange={(v) => update("buildableSiteRatio", v)} suffix="%" />
                <NumberField label="대지 폭" value={input.siteWidth} onChange={(v) => update("siteWidth", v)} suffix="m" />
                <NumberField label="대지 깊이" value={input.siteDepth} onChange={(v) => update("siteDepth", v)} suffix="m" />
                <NumberField label="전면도로 폭원" value={input.roadWidth} onChange={(v) => update("roadWidth", v)} suffix="m" step={0.5} />
                <NumberField label="조경 계획비율" value={input.landscapeRatio} onChange={(v) => update("landscapeRatio", v)} suffix="%" hint="법정값 아님" />
              </div>
            </section>
            <section className="card form-card">
              <div className="card-title"><div className="title-icon orange"><Icon name="scale" /></div><div><h3>법규 및 계획 상한</h3><p>원문 확인 전 사용자 계획값으로 표시</p></div><Badge status="review" /></div>
              <div className="form-grid two compact">
                <NumberField label="건폐율 상한" value={input.buildingCoverageRatio} onChange={(v) => update("buildingCoverageRatio", v)} suffix="%" />
                <NumberField label="기본 용적률" value={input.baseFar} onChange={(v) => update("baseFar", v)} suffix="%" />
                <NumberField label="완화 용적률" value={input.relaxedFar} onChange={(v) => update("relaxedFar", v)} suffix="%" />
                <NumberField label="최고층수" value={input.maxFloors} onChange={(v) => update("maxFloors", v)} suffix="층" />
                <NumberField label="최고높이" value={input.maxHeight} onChange={(v) => update("maxHeight", v)} suffix="m" step={0.5} />
                <NumberField label="기준층 활용률" value={input.floorPlateRatio} onChange={(v) => update("floorPlateRatio", v)} suffix="%" hint="최대 건축면적 대비" />
              </div>
              <Toggle checked={input.useRelaxedFar} onChange={(v) => update("useRelaxedFar", v)} label="완화 용적률 시나리오 사용" note="근거 확인 전 조건부 시뮬레이션으로만 적용" />
            </section>
          </div>

          <section className="card upload-card">
            <div className="card-title"><div className="title-icon purple"><Icon name="upload" /></div><div><h3>검토자료 업로드</h3><p>토지이용계획확인서, 결정도서, 시행지침, 고시문, LH 공고문</p></div><button className="button ghost" onClick={() => uploadRef.current?.click()}><Icon name="upload" size={17} /> 파일 선택</button></div>
            <input ref={uploadRef} type="file" hidden multiple accept=".pdf,.txt,.docx,.hwpx,.hwp,.xlsx" onChange={handleFiles} />
            {documents.length === 0 ? <button className="drop-zone" onClick={() => uploadRef.current?.click()}><span><Icon name="upload" size={26} /></span><b>PDF·HWPX·DOCX·XLSX·TXT 문서를 등록하세요</b><small>서버에서 본문과 법규수치 후보를 추출하며, 검증 전에는 계산에 적용하지 않습니다.</small></button> : <div className="file-list">{documents.map((doc) => <div key={doc.id}><span className="file-icon">{doc.name.split(".").pop()?.toUpperCase()}</span><span><b>{doc.name}</b><small>{doc.category} · {(doc.size / 1024 / 1024).toFixed(2)} MB · {doc.status === "analyzing" ? "분석 중" : doc.status === "analyzed" ? `본문 ${doc.analysis?.textLength.toLocaleString()}자 · 후보 ${doc.analysis?.candidates.length ?? 0}건` : doc.error || "분석 필요"}</small>{doc.analysis && <details className="document-analysis"><summary>추출 결과 보기</summary><p>{doc.analysis.preview || "텍스트 없음"}</p>{doc.analysis.candidates.slice(0, 8).map((candidate, index) => <em key={`${candidate.topic}-${index}`}>{candidate.topic} · {candidate.value ?? "수치 없음"}{candidate.unit || ""} · 검증 전</em>)}{doc.analysis.warnings.map((warning) => <em key={warning}>{warning}</em>)}</details>}</span><Badge status={doc.status === "analyzed" ? "review" : "unknown"} /><button onClick={() => setDocuments((current) => current.filter((item) => item.id !== doc.id))}>×</button></div>)}</div>}
          </section>
        </>}

        {activeTab === 1 && <>
          <SectionHeader eyebrow="02 · REGULATION REVIEW" title="법규 및 도시계획 검토" description="확인된 원문, 사용자 입력, 자료 미확보 상태를 분리합니다. 미확인 값으로 적법 판정을 만들지 않습니다." action={<a className="official-link" href="https://www.law.go.kr" target="_blank" rel="noreferrer">국가법령정보센터 ↗</a>} />
          <div className="review-overview"><div><span className="overview-icon navy"><Icon name="database" /></span><span><b>{12 + (reviewData?.laws.length ?? 0) + (reviewData?.ordinances?.length ?? 0) + (reviewData?.landUse.length ?? 0)}</b><small>검토 항목</small></span></div><div><span className="overview-icon green"><Icon name="check" /></span><span><b>{(reviewData?.laws.length ?? 0) + (reviewData?.ordinances?.length ?? 0) + (reviewData?.landUse.length ?? 0) + (reviewData?.location ? 1 : 0) + (reviewData?.parcel ? 1 : 0)}</b><small>공식자료 위치 확인</small></span></div><div><span className="overview-icon blue"><Icon name="save" /></span><span><b>{reviewCompleteness}%</b><small>근거 기반 완성도</small></span></div><div><span className="overview-icon orange"><Icon name="alert" /></span><span><b>{reviewData?.unresolved.length ?? 8}</b><small>확인 필요</small></span></div></div>
          {!reviewData ? <div className="notice danger"><Icon name="alert" /><div><b>공식자료 조사가 아직 실행되지 않았습니다.</b><span>대상지 입력 화면에서 ‘전국 통합 자동검토’를 실행해 주세요.</span></div></div> : <div className={`notice ${reviewData.applicationAssessmentComplete ? "success" : "amber"}`}><Icon name={reviewData.applicationAssessmentComplete ? "check" : "alert"} /><div><b>{reviewData.applicationAssessmentComplete ? "조항 근거를 포함한 적용판정을 완료했습니다." : "공식자료 위치는 확인했지만 조항·별표 적용판정은 아직 완료되지 않았습니다."}</b><span>확인시각 {new Date(reviewData.checkedAt).toLocaleString("ko-KR")} · 법령 검색 성공과 대상지 적용판정을 구분합니다.</span></div></div>}
          {reviewData && <section className="card official-results-card">
            <div className="card-title"><div className="title-icon teal"><Icon name="database" /></div><div><h3>공식자료 확인 결과</h3><p>VWorld·국가법령정보센터 응답과 업로드 공식문서 확인값을 함께 표시합니다.</p></div><button className="button ghost" disabled={isReviewing} onClick={runSiteReview}>다시 조회</button></div>
            {reviewData.location && <div className="verified-location"><Badge status="verified" /><span><b>{reviewData.location.address}</b><small>{reviewData.location.parcelAddress || "지번주소 없음"} · 좌표 {reviewData.location.x}, {reviewData.location.y}</small></span></div>}
            {reviewData.parcel && <div className="official-group"><h4>필지 자동조회</h4><div className="official-row"><Badge status="verified" /><b>{reviewData.parcel.area ? `${f(reviewData.parcel.area)}㎡` : "면적 미확보"}</b><span>{reviewData.parcel.landCategory ? `지목 ${reviewData.parcel.landCategory} · ` : ""}{reviewData.parcel.source}{reviewData.parcel.pnu ? ` · PNU ${reviewData.parcel.pnu}` : ""}</span><code>{reviewData.parcel.approximate ? "도형 개략" : "공식값"}</code></div></div>}
            {(reviewData.parcels?.length ?? 0) > 1 && <div className="official-group"><h4>복수 필지별 조사 결과</h4>{reviewData.parcels.map((item) => <div className="official-row" key={item.inputAddress}><Badge status={item.errors.length ? "review" : "verified"} /><b>{item.location?.parcelAddress || item.inputAddress}</b><span>{item.parcel?.area ? `${f(item.parcel.area)}㎡` : "면적 미확보"} · {item.landUse.filter((use) => use.category === "용도지역").map((use) => use.name).join(" / ") || "용도지역 미확보"}</span><code>{item.errors.length ? "일부 실패" : "조회"}</code></div>)}</div>}
            {reviewData.landUse.length > 0 && <div className="official-group"><h4>토지이용 · 용도지역</h4>{reviewData.landUse.map((item) => <div className="official-row" key={`${item.code}-${item.name}`}><Badge status="verified" /><b>{item.name}</b><span>{item.source}</span><code>{item.code}</code></div>)}</div>}
            {reviewData.planningStandards && <div className="official-group">
              <h4>전국 공통 용도지역 참고 상한 (계산 미반영)</h4>
              <p>{reviewData.planningStandards.zone}: 건폐율 {reviewData.planningStandards.buildingCoverageRatio}% · 용적률 {reviewData.planningStandards.far}%</p>
              <p>{reviewData.planningStandards.source} · 관할 도시계획조례와 지구단위계획에서 정한 실제 적용값을 확인해야 합니다. 이 일반 상한만으로 규모계산을 자동 확정하지 않습니다.</p>
            </div>}
            {reviewData.laws.length > 0 && <div className="official-group"><h4>현행 국가법령 · 메타데이터 확인</h4>{reviewData.laws.map((law) => <a className="official-row" href={law.link} target="_blank" rel="noreferrer" key={law.name}><Badge status="review" /><b>{law.name}</b><span>{law.ministry || "소관부처 확인"} · 시행 {law.enforcementDate || "일자 미확보"} · 적용판정 전</span><em>원문 ↗</em></a>)}</div>}
            {(reviewData.nationalArticleCandidates?.length ?? 0) > 0 && <div className="official-group">
              <h4>국가법령 조항 자동발췌 ({reviewData.nationalArticleCandidates?.length ?? 0}건)</h4>
              <p>공공주택 특별법 시행령 및 주택건설기준규정 원문 발췌입니다. 법령 원문 검색 성공만으로 개별 LH 매입사업 적용이 확정되는 것은 아닙니다.</p>
              {reviewData.nationalArticleCandidates?.filter((item) => item.topic === "주차").slice(0, 8).map((item, index) =>
                <details className="reg-detail" key={item.sourceTitle + item.article + index}>
                  <summary><Badge status="review"/> {item.sourceTitle} · {item.article}</summary>
                  <p>{item.excerpt}</p>
                  <a href={item.sourceUrl} target="_blank" rel="noreferrer">법령 원문 ↗</a>
                </details>
              )}
            </div>}
            {(reviewData.ordinances?.length ?? 0) > 0 && <div className="official-group"><h4>관할 자치법규 · 메타데이터 확인</h4>{reviewData.ordinances.map((ordinance) => <a className="official-row" href={ordinance.link} target="_blank" rel="noreferrer" key={ordinance.name}><Badge status="review" /><b>{ordinance.name}</b><span>{ordinance.localGovernment || "관할기관 확인"} · 시행 {ordinance.enforcementDate || "일자 미확보"} · 조문 분석 전</span><em>원문 ↗</em></a>)}</div>}
            {autoZoningCandidates.length > 0 && <div className="official-group">
              <h4>대상 용도지역 ↔ 조례 수치 자동 대조 ({autoZoningCandidates.length}건)</h4>
              <p>조례 본문의 용도지역과 숫자가 같은 행에 명시된 경우만 추출했습니다. 확정 적용값이 아니며, 지구단위계획 및 별표·부칙·개정 관계 확인 전에는 규모계산에 자동 적용하지 않습니다.</p>
              {autoZoningCandidates.map((rule, index) => <div key={rule.sourceTitle + rule.topic + index} className="official-row">
                <Badge status="review"/>
                <b>{rule.zone} · {rule.topic} {rule.value}%</b>
                <span>{rule.sourceTitle} · {rule.article}{rule.needsDistrictPlanReview ? " · 지구단위계획 별도 확인" : ""}</span>
                <button type="button" className="button ghost" onClick={() => {
                  setReviewCandidateIndex(rule.articleIndex);
                  setReviewRuleField(rule.topic === "건폐율" ? "buildingCoverageRatio" : "baseFar");
                  setReviewRuleValue(String(rule.value));
                }}>원문 확인 후 반영</button>
              </div>)}
            </div>}
            {(reviewData.ordinanceArticleCandidates?.length ?? 0) > 0 && <div className="official-group">
              <h4>자치법규 조문 자동 발췌 · 적용 검증 전 ({reviewData.ordinanceArticleCandidates?.length ?? 0}건)</h4>
              <p>국가법령정보센터 원문에서 관련 키워드를 추출했습니다. 대상 필지에 적용되는 조항·별표인지 아직 검증되지 않았으며 건폐율·용적률 등 계산에는 자동 반영되지 않습니다.</p>
              {reviewData.ordinanceArticleCandidates?.slice(0, 15).map((candidate, index) =>
                <details key={`${candidate.sourceTitle}-${candidate.topic}-${index}`} className="reg-detail">
                  <summary><Badge status="review" /> {candidate.topic} · {candidate.sourceTitle} · {candidate.article}</summary>
                  <p>{candidate.excerpt}</p>
                  <a href={candidate.sourceUrl} target="_blank" rel="noreferrer">국가법령정보센터 원문 확인 ↗</a>{["건폐율", "용적률", "주차", "높이"].includes(candidate.topic) &&
                    <button type="button" className="button ghost" onClick={() => {
                      setReviewCandidateIndex(index);
                      setReviewRuleField(candidate.topic === "건폐율" ? "buildingCoverageRatio" :
                        candidate.topic === "용적률" ? "baseFar" : candidate.topic === "높이" ? "maxHeight" : "apartmentParkingRatio");
                      setReviewRuleValue("");
                    }}>이 원문 근거로 계획값 입력</button>}
                </details>
              )}
            </div>}
            {selectedSource && <div className="official-group">
              <h4>검토자 확인 후 규모계산 연결</h4>
              <p>원문 후보는 자동 판정이 아닙니다. 아래 조항의 대상지·용도지역·지구단위계획 적용 여부를 직접 확인한 경우에만 수치를 반영하세요.</p>
              <b>{selectedSource.sourceTitle} · {selectedSource.article}</b>
              <p>{selectedSource.excerpt}</p>
              <div className="form-grid two compact">
                <Field label="계산에 적용할 항목"><select value={reviewRuleField} onChange={(event) => setReviewRuleField(event.target.value as ReviewedRuleField)}>
                  {selectedSource.topic === "건폐율" && <option value="buildingCoverageRatio">건폐율 상한 (%)</option>}
                  {selectedSource.topic === "용적률" && <option value="baseFar">기본 적용 용적률 (%)</option>}
                  {selectedSource.topic === "주차" && <><option value="apartmentParkingRatio">공동주택 주차계수 (대/세대)</option><option value="officetelParkingRatio">오피스텔 주차계수 (대/호)</option></>}
                  {selectedSource.topic === "높이" && <><option value="maxHeight">최고높이 (m)</option><option value="maxFloors">최고층수 (층)</option></>}
                </select></Field>
                <Field label="원문·조건 확인 후 수치"><input type="number" min="0" step="any" value={reviewRuleValue} onChange={(event) => setReviewRuleValue(event.target.value)} placeholder="원문 확인 수치" /></Field>
              </div>
              <button className="button primary" type="button" onClick={applyReviewedFinding}>검토자 확인값을 규모검토에 반영</button>
              <button className="button ghost" type="button" onClick={() => setReviewCandidateIndex(null)}>취소</button>
            </div>}
            {activeRules.length > 0 && <div className="official-group">
              <h4>계산에 반영된 원문 연결 입력값 (검토자 확인)</h4>
              {activeRules.map((rule) => <div className="official-row" key={rule.field}>
                <Badge status="user" /><b>{rule.field} · {rule.value}</b><span>{rule.sourceTitle} · 자동 적법판정 아님</span>
                <a href={rule.sourceUrl} target="_blank" rel="noreferrer">원문 ↗</a>
                <button type="button" onClick={() => setReviewedRules((current) => current.filter((item) => item.field !== rule.field))}>근거 연결 해제</button>
              </div>)}
            </div>}
            {(reviewData.officialDocuments?.documents.length ?? 0) > 0 && <div className="official-group">
              <h4>공식 첨부문서 자동분석 · 지구단위계획 / LH 공고</h4>
              <p>공식 홈페이지에서 발견한 PDF·HWPX·XLSX 첨부자료만 읽었습니다. 검색 결과가 해당 필지 또는 해당 연도 LH 사업의 유효한 최종 도서인지는 검증 전이며, 추출 수치는 계산에 자동 적용하지 않습니다.</p>
              {reviewData.officialDocuments?.documents.map((document, index) => <details className="reg-detail" key={document.sourceUrl + index}>
                <summary><Badge status={document.status === "analyzed" ? "review" : "unknown"} /> {document.kind === "district-plan" ? "지구단위계획" : "LH 공고·지침"} · {document.title} ({document.status === "analyzed" ? "본문 추출" : document.status === "failed" ? "추출 실패" : "원문 링크만 확인"})</summary>
                <a href={document.sourceUrl} target="_blank" rel="noreferrer">공식 원문 열기 ↗</a>
                {document.landingPage && <p>원 게시글: <a href={document.landingPage} target="_blank" rel="noreferrer">공고·고시 페이지 ↗</a></p>}
                <p>{document.format?.toUpperCase() || "확장자 미확보"} · 본문 {document.textLength.toLocaleString("ko-KR")}자 · 관련 후보 {document.candidates.length}건 · 적용 검증 전</p>
                {document.preview && <p>{document.preview}</p>}
                {document.candidates.slice(0, 12).map((candidate, candidateIndex) => <p key={candidateIndex}>
                  <b>{candidate.topic} {candidate.value === null ? "" : String(candidate.value) + (candidate.unit || "")} · 미검증</b> — {candidate.quote}
                </p>)}
                {document.warnings.map((warning, warningIndex) => <p key={warningIndex}>확인사항: {warning}</p>)}
              </details>)}
            </div>}
            {(reviewData.webSearch?.results?.length ?? 0) > 0 && <div className="official-group"><h4>공식 웹 후속검색 · 원문 후보</h4>{reviewData.webSearch.results.map((result) => <a className="official-row" href={result.url} target="_blank" rel="noreferrer" key={result.url}><Badge status="review" /><b>{result.title}</b><span>{result.sourceDomain} · 본문 분석 전</span><em>원문 ↗</em></a>)}</div>}
            {(reviewData.missing.length > 0 || reviewData.errors.length > 0) && <div className="api-errors">{reviewData.missing.map((name) => <span key={name}><Icon name="alert" size={13} /> {name} 연결 필요</span>)}{reviewData.errors.map((error) => <span key={error}><Icon name="alert" size={13} /> {error}</span>)}</div>}
            <div className="unresolved-list"><h4>별도 원문 확인사항</h4>{reviewData.unresolved.map((item) => <span key={item}>{item}</span>)}</div>
          </section>}
          <div className="reg-grid">{regulationGroups.map((group) => <section className="card regulation-card" key={group.title}><div className="reg-title"><span><Icon name={group.icon} /></span><div><h3>{group.title}</h3><p>{group.summary}</p></div></div><div className="reg-items">{group.items.map((item) => <details key={item.name}><summary><span>{item.name}</span><span className="reg-value">{item.value}</span><Badge status={item.status} /><Icon name="chevron" size={15} /></summary><div className="reg-detail"><b>적용 근거 / 확인사항</b><p>{item.source}</p><span>{reviewData ? `조회시각 ${new Date(reviewData.checkedAt).toLocaleString("ko-KR")}` : "공식자료 조회 전"} · 자동 확정 아님</span></div></details>)}</div></section>)}</div>
          <section className="card relaxation-card">
            <div className="card-title"><div className="title-icon orange"><Icon name="scale" /></div><div><h3>용적률 완화 시나리오</h3><p>완화제도 존재만으로 자동 적용하지 않으며, 요건 확인 전 조건부 분석으로 분리합니다.</p></div><Toggle checked={input.useRelaxedFar} onChange={(v) => update("useRelaxedFar", v)} label="완화안 반영" /></div>
            <div className="scenario-grid"><div><span>기본 적용안</span><b>{input.baseFar}%</b><small>사용자 입력 · 법적 근거 확인 필요</small></div><span className="scenario-arrow">→</span><div className="highlight"><span>완화 검토안</span><b>{input.relaxedFar}%</b><small>조건부 · 관할청/LH 협의 필요</small></div><div className="scenario-impact"><span>최대 연면적 차이</span><b>+{f(input.siteArea * (input.relaxedFar - input.baseFar) / 100)}㎡</b><small>단순 용적률 한도 비교</small></div></div>
            <div className="policy-table"><div className="policy-head"><span>제도명</span><span>법적 근거</span><span>적용 요건</span><span>대상지 판단</span></div>{["공공임대주택 용적률 완화", "신축매입약정 인센티브", "역세권 공공주택 제도"].map((name) => <div key={name}><b>{name}</b><span>원문 자료 미확보</span><span>지역·사업방식·공공기여 확인</span><Badge status="unknown" /></div>)}</div>
          </section>
        </>}

        {activeTab === 2 && <>
          <SectionHeader eyebrow="03 · LH GUIDELINE" title="LH 기준 및 특례 검토" description="LH 직접건설과 민간 신축매입약정 기준을 혼용하지 않고 사업방식별로 판단합니다." />
          <div className="notice navy"><Icon name="lh" /><div><b>{input.businessMode === "purchase" ? "민간 신축매입약정 검토 모드" : input.businessMode === "direct" ? "LH 직접건설 검토 모드" : "사업방식 미정 · 특례 확정 적용 보류"}</b><span>지역본부: {input.regionalOffice} · 최신 공고문 및 설계·시공 가이드라인 원문 연결 필요</span></div></div>
          <div className="lh-layout">
            <section className="card settings-card"><div className="card-title"><div className="title-icon"><Icon name="parking" /></div><div><h3>주차 기준 시뮬레이션</h3><p>계획 가정값이며 법정·LH 원문 확인 전 확정값이 아닙니다.</p></div></div><div className="form-grid two compact">
              <NumberField label="공동주택 법정계수" value={input.apartmentParkingRatio} onChange={(v) => update("apartmentParkingRatio", v)} suffix="대/세대" step={0.1} />
              <NumberField label="공동주택 LH계수" value={input.lhApartmentParkingRatio} onChange={(v) => update("lhApartmentParkingRatio", v)} suffix="대/세대" step={0.1} />
              <NumberField label="오피스텔 법정계수" value={input.officetelParkingRatio} onChange={(v) => update("officetelParkingRatio", v)} suffix="대/호" step={0.1} />
              <NumberField label="오피스텔 LH계수" value={input.lhOfficetelParkingRatio} onChange={(v) => update("lhOfficetelParkingRatio", v)} suffix="대/호" step={0.1} />
              <NumberField label="자주식 면적계수" value={input.selfParkingAreaPerCar} onChange={(v) => update("selfParkingAreaPerCar", v)} suffix="㎡/대" hint="계획 가정값" />
              <NumberField label="기계식 설비계수" value={input.mechanicalAreaPerCar} onChange={(v) => update("mechanicalAreaPerCar", v)} suffix="㎡/대" hint="형식별 재검토" />
              <Field label="0.3대 특례 승인상태" hint="승인 전에는 기본 주차대수를 적용"><select value={input.specialParkingApproval} onChange={(e) => update("specialParkingApproval", e.target.value as ProjectInput["specialParkingApproval"])}><option value="not-reviewed">미검토</option><option value="conditional">조건부 검토</option><option value="approved">공식 승인 확인</option><option value="rejected">적용 불가 확인</option></select></Field>
            </div><div className="toggle-stack">
              <Toggle checked={input.purchaseAgreementConfirmed} onChange={(v) => update("purchaseAgreementConfirmed", v)} label="공공주택사업자 매도약정 체결 원본 확인" note="예정 또는 신청 상태는 해당하지 않음"/>
              <Toggle checked={input.specialParkingUseScopeConfirmed} onChange={(v) => update("specialParkingUseScopeConfirmed", v)} label="오피스텔 등 해당 용도의 특례 대상 인정 확인" note="관할 허가권자/LH의 실제 적용범위 확인"/>
              <Toggle checked={input.specialParkingLhConfirmed} onChange={(v) => update("specialParkingLhConfirmed", v)} label="최신 LH 지역본부 공고 및 추가요건 확인" note="입지·공급유형 및 지역별 조건 포함"/>
              <Toggle checked={input.specialParkingEnabled} onChange={(v) => update("specialParkingEnabled", v)} label="전용 30㎡ 미만 0.3대 특례 시나리오" note="미승인 시 기본안과 분리하여 표시" /><Toggle checked={input.lhParkingRatioVerified} onChange={(v) => update("lhParkingRatioVerified", v)} label="LH 주차계수 근거 확인" note="공고·가이드 원문을 확인한 경우에만 켬" /><Toggle checked={input.mechanicalAllowed} onChange={(v) => update("mechanicalAllowed", v)} label="기계식주차 허용 가정" note="LH 인수·유지관리·비율 제한 원문 확인 필요" /></div></section>
            <section className="card criteria-card"><div className="card-title"><div className="title-icon orange"><Icon name="alert" /></div><div><h3>특례 적용 판정</h3><p>필수조건을 개별 검증합니다.</p></div></div><div className="criteria-list">
              {parking03.checks.map((item) => <div key={item.id}>
                <span className={`criteria-check ${item.status === "pass" ? "ok" : "wait"}`}>{item.status === "pass" ? <Icon name="check" size={15}/> : item.status === "fail" ? "×" : "?"}</span>
                <span><b>{item.label}</b><small>{item.detail}</small></span>
              </div>)}
              <div><a href={parking03.sourceUrl} target="_blank" rel="noreferrer">법령 원문: 공공주택 특별법 시행령 제37조제4항 ↗</a></div>
              </div><div className={`decision ${parking03.canApply ? "conditional" : "hold"}`}><span>{parking03.canApply ? "근거확인 값 반영" : parking03.canShowConditional ? "조건부 시나리오" : "적용 보류"}</span><b>{parking03.canApply ? "B안 0.3대 반영 (사용자 근거확인)" : parking03.canShowConditional ? "기본 주차와 0.3대 조건부 결과를 분리" : "원 법정기준으로 계산"}</b></div></section>
          </div>
          <section className="card facility-card"><div className="card-title"><div className="title-icon teal"><Icon name="building" /></div><div><h3>부대복리시설 비교</h3><p>세대수 변경 시 면적이 자동 재산정되며, 법정 의무와 계획 가정을 구분합니다.</p></div></div><div className="facility-columns">{[results[0], results[2]].map((result) => <div key={result.definition.id}><div className="facility-head"><span>{result.definition.useType === "apartment" ? "A · 공동주택" : "B · 오피스텔"}</span><b>{result.unitCount}{result.definition.useType === "apartment" ? "세대" : "호"} · {f(result.amenityArea)}㎡</b></div>{result.facilities.map((facility) => <div className="facility-row" key={facility.name}><span><b>{facility.name}</b><small>{facility.basis}</small></span><span>{facility.area ? `${f(facility.area)}㎡` : "미설치"}</span><Badge status="review" /></div>)}</div>)}</div></section>
        </>}

        {activeTab === 3 && <>
          <SectionHeader eyebrow="04 · MASSING STUDY" title="건축 규모검토" description="법규상 최대치와 배치·주차를 고려한 개략 실현가능 규모를 구분합니다." action={<span className="live-pill"><i /> LIVE CALCULATION</span>} />
          <div className="assumption-bar"><div><span>대지</span><b>{f(input.siteArea)}㎡</b></div><div><span>용적률</span><b>{appliedFar}%</b></div><div><span>최고</span><b>{input.maxFloors}F / {input.maxHeight}m</b></div><div><span>기준층 활용</span><b>{input.floorPlateRatio}%</b></div><button onClick={() => setActiveTab(0)}><Icon name="settings" size={16} /> 입력값 수정</button></div>
          <div className="alternative-grid">{results.map((result) => <button key={result.definition.id} className={`alt-card ${selected.definition.id === result.definition.id ? "selected" : ""}`} onClick={() => setSelectedId(result.definition.id)}><div className="alt-top"><span>{result.definition.id}</span><Badge status={result.eligibility} /></div><h3>{result.definition.shortName}</h3><p>{result.definition.exclusiveArea}㎡ · 전용률 {result.definition.efficiency * 100}% · {result.definition.parkingMode === "self" ? "자주식" : "기계식"}</p><div className="alt-hero"><strong>{(input.maxFloors > 0 || input.maxHeight > 0) && input.siteArea > 0 && input.baseFar > 0 ? result.unitCount : "—"}</strong><span>{result.definition.useType === "apartment" ? "세대" : "호"}</span></div><div className="alt-stats"><span><small>계획 용적률</small><b>{result.plannedFar}%</b></span><span><small>계획 주차</small><b>{result.parking.finalCount}대</b></span><span><small>규모</small><b>{result.recommendedFloors}F / B{result.parking.basementFloors}</b></span></div><div className="alt-score"><span>보조 사업성 지표</span><div><i style={{ width: `${Math.min(100, Math.max(5, result.score))}%` }} /></div><b>{result.score}</b></div></button>)}</div>
          <div className="detail-layout">
            <section className="card result-detail"><div className="result-title"><div><span className="alt-label">{selected.definition.id}</span><span><h3>{selected.definition.name}</h3><p>선택 대안 상세 산출내역</p></span></div><button className="button ghost" onClick={() => setActiveTab(4)}>비교표에서 보기 <Icon name="chevron" size={15} /></button></div>
              <div className="result-metrics"><Metric label="용적률상 최대" value={selected.unitCountByFar} suffix={selected.definition.useType === "apartment" ? "세대" : "호"} sub="법규 입력값 기준" /><Metric label="배치 가능 최대" value={selected.unitCountByEnvelope} suffix={selected.definition.useType === "apartment" ? "세대" : "호"} sub="층수·높이·기준층 기준" /><Metric label="권장 계획수량" value={selected.unitCount} suffix={selected.definition.useType === "apartment" ? "세대" : "호"} sub="부대시설 반영" tone="navy" /></div>
              <div className="area-breakdown"><h4>면적 구성</h4><div className="area-bar"><i className="exclusive" style={{ flex: selected.residentialExclusiveArea }} /><i className="common" style={{ flex: selected.residentialCommonArea }} /><i className="amenity" style={{ flex: selected.amenityArea }} /><i className="parking" style={{ flex: selected.parkingArea }} /></div><div className="area-legend"><span><i className="exclusive" />전용 <b>{f(selected.residentialExclusiveArea)}㎡</b></span><span><i className="common" />주거공용 <b>{f(selected.residentialCommonArea)}㎡</b></span><span><i className="amenity" />부대·설비 <b>{f(selected.amenityArea + selected.equipmentArea)}㎡</b></span><span><i className="parking" />주차 <b>{f(selected.parkingArea)}㎡</b></span></div></div>
              <div className="calculation-grid"><div><h4>건축 규모</h4><dl><dt>최대 건축면적</dt><dd>{f(selected.maxBuildableArea)}㎡</dd><dt>계획 건축면적</dt><dd>{f(selected.plannedBuildingArea)}㎡</dd><dt>용적률 산정 연면적</dt><dd>{f(selected.farCountedArea)}㎡</dd><dt>지하층 연면적</dt><dd>{f(selected.belowGroundArea)}㎡</dd><dt>전체 연면적</dt><dd>{f(selected.totalFloorArea)}㎡</dd></dl></div><div><h4>주차 계획</h4><dl><dt>원 법정 / LH 요구</dt><dd>{selected.parking.originalLegalCount} / {selected.parking.lhCount}대</dd><dt>특례 조건부 / 기본</dt><dd>{selected.parking.conditionalCount ?? "-"} / {selected.parking.fallbackCount}대</dd><dt>최종 적용</dt><dd>{selected.parking.finalCount}대</dd><dt>자주식 / 기계식</dt><dd>{selected.parking.selfCount} / {selected.parking.mechanicalCount}대</dd><dt>장애인 / 전기차</dt><dd>{selected.parking.accessibleCount} / {selected.parking.evCount}대</dd><dt>예상 지하층</dt><dd>B{selected.parking.basementFloors}</dd></dl></div></div>
              <details className="formula-box" open><summary>공개 산식 <Icon name="chevron" size={15} /></summary>{selected.formulas.map((formula) => <code key={formula}>{formula}</code>)}</details>
            </section>
            <aside className="warnings-panel"><h3><Icon name="alert" size={19} /> 주요 검토사항</h3>{selected.warnings.map((warning, index) => <div key={warning}><span>{index + 1}</span><p>{warning}</p></div>)}<button className="button light" onClick={() => setActiveTab(1)}>법규 검토로 이동 <Icon name="chevron" size={14} /></button></aside>
          </div>
        </>}

        {activeTab === 4 && <>
          <SectionHeader eyebrow="05 · EXECUTIVE SUMMARY" title="건축개요 및 종합비교" description="발주처 보고용 핵심 지표와 산출근거를 한 화면에서 확인하고 출력합니다." action={<div className="report-actions"><button className="button ghost" onClick={exportProject}><Icon name="database" size={16} /> 프로젝트</button><button className="button ghost" onClick={exportExcel}><Icon name="download" size={16} /> Excel</button><button className="button dark" onClick={() => window.print()}><Icon name="report" size={16} /> PDF 인쇄</button></div>} />
          {recommendation ? <section className="recommend-card"><div className="recommend-badge"><Icon name="check" /><span>법규 적합 대안 추천</span></div><div><span className="alt-label inverse">{recommendation.definition.id}</span><div><h2>{recommendation.definition.name}</h2><p>필수 법규·LH 조건을 충족한 대안 중 보조 사업성 지표가 가장 높습니다.</p></div></div><div className="recommend-metrics"><span><small>계획 수량</small><b>{recommendation.unitCount}{recommendation.definition.useType === "apartment" ? "세대" : "호"}</b></span><span><small>계획 용적률</small><b>{recommendation.plannedFar}%</b></span><span><small>지하 부담</small><b>B{recommendation.parking.basementFloors}</b></span><span><small>보조 사업성 지표</small><b>{recommendation.score}</b></span></div></section> : <section className="recommend-card recommendation-hold"><div className="recommend-badge"><Icon name="alert" /><span>추천 보류</span></div><div><span className="alt-label inverse">?</span><div><h2>법규 적합성이 확인된 대안이 없습니다.</h2><p>허용용도, 건폐율·용적률, 주차기준 및 LH 매입 가능성 근거를 확보하기 전에는 점수만으로 대안을 추천하지 않습니다.</p></div></div><div className="recommend-metrics"><span><small>적합</small><b>{results.filter((result) => result.eligibility === "eligible").length}개</b></span><span><small>조건부</small><b>{results.filter((result) => result.eligibility === "conditional").length}개</b></span><span><small>판정불가</small><b>{results.filter((result) => result.eligibility === "unknown").length}개</b></span><span><small>부적합</small><b>{results.filter((result) => result.eligibility === "ineligible").length}개</b></span></div></section>}
          <section className="card comparison-card"><div className="card-title"><div className="title-icon"><Icon name="report" /></div><div><h3>4개 계획안 건축개요</h3><p>{input.projectName} · {input.address}</p></div><span className="report-date">검토일 2026.10.24</span></div><ComparisonTable results={results} input={input} /></section>
          <div className="pros-grid">{results.map((result) => <section className="card pros-card" key={result.definition.id}><div><span className="alt-label">{result.definition.id}</span><h3>{result.definition.shortName}</h3></div><h4>주요 장점</h4><ul><li>계획 수량 {result.unitCount}{result.definition.useType === "apartment" ? "세대" : "호"} 확보</li><li>{result.definition.parkingMode === "mechanical" ? `자주식 대비 주차면적 절감 가능` : "운영·유지관리 안정성 우수"}</li><li>입력 용적률 한도 내 계획</li></ul><h4>위험 및 협의</h4><ul className="risks"><li>{result.definition.useType === "officetel" ? "LH 오피스텔 매입 가능조건 확인" : "주택건설기준 및 부대시설 확인"}</li><li>{result.definition.parkingMode === "mechanical" ? "기계식 인수·비율·형식 협의" : "지하층 및 공사비 부담 검토"}</li></ul></section>)}</div>
          <section className="card audit-card"><div className="card-title"><div className="title-icon orange"><Icon name="alert" /></div><div><h3>보고서 전제 및 제한사항</h3><p>법적 확정값과 계획 추정값을 명확히 구분합니다.</p></div></div><div className="audit-grid"><div><Badge status="user" /><p>대지면적, 건폐율, 용적률, 높이, 주차계수는 현재 사용자 입력값입니다.</p></div><div><Badge status="unknown" /><p>지구단위계획, 조례, 일조·인동거리, LH 최신 공고 원문이 연결되지 않았습니다.</p></div><div><Badge status="review" /><p>추천 결과는 사업성 비교이며 적법성·매입확약·인허가 가능성을 보증하지 않습니다.</p></div></div></section>
        </>}
      </div>
    </main>
    {toast && <div className="toast"><Icon name="check" size={18} />{toast}</div>}
  </div>;
}
