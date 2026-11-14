/**
 * 운영(프로덕션) 회귀검토: 샘플 대상지로 /api/site-review 를 호출하고
 * 법규검토표·규모검토·상세 개요표를 같은 라이브러리로 재구성해 요약을 남긴다.
 * 실행: REGRESSION_BASE=https://lh-plan-lab.vercel.app npx vitest run --config regression/vitest.config.ts
 */
import { describe, it } from "vitest";
import { appendFileSync, writeFileSync } from "node:fs";
import { newProject, applyReview } from "../lib/project/store";
import { resolveParams, candidateParams } from "../lib/review/params";
import { runScenario, defaultScenario, DEFAULT_ASSUMPTIONS, summaryRows } from "../lib/massing/engine";
import { buildDetailedOverview } from "../lib/report/detailed-overview";
import type { SiteReviewResult } from "../lib/types";

const BASE = process.env.REGRESSION_BASE ?? "https://lh-plan-lab.vercel.app";
const SITES = (process.env.REGRESSION_SITES || [
  "서울특별시 금천구 독산동 151-10",
  "경기도 의정부시 가능동 75-1",
  "서울특별시 노원구 상계동 1268",
  "충청북도 청주시 상당구 상당로 155",
  "경기도 성남시 분당구 분당로 50",
  "경기도 부천시 길주로 210",
].join("|")).split("|");

const out: string[] = [];
const log = (s = "") => { out.push(s); console.log(s); };
const short = (s: string | undefined, n = 220) => (s ?? "").replace(/\s+/g, " ").slice(0, n);

describe("운영 회귀검토", () => {
  for (const address of SITES) {
    it(address, async () => {
      log(`\n## ${address}`);
      const t0 = Date.now();
      const res = await fetch(`${BASE}/api/site-review`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, parcelAddresses: [], businessMode: "purchase", lhSupplyType: "youth" }), signal: AbortSignal.timeout(110_000) }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }) }) as unknown as Response);
      const data = await res.json().catch(() => ({})) as SiteReviewResult & { error?: string };
      log(`- HTTP ${res.status} · ${Math.round((Date.now() - t0) / 1000)}s · status=${data.status} · 오류 ${data.errors?.length ?? "?"} · 미설정 ${data.missing?.join(",") || "없음"}`);
      if (!res.ok || !data.location) { log(`- 실패: ${short(data.error ?? JSON.stringify(data).slice(0, 300))}`); return; }
      log(`- 위치: ${data.location.parcelAddress ?? data.location.address} · 용도지역 ${(data.landUse ?? []).filter((l) => l.category === "용도지역").map((l) => l.name).join(",")} · 면적 ${data.parcel?.area ?? "?"}㎡`);
      for (const e of data.errors ?? []) log(`  - 오류: ${short(e, 200)}`);
      log(`- 국가법령 ${data.laws.length}건 (전문 ${data.laws.filter((l) => l.retrievalStatus === "full-text").length}) · 조례 ${data.ordinances.length}건 (전문 ${data.ordinances.filter((o) => o.retrievalStatus === "full-text").length})`);
      log(`  - 법령: ${data.laws.map((l) => `${l.name}[${l.retrievalStatus === "full-text" ? "전문" : "메타"}${l.enforcementDate ? " " + l.enforcementDate : ""}]`).join(" / ")}`);
      log(`  - 조례: ${data.ordinances.map((o) => `${o.name}[${o.retrievalStatus === "full-text" ? "전문" : "메타"}]${/elis/.test(o.link) ? "(ELIS)" : ""}`).join(" / ")}`);
      const nat = data.nationalArticleCandidates ?? [];
      log(`- 국가법령 조문 후보 ${nat.length}건: ${[...new Set(nat.map((n) => `${n.sourceTitle} ${n.article}`))].slice(0, 25).join(" / ")}`);
      const c27 = [...(data.collected ?? []).map((c) => ({ sourceTitle: c.title, article: c.article, excerpt: c.text })), ...nat].find((n) => /주택건설기준/.test(n.sourceTitle) && /27/.test(n.article) && n.excerpt.length > 30);
      log(`- 주택건설기준 제27조: ${c27 ? short(c27.excerpt.slice(Math.max(0, c27.excerpt.search(/소형\s*주택/) - 20)), 400) : "미확보"}`);
      const collected = data.collected ?? [];
      log(`- 자동 수집 조문 ${collected.length}건 · 행별: ${Object.entries(collected.reduce<Record<string, number>>((a, c) => ({ ...a, [c.rowId]: (a[c.rowId] ?? 0) + 1 }), {})).map(([k, v]) => `${k}:${v}`).join(" ")}`);
      const tr = data.transit;
      log(`- 역세권: ${tr ? `${tr.verdict} · ${short(tr.basis, 160)}${(tr.planned ?? []).length ? ` · 예정 ${tr.planned!.map((p) => `${p.name} ${p.distance}m`).join(",")}` : ""}` : "없음"}`);
      log(`- LH 공고: ${data.lhNotice ? `${data.lhNotice.title} · 기준 ${(data.lhNotice.extractedCriteria ?? []).length}건 (쪽 ${[...new Set((data.lhNotice.extractedCriteria ?? []).map((c) => c.page).filter(Boolean))].join(",")})` : "없음"}`);

      let p = newProject({ address, business: "lh-purchase", uses: ["apartment", "urban", "officetel"], supplies: ["youth"] });
      p = applyReview(p, data);
      const rows = p.rows;
      const pick = (id: string) => rows.find((r) => r.id === id);
      for (const id of ["plan.use", "plan.bcrfar", "plan.relax", "bld.setback", "park.apartment", "park.urban", "park.officetel", "park.mech.ord", "park.mech.lh", "park.lh03"]) {
        const r = pick(id);
        log(`- [${id}] ${r ? `${r.status} · 내용: ${short(r.content, 160)} · 비고: ${short(r.note, 200)} · 근거 ${r.sources.length}건${r.sources.some((s) => s.page) ? " (쪽 표기)" : ""}` : "행 없음"}`);
      }
      log(`- 지정·상위계획: 용도지역지구 ${(data.landUse ?? []).map((l) => `${l.category}:${l.name}`).join(", ")} · 토지이용계획 ${(data.siteFacts?.designations ?? []).map((d) => `${d.name}(${d.conflict ?? ""})`).join(", ")} · 지구단위 ${data.districtPlan ? "있음" : "없음"}`);
      for (const r of rows) log(`  · ROW ${r.id} [${r.status}] ${r.group}${r.sub ? "/" + r.sub : ""} | ${short(r.content, 150)} | 비고: ${short(r.note, 150)}${r.missing ? " | 누락: " + r.missing : ""}`);
      const hl = rows.flatMap((r) => r.sources.flatMap((s) => s.highlights ?? [])).filter(Boolean);
      log(`- 형광펜 후보 ${hl.length}개 · 짧은 낱말(<8자) ${hl.filter((h) => h.replace(/\s/g, "").length < 8).length}개`);
      const params = resolveParams(rows);
      const candidates = candidateParams(rows);
      for (const sc of [
        defaultScenario("apartment", "a"), defaultScenario("urban", "u"), defaultScenario("officetel", "o"),
        defaultScenario("urban", "um", { parking: "mixed", mechanicalShare: 50 }), defaultScenario("urban", "u3", { apply03: true }),
        defaultScenario("apartment", "r", { farMode: "relaxed" }),
      ]) {
        try {
          const r = runScenario({ params, candidates, scenario: sc, assumptions: DEFAULT_ASSUMPTIONS, site: p.site });
          log(`- 규모 ${sc.use}/${sc.parking}${sc.apply03 ? "/0.3" : ""}${sc.farMode !== "base" ? "/" + sc.farMode : ""}: ${r.feasibility} · ${r.units}세대 · 용적률 ${r.farApplied ?? "?"}% · 주차 ${r.parking.legal ?? "?"}대${r.parking.special03 != null ? `(0.3 ${r.parking.special03})` : ""} 기계식 ${r.parking.mechanical} · 불가 ${r.blockers.map((b) => short(b, 60)).join(";") || "-"} · 검토요망 ${r.conditions.filter((c) => c.startsWith("검토요망")).length}`);
          if (sc.id === "a") {
            const sheet = buildDetailedOverview(p, r);
            log(`  - 상세 개요표 시트 "${sheet.name}" 셀 ${Object.keys(sheet.cells).length}개 · 요약행 ${summaryRows(r).length}`);
          }
        } catch (e) { log(`- 규모 ${sc.use} 계산 오류: ${e instanceof Error ? e.message : e}`); }
      }
    }, 130_000);
  }
  it("요약 저장", () => {
    const text = `# 운영 회귀검토 ${new Date().toISOString()}\n${out.join("\n")}\n`;
    writeFileSync("regression-report.md", text);
    if (process.env.GITHUB_STEP_SUMMARY) appendFileSync(process.env.GITHUB_STEP_SUMMARY, text);
  });
});
