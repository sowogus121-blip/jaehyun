/**
 * 공식자료 조회 결과(SiteReviewResult) → 법규검토표 행.
 *
 * 우선순위: 검토자 수정 > 검증 근거 라이브러리(획지 > 지자체) > 국가법령정보 API 조문 자동추출 > 국가법령 일반기준(후보)
 * 계산 연동 수치는 행 상태가 verified/user일 때만 사용된다 (resolveParams 참고).
 */
import type { SiteReviewResult } from "../types";
import { findZone, LAW, lawUrl, ref, useRestrictionRef, SUNLIGHT_TEXT, SUNLIGHT_HIGHLIGHTS, OPEN_SPACE_ZONES, OPEN_SPACE_FLOOR_AREA } from "./national";
import { matchLibrary, type LibraryContext, type RowPatch } from "./library";
import { findArticle, zoneRatio, type Article } from "./articles";
import { assessParcelAssembly } from "../parcel-assembly";
import { ORDINANCE_TOPICS, NATIONAL_ARTICLES, lhCriterionRow } from "./collect-topics";
import { classifyDesignations, NEW_TOWN_HINT } from "./special-zones";
import { extractParkingRules, extractLhMechRule, describeTiers, type ParkingRule } from "./parking-rules";
import type { ReviewRow, RowStatus, SiteInput, SourceRef, UseKind } from "./types";
import { USE_SHORT } from "./types";


export const ROW_ORDER: Array<{ id: string; group: string; sub?: string; section: ReviewRow["section"] }> = [
  { id: "site.location", group: "위치", section: "site" },
  { id: "site.area", group: "구역면적", section: "site" },
  { id: "site.assembly", group: "합필 검토", section: "site" },
  { id: "site.zone", group: "용도지역·지구", section: "site" },
  { id: "site.road", group: "접도 조건", section: "site" },
  { id: "site.building", group: "기존 건축물", section: "site" },
  { id: "site.overlay", group: "중첩 규제", section: "site" },
  { id: "plan.district", group: "지구단위계획", section: "planning" },
  { id: "plan.use", group: "건축행위 가능 여부", section: "planning" },
  { id: "plan.bcrfar", group: "건폐율 / 용적률", section: "planning" },
  { id: "plan.relax", group: "공공임대 용적률 완화", section: "planning" },
  { id: "plan.height", group: "최고높이", section: "planning" },
  { id: "bld.sunlight", group: "정북일조", section: "building" },
  { id: "bld.spacing", group: "채광·인동거리", section: "building" },
  { id: "bld.setback", group: "대지안의공지", section: "building" },
  { id: "bld.landscape", group: "조경", section: "building" },
  { id: "bld.openspace", group: "공개공지", section: "building" },
  { id: "bld.amenity", group: "부대복리시설", section: "building" },
  { id: "bld.safety", group: "피난·방화·승강기", section: "building" },
  { id: "bld.access", group: "장애인 편의시설", section: "building" },
  { id: "park.mech.ord", group: "기계식주차", sub: "조례", section: "parking" },
  { id: "park.mech.lh", group: "기계식주차", sub: "LH 기준", section: "parking" },
  { id: "park.ordinance", group: "주차", sub: "조례 기준", section: "parking" },
  { id: "park.apartment", group: "주차", sub: "공동주택", section: "parking" },
  { id: "park.urban", group: "주차", sub: "도시형생활주택", section: "parking" },
  { id: "park.officetel", group: "주차", sub: "오피스텔", section: "parking" },
  { id: "park.lh03", group: "주차", sub: "LH 0.3대 특례", section: "parking" },
  { id: "lh.notice", group: "LH 공고", sub: "적용 공고", section: "lh" },
  { id: "lh.scale", group: "LH 공고", sub: "최소 호수·평면", section: "lh" },
  { id: "lh.community", group: "LH 공고", sub: "커뮤니티·관리", section: "lh" },
];

const fmt = (n: number) => n.toLocaleString("ko-KR", { maximumFractionDigits: 2 });
const compact = (s: string) => s.replace(/\s+/g, "");

function articleRef(a: Article, highlights: string[] = []): SourceRef {
  return {
    title: a.sourceTitle, article: a.article, url: a.sourceUrl,
    excerpt: a.fullText ?? a.excerpt, verbatim: true, highlights, kind: "ordinance",
    effectiveDate: undefined,
  };
}

function ordinanceUrl(review: SiteReviewResult | null, keyword: string) {
  return review?.ordinances.find((o) => o.name.includes(keyword))?.link;
}
function ordinanceRef(review: SiteReviewResult | null, keyword: string): SourceRef | null {
  const o = review?.ordinances.find((x) => x.name.includes(keyword));
  return o ? { title: o.name, url: o.link, effectiveDate: o.enforcementDate ?? undefined, kind: "ordinance" } : null;
}
function lawRef(review: SiteReviewResult | null, name: string, article?: string): SourceRef {
  const hit = review?.laws.find((l) => compact(l.name) === compact(name));
  return { ...ref(name, article), effectiveDate: hit?.enforcementDate ?? undefined };
}

function blank(id: string): ReviewRow {
  const t = ROW_ORDER.find((r) => r.id === id);
  return {
    id, group: t?.group ?? id, sub: t?.sub, section: t?.section ?? "extra",
    content: "", law: "", note: "", status: "missing", sources: [], origin: "auto",
  };
}

/** VWorld 레이어 또는 토지이용계획 '지구단위계획구역(포함·저촉)' */
export function districtPlanOf(review: SiteReviewResult | null): boolean {
  return Boolean(review?.districtPlan) || (review?.siteFacts?.designations ?? []).some((d) => /지구단위계획/.test(d.name) && d.conflict !== "접함");
}

function siteContext(site: SiteInput, review: SiteReviewResult | null): LibraryContext {
  const zones = [...new Set((review?.landUse ?? []).filter((l) => l.category === "용도지역").map((l) => l.name))];
  return {
    address: review?.location?.parcelAddress || review?.location?.address || site.address,
    zones,
    districtPlan: review ? districtPlanOf(review) : null,
    blockNo: compact(site.blockNo ?? "").toUpperCase(),
  };
}

export function buildRows(site: SiteInput, review: SiteReviewResult | null): ReviewRow[] {
  const rows = new Map<string, ReviewRow>();
  const put = (row: Partial<ReviewRow> & { id: string }) => {
    const base = rows.get(row.id) ?? blank(row.id);
    rows.set(row.id, { ...base, ...row, origin: "auto" } as ReviewRow);
  };
  const ctx = siteContext(site, review);
  const zoneNames = ctx.zones;
  const mixed = Boolean(review?.mixedUseZones) || zoneNames.length > 1;
  const zoneName = mixed ? "" : zoneNames[0] ?? "";
  const zone = zoneName ? findZone(zoneName) : null;
  const plans = ["apartment", "urban", "officetel"] as UseKind[];
  const uses = site.uses.length ? site.uses : plans;
  const cityPlan = ordinanceRef(review, "도시계획 조례");
  const cityBuilding = ordinanceRef(review, "건축 조례");
  const cityParking = ordinanceRef(review, "주차장");

  // ── 위치 / 면적 / 용도지역 ──
  const place = review?.location?.parcelAddress || review?.location?.address || site.address || "주소 미입력";
  const extra = site.extraParcels.filter(Boolean);
  put({
    id: "site.location",
    content: "· " + place + (extra.length ? `\n· 합필 대상 ${extra.length}필지: ${extra.join(", ")}` : ""),
    law: review?.location ? "VWorld 주소·지적 조회" : "",
    note: review?.location ? "" : "주소 좌표 미조회",
    status: review?.location ? "verified" : site.address ? "user" : "missing",
    sources: review?.location ? [{ title: "국가공간정보포털 VWorld", url: "https://www.vworld.kr", kind: "api" }] : [],
  });

  const land = review?.siteFacts?.land ?? null;
  const officialArea = land?.officialArea && (review?.parcels?.length ?? 1) <= 1 ? land.officialArea : null;
  const apiArea = officialArea ?? review?.parcel?.area ?? null;
  const override = site.siteAreaOverride && site.siteAreaOverride > 0 ? site.siteAreaOverride : null;
  const area = override ?? apiArea;
  put({
    id: "site.area",
    content: area ? `· ${fmt(area)}㎡` : "대지면적 미확보",
    law: override ? "검토자 입력 (토지대장·측량)" : officialArea ? "토지대장 (VWorld 토지특성정보)" : review?.parcel?.source ?? "토지대장",
    note: override
      ? (apiArea ? `조회값 ${fmt(apiArea)}㎡ 대신 입력값 적용` : "")
      : officialArea ? [land?.landCategory ? `지목 ${land.landCategory}` : "", "도로 편입·제외면적 별도 확인"].filter(Boolean).join(" · ")
      : review?.parcel?.approximate ? "지적도형 환산 개략면적 · 토지대장 대조 필요" : "도로 편입·제외면적 별도 확인",
    status: override ? "user" : apiArea ? (officialArea || !review?.parcel?.approximate ? "verified" : "candidate") : "missing",
    params: area ? { siteArea: area } : undefined,
    sources: officialArea ? [{ title: "VWorld 토지특성정보 (토지대장 면적)", url: "https://www.vworld.kr", kind: "api" }] : review?.parcel ? [{ title: review.parcel.source, url: "https://www.vworld.kr", kind: "api" }] : [],
    missing: area ? undefined : "토지대장 면적",
  });

  put({
    id: "site.zone",
    content: zoneNames.length ? "· " + zoneNames.join(" / ") + (mixed ? " (혼합 용도지역)" : "") : "용도지역 미조회",
    law: "국토계획법 제36조 · 토지이용계획확인서",
    note: mixed ? "필지·면적별 용도지역 분리 산정 필요 (가중평균 자동 적용 안 함)" : "",
    status: zoneNames.length ? (mixed ? "candidate" : "verified") : "missing",
    sources: [{ title: "토지이음 토지이용계획", url: "https://www.eum.go.kr", kind: "api" }],
  });

  const facts = review?.siteFacts;
  const designatedRoads = (facts?.designations ?? []).filter((d) => /^(광로|대로|중로|소로)\s*\d\s*류/.test(d.name))
    .map((d) => ({ name: d.name.replace(/\(.*$/, "").trim(), widthText: (d.name.match(/\(([^)]*m[^)]*)\)/)?.[1] ?? "") + (d.conflict ? ` · ${d.conflict}` : ""), minWidth: Number(d.name.match(/폭\s*(\d+)/)?.[1] ?? NaN) || null, source: "토지이용계획 도시계획시설(도로)" }));
  const allRoads = [...designatedRoads, ...(facts?.roads ?? []).filter((r) => !/규모 미표기|도로폭 미표기/.test(r.widthText) && !designatedRoads.some((d) => compact(r.name).startsWith(compact(d.name))))];
  if (facts && (allRoads.length || land?.roadSide)) {
    const minWidth = Math.min(...allRoads.map((r) => r.minWidth ?? Infinity));
    put({
      id: "site.road",
      content: [land?.roadSide ? `· 도로접면: ${land.roadSide}` : "", ...allRoads.map((r) => `· ${r.name} (${r.widthText})`), ...(facts.roads ?? []).filter((r) => /도로폭 미표기/.test(r.widthText)).slice(0, 3).map((r) => `· 인접 도로명: ${r.name}`)].filter(Boolean).join("\n"),
      law: "건축법 제44조(대지와 도로의 관계)·제46조(건축선의 지정)",
      note: [Number.isFinite(minWidth) && minWidth < 4 ? "폭 4m 미만 도로 포함: 건축선 후퇴 검토" : "", "인접 여부·건축선·차량 진출입은 지적도 대조", land?.terrainShape ? `지형 ${land.terrainShape}·${land.terrainHeight ?? ""}` : ""].filter(Boolean).join(" · "),
      status: "verified",
      sources: [{ title: allRoads[0]?.source ?? "VWorld 토지특성정보", url: "https://www.vworld.kr", kind: "api" }],
    });
  } else if (facts) {
    put({ id: "site.road", content: "인접 도로 정보 미검출", law: "건축법 제44조·제46조", note: "지적도·도로대장 확인", status: "missing", sources: [], missing: "접도 도로 폭원" });
  }
  if (facts && (facts.buildings !== null || facts.permits !== null)) {
    const b = facts.buildings ?? [];
    const pm = facts.permits ?? [];
    put({
      id: "site.building",
      content: [
        ...(b.length ? b.map((x) => `· 건축물대장: ${x.name ? x.name + " · " : ""}${x.use} · 연면적 ${x.totalArea ? fmt(x.totalArea) + "㎡" : "-"} · ${x.floors}층 · 사용승인 ${x.approvedAt ?? "-"}`) : facts.buildings ? ["· 건축물대장 표제부 없음 (나대지 또는 미등재)"] : []),
        ...pm.slice(0, 5).map((x) => `· 인허가: ${x.use} · 연면적 ${x.totalArea ? fmt(x.totalArea) + "㎡" : "-"} · 허가 ${x.permittedAt ?? "-"} · 착공 ${x.startedAt ?? "-"} · 사용승인 ${x.approvedAt ?? "-"}`),
      ].join("\n"),
      law: "건축물대장 · 건축인허가 대장",
      note: pm.some((x) => x.permittedAt && !x.approvedAt) ? "유효한 허가 존재 가능: 변경·취소 여부 확인" : b.length ? "철거·멸실 및 명도 일정 확인" : "",
      status: "verified",
      sources: [{ title: "국토교통부 건축HUB (공공데이터포털)", url: "https://www.hub.go.kr", kind: "api" }],
    });
  }

  const assembly = review && review.parcels.length > 1 ? assessParcelAssembly(review) : null;
  if (assembly) {
    const w = assembly.weightedCandidate;
    put({
      id: "site.assembly",
      content: assembly.parcels.map((p) => `· ${p.address}: ${p.area ? fmt(p.area) + "㎡" : "면적 미확보"} · ${p.zone ?? "용도지역 미확인"}`).join("\n")
        + (assembly.totalArea ? `\n· 합계 ${fmt(assembly.totalArea)}㎡` : "")
        + (w ? `\n· 면적 가중 참고: 건폐율 ${w.bcr}% · 용적률 ${w.far}% (최소 용도지역 ${fmt(w.smallestZoneArea)}㎡)` : ""),
      law: "건축법 시행령 제3조 · 국토계획법 제84조, 시행령 제94조",
      note: assembly.notes.slice(2).join(" ") || "필지 인접성·1대지 인정·합필 가능성 별도 확인",
      status: "candidate",
      params: w?.eligibleForStatutoryThreshold ? { bcr: w.bcr, far: w.far } : undefined,
      sources: [ref(LAW.planningAct, "제84조")],
    });
  }

  const overlays = (review?.landUse ?? []).filter((l) => l.category !== "용도지역" && l.code !== "LT_C_UPISUQ161");
  if (overlays.length) {
    put({
      id: "site.overlay",
      content: overlays.map((o) => `· ${o.category}: ${o.name}`).join("\n"),
      law: "국토계획법 제37·38조",
      note: overlays.some((o) => o.name.includes("고도")) ? "고도지구: 최고높이 결정내용 확인" : "지구·구역별 행위제한 확인",
      status: "candidate",
      sources: [{ title: "VWorld 용도지구·구역 레이어", url: "https://www.vworld.kr", kind: "api" }],
    });
  }

  // ── 상위계획·다른 법령에 따른 지역·지구 (토지이용계획확인서 전체) ──
  const designations = review?.siteFacts?.designations ?? null;
  if (designations && designations.length) {
    put({
      id: "site.overlay",
      content: designations.map((d) => `· ${d.name}${d.conflict ? ` (${d.conflict})` : ""}`).join("\n"),
      law: "토지이용계획확인서 (토지이용규제 기본법 제10조)",
      note: "국토계획법 및 다른 법령에 따른 지역·지구 전체. 저촉·접합 표기는 필지 일부만 걸린 경우",
      status: "verified",
      sources: [{ title: "VWorld 토지이용계획 속성정보", url: "https://www.eum.go.kr/web/ar/lu/luLandDet.jsp", kind: "api" }],
    });
    const minor: Array<{ name: string; conflict: string | null; law: string }> = [];
    for (const m of classifyDesignations(designations)) {
      // 대지에 '접함'으로만 걸린 지정은 직접 적용 대상이 아니므로 참고 행으로 모은다 (접한 도로는 접도 조건 행).
      const applied = m.designations.filter((d) => d.conflict !== "접함");
      if (m.rule?.id === "urban-facility" && !applied.length) continue;
      if (!m.rule || !m.rule.scale || !applied.length) {
        for (const d of m.designations) minor.push({ name: d.name, conflict: d.conflict, law: m.rule ? m.rule.law.split(" · ")[0].replace(/\s*제\d.*$/, "") : "" });
        continue;
      }
      m.designations = applied;
      const names = m.designations.map((d) => d.name);
      const lawNames = m.rule.law.split(" · ").map((x) => x.replace(/\s*제\d.*$/, "").trim());
      const lawSources: SourceRef[] = lawNames.filter((n) => !/조례/.test(n)).map((n) => {
        const hit = review?.laws.find((l) => compact(l.name) === compact(n));
        return { title: n, url: hit?.link ?? lawUrl(n), effectiveDate: hit?.enforcementDate ?? undefined, kind: "law" as const };
      });
      const docs = (review?.webSearch?.results ?? []).filter((w) => names.some((n) => compact(w.title).includes(compact(n).replace(/구역$|지구$/, "")))).slice(0, 3)
        .map((w) => ({ title: w.title, url: w.url, excerpt: w.description, verbatim: false, kind: "plan" as const }));
      put({
        id: `zone.${m.rule.id}`,
        group: "상위계획·특별법",
        sub: names.slice(0, 2).join(", "),
        section: "planning",
        content: m.designations.map((d) => `· ${d.name}${d.conflict ? ` (${d.conflict})` : ""}`).join("\n") + `\n· 확인: ${m.rule.check}`,
        law: m.rule.law,
        note: "규모(용도·용적률·높이)에 직접 영향 가능 · 결정고시·계획 원문 확인 후 수치 입력",
        status: "candidate",
        sources: [...lawSources, ...docs],
        missing: m.rule.search ? `${m.rule.search} 원문` : undefined,
      });
    }
    if (minor.length) {
      put({
        id: "zone.minor", group: "상위계획·특별법", sub: "기타 지역·지구", section: "planning",
        content: minor.map((d) => `· ${d.name}${d.conflict ? ` (${d.conflict})` : ""}${d.law ? ` — ${d.law}` : ""}`).join("\n"),
        law: "토지이용계획확인서 · 각 근거 법령",
        note: "규모 영향 낮음 또는 대지 경계에 접함 · 절차(허가·심의·부담금) 해당 여부만 확인",
        status: "candidate", sources: [],
      });
    }
  }
  if (NEW_TOWN_HINT.test(place) && !(designations ?? []).some((d) => /노후계획도시|특별정비/.test(d.name))) {
    put({
      id: "zone.aging-hint", group: "상위계획·특별법", sub: "노후계획도시 해당 여부", section: "planning",
      content: "택지조성사업 완료 후 20년 이상 경과한 100만㎡ 이상 지역이면 노후계획도시 특별법 대상 가능 · 지자체 노후계획도시정비 기본계획 수립 여부 확인",
      law: "노후계획도시 정비 및 지원에 관한 특별법 제2조",
      note: "특별정비예정구역 지정 시 용적률 상향·통합재건축 특례 → 신축매입약정 일정·대상지 가치에 영향",
      status: "candidate",
      sources: [{ title: "노후계획도시 정비 및 지원에 관한 특별법", article: "제2조", url: lawUrl("노후계획도시 정비 및 지원에 관한 특별법", "제2조"), kind: "law" }],
      missing: "노후계획도시정비 기본계획 포함 여부",
    });
  }

  // ── 지구단위계획 ──
  const planDocs = review?.officialDocuments?.documents.filter((d) => d.kind === "district-plan") ?? [];
  if (districtPlanOf(review) || site.blockNo) {
    put({
      id: "plan.district",
      content: districtPlanOf(review)
        ? ((designations ?? []).find((d) => d.name.includes("지구단위계획"))?.name ?? "지구단위계획구역 레이어 검출") + (site.blockNo ? ` · 획지 ${site.blockNo} (검토자 지정)` : " · 획지번호 미확인")
        : `획지 ${site.blockNo} (검토자 지정)`,
      law: "국토계획법 제52조 · 결정조서·결정도·시행지침",
      note: site.blockNo
        ? "결정도·지적 중첩으로 획지 재확인. 허용용도·건폐율·용적률·높이·건축선·차량출입은 획지 기준 우선"
        : "구역 포함만으로 획지 기준을 적용하지 않음. 결정도에서 획지번호 확인 후 입력",
      status: site.blockNo ? "user" : "candidate",
      missing: site.blockNo ? undefined : "해당 필지의 획지번호",
      sources: planDocs.filter((d) => d.status === "analyzed").slice(0, 4).map((d) => ({
        title: d.title, noticeNo: d.gosiNo, effectiveDate: d.gosiDate ?? undefined,
        url: d.sourceUrl, excerpt: (d.text ?? d.preview).slice(0, 4000), verbatim: !!d.gosiNo, kind: "plan" as const,
      })),
    });
  }

  // ── 건축행위 가능 여부 ──
  const useArticle = findArticle(review, "도시계획 조례", ["용도지역안에서의 건축제한", "용도지역 안에서의 건축제한", "건축제한"]);
  put({
    id: "plan.use",
    content: zone
      ? uses.map((u) => `· ${USE_SHORT[u]}: ${zone.zone} 건축제한 별표에서 허용 여부 확인`).join("\n")
      : "용도지역 확정 후 계획 용도별 허용 여부 확인",
    law: [cityPlan?.title ? `${cityPlan.title} 용도지역 건축제한 조항·별표` : "", zone ? `국토계획법 시행령 제71조 별표 ${zone.annex}` : ""].filter(Boolean).join(", "),
    note: "허용·조건부·불허를 행 편집에서 지정해야 규모검토에 반영됨",
    status: useArticle || zone ? "candidate" : "missing",
    sources: [
      ...(zone ? [useRestrictionRef(zone)] : []),
      ...(useArticle ? [articleRef(useArticle, ["건축할 수 있는"])] : cityPlan ? [cityPlan] : []),
      ref("건축법 시행령", "별표 1", { annex: "별표 1" }),
    ],
    missing: "계획 용도별 허용 여부 판정",
  });

  // ── 건폐율 / 용적률 ──
  const bcrArticle = findArticle(review, "도시계획 조례", ["용도지역안에서의 건폐율", "용도지역 안에서의 건폐율"]);
  const farArticle = findArticle(review, "도시계획 조례", ["용도지역안에서의 용적률", "용도지역 안에서의 용적률"]);
  const fromCollected = (label: string) => (review?.collected ?? []).filter((c) => c.topic === label)
    .map((c) => ({ sourceTitle: c.title, sourceUrl: c.url, topic: label, article: c.article, excerpt: c.text.slice(0, 270), fullText: c.text, verified: false as const }));
  const bcrPick = zoneName ? [bcrArticle, ...fromCollected("용도지역별 건폐율")].find((a) => a && zoneRatio(a, zoneName)) ?? bcrArticle : bcrArticle;
  const farPick = zoneName ? [farArticle, ...fromCollected("용도지역별 용적률")].find((a) => a && zoneRatio(a, zoneName)) ?? farArticle : farArticle;
  const bcr = zoneName ? zoneRatio(bcrPick ?? null, zoneName) : null;
  const far = zoneName ? zoneRatio(farPick ?? null, zoneName) : null;
  const plansGovern = Boolean(districtPlanOf(review));
  const bcrfarStatus: RowStatus = bcr && far ? (plansGovern ? "candidate" : "verified") : bcr || far || zone ? "candidate" : "missing";
  put({
    id: "plan.bcrfar",
    content: bcr || far
      ? `건폐율 ${bcr ? bcr.value + "%" : "미추출"} 이하\n용적률 ${far ? fmt(far.value) + "%" : "미추출"} 이하`
      : zone ? `조례 수치 미추출 (국토계획법 시행령 상한: 건폐율 ${zone.bcr}%, 용적률 ${fmt(zone.far)}%)` : "용도지역 미확정",
    law: [bcrPick ? `${bcrPick.sourceTitle} ${bcrPick.article}` : "", farPick ? `${farPick.sourceTitle} ${farPick.article}` : ""].filter(Boolean).join(",\n")
      || "국토계획법 시행령 제84조·제85조 / 관할 도시계획 조례",
    note: plansGovern ? "지구단위계획구역: 획지별 기준 확인 전까지 조례 일반값은 계산에 쓰지 않음"
      : bcr && far ? "조례 원문 자동추출값 · 특별계획·완화 별도" : "조례 조문에서 수치를 입력하면 규모검토에 반영",
    status: bcrfarStatus,
    params: bcr && far ? { bcr: bcr.value, far: far.value } : undefined,
    sources: [
      ...(bcrPick ? [articleRef(bcrPick, bcr ? [zoneName, bcr.match] : [zoneName])] : []),
      ...(farPick ? [articleRef(farPick, far ? [zoneName, far.match] : [zoneName])] : []),
      ...(!bcrPick && !farPick ? [ref(LAW.planningDecree, "제84조"), ref(LAW.planningDecree, "제85조")] : []),
    ],
    missing: bcr && far ? undefined : "관할 조례의 용도지역별 건폐율·용적률 조문",
  });

  // ── 공공임대 용적률 완화 ──
  const relaxArticle = findArticle(review, "도시계획 조례", ["임대주택", "공공임대", "용적률의 완화", "용적률 완화"]);
  put({
    id: "plan.relax",
    content: "공공임대 유형·사업방식별 완화율과 최종 상한 조건부 검토",
    law: relaxArticle ? `${relaxArticle.sourceTitle} ${relaxArticle.article}` : "국토계획법 제78조 · 관할 도시계획 조례 · 공공주택 특별법",
    note: "완화 요건(매입임대 해당성·임대의무기간·공급비율) 확인 전 완화 용적률은 계산에 쓰지 않음",
    status: relaxArticle ? "candidate" : "missing",
    sources: relaxArticle ? [articleRef(relaxArticle, ["임대주택"])] : [ref(LAW.planningAct, "제78조")],
    missing: "완화 상한 및 적용요건",
  });

  // ── 최고높이 ──
  const heightOverlay = overlays.find((o) => o.name.includes("고도"));
  put({
    id: "plan.height",
    content: heightOverlay ? `${heightOverlay.name} 지정 · 최고높이 결정내용 확인` : "별도 최고높이 미확정",
    law: "건축법 제60조, 도시관리계획" + (districtPlanOf(review) ? "·지구단위계획" : ""),
    note: "높이 미확정 시 규모검토는 용적률·건폐율 기준으로 산정하고 층수는 참고값으로 표시",
    status: heightOverlay || districtPlanOf(review) ? "candidate" : "missing",
    sources: [ref(LAW.buildingAct, "제60조")],
    missing: "최고높이·층수 제한 여부",
  });

  // ── 건축 일반 ──
  const sunArticle = findArticle(review, "건축 조례", ["일조", "정북"]);
  put({
    id: "bld.sunlight",
    content: zone?.sunlight ? SUNLIGHT_TEXT : zone ? `${zone.zone}: 정북일조 사선 비적용 (채광·인동거리는 별도)` : "용도지역 확정 후 판단",
    law: "건축법 제61조제1항, 시행령 제86조제1항" + (sunArticle ? `, ${sunArticle.sourceTitle} ${sunArticle.article}` : ""),
    note: zone?.sunlight ? "조례 강화 여부 확인" : "",
    status: zone ? "candidate" : "missing",
    sources: [lawRef(review, LAW.buildingDecree, "제86조"), ...(sunArticle ? [articleRef(sunArticle, ["정북"])] : [])].map((s, i) => i === 0 ? { ...s, excerpt: zone?.sunlight ? SUNLIGHT_TEXT : undefined, highlights: SUNLIGHT_HIGHLIGHTS } : s),
  });
  put({
    id: "bld.spacing",
    content: "공동주택 채광창 방향 이격 및 동간 인동거리: 조례로 정하는 거리 적용",
    law: "건축법 시행령 제86조제3항" + (sunArticle ? `, ${sunArticle.sourceTitle}` : ""),
    note: "배치계획 시 실제 이격 반영 (개략 규모검토는 기준층 면적 비율로 반영)",
    status: sunArticle ? "candidate" : "missing",
    sources: [lawRef(review, LAW.buildingDecree, "제86조")],
    missing: "조례상 인동거리 배수",
  });
  const setbackArticle = findArticle(review, "건축 조례", ["대지 안의 공지", "대지안의 공지"]);
  put({
    id: "bld.setback",
    content: "건축선 및 인접대지경계선으로부터 띄어야 하는 거리 (용도별)",
    law: "건축법 제58조, 시행령 제80조의2 별표 2" + (setbackArticle ? `, ${setbackArticle.sourceTitle} ${setbackArticle.article}` : ", 관할 건축조례"),
    note: "지구단위계획 건축한계선·건축지정선 별도",
    status: setbackArticle ? "candidate" : "missing",
    sources: [lawRef(review, LAW.buildingDecree, "제80조의2"), ...(setbackArticle ? [articleRef(setbackArticle, ["대지 안의 공지"])] : [])],
    missing: "조례 별표 이격거리",
  });
  const landscapeArticle = findArticle(review, "건축 조례", ["대지의 조경", "조경"]);
  put({
    id: "bld.landscape",
    content: "대지면적 200㎡ 이상: 조례로 정하는 기준에 따른 조경",
    law: "건축법 제42조" + (landscapeArticle ? `, ${landscapeArticle.sourceTitle} ${landscapeArticle.article}` : ", 관할 건축조례"),
    note: "조경 비율(%)을 입력하면 건축개요 조경면적에 반영",
    status: landscapeArticle ? "candidate" : "missing",
    sources: [lawRef(review, LAW.buildingAct, "제42조"), ...(landscapeArticle ? [articleRef(landscapeArticle, ["조경"])] : [])],
    missing: "연면적 구간별 조경 비율",
  });
  const openZone = zoneName && OPEN_SPACE_ZONES.some((z) => zoneName.includes(z));
  put({
    id: "bld.openspace",
    content: openZone
      ? `업무시설(오피스텔) 등 해당 용도 바닥면적 합계 ${fmt(OPEN_SPACE_FLOOR_AREA)}㎡ 이상 시 대상 (대지면적의 10% 이하 범위에서 조례 비율)`
      : zone ? `${zone.zone}: 공개공지 대상 지역 아님` : "용도지역 확정 후 판단",
    law: "건축법 제43조, 시행령 제27조의2",
    note: "공동주택은 대상 용도 아님. 오피스텔 대안의 연면적으로 규모검토에서 자동 판정",
    status: zone ? "candidate" : "missing",
    sources: [lawRef(review, LAW.buildingDecree, "제27조의2")],
  });
  put({
    id: "bld.amenity",
    content: "관리사무소·주민공동시설·경로당·어린이놀이터 등 세대수 기준 설치 (도시형생활주택 일부 적용 제외)",
    law: "주택건설기준 등에 관한 규정 제28조, 제55조의2",
    note: "규모검토의 부대복리 면적은 계획 가정값 (세대당 ㎡)",
    status: "candidate",
    sources: [lawRef(review, LAW.housingStd, "제55조의2")],
  });
  put({
    id: "bld.safety",
    content: "직통계단·피난계단, 방화구획, 소방시설, 승강기(6층 이상·연면적 2천㎡ 이상) 기준",
    law: "건축법 제49·64조, 피난·방화규칙, 소방시설법",
    note: "층수·연면적 확정 후 판정",
    status: "candidate",
    sources: [lawRef(review, LAW.buildingAct, "제64조"), lawRef(review, LAW.evacuation)],
  });
  put({
    id: "bld.access",
    content: "공동주택(세대수 기준)·업무시설 편의시설 설치 대상 및 장애인 전용주차구획",
    law: "장애인등편의법 시행령 별표 1·2",
    note: "",
    status: "candidate",
    sources: [lawRef(review, LAW.accessibility)],
  });

  // ── 주차 ──
  const mechArticle = findArticle(review, "주차장", ["기계식"]);
  put({
    id: "park.mech.ord",
    content: "기계식 설치 가능 용도·지역, 총 주차대수 대비 허용비율, 최소 설치대수 확인",
    law: (mechArticle ? `${mechArticle.sourceTitle} ${mechArticle.article}` : cityParking?.title ?? "관할 주차장 조례") + ", 주차장법 시행규칙",
    note: "조례 허용 여부와 LH 인수 여부는 별도 판정",
    status: mechArticle ? "candidate" : "missing",
    sources: [...(mechArticle ? [articleRef(mechArticle, ["기계식"])] : cityParking ? [cityParking] : []), lawRef(review, LAW.parkingRule)],
    missing: "조례상 기계식 허용 여부·비율·최소대수",
  });
  const parkingArticle = findArticle(review, "주차장", ["부설주차장의 설치기준", "부설주차장 설치기준", "주차대수"]);
  put({
    id: "park.ordinance",
    content: (review?.collected ?? []).some((c) => c.rowId === "park.ordinance" && c.article.startsWith("별표"))
      ? "용도별 부설주차장 설치기준 (조례 별표 원문 확보 · 주거용도는 아래 행에 자동 반영)"
      : "용도별 부설주차장 설치기준 (조례 별표)",
    law: parkingArticle ? `${parkingArticle.sourceTitle} ${parkingArticle.article}` : (cityParking?.title ?? "관할 주차장 조례") + " 별표",
    note: (review?.collected ?? []).some((c) => c.rowId === "park.ordinance" && c.article.startsWith("별표")) ? "비주거 용도 혼합 시 별표 시설면적 기준으로 합산" : "아래 용도별 행에 대/세대 수치를 입력하면 규모검토에 반영",
    status: parkingArticle ? ((review?.collected ?? []).some((c) => c.rowId === "park.ordinance" && c.article.startsWith("별표")) ? "verified" : "candidate") : "missing",
    sources: parkingArticle ? [articleRef(parkingArticle, ["주차"])] : cityParking ? [cityParking] : [ref("주차장법 시행령", "별표 1")],
  });
  // 조례 별표(부설주차장 설치기준) 원문에서 용도별 기준 자동 판독
  const parkingAnnexes = (review?.collected ?? []).filter((c) => c.rowId === "park.ordinance" && c.article.startsWith("별표"));
  const annexRule = (use: UseKind): { rule: ParkingRule; annex: (typeof parkingAnnexes)[number] } | null => {
    for (const annex of parkingAnnexes) {
      const rules = extractParkingRules(annex.text);
      const rule = rules.find((r) => r.use === use && r.tiers) ?? rules.find((r) => r.use === use)
        ?? (use === "urban" ? rules.find((r) => r.use === "apartment" && /도시형\s*생활주택/.test(r.quote)) : undefined);
      if (rule) return { rule, annex };
    }
    return null;
  };
  const parkRow = (id: string, use: UseKind, text: string) => {
    const word = use === "officetel" ? "호" : "세대";
    const found = annexRule(use);
    const tierKey = use === "apartment" ? "parkingApartmentTiers" : use === "urban" ? "parkingUrbanTiers" : "parkingOfficetelTiers";
    if (found) {
      const { rule, annex } = found;
      const nums = (rule.tiers ?? []).flatMap((t) => [...(t.ratio ? [`${t.ratio}대`] : []), ...(t.sqmPerStall ? [`${t.sqmPerStall}㎡당`] : []), ...(t.maxArea !== undefined ? [`${t.maxArea}제곱미터`, `${t.maxArea}㎡`] : [])]);
      return put({
        id,
        content: (rule.tiers ? describeTiers(rule.tiers, word) : `조례 별표 원문: ${rule.quote.slice(0, 200)}${rule.quote.length > 200 ? "…" : ""}`)
          + (rule.refHousingStd27 ? `\n「주택건설기준 등에 관한 규정」 제27조 산정 대수와 비교해 큰 값 적용` : ""),
        law: `${annex.title} ${annex.article.split(" · ")[0]}` + (rule.refHousingStd27 ? " · 주택건설기준 등에 관한 규정 제27조" : ""),
        note: rule.tiers ? `별표 원문에서 자동 판독 · 규모검토에서 타입별 전용면적으로 법정대수 산정` : "별표 문구에서 수치를 판독하지 못해 원문 인용만 · 대수는 직접 입력",
        status: rule.tiers ? "verified" : "candidate",
        params: rule.tiers ? { [tierKey]: rule.tiers } : undefined,
        sources: [
          { title: annex.title, article: annex.article.split(" · ")[0], effectiveDate: annex.effectiveDate ?? undefined, url: annex.url, excerpt: rule.quote, verbatim: true, highlights: nums, kind: "ordinance" },
          ...(rule.refHousingStd27 ? [lawRef(review, LAW.housingStd, "제27조")] : []),
        ],
      });
    }
    return put({
      id, content: text,
      law: (cityParking?.title ?? "관할 주차장 조례") + " 별표 · 주택건설기준 등에 관한 규정 제27조",
      note: parkingAnnexes.length ? `별표는 확보했지만 ${USE_SHORT[use]} 항목을 찾지 못함 · 대/${word} 직접 입력` : `조례 별표 미확보 · 대/${word} 직접 입력`,
      status: "missing",
      sources: [lawRef(review, LAW.housingStd, "제27조")],
      missing: `${word}당 법정 최소대수`,
    });
  };
  if (uses.includes("apartment") || !site.uses.length) parkRow("park.apartment", "apartment", "조례상 전용면적 기준 및 세대당 최소대수 적용");
  if (uses.includes("urban")) parkRow("park.urban", "urban", "도시형생활주택 전용면적별 기준 (조례 별표)");
  if (uses.includes("officetel") || !site.uses.length) parkRow("park.officetel", "officetel", "오피스텔 호실 전용면적 기준 (조례 별표)");

  // ── LH ──
  const lh = site.business === "lh-purchase";
  const notice = review?.lhNotice ?? null;
  const rules = notice?.rules ?? null;
  const noticeSource: SourceRef | null = notice ? { title: notice.title, url: notice.pdfUrl ?? notice.url, noticeNo: notice.id, effectiveDate: notice.publishedAt, kind: "lh" } : null;
  put({
    id: "park.lh03",
    content: "조건 충족 시 0.3대/호\n- 전용 30㎡ 미만\n- 청년형은 도시철도역 출구 또는 대학 교문 직선거리 500m 이내 (고령자형 입지 무관)\n- LH 선정심의 → 조건부 매입약정 → 매입약정증명서 발급 → 인허가 제출",
    law: "공공주택 특별법 시행령 제37조제4항" + (notice ? ` · ${notice.title}` : " · LH 지역본부 공고"),
    note: !lh ? "LH 매입약정 사업 아님"
      : site.transitWithin500m ? (review?.transit?.verdict === "within" ? `입지 자동 확인: ${review.transit.basis}` : "검토자: 역세권 500m 입지 확인")
      : review?.transit ? (review.transit.verdict === "within" ? `입지 자동 확인: ${review.transit.basis}`
        : review.transit.verdict === "borderline" ? `경계 거리 · 출구·교문 기준 확인 필요: ${review.transit.basis}`
        : review.transit.verdict === "outside" ? `500m 밖 · 청년형 특례 불가 (고령자형은 입지 무관): ${review.transit.basis}`
        : "입지 자동 판정 실패 · 직접 확인")
      : "역세권 입지 미확인",
    status: lh ? "candidate" : "missing",
    params: lh ? { lhParking03: "conditional", lhParking03MaxArea: rules?.parking03MaxArea ?? 30 } : undefined,
    sources: [lawRef(review, LAW.publicHousingDecree, "제37조"), ...(noticeSource ? [noticeSource] : [])],
  });
  // 검증 규칙이 없으면 공고문 PDF 추출 문구에서 기계식 허용요건·비율을 직접 읽는다.
  const mechQuotes = (notice?.extractedCriteria ?? []).map((c) => c.quote).filter((q) => /기계식/.test(q));
  const mech = !rules && mechQuotes.length ? extractLhMechRule(mechQuotes) : null;
  put({
    id: "park.mech.lh",
    content: rules
      ? `역세권 청년·신혼형 오피스텔 및 도시형생활주택은 총 주차대수의 ${rules.mechanicalMaxPercent}% 이하 계획\n0.3대 완화를 받을 시 기계식주차 설치 지양`
      : mech ? [mech.requirement ? `허용요건: ${mech.requirement}` : "", mech.ratioText ? `비율: ${mech.ratioText}` : ""].filter(Boolean).join("\n")
      : notice ? "공고문에서 기계식주차 인수기준 문구를 찾지 못함 · 공고문 확인" : "관할 LH 지역본부 공고 미확인",
    law: notice ? notice.title : "LH 지역본부 신축매입약정 공고",
    note: mech ? "공고문 PDF에서 자동 추출 · 지자체 조례 기준과 LH 인수 기준 중 엄격한 값 적용" : "지자체 조례 기준과 LH 인수 기준 중 엄격한 값을 적용",
    status: (rules || mech?.maxPercent) && notice?.isCurrent ? "verified" : notice ? "candidate" : "missing",
    params: rules ? { lhMechApartment: "prohibited", lhMechUrban: "conditional", lhMechOfficetel: "conditional", lhMechMaxPercent: rules.mechanicalMaxPercent }
      : mech?.maxPercent ? { ...(mech.apartmentExcluded ? { lhMechApartment: "prohibited" as const } : {}), lhMechUrban: "conditional", lhMechOfficetel: "conditional", lhMechMaxPercent: mech.maxPercent } : undefined,
    sources: noticeSource ? [{ ...noticeSource, ...(mech ? { excerpt: [mech.requirement, mech.ratioText].filter(Boolean).join(" / "), verbatim: true, highlights: mech.maxPercent ? [`${mech.maxPercent}%`, "500m"] : ["500m"] } : {}) }] : [],
    missing: rules || mech?.maxPercent ? undefined : "공고문 기계식 인수기준 조항",
  });
  put({
    id: "lh.notice",
    content: notice
      ? `${notice.title}\n게시 ${notice.publishedAt} · 마감 ${notice.closesAt} · ${notice.isCurrent ? "접수기간 내" : "접수 종료 (참고용)"}`
      : lh ? "관할 지역본부 최신 공고 미확인" : "LH 매입약정 외 사업",
    law: "LH 청약플러스 매입임대 공고",
    note: notice ? (notice.isCurrent ? "해당 지역본부 최신 공고 우선 적용. 다른 본부·과거 공고 혼용 금지" : "종료 공고는 신규 신청 기준으로 확정하지 않음") : "",
    status: notice ? (notice.isCurrent ? "verified" : "candidate") : lh ? "missing" : "candidate",
    sources: noticeSource ? [noticeSource, ...(notice?.guideUrl ? [{ title: "설계·시공 가이드라인 첨부", url: notice.guideUrl, kind: "lh" as const }] : [])] : [],
  });
  put({
    id: "lh.scale",
    content: rules
      ? `일반지역 ${rules.minimumHomes}호 이상 / 규제지역 ${rules.regulatedMinimumHomes}호 이상\n청년 전용 ${rules.youthMinimumArea}~${rules.youthMaximumArea}㎡(${rules.youthRooms}룸 이상) · 신혼 전용 ${rules.newlywedMinimumArea}㎡ 이상(${rules.newlywedRooms}룸 이상)`
      : "공급유형별 최소 전용면적·호수·평면요건 (공고문 확인)",
    law: notice ? notice.title : "LH 지역본부 공고",
    note: site.supplies.length ? "계획 공급유형: " + site.supplies.join(", ") : "",
    status: rules && notice?.isCurrent ? "verified" : lh ? "candidate" : "missing",
    params: rules ? { lhMinHomes: rules.minimumHomes } : undefined,
    sources: noticeSource ? [noticeSource] : [],
  });
  put({
    id: "lh.community",
    content: rules
      ? `${rules.communityThreshold}세대 이상 커뮤니티 시설 · ${rules.managementOfficeThreshold}세대 이상 관리사무소`
      : "커뮤니티·관리사무소·경비실 설치 기준 (공고문 확인)",
    law: notice ? notice.title : "LH 지역본부 공고",
    note: "",
    status: rules && notice?.isCurrent ? "verified" : lh ? "candidate" : "missing",
    params: rules ? { lhCommunityThreshold: rules.communityThreshold, lhCommunitySqmPerHome: 1 } : undefined,
    sources: noticeSource ? [noticeSource] : [],
  });

  // ── 검증 근거 라이브러리 (우선 적용) ──
  for (const entry of matchLibrary(ctx)) {
    for (const patch of entry.rows(ctx)) applyPatch(rows, patch, entry.title);
  }

  // 지구단위계획 구역인데 획지 기준이 확정되지 않았다면 건폐율·용적률·용도·높이를 후보로 묶는다.
  if (districtPlanOf(review) && !site.blockNo) {
    for (const id of ["plan.bcrfar", "plan.use", "plan.height"]) {
      const row = rows.get(id);
      if (row && (row.status === "verified" || row.status === "user")) {
        rows.set(id, { ...row, status: "candidate", note: [row.note, "지구단위계획구역: 획지번호 확인 전까지 계산 미적용"].filter(Boolean).join(" · ") });
      }
    }
  }
  if (mixed) {
    const row = rows.get("plan.bcrfar");
    if (row && row.status === "verified") rows.set("plan.bcrfar", { ...row, status: "candidate", note: "혼합 용도지역: 면적별 분리 산정 필요" });
  }

  attachCollected(rows, review, zoneName);
  return orderRows([...rows.values()]);
}

/** 자동 수집 조문·LH 공고 문구를 해당 행 근거로 첨부. 근거 누락 행은 '후보'로 올리되 수치는 확정하지 않는다. */
function attachCollected(rows: Map<string, ReviewRow>, review: SiteReviewResult | null, zoneName: string) {
  const add = (rowId: string, src: SourceRef) => {
    const row = rows.get(rowId);
    if (!row) return;
    const key = (x: SourceRef) => compact(x.title) + "|" + (x.article ?? "").match(/^[^·]+/)?.[0]?.trim() + "|" + (x.excerpt ?? "").slice(0, 24);
    if (row.sources.some((x) => key(x) === key(src) || (x.verbatim && compact(x.title) === compact(src.title) && (x.article ?? "").split(" · ")[0] === (src.article ?? "").split(" · ")[0]))) return;
    rows.set(rowId, {
      ...row,
      sources: [...row.sources, src],
      status: row.status === "missing" ? "candidate" : row.status,
      note: row.status === "missing" ? [row.note, "조문 자동 수집 · 내용 확인 후 수치 입력·확정"].filter(Boolean).join(" · ") : row.note,
    });
  };
  for (const c of review?.collected ?? []) {
    const topic = ORDINANCE_TOPICS.find((t) => t.label === c.topic);
    const national = NATIONAL_ARTICLES.find((n) => n.label === c.topic);
    const highlights = [...(topic?.terms ?? []), ...(zoneName && c.kind === "ordinance" ? [zoneName] : []), ...(national?.no === 86 ? SUNLIGHT_HIGHLIGHTS : [])];
    add(c.rowId, { title: c.title, article: c.article, url: c.url, effectiveDate: c.effectiveDate ?? undefined, excerpt: c.text, verbatim: true, highlights, kind: c.kind });
  }
  const notice = review?.lhNotice;
  const perRow = new Map<string, number>();
  for (const q of notice?.extractedCriteria ?? []) {
    const rowId = lhCriterionRow(q.quote);
    if (!rowId || (perRow.get(rowId) ?? 0) >= 4) continue;
    perRow.set(rowId, (perRow.get(rowId) ?? 0) + 1);
    add(rowId, { title: `${notice!.title} (공고문 PDF 추출)`, url: notice!.pdfUrl ?? notice!.url, excerpt: q.quote, verbatim: true, highlights: q.value !== null ? [String(q.value)] : [], kind: "lh" });
  }
}

function applyPatch(rows: Map<string, ReviewRow>, patch: RowPatch, entryTitle: string) {
  const base = rows.get(patch.id) ?? blank(patch.id);
  rows.set(patch.id, {
    ...base, ...patch,
    note: [patch.note ?? base.note].filter(Boolean).join(" · "),
    sources: patch.sources ? mergeSources(patch.sources, base.sources) : base.sources,
    origin: "auto",
    updatedAt: undefined,
    missing: patch.missing,
  } as ReviewRow);
  void entryTitle;
}

/** 라이브러리 요지(summary)와 API 원문(verbatim)이 같은 조문이면 원문을 남긴다 */
function mergeSources(library: SourceRef[], api: SourceRef[]): SourceRef[] {
  const articleNo = (s: SourceRef) => (s.article ?? "").match(/제\d+조(?:의\d+)?/)?.[0] ?? s.article ?? "";
  const verbatim = api.filter((s) => s.verbatim);
  const kept = library.filter((l) => !verbatim.some((v) => compact(v.title) === compact(l.title) && articleNo(v) && articleNo(v) === articleNo(l)));
  return [...kept, ...verbatim.map((v) => ({ ...v, highlights: [...new Set([...(v.highlights ?? []), ...library.filter((l) => articleNo(l) === articleNo(v)).flatMap((l) => l.highlights ?? [])])] }))];
}

const SECTION_ORDER: ReviewRow["section"][] = ["site", "planning", "building", "parking", "lh", "extra"];
export function orderRows(rows: ReviewRow[]): ReviewRow[] {
  const index = (r: ReviewRow) => {
    const i = ROW_ORDER.findIndex((t) => t.id === r.id);
    return i === -1 ? 1000 : i;
  };
  return [...rows].sort((a, b) => {
    const s = SECTION_ORDER.indexOf(a.section) - SECTION_ORDER.indexOf(b.section);
    if (s) return s;
    const ga = rows.findIndex((r) => r.group === a.group), gb = rows.findIndex((r) => r.group === b.group);
    return index(a) - index(b) || ga - gb;
  });
}

/** 재조회 시 검토자가 수정·추가한 행은 유지하고 자동 행만 갱신한다. */
export function mergeRows(previous: ReviewRow[], fresh: ReviewRow[]): ReviewRow[] {
  const kept = previous.filter((r) => r.edited || r.origin === "user");
  const keptIds = new Set(kept.map((r) => r.id));
  return orderRows([...fresh.filter((r) => !keptIds.has(r.id)), ...kept]);
}

export function lawSearchUrl(text: string) {
  return lawUrl(text);
}
