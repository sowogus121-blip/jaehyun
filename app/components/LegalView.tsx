"use client";

import { useMemo, useRef, useState } from "react";
import type { FarOption, LhSupply, ParamKey, ParkingTier, Project, ReviewRow, RowStatus, RuleParams, SourceRef, UseVerdict } from "@/lib/review/types";
import { STATUS_LABEL, SUPPLY_LABEL } from "@/lib/review/types";
import { NUMERIC_PARAMS, PARAM_LABEL, VERDICT_PARAMS, resolveParams } from "@/lib/review/params";
import { lookupHint, officialLinks } from "@/lib/review/lookup-hints";
import { buildChecklist, checklistSummary, CHECK_LABEL, sourceStatuses, type SourceState } from "@/lib/review/checklist";
import { citeLine } from "@/lib/report/format";
import { findMetroOrdinanceRules, findMetroOrdinanceSource } from "@/lib/metro-ordinance-catalog";
import { findLhGuidelines, findMetroAnnexRecords } from "@/lib/metro-annex-lh-catalog";
import { findDistrictPlanEvidence } from "@/lib/district-plan-sources";
import { NATIONAL_SCREENING_RULES } from "@/lib/national-screening-rules";
import { PARCEL_ANNEX_SOURCES } from "@/lib/parcel-annex-library";
import type { UploadedDocument } from "@/lib/types";
import { Emph, Field, Marked, Num, Panel, StatusChip } from "./ui";

const VERDICT_LABEL: Record<UseVerdict, string> = { allowed: "허용", conditional: "조건부", prohibited: "불가" };

export function LegalView({ project, onChange, onRefresh, refreshing, onUpload }: {
  project: Project;
  onChange: (p: Project, rebuild?: boolean) => void;
  onRefresh: () => void;
  refreshing: boolean;
  onUpload: (files: File[]) => void;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [draft, setDraft] = useState<ReviewRow | null>(null);
  const [filter, setFilter] = useState<"all" | "open">("all");
  const rows = project.rows;
  const resolved = useMemo(() => resolveParams(rows), [rows]);
  const counts = useMemo(() => rows.reduce<Record<RowStatus, number>>((acc, r) => ({ ...acc, [r.status]: acc[r.status] + 1 }), { verified: 0, user: 0, candidate: 0, missing: 0 }), [rows]);
  const visible = filter === "all" ? rows : rows.filter((r) => r.status === "candidate" || r.status === "missing");
  const zone = project.review?.landUse.find((l) => l.category === "용도지역")?.name ?? "";
  const address = project.review?.location?.parcelAddress || project.site.address;

  const open = (row: ReviewRow) => { setSelected(row.id); setDraft(JSON.parse(JSON.stringify(row))); };
  const newRow = (seed: Partial<ReviewRow> = {}) => {
    const row: ReviewRow = { id: "user." + Date.now().toString(36), group: "추가 검토", section: "extra", content: "", law: "", note: "", status: "user", sources: [], origin: "user", ...seed };
    setSelected(row.id); setDraft(row);
  };
  const save = (row: ReviewRow) => {
    const stamped = { ...row, edited: true, updatedAt: new Date().toISOString() };
    const exists = rows.some((r) => r.id === row.id);
    onChange({ ...project, rows: exists ? rows.map((r) => (r.id === row.id ? stamped : r)) : [...rows, stamped], massingDone: false });
    setDraft(null); setSelected(null);
  };
  const remove = (id: string) => { onChange({ ...project, rows: rows.filter((r) => r.id !== id) }); setDraft(null); setSelected(null); };
  const revert = (id: string) => { onChange({ ...project, rows: rows.filter((r) => r.id !== id) }, true); setDraft(null); setSelected(null); };
  const setSite = (patch: Partial<Project["site"]>) => onChange({ ...project, site: { ...project.site, ...patch } }, true);

  return <div className="view legal-view">
    <Panel title="대상지 조건" sub="이 값이 바뀌면 자동 행이 다시 작성됩니다. 검토자가 수정한 행은 유지됩니다."
      actions={<>
        <button className="btn" onClick={onRefresh} disabled={refreshing}>{refreshing ? "공식자료 조회 중…" : "공식자료 다시 조회"}</button>
        <label className={`toggle ${project.legalDone ? "on" : ""}`}><input type="checkbox" checked={project.legalDone} onChange={(e: { target: { checked: boolean } }) => onChange({ ...project, legalDone: e.target.checked })} />법규검토 완료</label>
      </>}>
      <div className="site-bar">
        <Field label="대상지"><div className="static">{address}{project.site.extraParcels.length ? ` 외 ${project.site.extraParcels.length}필지` : ""}</div></Field>
        <Field label="대지면적 수정" hint={project.review?.parcel?.area ? `조회값 ${project.review.parcel.area.toLocaleString()}㎡` : "조회값 없음"}>
          <Num value={project.site.siteAreaOverride} onChange={(v) => setSite({ siteAreaOverride: v })} suffix="㎡" step={0.1} placeholder="자동" />
        </Field>
        <Field label="획지번호" hint="결정도로 확인한 경우만"><input value={project.site.blockNo ?? ""} onChange={(e: { target: { value: string } }) => setSite({ blockNo: e.target.value })} placeholder="예: C04" /></Field>
        <Field label="사업유형">
          <select value={project.site.business} onChange={(e: { target: { value: string } }) => setSite({ business: e.target.value as Project["site"]["business"] })}>
            <option value="lh-purchase">LH 신축매입약정</option><option value="lh-other">LH 기타 공공임대</option><option value="private">민간</option>
          </select>
        </Field>
        <Field label="공급유형"><div className="checks">{(Object.keys(SUPPLY_LABEL) as LhSupply[]).map((s) => <label key={s}><input type="checkbox" checked={project.site.supplies.includes(s)} onChange={() => setSite({ supplies: project.site.supplies.includes(s) ? project.site.supplies.filter((x) => x !== s) : [...project.site.supplies, s] })} />{SUPPLY_LABEL[s]}</label>)}</div></Field>
        <Field label="0.3대 특례 입지"><label className="inline"><input type="checkbox" checked={Boolean(project.site.transitWithin500m)} onChange={(e: { target: { checked: boolean } }) => setSite({ transitWithin500m: e.target.checked })} />역 출구·대학 교문 500m 이내 확인</label></Field>
      </div>
      {project.review && (project.review.missing.length > 0 || project.review.errors.length > 0) && <div className="alert">
        {project.review.missing.length > 0 && <p><b>서버 환경변수 미설정{project.review.deployEnv ? ` (${project.review.deployEnv} 배포)` : ""}:</b> {project.review.missing.join(", ")} — 해당 공식자료는 자동 조회되지 않았습니다.
          {project.review.deployEnv === "preview" && <> Vercel → Settings → Environment Variables에서 이 키들의 적용 환경에 <b>Preview</b>를 체크한 뒤 재배포하세요.</>}</p>}
        {project.review.errors.map((e, i) => <p key={i}>{e}</p>)}
      </div>}
      {!project.review && <div className="alert info"><p>아직 공식자료를 조회하지 않았습니다. <b>공식자료 다시 조회</b>를 누르세요.</p></div>}
    </Panel>

    <ChecklistPanel project={project} refreshing={refreshing} onRefresh={onRefresh} onJump={(id) => { const r = rows.find((x) => x.id === id); if (r) open(r); }} />

    <Panel title="법규검토표" sub={`${project.reviewedAt ? "조회 " + new Date(project.reviewedAt).toLocaleString("ko-KR") + " · " : ""}행을 누르면 내용·근거·수치를 수정할 수 있습니다. 원문 확인·검토자 입력 행의 수치만 규모검토에 연동됩니다.`}
      actions={<>
        <div className="seg"><button className={filter === "all" ? "on" : ""} onClick={() => setFilter("all")}>전체 {rows.length}</button><button className={filter === "open" ? "on" : ""} onClick={() => setFilter("open")}>미확정 {counts.candidate + counts.missing}</button></div>
        <button className="btn" onClick={() => newRow()}>+ 행 추가</button>
      </>}>
      <div className="status-strip">
        {(["verified", "user", "candidate", "missing"] as RowStatus[]).map((s) => <span key={s}><StatusChip status={s} /> {counts[s]}</span>)}
        <span className="muted">계산 연동 수치: {Object.values(resolved).length}개</span>
      </div>
      <LegalTable rows={visible} selected={selected} onSelect={open} />
      {draft && <RowEditor key={draft.id} row={draft} address={address} zone={zone} isNew={!rows.some((r) => r.id === draft.id)}
        onSave={save} onCancel={() => { setDraft(null); setSelected(null); }}
        onDelete={draft.origin === "user" ? () => remove(draft.id) : undefined}
        onRevert={draft.origin === "auto" && rows.find((r) => r.id === draft.id)?.edited ? () => revert(draft.id) : undefined} />}
    </Panel>

    <ReferencePanel project={project} onUpload={onUpload} onUseCandidate={(doc, c) => newRow({
      group: c.topic, content: c.quote, status: "candidate", note: "업로드 문서 추출 후보 · 조항·적용대상 확인 후 상태 변경",
      sources: [{ title: doc.name, excerpt: c.quote, verbatim: true, kind: "upload" }],
    })} />
  </div>;
}

const SOURCE_LABEL: Record<SourceState, string> = { ok: "정상", alt: "대체", fail: "실패", na: "해당없음" };
function SourceStrip({ project }: { project: Project }) {
  const list = useMemo(() => sourceStatuses(project), [project]);
  if (!list.length) return null;
  return <div className="source-strip">
    {list.map((s) => <span key={s.name} className={`src src-${s.state}`} title={s.detail}>
      <i>{SOURCE_LABEL[s.state]}</i><b>{s.name}</b><small>{s.detail}</small>
    </span>)}
  </div>;
}

function ChecklistPanel({ project, refreshing, onRefresh, onJump }: { project: Project; refreshing: boolean; onRefresh: () => void; onJump: (rowId: string) => void }) {
  const groups = useMemo(() => buildChecklist(project), [project]);
  const sum = checklistSummary(groups);
  const [open, setOpen] = useState(true);
  return <Panel title="규모검토 필요자료" sub={`대상지 조회 시 자동 수집 · 확보 ${sum.ok} / 일부 ${sum.partial} / 미확보 ${sum.missing} / 직접 확인 ${sum.manual}`}
    actions={<><button className="btn" onClick={onRefresh} disabled={refreshing}>{refreshing ? "수집 중…" : "자료 다시 수집"}</button><button className="btn" onClick={() => setOpen((v) => !v)}>{open ? "접기" : "펼치기"}</button></>}>
    {open && <SourceStrip project={project} />}
    {open && <div className="checklist">
      {groups.map((g) => <div className="check-group" key={g.title}>
        <h4>{g.title}</h4>
        {g.items.map((item) => <div key={item.id} className={`check-item ${item.rowId ? "clickable" : ""}`} onClick={() => item.rowId && onJump(item.rowId)} title={item.rowId ? "법규검토표 해당 행 열기" : ""}>
          <span className={`cs cs-${item.state}`}>{CHECK_LABEL[item.state]}</span>
          <span className="ci-body"><b>{item.label}</b><small>{item.detail}</small></span>
          {item.link && <a href={item.link.url} target="_blank" rel="noreferrer" onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}>{item.link.label} ↗</a>}
        </div>)}
      </div>)}
    </div>}
  </Panel>;
}

export function LegalTable({ rows, selected, onSelect, print = false }: { rows: ReviewRow[]; selected?: string | null; onSelect?: (r: ReviewRow) => void; print?: boolean }) {
  const spans = useMemo(() => {
    const map = new Map<string, number>();
    for (let i = 0; i < rows.length; i++) {
      if (!rows[i].sub) continue;
      if (i > 0 && rows[i - 1].group === rows[i].group && rows[i - 1].sub) continue;
      let n = 1;
      while (rows[i + n] && rows[i + n].group === rows[i].group && rows[i + n].sub) n++;
      map.set(rows[i].id, n);
    }
    return map;
  }, [rows]);
  return <table className={`law-table ${print ? "print" : ""}`}>
    <colgroup><col className="c-group" /><col className="c-sub" /><col className="c-content" /><col className="c-law" /><col className="c-note" />{!print && <col className="c-status" />}</colgroup>
    <thead><tr><th colSpan={2}>구분</th><th>내용</th><th>관련 법령</th><th>비고</th>{!print && <th>근거</th>}</tr></thead>
    <tbody>
      {rows.map((row, i) => {
        const continued = row.sub && i > 0 && rows[i - 1].group === row.group && rows[i - 1].sub;
        const span = spans.get(row.id);
        const content = row.content || (row.missing ? `근거 누락: ${row.missing}` : "");
        return <tr key={row.id} className={`${selected === row.id ? "selected" : ""} st-${row.status} ${onSelect ? "clickable" : ""}`} onClick={() => onSelect?.(row)}>
          {!row.sub && <th colSpan={2} className="g">{row.group}</th>}
          {row.sub && !continued && <th rowSpan={span} className="g">{row.group}</th>}
          {row.sub && <th className="g sub">{row.sub}</th>}
          <td className="content"><Emph text={content} /></td>
          <td className="law">{row.law.split("\n").map((l, k) => <span className="line" key={k}>{l}</span>)}</td>
          <td className="note"><Emph text={row.note} />{print && row.status === "candidate" && <span className="line flag">※ 원문 대조 필요</span>}</td>
          {!print && <td className="status"><StatusChip status={row.status} compact />{row.sources.length > 0 && <small>{row.sources.length}건</small>}{row.edited && <small className="edited">수정</small>}</td>}
        </tr>;
      })}
    </tbody>
  </table>;
}

type LookupResult = { title: string; url: string; effectiveDate: string | null; articles: Array<{ article: string; text: string }> };

function RowEditor({ row, address, zone, isNew, onSave, onCancel, onDelete, onRevert }: {
  row: ReviewRow; address: string; zone: string; isNew: boolean;
  onSave: (r: ReviewRow) => void; onCancel: () => void; onDelete?: () => void; onRevert?: () => void;
}) {
  const [r, setR] = useState<ReviewRow>(row);
  const [lookup, setLookup] = useState<{ loading: boolean; error?: string; results?: LookupResult[] }>({ loading: false });
  const set = <K extends keyof ReviewRow>(k: K, v: ReviewRow[K]) => setR((x) => ({ ...x, [k]: v }));
  const setParam = (k: ParamKey, v: RuleParams[ParamKey] | undefined) => setR((x) => {
    const params = { ...(x.params ?? {}) } as Record<string, unknown>;
    if (v === undefined) delete params[k]; else params[k] = v;
    return { ...x, params: params as RuleParams };
  });
  const setSource = (i: number, patch: Partial<SourceRef>) => setR((x) => ({ ...x, sources: x.sources.map((s, j) => (j === i ? { ...s, ...patch } : s)) }));
  const hint = lookupHint(row.id);
  const [customTerms, setCustomTerms] = useState(hint?.terms.join(", ") ?? "");
  const [customSource, setCustomSource] = useState(hint?.source ?? "도시계획 조례");
  const paramKeys = Object.keys(r.params ?? {}) as ParamKey[];
  const [addKey, setAddKey] = useState<ParamKey>("bcr");
  const needsSource = r.status === "verified" && !r.sources.some((s) => s.url || s.title);

  const runLookup = async () => {
    setLookup({ loading: true });
    try {
      const res = await fetch("/api/rule-lookup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ address, source: customSource, terms: customTerms.split(/[,，]/).map((s) => s.trim()).filter(Boolean) }) });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "조회 실패");
      setLookup({ loading: false, results: data.results });
    } catch (e) { setLookup({ loading: false, error: e instanceof Error ? e.message : "조회 실패" }); }
  };
  const attach = (res: LookupResult, a: { article: string; text: string }) => {
    const terms = customTerms.split(/[,，]/).map((s) => s.trim()).filter(Boolean);
    const highlights = [...terms, ...(zone ? [zone] : [])];
    setR((x) => ({
      ...x,
      sources: [...x.sources, { title: res.title, article: a.article, url: res.url, effectiveDate: res.effectiveDate ?? undefined, excerpt: a.text, verbatim: true, highlights, kind: "ordinance" }],
      law: x.law ? x.law : `${res.title} ${a.article}`,
    }));
  };

  return <div className="editor">
    <div className="editor-head">
      <h3>{isNew ? "행 추가" : `${row.group}${row.sub ? " · " + row.sub : ""} 수정`}</h3>
      <div className="editor-actions">
        {onRevert && <button className="btn" onClick={onRevert} title="검토자 수정을 지우고 자동 조사 결과로 되돌립니다">자동값으로 되돌리기</button>}
        {onDelete && !isNew && <button className="btn danger" onClick={onDelete}>행 삭제</button>}
        <button className="btn" onClick={onCancel}>취소</button>
        <button className="btn primary" disabled={needsSource} onClick={() => onSave(r)} title={needsSource ? "원문 확인 상태는 근거(법령명 또는 URL)가 필요합니다" : ""}>저장</button>
      </div>
    </div>
    <div className="editor-grid">
      <Field label="구분"><input value={r.group} onChange={(e: { target: { value: string } }) => set("group", e.target.value)} /></Field>
      <Field label="세부 구분"><input value={r.sub ?? ""} onChange={(e: { target: { value: string } }) => set("sub", e.target.value || undefined)} /></Field>
      <Field label="상태" hint="원문 확인·검토자 입력만 계산에 연동">
        <select value={r.status} onChange={(e: { target: { value: string } }) => set("status", e.target.value as RowStatus)}>
          {(["verified", "user", "candidate", "missing"] as RowStatus[]).map((s) => <option key={s} value={s}>{STATUS_LABEL[s]}</option>)}
        </select>
      </Field>
      <Field label="내용" wide hint="수치·조건을 실제 법규검토표에 들어갈 문장으로 작성 (숫자는 출력 시 빨간 글씨)"><textarea rows={4} value={r.content} onChange={(e: { target: { value: string } }) => set("content", e.target.value)} /></Field>
      <Field label="관련 법령" wide><textarea rows={2} value={r.law} onChange={(e: { target: { value: string } }) => set("law", e.target.value)} /></Field>
      <Field label="비고" wide><textarea rows={2} value={r.note} onChange={(e: { target: { value: string } }) => set("note", e.target.value)} /></Field>
      {(r.status === "missing" || r.status === "candidate") && <Field label="누락·미확정 근거" wide><input value={r.missing ?? ""} onChange={(e: { target: { value: string } }) => set("missing", e.target.value || undefined)} /></Field>}
    </div>

    <h4>규모검토 연동 수치</h4>
    <div className="param-list">
      {paramKeys.length === 0 && <p className="muted">연동 수치 없음 — 이 행의 값이 계산에 쓰이려면 아래에서 항목을 추가하세요.</p>}
      {paramKeys.map((k) => <div className="param" key={k}>
        <span>{PARAM_LABEL[k]}</span>
        {VERDICT_PARAMS.includes(k)
          ? <select value={String(r.params?.[k] ?? "")} onChange={(e: { target: { value: string } }) => setParam(k, (e.target.value || undefined) as UseVerdict | undefined)}>
              {(Object.keys(VERDICT_LABEL) as UseVerdict[]).map((v) => <option key={v} value={v}>{VERDICT_LABEL[v]}</option>)}
            </select>
          : k === "relaxedFarOptions"
            ? <FarOptionsInput value={r.params?.[k] as FarOption[] | undefined} onChange={(v) => setParam(k, v as never)} />
          : k.endsWith("Tiers")
            ? <TierInput value={r.params?.[k] as ParkingTier[] | undefined} onChange={(v) => setParam(k, v as never)} />
            : <Num value={r.params?.[k] as number | undefined} step={0.01} onChange={(v) => setParam(k, v)} />}
        <button className="btn sm" onClick={() => setParam(k, undefined)}>삭제</button>
      </div>)}
      <div className="param add">
        <select value={addKey} onChange={(e: { target: { value: string } }) => setAddKey(e.target.value as ParamKey)}>
          {([...NUMERIC_PARAMS, "relaxedFarOptions", "parkingApartmentTiers", "parkingUrbanTiers", "parkingOfficetelTiers", ...VERDICT_PARAMS] as ParamKey[]).filter((k) => !paramKeys.includes(k)).map((k) => <option key={k} value={k}>{PARAM_LABEL[k]}</option>)}
        </select>
        <button className="btn sm" onClick={() => setParam(addKey, VERDICT_PARAMS.includes(addKey) ? "allowed" : addKey.endsWith("Tiers") ? ([{ ratio: 1 }] as never) : addKey === "relaxedFarOptions" ? ([] as never) : 0)}>+ 수치 추가</button>
      </div>
    </div>

    <h4>근거 원문 <small>(보고서 근거부록에 형광펜 표시로 첨부)</small></h4>
    {r.sources.map((s, i) => <div className="source-edit" key={i}>
      <div className="source-grid">
        <input placeholder="법령·조례·고시명" value={s.title} onChange={(e: { target: { value: string } }) => setSource(i, { title: e.target.value })} />
        <input placeholder="조항 (예: 제46조제1항)" value={s.article ?? ""} onChange={(e: { target: { value: string } }) => setSource(i, { article: e.target.value })} />
        <input placeholder="별표" value={s.annex ?? ""} onChange={(e: { target: { value: string } }) => setSource(i, { annex: e.target.value })} />
        <input placeholder="고시·공고번호" value={s.noticeNo ?? ""} onChange={(e: { target: { value: string } }) => setSource(i, { noticeNo: e.target.value })} />
        <input placeholder="시행일" value={s.effectiveDate ?? ""} onChange={(e: { target: { value: string } }) => setSource(i, { effectiveDate: e.target.value })} />
        <input placeholder="원문 URL" value={s.url ?? ""} onChange={(e: { target: { value: string } }) => setSource(i, { url: e.target.value })} />
      </div>
      <textarea rows={3} placeholder="원문 발췌 (조문을 그대로 붙여넣기)" value={s.excerpt ?? ""} onChange={(e: { target: { value: string } }) => setSource(i, { excerpt: e.target.value, verbatim: true })} />
      <div className="source-foot">
        <input placeholder="형광펜 표시할 문구 (쉼표 구분)" value={(s.highlights ?? []).join(", ")} onChange={(e: { target: { value: string } }) => setSource(i, { highlights: e.target.value.split(/[,，]/).map((x) => x.trim()).filter(Boolean) })} />
        {s.url && <a href={s.url} target="_blank" rel="noreferrer">원문 열기</a>}
        <button className="btn sm danger" onClick={() => setR((x) => ({ ...x, sources: x.sources.filter((_, j) => j !== i) }))}>삭제</button>
      </div>
      {s.excerpt && <p className="preview">{s.verbatim ? "" : <em className="muted">[요지 · 원문 대조 필요] </em>}<Marked text={s.excerpt} highlights={s.highlights} /></p>}
    </div>)}
    <button className="btn sm" onClick={() => setR((x) => ({ ...x, sources: [...x.sources, { title: "", kind: "other" }] }))}>+ 근거 직접 추가</button>

    <div className="lookup">
      <h4>원문 조문 자동 탐색 <small>국가법령정보센터에서 관할 조례·법령 본문을 검색합니다</small></h4>
      <div className="lookup-bar">
        <select value={customSource} onChange={(e: { target: { value: string } }) => setCustomSource(e.target.value)}>
          {["도시계획 조례", "건축 조례", "주차장 설치 및 관리 조례", "법령:건축법 시행령", "법령:주차장법 시행령", "법령:주택건설기준 등에 관한 규정", "법령:공공주택 특별법 시행령", "법령:국토의 계획 및 이용에 관한 법률 시행령"].map((o) => <option key={o} value={o}>{o.replace("법령:", "")}</option>)}
        </select>
        <input value={customTerms} onChange={(e: { target: { value: string } }) => setCustomTerms(e.target.value)} placeholder="검색어 (쉼표 구분)" />
        <button className="btn" disabled={lookup.loading || !customTerms.trim()} onClick={runLookup}>{lookup.loading ? "검색 중…" : "조문 검색"}</button>
      </div>
      {lookup.error && <p className="error">{lookup.error}</p>}
      {lookup.results?.length === 0 && <p className="muted">해당 조례를 찾지 못했습니다. 아래 공식 사이트에서 직접 확인하세요.</p>}
      {lookup.results?.map((res) => <div className="lookup-result" key={res.url}>
        <b>{res.title}</b> <small>{res.effectiveDate ? `시행 ${res.effectiveDate}` : ""}</small> <a href={res.url} target="_blank" rel="noreferrer">원문</a>
        {res.articles.length === 0 && <p className="muted">검색어가 포함된 조문이 없습니다. 검색어를 바꿔 보세요.</p>}
        {res.articles.map((a) => <div className="article" key={a.article}>
          <div><b>{a.article}</b> <button className="btn sm" onClick={() => attach(res, a)}>근거로 첨부</button></div>
          <p><Marked text={a.text.slice(0, 900)} highlights={customTerms.split(/[,，]/).map((s) => s.trim())} />{a.text.length > 900 ? "…" : ""}</p>
        </div>)}
      </div>)}
      <div className="official-links">{officialLinks(address).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}</div>
    </div>
  </div>;
}

/** 주차기준 구간 입력: "<30:0.7, 60:0.9, 1" 또는 "85:1/70㎡, 1/65㎡"
 *  상한(㎡, '<'면 미만):세대당 대수[/전용 ㎡당 1대]. 상한 없는 마지막 구간은 "대수[/㎡]" */
/** 완화 용적률 단계 입력: "300:매입임대, 400:공공임대 추가공급" */
function FarOptionsInput({ value, onChange }: { value?: FarOption[]; onChange: (v: FarOption[] | undefined) => void }) {
  const [draft, setDraft] = useState((value ?? []).map((o) => `${o.far}:${o.label}`).join(", "));
  return <input title="용적률%:설명, … (예: 300:매입임대, 400:공공임대 추가공급)" value={draft}
    onChange={(e: { target: { value: string } }) => setDraft(e.target.value)}
    onBlur={() => {
      const prev = new Map((value ?? []).map((o) => [o.far, o]));
      const list = draft.split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
        const [far, ...label] = x.split(":");
        const n = Number(far.replace(/[^\d.]/g, ""));
        return { ...(prev.get(n) ?? {}), far: n, label: label.join(":").trim() || `${n}%` };
      }).filter((o) => Number.isFinite(o.far) && o.far > 0);
      onChange(list.length ? list : undefined);
    }} />;
}

function TierInput({ value, onChange }: { value?: ParkingTier[]; onChange: (v: ParkingTier[] | undefined) => void }) {
  const fmt = (t: ParkingTier) => {
    const rule = [t.ratio !== undefined ? String(t.ratio) : "", t.sqmPerStall ? `/${t.sqmPerStall}㎡` : ""].join("");
    return t.maxArea !== undefined ? `${t.strict ? "<" : ""}${t.maxArea}:${rule}` : rule;
  };
  const [draft, setDraft] = useState((value ?? []).map(fmt).join(", "));
  const parse = (x: string): ParkingTier | null => {
    const [cond, rule] = x.includes(":") ? x.split(":") : ["", x];
    const t: ParkingTier = {};
    if (cond.trim()) { t.strict = cond.trim().startsWith("<") || undefined; t.maxArea = Number(cond.replace(/[<\s]/g, "")); }
    const [ratio, sqm] = rule.split("/");
    if (ratio?.trim()) t.ratio = Number(ratio.trim());
    if (sqm) t.sqmPerStall = Number(sqm.replace(/[^\d.]/g, ""));
    return (t.ratio !== undefined && Number.isFinite(t.ratio)) || t.sqmPerStall ? t : null;
  };
  return <input title="상한㎡:세대당 대수[/㎡당 1대] — 예: <30:0.7, 60:0.9, 1  또는  85:1/70㎡, 1/65㎡" value={draft}
    onChange={(e: { target: { value: string } }) => setDraft(e.target.value)}
    onBlur={() => {
      const tiers = draft.split(",").map((x) => x.trim()).filter(Boolean).map(parse).filter((t): t is ParkingTier => !!t);
      onChange(tiers.length ? tiers : undefined);
    }} />;
}

function fmtDate(v?: string | null) {
  return v && /^\d{8}$/.test(v) ? `${v.slice(0, 4)}.${v.slice(4, 6)}.${v.slice(6)}` : v ?? "-";
}

function ReferencePanel({ project, onUpload, onUseCandidate }: {
  project: Project;
  onUpload: (files: File[]) => void;
  onUseCandidate: (doc: UploadedDocument, c: NonNullable<UploadedDocument["analysis"]>["candidates"][number]) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const review = project.review;
  const address = review?.location?.parcelAddress || project.site.address;
  const metro = findMetroOrdinanceSource(address);
  const metroRules = findMetroOrdinanceRules(address);
  const annex = findMetroAnnexRecords(address);
  const lhGuides = findLhGuidelines(address);
  const plans = findDistrictPlanEvidence(address);
  const [tab, setTab] = useState<"sources" | "catalog" | "uploads" | "national">("sources");
  return <Panel title="참고자료 · 원문" sub="조회된 법령·조례 원문, 지역 근거 카탈로그, 업로드 문서. 표에 반영하려면 해당 행을 열어 근거로 첨부하세요."
    actions={<div className="seg">
      <button className={tab === "sources" ? "on" : ""} onClick={() => setTab("sources")}>조회 원문</button>
      <button className={tab === "catalog" ? "on" : ""} onClick={() => setTab("catalog")}>지역 근거 {metroRules.length + annex.length + lhGuides.length + plans.length}</button>
      <button className={tab === "uploads" ? "on" : ""} onClick={() => setTab("uploads")}>업로드 {project.documents.length}</button>
      <button className={tab === "national" ? "on" : ""} onClick={() => setTab("national")}>국가법규 점검</button>
    </div>}>
    {tab === "sources" && <div className="ref-grid">
      <table className="grid-table ref-table">
        <thead><tr><th>구분</th><th>자료</th><th>시행·고시</th><th>출처</th><th>원문</th></tr></thead>
        <tbody>
          {(review?.laws ?? []).map((l) => <tr key={l.link}><td>법령</td><td>{l.name}</td><td>{fmtDate(l.enforcementDate)}</td><td><span className="tag">국가법령정보센터</span></td><td><a href={l.link} target="_blank" rel="noreferrer">열기</a></td></tr>)}
          {(review?.ordinances ?? []).map((o) => <tr key={o.link}><td>조례</td><td>{o.name}</td><td>{fmtDate(o.enforcementDate)}</td><td><span className={`tag ${(o as { source?: string }).source === "elis" ? "tag-alt" : ""}`}>{(o as { source?: string }).source === "elis" ? "자치법규정보시스템(대체)" : "국가법령정보센터"}</span></td><td><a href={o.link} target="_blank" rel="noreferrer">열기</a></td></tr>)}
          {(review?.officialDocuments?.documents ?? []).filter((d) => d.kind === "district-plan").map((d) => <tr key={d.sourceUrl}>
            <td>지구단위</td>
            <td>{d.title}{d.siteMention && <span className="tag tag-hit">지번 기재</span>}
              {d.attachments && d.attachments.length > 0 && <small className="att">첨부 {d.attachments.filter((x) => x.analyzed).length}/{d.attachments.length} 분석 · {d.attachments.map((x) => x.name).join(", ")}</small>}</td>
            <td>{d.gosiNo ? <>{d.gosiNo}<br /><small>{d.gosiDate}</small></> : d.status === "analyzed" ? `${d.pageCount ?? "?"}쪽 분석` : d.status === "failed" ? "읽기 실패" : "링크"}</td>
            <td><span className="tag">{d.gosiNo ? "토지이음 고시" : "웹검색"}</span></td>
            <td><a href={d.sourceUrl} target="_blank" rel="noreferrer">열기</a></td></tr>)}
          {review?.lhNotice && <tr><td>LH 공고</td><td>{review.lhNotice.title}</td><td>{review.lhNotice.publishedAt}</td><td><span className="tag">LH 청약플러스</span></td><td><a href={review.lhNotice.url} target="_blank" rel="noreferrer">공고</a>{review.lhNotice.pdfUrl && <> · <a href={review.lhNotice.pdfUrl} target="_blank" rel="noreferrer">PDF</a></>}{review.lhNotice.guideUrl && <> · <a href={review.lhNotice.guideUrl} target="_blank" rel="noreferrer">가이드라인</a></>}</td></tr>}
          {(review?.officialDocuments?.documents ?? []).filter((d) => d.kind === "lh-notice" && d.status === "analyzed").map((d) => <tr key={d.sourceUrl}><td>LH 첨부</td><td>{d.title}</td><td>{d.pageCount ?? "?"}쪽 분석</td><td><span className="tag">웹검색</span></td><td><a href={d.sourceUrl} target="_blank" rel="noreferrer">열기</a></td></tr>)}
          {!review && <tr><td colSpan={5} className="empty">공식자료 조회 전</td></tr>}
        </tbody>
      </table>
      {(review?.webSearch.results ?? []).length > 0 && <details className="extracted">
        <summary>공식기관 웹검색 결과 {review!.webSearch.results.length}건 (참고 링크)</summary>
        <ul>{review!.webSearch.results.slice(0, 20).map((w) => <li key={w.url}><a href={w.url} target="_blank" rel="noreferrer">{w.title}</a> <small>{w.sourceDomain}</small></li>)}</ul>
      </details>}
      {review?.lhNotice?.extractedCriteria && review.lhNotice.extractedCriteria.length > 0 && <details className="extracted">
        <summary>LH 공고문 자동 추출 문구 {review.lhNotice.extractedCriteria.length}건 (검증 전 후보)</summary>
        <ul>{review.lhNotice.extractedCriteria.map((c, i) => <li key={i}><b>{c.topic}</b> {c.quote}</li>)}</ul>
      </details>}
      <div className="official-links">{officialLinks(address).map((l) => <a key={l.url} href={l.url} target="_blank" rel="noreferrer">{l.label} ↗</a>)}</div>
    </div>}
    {tab === "catalog" && <div>
      {metro && <p className="muted">{metro.city} · {metro.title} (시행 {metro.effectiveDate}) <a href={metro.url} target="_blank" rel="noreferrer">원문</a></p>}
      <table className="grid-table">
        <thead><tr><th>구분</th><th>항목</th><th>내용</th><th>조건·한계</th></tr></thead>
        <tbody>
          {plans.map((m) => <tr key={m.plan.id}><td>지구단위 후보</td><td><a href={m.plan.officialNoticeUrl} target="_blank" rel="noreferrer">{m.plan.name}</a><br /><small>{m.plan.noticeNo}</small></td><td>{m.message}</td><td>{m.plan.warnings.join(" ")}</td></tr>)}
          {metroRules.map((x) => <tr key={x.id}><td>{x.kind}</td><td>{x.title}<br /><small>{x.article}</small></td><td>{x.detail}</td><td>{x.conditions}</td></tr>)}
          {annex.map((x) => <tr key={x.id}><td>별표</td><td><a href={x.sourceUrl} target="_blank" rel="noreferrer">{x.title}</a><br /><small>{x.appendix ?? ""}</small></td><td>{x.topic}</td><td>{x.conditions}</td></tr>)}
          {lhGuides.map((x) => <tr key={x.id}><td>LH 기준</td><td>{x.topic}<br /><small>{x.sourceLocation}</small></td><td>{x.detail}</td><td>{x.conditions}</td></tr>)}
          {metroRules.length + annex.length + lhGuides.length + plans.length === 0 && <tr><td colSpan={4} className="empty">이 지역의 사전 검증 근거가 없습니다. 행별 "원문 조문 자동 탐색"을 사용하세요.</td></tr>}
        </tbody>
      </table>
    </div>}
    {tab === "uploads" && <div>
      <div className="upload-bar">
        <button className="btn" onClick={() => fileRef.current?.click()}>문서 업로드 (PDF·HWPX·DOCX·XLSX·TXT)</button>
        <span className="muted">지구단위계획 결정조서·시행지침, LH 공고문·체크리스트 등. 추출 수치는 후보로만 표시됩니다.</span>
        <input ref={fileRef} type="file" multiple hidden accept=".pdf,.hwpx,.docx,.xlsx,.txt" onChange={(e: { target: HTMLInputElement }) => { const files = Array.from(e.target.files ?? []); if (files.length) onUpload(files); e.target.value = ""; }} />
      </div>
      {project.documents.map((d) => <details key={d.id} className="doc">
        <summary><b>{d.name}</b> · {d.status === "analyzed" ? `${d.analysis?.format?.toUpperCase()} ${d.analysis?.pageCount ?? ""}쪽 · 후보 ${d.analysis?.candidates.length ?? 0}건` : d.status === "analyzing" ? "분석 중" : d.error ?? "실패"}</summary>
        {d.analysis?.candidates.map((c, i) => <div className="candidate" key={i}><span className="tag">{c.topic}</span> {c.quote} <button className="btn sm" onClick={() => onUseCandidate(d, c)}>행으로 추가</button></div>)}
      </details>)}
    </div>}
    {tab === "national" && <table className="grid-table">
      <thead><tr><th>분류</th><th>항목</th><th>근거</th><th>확인 질문</th></tr></thead>
      <tbody>
        {NATIONAL_SCREENING_RULES.map((x) => <tr key={x.id}><td>{x.category}</td><td>{x.title}</td><td><a href={x.sourceUrl} target="_blank" rel="noreferrer">{x.law} {x.article}</a></td><td>{x.screeningQuestion}</td></tr>)}
        {PARCEL_ANNEX_SOURCES.filter((s) => s.scope === "공통").map((s) => <tr key={s.id}><td>{s.kind}</td><td>{s.title}</td><td><a href={s.url} target="_blank" rel="noreferrer">원문</a></td><td>{s.purpose}</td></tr>)}
      </tbody>
    </table>}
  </Panel>;
}

export function sourceLabel(s: SourceRef) { return citeLine(s); }
