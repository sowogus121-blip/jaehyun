"use client";

import { useMemo, useState } from "react";
import type { Project } from "@/lib/review/types";
import { resolveParams } from "@/lib/review/params";
import { Field, Panel, downloadBlob } from "./ui";
import { STOP_REASONS, WORK_STAGES, WORK_STATUS, latestByProject, newEntry, sortEntries, worklogCsv, type WorkEntry, type WorkStage, type WorkStatus } from "@/lib/worklog";

/** 현재 프로젝트 상태로 진행사항 초안 만들기 */
function projectSnapshot(p: Project): { stage: WorkStage; content: string } {
  const verified = p.rows.filter((r) => r.status === "verified" || r.status === "user").length;
  const open = p.rows.filter((r) => r.status === "candidate" || r.status === "missing").length;
  const review = p.rows.filter((r) => /검토요망/.test(r.note)).map((r) => r.sub ? `${r.group}·${r.sub}` : r.group);
  const params = resolveParams(p.rows);
  const lines = [
    `대상지 ${p.site.address}`,
    `법규검토 ${p.legalDone ? "완료" : "진행"} · 확정 ${verified}행 / 미확정 ${open}행${review.length ? ` · 검토요망: ${[...new Set(review)].join(", ")}` : ""}`,
    params.bcr && params.far ? `건폐율 ${params.bcr.value}% · 용적률 ${params.far.value}%` : "",
    `규모검토 ${p.massingDone ? "완료" : "진행"} · 대안 ${p.scenarios.length}개 (${p.scenarios.map((s) => s.name).slice(0, 4).join(", ")}${p.scenarios.length > 4 ? " 외" : ""})`,
  ].filter(Boolean);
  return { stage: p.massingDone ? "결과 출력·보고" : p.legalDone ? "규모검토" : "법규검토", content: lines.join("\n") };
}

export function WorklogView({ entries, onChange, projects, current }: { entries: WorkEntry[]; onChange: (list: WorkEntry[]) => void; projects: Project[]; current: Project | null }) {
  const [draft, setDraft] = useState<WorkEntry | null>(null);
  const [fProject, setFProject] = useState("");
  const [fStatus, setFStatus] = useState("");
  const [fMonth, setFMonth] = useState("");
  const months = useMemo(() => [...new Set(entries.map((e) => e.date.slice(0, 7)))].sort().reverse(), [entries]);
  const visible = useMemo(() => sortEntries(entries).filter((e) =>
    (!fProject || (e.projectId ?? e.projectName) === fProject) && (!fStatus || e.status === fStatus) && (!fMonth || e.date.startsWith(fMonth))), [entries, fProject, fStatus, fMonth]);
  const latest = useMemo(() => latestByProject(entries), [entries]);
  const projectKeys = useMemo(() => [...new Map(entries.map((e) => [e.projectId ?? e.projectName, e.projectName])).entries()], [entries]);
  const byDate = useMemo(() => { const m = new Map<string, WorkEntry[]>(); for (const e of visible) m.set(e.date, [...(m.get(e.date) ?? []), e]); return [...m.entries()]; }, [visible]);

  const start = (base?: Partial<WorkEntry>) => {
    const p = current;
    const snap = p ? projectSnapshot(p) : null;
    setDraft(newEntry({ projectId: p?.id, projectName: p?.name ?? "", address: p?.site.address, stage: snap?.stage ?? "법규검토", content: snap?.content ?? "", ...base }));
  };
  const save = () => {
    if (!draft) return;
    const e = { ...draft, updatedAt: new Date().toISOString() };
    onChange(entries.some((x) => x.id === e.id) ? entries.map((x) => (x.id === e.id ? e : x)) : [e, ...entries]);
    setDraft(null);
  };
  const set = (patch: Partial<WorkEntry>) => setDraft((d) => (d ? { ...d, ...patch } : d));
  const needReason = draft && (draft.status === "stopped" || draft.status === "hold" || draft.status === "rework");

  return <div className="view worklog-view">
    <Panel title="업무일지" sub="날짜별로 어떤 프로젝트를 어디까지 진행했는지 기록합니다. 중단한 검토는 '검토 중단(타절)'과 사유로 남깁니다."
      actions={<>
        <button className="btn primary" onClick={() => start()}>+ 오늘 기록{current ? ` (${current.name})` : ""}</button>
        <button className="btn" disabled={!entries.length} onClick={() => downloadBlob(worklogCsv(visible), "text/csv;charset=utf-8", `업무일지_${new Date().toISOString().slice(0, 10)}.csv`)}>엑셀(CSV) 내보내기</button>
      </>}>
      {draft && <div className="worklog-editor">
        <div className="wl-grid">
          <Field label="날짜"><input type="date" value={draft.date} onChange={(e: { target: { value: string } }) => set({ date: e.target.value })} /></Field>
          <Field label="프로젝트">
            <select value={draft.projectId ?? ""} onChange={(e: { target: { value: string } }) => { const p = projects.find((x) => x.id === e.target.value); set(p ? { projectId: p.id, projectName: p.name, address: p.site.address } : { projectId: undefined }); }}>
              <option value="">직접 입력</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
            {!draft.projectId && <input placeholder="프로젝트명" value={draft.projectName} onChange={(e: { target: { value: string } }) => set({ projectName: e.target.value })} />}
          </Field>
          <Field label="단계"><select value={draft.stage} onChange={(e: { target: { value: string } }) => set({ stage: e.target.value as WorkStage })}>{WORK_STAGES.map((s) => <option key={s}>{s}</option>)}</select></Field>
          <Field label="상태"><div className="wl-status">{(Object.keys(WORK_STATUS) as WorkStatus[]).map((k) => <button type="button" key={k} className={`wl-badge wl-${WORK_STATUS[k].tone} ${draft.status === k ? "on" : ""}`} onClick={() => set({ status: k })}>{WORK_STATUS[k].label}</button>)}</div></Field>
          {needReason && <Field label={draft.status === "stopped" ? "중단 사유" : "사유"}>
            <select value={STOP_REASONS.includes(draft.reason as (typeof STOP_REASONS)[number]) ? draft.reason : draft.reason ? "기타" : ""} onChange={(e: { target: { value: string } }) => set({ reason: e.target.value })}>
              <option value="">선택</option>{STOP_REASONS.map((r) => <option key={r}>{r}</option>)}
            </select>
          </Field>}
        </div>
        <Field label="진행사항" wide><textarea rows={4} value={draft.content} onChange={(e: { target: { value: string } }) => set({ content: e.target.value })} placeholder="오늘 한 일, 확인된 법규·규모 결과" /></Field>
        <Field label="다음 할 일" wide><input value={draft.next ?? ""} onChange={(e: { target: { value: string } }) => set({ next: e.target.value })} placeholder="예: LH 지역본부에 예정역 인정 여부 문의" /></Field>
        <div className="wl-actions">
          {current && <button className="btn" onClick={() => { const s = projectSnapshot(current); set({ projectId: current.id, projectName: current.name, address: current.site.address, stage: s.stage, content: s.content }); }}>현재 프로젝트 진행상황 불러오기</button>}
          <span className="spacer" />
          <button className="btn" onClick={() => setDraft(null)}>취소</button>
          <button className="btn primary" disabled={!draft.projectName.trim() || !draft.content.trim()} onClick={save}>저장</button>
        </div>
      </div>}

      {latest.length > 0 && <div className="wl-summary">
        <h4>프로젝트별 현재 상태</h4>
        <table className="wl-table"><thead><tr><th>프로젝트</th><th>최근 기록</th><th>단계</th><th>상태</th><th>다음 할 일</th></tr></thead>
          <tbody>{latest.map((e) => <tr key={e.id} onClick={() => setFProject(e.projectId ?? e.projectName)} className="clickable">
            <td><b>{e.projectName}</b>{e.address && <small>{e.address}</small>}</td><td>{e.date}</td><td>{e.stage}</td>
            <td><span className={`wl-badge wl-${WORK_STATUS[e.status].tone} on`}>{WORK_STATUS[e.status].label}</span>{e.reason && <small>{e.reason}</small>}</td><td>{e.next ?? ""}</td>
          </tr>)}</tbody></table>
      </div>}

      <div className="wl-filters">
        <select value={fProject} onChange={(e: { target: { value: string } }) => setFProject(e.target.value)}><option value="">전체 프로젝트</option>{projectKeys.map(([k, n]) => <option key={k} value={k}>{n}</option>)}</select>
        <select value={fStatus} onChange={(e: { target: { value: string } }) => setFStatus(e.target.value)}><option value="">전체 상태</option>{(Object.keys(WORK_STATUS) as WorkStatus[]).map((k) => <option key={k} value={k}>{WORK_STATUS[k].label}</option>)}</select>
        <select value={fMonth} onChange={(e: { target: { value: string } }) => setFMonth(e.target.value)}><option value="">전체 기간</option>{months.map((m) => <option key={m} value={m}>{m.replace("-", "년 ")}월</option>)}</select>
        <span className="muted">{visible.length}건</span>
      </div>

      {!entries.length && !draft && <p className="muted wl-empty">아직 기록이 없습니다. <b>+ 오늘 기록</b>을 누르면 현재 프로젝트 진행상황이 자동으로 채워집니다.</p>}
      {byDate.map(([date, list]) => <div className="wl-day" key={date}>
        <h4>{date.replace(/^(\d{4})-(\d{2})-(\d{2})$/, "$1년 $2월 $3일")}</h4>
        {list.map((e) => <div className="wl-entry" key={e.id}>
          <div className="wl-head"><b>{e.projectName}</b><span className="wl-stage">{e.stage}</span><span className={`wl-badge wl-${WORK_STATUS[e.status].tone} on`}>{WORK_STATUS[e.status].label}</span>{e.reason && <small className="wl-reason">사유: {e.reason}</small>}
            <span className="spacer" /><button className="btn sm" onClick={() => setDraft(e)}>수정</button><button className="btn sm danger" onClick={() => onChange(entries.filter((x) => x.id !== e.id))}>삭제</button></div>
          <p className="wl-content">{e.content}</p>
          {e.next && <p className="wl-next">다음: {e.next}</p>}
        </div>)}
      </div>)}
    </Panel>
  </div>;
}
