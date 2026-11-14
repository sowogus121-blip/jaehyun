"use client";

import { useMemo, useState } from "react";
import type { Assumptions, FarOption, LhSupply, Project, Scenario, UnitType, UseKind } from "@/lib/review/types";
import { SUPPLY_LABEL, UNIT_WORD, USE_SHORT } from "@/lib/review/types";
import { candidateParams, resolveParams, type ResolvedParams } from "@/lib/review/params";
import { FEASIBILITY_LABEL, defaultScenario, runScenario, summaryRows, type ScenarioResult } from "@/lib/massing/engine";
import { uid } from "@/lib/project/store";
import { fmtNum } from "@/lib/report/format";
import { Field, Num, Panel, StatusChip } from "./ui";
import { describeTiers } from "@/lib/review/parking-rules";
import type { ParkingTier } from "@/lib/review/types";

export function useResults(project: Project) {
  const params = useMemo(() => resolveParams(project.rows), [project.rows]);
  const candidates = useMemo(() => candidateParams(project.rows), [project.rows]);
  const results = useMemo(() => project.scenarios.map((scenario) => runScenario({ params, candidates, scenario, assumptions: project.assumptions, site: project.site })), [params, candidates, project.scenarios, project.assumptions, project.site]);
  return { params, results };
}

const VERDICT: Record<string, string> = { allowed: "허용", conditional: "조건부", prohibited: "불가" };
const showValue = (v: unknown) => typeof v === "number" ? fmtNum(v)
  : Array.isArray(v) && v.length && typeof (v[0] as { far?: number }).far === "number" ? (v as FarOption[]).map((o) => `${o.far}%`).join(" · ")
  : Array.isArray(v) ? describeTiers(v as ParkingTier[], "세대")
  : VERDICT[String(v)] ?? String(v);

export function MassingView({ project, onChange, onGoLegal }: { project: Project; onChange: (p: Project) => void; onGoLegal: (rowId?: string) => void }) {
  const { params, results } = useResults(project);
  const candidates = useMemo(() => candidateParams(project.rows), [project.rows]);
  const selectedId = project.scenarios.some((s) => s.id === project.selectedScenarioId) ? project.selectedScenarioId : project.scenarios[0]?.id;
  const selected = results.find((r) => r.scenario.id === selectedId) ?? results[0];
  const [showAssumptions, setShowAssumptions] = useState(false);

  const updateScenario = (id: string, patch: Partial<Scenario>) => onChange({ ...project, scenarios: project.scenarios.map((s) => (s.id === id ? { ...s, ...patch } : s)), massingDone: false });
  const addScenario = (use: UseKind) => {
    const s = defaultScenario(use, uid("s"), { name: `${USE_SHORT[use]} 대안 ${project.scenarios.length + 1}` });
    onChange({ ...project, scenarios: [...project.scenarios, s], selectedScenarioId: s.id });
  };
  const duplicate = (s: Scenario) => {
    const copy = { ...JSON.parse(JSON.stringify(s)), id: uid("s"), name: s.name + " (복제)" } as Scenario;
    onChange({ ...project, scenarios: [...project.scenarios, copy], selectedScenarioId: copy.id });
  };
  const remove = (id: string) => {
    const rest = project.scenarios.filter((s) => s.id !== id);
    if (!rest.length) return;
    onChange({ ...project, scenarios: rest, selectedScenarioId: rest[0].id });
  };
  // 완화 용적률 단계(예: 300%·400%)마다 현재 대안을 복제해 비교 대안을 만든다.
  const farOptions = ((params.relaxedFarOptions ?? candidates.relaxedFarOptions)?.value as FarOption[] | undefined) ?? [];
  const addFarScenarios = () => {
    const base = selected?.scenario ?? project.scenarios[0];
    if (!base || !farOptions.length) return;
    const made = farOptions.filter((o) => !project.scenarios.some((s) => s.use === base.use && s.farMode === "relaxed" && s.relaxedFar === o.far))
      .map((o) => ({ ...JSON.parse(JSON.stringify(base)), id: uid("s"), name: `${USE_SHORT[base.use]} · 완화 ${o.far}% (${o.label})`, farMode: "relaxed", relaxedFar: o.far } as Scenario));
    if (made.length) onChange({ ...project, scenarios: [...project.scenarios, ...made], selectedScenarioId: made[0].id, massingDone: false });
  };
  const setAssumption = (k: keyof Assumptions, v: number | undefined) => onChange({ ...project, assumptions: { ...project.assumptions, [k]: v ?? 0 } });

  const keyParams: Array<keyof ResolvedParams> = ["siteArea", "bcr", "far", "relaxedFar", "relaxedFarOptions", "maxFloors", "maxHeight", "landscapeRatio", "parkingApartment", "parkingUrban", "parkingOfficetel", "useApartment", "useUrban", "useOfficetel", "mechApartment", "mechOfficetel", "mechMaxPercent", "mechMinStalls", "lhMechMaxPercent", "lhParking03", "lhMinHomes"];

  return <div className="view massing-view">
    <Panel title="법규 연동값" sub="법규검토표에서 '원문 확인' 또는 '검토자 입력' 상태인 행의 수치만 사용합니다. 값을 바꾸려면 법규검토표에서 수정하세요."
      actions={<label className={`toggle ${project.massingDone ? "on" : ""}`}><input type="checkbox" checked={project.massingDone} onChange={(e: { target: { checked: boolean } }) => onChange({ ...project, massingDone: e.target.checked })} />규모검토 완료</label>}>
      <div className="param-cards">
        {keyParams.map((k) => {
          const p = params[k];
          const c = candidates[k];
          if (!p && !c) return null;
          return <button key={k} className={`param-card ${p ? "" : "candidate"}`} onClick={() => onGoLegal((p ?? c)?.rowId)} title="법규검토표의 해당 행으로 이동">
            <small>{(p ?? c)!.label}</small>
            <b>{showValue((p ?? c)!.value)}</b>
            {p ? <StatusChip status={p.status} compact /> : <span className="chip chip-candidate">후보·미적용</span>}
          </button>;
        })}
        {!params.siteArea && <div className="param-card missing"><small>대지면적</small><b>미확정</b></div>}
        {!params.bcr && <div className="param-card missing"><small>건폐율</small><b>미확정</b></div>}
        {!params.far && <div className="param-card missing"><small>용적률</small><b>미확정</b></div>}
      </div>
    </Panel>

    <Panel title="대안별 건축개요 비교" sub="설계도서 이전 개략 검토값 · 법규상 최대 연면적과 계획 가능 연면적을 구분합니다."
      actions={<>
        <button className="btn" onClick={() => setShowAssumptions((v) => !v)}>설계 가정값 {showAssumptions ? "닫기" : "보기"}</button>
        {farOptions.length > 0 && <button className="btn primary" onClick={addFarScenarios} title={farOptions.map((o) => `${o.far}% ${o.label}`).join(" / ")}>+ 완화 용적률 단계별 대안 ({farOptions.map((o) => o.far + "%").join("·")})</button>}
        {(["apartment", "urban", "officetel"] as UseKind[]).map((u) => <button key={u} className="btn" onClick={() => addScenario(u)}>+ {USE_SHORT[u]}</button>)}
      </>}>
      {showAssumptions && <div className="assumptions">
        {([
          ["floorPlateRatio", "배치효율 (최대건축면적 대비 %)", "%"], ["basementRatio", "지하층 계획면적 (대지 대비 %)", "%"],
          ["selfParkingArea", "자주식 1대 소요면적", "㎡"], ["mechanicalParkingArea", "기계식 1대 소요면적", "㎡"], ["mechanicalStaging", "기계식 출입·대기공간", "㎡"],
          ["equipmentRatio", "기계·전기실 (지상연면적 대비)", "%"], ["equipmentMin", "기계·전기실 최소", "㎡"], ["groundFloorHeight", "1층 층고", "m"],
          ["amenityApartment", "부대복리 (공동주택·도생)", "㎡/세대"], ["amenityOfficetel", "부대시설 (오피스텔)", "㎡/호"], ["otherCommonRatio", "기타공용 계약면적 배분", "%"],
        ] as Array<[keyof Assumptions, string, string]>).map(([k, label, unit]) => <Field key={k} label={label}><Num value={project.assumptions[k]} step={0.1} suffix={unit} onChange={(v) => setAssumption(k, v)} /></Field>)}
      </div>}
      <ComparisonTable results={results} selectedId={selectedId} onSelect={(id) => onChange({ ...project, selectedScenarioId: id })} />
    </Panel>

    {selected && <Panel title={`대안 설정 · ${selected.scenario.name}`} sub={`${USE_SHORT[selected.scenario.use]} · ${FEASIBILITY_LABEL[selected.feasibility]}`}
      actions={<>
        <button className="btn" onClick={() => duplicate(selected.scenario)}>복제</button>
        <button className="btn danger" disabled={project.scenarios.length < 2} onClick={() => remove(selected.scenario.id)}>삭제</button>
      </>}>
      <ScenarioEditor scenario={selected.scenario} farOptions={farOptions} onChange={(patch) => updateScenario(selected.scenario.id, patch)} />
      <ScenarioDetail result={selected} />
    </Panel>}
  </div>;
}

export function ComparisonTable({ results, selectedId, onSelect, print = false }: { results: ScenarioResult[]; selectedId?: string; onSelect?: (id: string) => void; print?: boolean }) {
  if (!results.length) return null;
  const table = results.map((r) => summaryRows(r));
  const labels = table[0].map(([k]) => k);
  return <div className="table-scroll"><table className={`summary-table ${print ? "print" : ""}`}>
    <thead><tr><th>구분</th>{results.map((r) => <th key={r.scenario.id} className={`${r.scenario.id === selectedId && !print ? "selected" : ""} ${onSelect ? "clickable" : ""}`} onClick={() => onSelect?.(r.scenario.id)}>
      <span className="scn-name">{r.scenario.name}</span>
      <span className={`feas feas-${r.feasibility}`}>{FEASIBILITY_LABEL[r.feasibility]}</span>
    </th>)}</tr></thead>
    <tbody>
      {labels.map((label, i) => <tr key={label} className={label === "법규상 최대 연면적" ? "sub-row" : ""}><th>{label}</th>{table.map((rows, j) => <td key={j}>{rows[i][1]}</td>)}</tr>)}
      <tr className="check-row"><th>법규 충족 검토</th>{results.map((r) => <td key={r.scenario.id}>
        {r.checks.map((c) => <span key={c.label} className={`check ${c.ok === false ? "bad" : c.ok ? "good" : ""}`}>{c.ok === false ? "초과 " : c.ok ? "✓ " : "· "}{c.label} {c.planned} / {c.limit}</span>)}
        {r.blockers.map((b) => <span key={b} className="check bad">불가: {b}</span>)}
        {r.missing.map((m) => <span key={m} className="check miss">근거 필요: {m}</span>)}
      </td>)}</tr>
    </tbody>
  </table></div>;
}

function ScenarioEditor({ scenario: s, farOptions, onChange }: { scenario: Scenario; farOptions: FarOption[]; onChange: (patch: Partial<Scenario>) => void }) {
  const farValue = s.farMode === "base" ? "base" : s.farMode === "custom" ? "custom" : `r${s.relaxedFar ?? ""}`;
  const setType = (id: string, patch: Partial<UnitType>) => onChange({ types: s.types.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
  const shareSum = s.types.reduce((a, t) => a + (t.share || 0), 0);
  return <div className="scenario-editor">
    <div className="form-grid compact">
      <Field label="대안명"><input value={s.name} onChange={(e: { target: { value: string } }) => onChange({ name: e.target.value })} /></Field>
      <Field label="용도"><select value={s.use} onChange={(e: { target: { value: string } }) => { const use = e.target.value as UseKind; const d = defaultScenario(use, s.id); onChange({ use, efficiency: d.efficiency, farEfficiency: d.farEfficiency, floorHeight: d.floorHeight }); }}>
        {(["apartment", "urban", "officetel"] as UseKind[]).map((u) => <option key={u} value={u}>{USE_SHORT[u]}</option>)}</select></Field>
      <Field label="용적률"><select value={farValue} onChange={(e: { target: { value: string } }) => {
        const v = e.target.value;
        if (v === "base") onChange({ farMode: "base" });
        else if (v === "custom") onChange({ farMode: "custom", customFar: s.customFar ?? undefined });
        else onChange({ farMode: "relaxed", relaxedFar: v === "r" ? undefined : Number(v.slice(1)) });
      }}>
        <option value="base">법정 기본 용적률</option>
        {farOptions.length ? farOptions.map((o) => <option key={o.far} value={`r${o.far}`}>완화 {o.far}% · {o.label}</option>) : <option value="r">완화 용적률 (법규검토표)</option>}
        <option value="custom">직접 지정</option>
      </select></Field>
      {s.farMode === "custom" && <Field label="지정 용적률" hint="근거는 법규검토표 비고에 기록"><Num value={s.customFar} suffix="%" onChange={(v) => onChange({ customFar: v })} /></Field>}
      <Field label="주차방식"><select value={s.parking} onChange={(e: { target: { value: string } }) => onChange({ parking: e.target.value as Scenario["parking"] })}><option value="self">자주식</option><option value="mixed">자주식 + 기계식</option></select></Field>
      {s.parking === "mixed" && <Field label="희망 기계식 비율" hint="조례·LH 상한과 비교해 작은 값 적용"><Num value={s.mechanicalShare} suffix="%" onChange={(v) => onChange({ mechanicalShare: v ?? 0 })} /></Field>}
      <Field label="LH 0.3대 특례"><label className="inline"><input type="checkbox" checked={s.apply03} onChange={(e: { target: { checked: boolean } }) => onChange({ apply03: e.target.checked })} />특례 적용 시나리오</label></Field>
      <Field label="기준층 호수" hint="0 = 건폐율·배치효율로 자동"><Num value={s.unitsPerFloor} suffix={UNIT_WORD[s.use]} onChange={(v) => onChange({ unitsPerFloor: v ?? 0 })} /></Field>
      <Field label={s.use === "officetel" ? "전용률 (계약면적 대비)" : "전용률 (공급면적 대비)"}><Num value={s.efficiency} suffix="%" onChange={(v) => onChange({ efficiency: v ?? 0, ...(s.use === "officetel" ? {} : { farEfficiency: v ?? 0 }) })} /></Field>
      {s.use === "officetel" && <Field label="지상층 전용률" hint="용적률 산정면적 대비"><Num value={s.farEfficiency} suffix="%" onChange={(v) => onChange({ farEfficiency: v ?? 0 })} /></Field>}
      <Field label="기준층 층고"><Num value={s.floorHeight} step={0.05} suffix="m" onChange={(v) => onChange({ floorHeight: v ?? 3 })} /></Field>
    </div>
    <table className="grid-table types-table">
      <thead><tr><th>타입</th><th>전용면적(㎡)</th><th>구성비(%)</th><th>공급유형</th><th></th></tr></thead>
      <tbody>
        {s.types.map((t) => <tr key={t.id}>
          <td><input value={t.name} onChange={(e: { target: { value: string } }) => setType(t.id, { name: e.target.value })} /></td>
          <td><Num value={t.exclusive} step={0.01} onChange={(v) => setType(t.id, { exclusive: v ?? 0 })} /></td>
          <td><Num value={t.share} onChange={(v) => setType(t.id, { share: v ?? 0 })} /></td>
          <td><select value={t.supply ?? ""} onChange={(e: { target: { value: string } }) => setType(t.id, { supply: (e.target.value || undefined) as LhSupply | undefined })}><option value="">-</option>{(Object.keys(SUPPLY_LABEL) as LhSupply[]).map((k) => <option key={k} value={k}>{SUPPLY_LABEL[k]}</option>)}</select></td>
          <td><button className="btn sm danger" disabled={s.types.length < 2} onClick={() => onChange({ types: s.types.filter((x) => x.id !== t.id) })}>삭제</button></td>
        </tr>)}
      </tbody>
      <tfoot><tr><td><button className="btn sm" onClick={() => onChange({ types: [...s.types, { id: uid("t"), name: "새 타입", exclusive: 36, share: 0 }] })}>+ 타입</button></td><td></td><td className={shareSum !== 100 ? "warn" : ""}>합계 {shareSum}%</td><td colSpan={2}>{shareSum !== 100 && <small>구성비 합계가 100%가 아니면 비율로 환산합니다</small>}</td></tr></tfoot>
    </table>
  </div>;
}

function ScenarioDetail({ result: r }: { result: ScenarioResult }) {
  const word = UNIT_WORD[r.scenario.use];
  return <div className="scenario-detail">
    <div className="detail-grid">
      <div>
        <h4>타입별 {word}수</h4>
        <table className="grid-table">
          <thead><tr><th>타입</th><th>전용</th><th>{word}수</th><th>{r.scenario.use === "officetel" ? "지상 산정면적" : "공급면적"}</th><th>계약면적</th></tr></thead>
          <tbody>{r.types.map((t) => <tr key={t.type.id}><td>{t.type.name}</td><td>{fmtNum(t.exclusive)}㎡</td><td>{t.count}</td><td>{fmtNum(t.supplyArea)}㎡</td><td>{fmtNum(t.contractArea)}㎡</td></tr>)}</tbody>
          <tfoot><tr><td>합계</td><td>{fmtNum(r.exclusiveTotal)}㎡</td><td>{r.units}</td><td colSpan={2}>전용률 {fmtNum(r.exclusiveRatio, 1)}% ({r.scenario.use === "officetel" ? "계약면적 대비" : "공급면적 대비"})</td></tr></tfoot>
        </table>
        <h4>주차 · 지하층</h4>
        <table className="grid-table">
          <tbody>
            <tr><th>법정 주차</th><td>{r.parking.legal !== null ? `${r.parking.legal}대 (${r.parking.ratio}대/${word})` : "기준 미확정"}</td></tr>
            {r.parking.special03 !== null && <tr><th>0.3대 특례</th><td>{r.parking.special03}대</td></tr>}
            <tr><th>계획 주차</th><td>{r.parking.applied !== null ? `자주식 ${r.parking.self}대 · 기계식 ${r.parking.mechanical}대 (장애인 ${r.parking.accessible}대 포함 가정)` : "-"}</td></tr>
            {r.parking.mechanicalCap !== null && <tr><th>기계식 적용 상한</th><td>{r.parking.mechanicalCap}%</td></tr>}
            <tr><th>지하 소요면적</th><td>주차 {fmtNum(r.parking.area)}㎡ + 기계·전기 {fmtNum(r.equipmentArea)}㎡ = {fmtNum(r.basementNeeded)}㎡</td></tr>
            <tr><th>지하층</th><td>지하 {r.floorsBelow}층 (층당 계획면적 {fmtNum(r.basementPlate)}㎡)</td></tr>
            <tr><th>연면적 구분</th><td>법규상 최대 {fmtNum(r.legalMaxFloorArea)}㎡ / 계획 가능 {fmtNum(r.aboveGroundArea)}㎡ ({r.legalMaxFloorArea ? fmtNum(r.aboveGroundArea / r.legalMaxFloorArea * 100, 1) : 0}%)</td></tr>
          </tbody>
        </table>
      </div>
      <div>
        {(r.blockers.length > 0 || r.missing.length > 0 || r.conditions.length > 0 || r.warnings.length > 0) && <div className="notes">
          {r.blockers.map((x) => <p key={x} className="bad">불가 · {x}</p>)}
          {r.missing.map((x) => <p key={x} className="miss">근거 필요 · {x}</p>)}
          {r.conditions.map((x) => <p key={x} className="cond">조건 · {x}</p>)}
          {r.warnings.map((x) => <p key={x} className="warn">참고 · {x}</p>)}
        </div>}
        <h4>계산식</h4>
        <ol className="formulas">{r.formulas.map((f) => <li key={f}>{f}</li>)}</ol>
      </div>
    </div>
  </div>;
}
