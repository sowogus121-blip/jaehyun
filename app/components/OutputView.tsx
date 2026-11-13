"use client";

import { useState } from "react";
import type { Project, ReviewRow, SourceRef } from "@/lib/review/types";
import { UNIT_WORD } from "@/lib/review/types";
import { FEASIBILITY_LABEL, summaryRows, type ScenarioResult } from "@/lib/massing/engine";
import { citeLine, fmtNum } from "@/lib/report/format";
import type { ExportBody } from "@/lib/report/export-types";
import { LegalTable } from "./LegalView";
import { ComparisonTable, useResults } from "./MassingView";
import { Marked, Panel, downloadBlob } from "./ui";

export function exportPayload(project: Project, results: ScenarioResult[], kind: ExportBody["kind"]): ExportBody {
  return {
    kind, projectName: project.name, address: project.review?.location?.parcelAddress || project.site.address, reviewedAt: project.reviewedAt,
    rows: kind === "legal" ? project.rows : undefined,
    scenarios: kind === "summary" ? results.map((r) => ({
      name: r.scenario.name, feasibility: FEASIBILITY_LABEL[r.feasibility], summary: summaryRows(r),
      types: r.types.map((t) => ({ name: t.type.name, exclusive: t.exclusive, count: t.count, supplyArea: t.supplyArea, contractArea: t.contractArea })),
      formulas: r.formulas, notes: [...r.blockers, ...r.missing.map((m) => "근거 필요: " + m), ...r.conditions, ...r.warnings],
    })) : undefined,
  };
}

export function OutputView({ project, notify }: { project: Project; notify: (msg: string) => void }) {
  const { results } = useResults(project);
  const [busy, setBusy] = useState<string | null>(null);
  const [withAppendix, setWithAppendix] = useState(true);
  const [withFormulas, setWithFormulas] = useState(true);
  const [scope, setScope] = useState<"all" | "selected">("all");
  const shown = scope === "all" ? results : results.filter((r) => r.scenario.id === project.selectedScenarioId);

  const excel = async (kind: ExportBody["kind"]) => {
    setBusy(kind);
    try {
      const res = await fetch("/api/export/xlsx", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(exportPayload(project, shown, kind)) });
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? "엑셀 생성 실패");
      downloadBlob(await res.blob(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", `${kind === "legal" ? "법규검토표" : "건축개요표"}_${project.name}.xlsx`);
    } catch (e) { notify(e instanceof Error ? e.message : "엑셀 생성 실패"); }
    setBusy(null);
  };
  const backup = () => downloadBlob(JSON.stringify({ app: "LH Plan Lab", exportedAt: new Date().toISOString(), project }, null, 2), "application/json", `${project.name}.lhplan.json`);

  return <div className="view output-view">
    <Panel title="결과 출력" sub="엑셀은 실무 법규검토표 양식(구분·내용·관련 법령·비고)으로 생성됩니다. PDF는 아래 미리보기를 그대로 인쇄합니다.">
      <div className="output-actions">
        <button className="btn primary" disabled={busy !== null} onClick={() => excel("legal")}>{busy === "legal" ? "생성 중…" : "엑셀 법규검토표"}</button>
        <button className="btn primary" disabled={busy !== null} onClick={() => excel("summary")}>{busy === "summary" ? "생성 중…" : "엑셀 건축개요표"}</button>
        <button className="btn primary" onClick={() => window.print()}>PDF 검토보고서 (인쇄)</button>
        <button className="btn" onClick={backup}>프로젝트 JSON 백업</button>
        <span className="sep" />
        <label className="inline"><input type="checkbox" checked={withAppendix} onChange={(e: { target: { checked: boolean } }) => setWithAppendix(e.target.checked)} />근거 원문 부록 (형광펜)</label>
        <label className="inline"><input type="checkbox" checked={withFormulas} onChange={(e: { target: { checked: boolean } }) => setWithFormulas(e.target.checked)} />계산식</label>
        <select value={scope} onChange={(e: { target: { value: string } }) => setScope(e.target.value as "all" | "selected")}><option value="all">전체 대안</option><option value="selected">선택 대안만</option></select>
      </div>
    </Panel>
    <div className="report-preview"><Report project={project} results={shown} withAppendix={withAppendix} withFormulas={withFormulas} /></div>
  </div>;
}

function collectSources(rows: ReviewRow[]) {
  const seen = new Map<string, { source: SourceRef; rows: string[] }>();
  for (const row of rows) for (const s of row.sources) {
    if (!s.excerpt) continue;
    const key = s.title + "|" + (s.article ?? "") + "|" + s.excerpt.slice(0, 30);
    const label = row.sub ? `${row.group}·${row.sub}` : row.group;
    const entry = seen.get(key);
    if (entry) { entry.rows.push(label); entry.source.highlights = [...new Set([...(entry.source.highlights ?? []), ...(s.highlights ?? [])])]; }
    else seen.set(key, { source: { ...s }, rows: [label] });
  }
  return [...seen.values()];
}

export function Report({ project, results, withAppendix, withFormulas }: { project: Project; results: ScenarioResult[]; withAppendix: boolean; withFormulas: boolean }) {
  const address = project.review?.location?.parcelAddress || project.site.address;
  const sources = collectSources(project.rows);
  const rows = project.rows.filter((r) => r.content.trim() || r.status !== "missing");
  const date = new Date().toLocaleDateString("ko-KR");
  return <article className="report">
    <header className="report-head">
      <p className="kicker">LH 공공임대 법규 · 규모 검토</p>
      <h1>{project.name}</h1>
      <p>{address} · 검토일 {date}{project.reviewedAt ? ` · 공식자료 조회 ${new Date(project.reviewedAt).toLocaleDateString("ko-KR")}` : ""}</p>
    </header>
    <section className="report-section">
      <h2>1. 법규검토</h2>
      <LegalTable rows={rows} print />
      <p className="report-note">※ 붉은 글씨는 적용 수치. "원문 대조 필요"로 표시된 항목은 공식 원문으로 최종 확인이 필요한 후보값이며 규모 산정에 반영하지 않았습니다.</p>
    </section>
    <section className="report-section page-break">
      <h2>2. 건축개요 (개략)</h2>
      <ComparisonTable results={results} print />
      {results.map((r) => <div key={r.scenario.id} className="report-scenario">
        <h3>{r.scenario.name} — {FEASIBILITY_LABEL[r.feasibility]}</h3>
        {r.units > 0 && <table className="grid-table compact"><thead><tr><th>타입</th><th>전용(㎡)</th><th>{UNIT_WORD[r.scenario.use]}수</th><th>계약면적(㎡)</th></tr></thead>
          <tbody>{r.types.map((t) => <tr key={t.type.id}><td>{t.type.name}</td><td>{fmtNum(t.exclusive)}</td><td>{t.count}</td><td>{fmtNum(t.contractArea)}</td></tr>)}</tbody></table>}
        {(r.blockers.length + r.missing.length + r.conditions.length) > 0 && <ul className="report-list">
          {r.blockers.map((x) => <li key={x}>불가: {x}</li>)}{r.missing.map((x) => <li key={x}>근거 필요: {x}</li>)}{r.conditions.map((x) => <li key={x}>조건: {x}</li>)}
        </ul>}
        {withFormulas && r.formulas.length > 0 && <ol className="formulas">{r.formulas.map((f) => <li key={f}>{f}</li>)}</ol>}
      </div>)}
      <p className="report-note">※ 설계도서가 없는 상태의 개략 검토값입니다. 배치·일조·인동거리·소방활동공간 검토 후 변동될 수 있습니다.</p>
    </section>
    {withAppendix && sources.length > 0 && <section className="report-section page-break appendix">
      <h2>부록. 근거 법령 발췌</h2>
      {sources.map(({ source: s, rows: used }, i) => <div className="appendix-item" key={i}>
        <h3>[{i + 1}] {citeLine(s)}</h3>
        <p className="appendix-meta">관련 항목: {used.join(", ")}{s.url ? <> · <a href={s.url}>{s.url}</a></> : null}</p>
        {!s.verbatim && <p className="appendix-flag">요지 (원문 대조 필요)</p>}
        <blockquote><Marked text={s.excerpt ?? ""} highlights={s.highlights} /></blockquote>
      </div>)}
    </section>}
  </article>;
}
