"use client";

import { useRef, useState } from "react";
import type { BusinessType, LhSupply, Project, UnitType, UseKind } from "@/lib/review/types";
import { SUPPLY_LABEL, USE_SHORT } from "@/lib/review/types";
import { projectProgress, uid } from "@/lib/project/store";
import { Field, Num, Panel } from "./ui";

export interface NewProjectForm {
  name: string;
  address: string;
  extraParcels: string[];
  siteArea?: number;
  business: BusinessType;
  uses: UseKind[];
  supplies: LhSupply[];
  types: UnitType[];
  blockNo?: string;
}

export function parseTypes(text: string, supplies: LhSupply[]): UnitType[] {
  const values = text.split(/[,\s/]+/).map((v) => Number(v)).filter((v) => Number.isFinite(v) && v > 0);
  return values.map((v, i) => ({ id: uid("t"), name: `${Math.round(v)}${String.fromCharCode(65 + i)}`, exclusive: v, share: Math.round(100 / values.length), supply: supplies[0] }));
}

export function ProjectsView({ projects, onOpen, onCreate, onDuplicate, onDelete, onImport, busy }: {
  projects: Project[];
  onOpen: (id: string) => void;
  onCreate: (form: NewProjectForm) => void;
  onDuplicate: (id: string) => void;
  onDelete: (id: string) => void;
  onImport: (text: string) => void;
  busy: boolean;
}) {
  const [form, setForm] = useState<NewProjectForm>({ name: "", address: "", extraParcels: [], business: "lh-purchase", uses: ["apartment", "officetel"], supplies: ["youth"], types: [] });
  const [typeText, setTypeText] = useState("");
  const [parcelText, setParcelText] = useState("");
  const [showForm, setShowForm] = useState(projects.length === 0);
  const fileRef = useRef<HTMLInputElement>(null);
  const set = <K extends keyof NewProjectForm>(k: K, v: NewProjectForm[K]) => setForm((f) => ({ ...f, [k]: v }));
  const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v]);

  const submit = () => {
    if (!form.address.trim()) return;
    onCreate({ ...form, extraParcels: parcelText.split(/\r?\n/).map((s) => s.trim()).filter(Boolean), types: parseTypes(typeText, form.supplies) });
    setShowForm(false);
    setForm((f) => ({ ...f, name: "", address: "", siteArea: undefined, blockNo: "" }));
    setTypeText(""); setParcelText("");
  };

  const sorted = [...projects].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return <div className="view">
    <Panel title="프로젝트" sub="저장된 검토 목록 · 브라우저에 저장되며 JSON으로 백업할 수 있습니다."
      actions={<>
        <button className="btn" onClick={() => fileRef.current?.click()}>JSON 불러오기</button>
        <button className="btn primary" onClick={() => setShowForm((v) => !v)}>{showForm ? "닫기" : "+ 새 검토"}</button>
        <input ref={fileRef} type="file" accept="application/json,.json" hidden onChange={async (e: { target: HTMLInputElement }) => { const f = e.target.files?.[0]; if (f) onImport(await f.text()); e.target.value = ""; }} />
      </>}>
      {showForm && <div className="new-project">
        <div className="form-grid">
          <Field label="대상지 주소 (지번)" wide hint="예: 경기도 의정부시 가능동 75-1 · 대지면적·용도지역·법규는 자동 조회합니다.">
            <input value={form.address} placeholder="시·도 시·군·구 동·읍·면 지번" onChange={(e: { target: { value: string } }) => set("address", e.target.value)} onKeyDown={(e: { key: string }) => e.key === "Enter" && submit()} autoFocus />
          </Field>
          <Field label="프로젝트명" hint="비우면 주소로 저장"><input value={form.name} onChange={(e: { target: { value: string } }) => set("name", e.target.value)} /></Field>
          <Field label="대지면적 (선택)" hint="비우면 지적 조회값 사용 · 이후 수정 가능"><Num value={form.siteArea} onChange={(v) => set("siteArea", v)} suffix="㎡" step={0.1} /></Field>
          <Field label="사업유형">
            <select value={form.business} onChange={(e: { target: { value: string } }) => set("business", e.target.value as BusinessType)}>
              <option value="lh-purchase">LH 신축매입약정</option>
              <option value="lh-other">LH 기타 공공임대</option>
              <option value="private">민간 (LH 기준 미적용)</option>
            </select>
          </Field>
          <Field label="계획 용도">
            <div className="checks">{(["apartment", "urban", "officetel"] as UseKind[]).map((u) => <label key={u}><input type="checkbox" checked={form.uses.includes(u)} onChange={() => set("uses", toggle(form.uses, u))} />{USE_SHORT[u]}</label>)}</div>
          </Field>
          <Field label="LH 공급유형">
            <div className="checks">{(Object.keys(SUPPLY_LABEL) as LhSupply[]).map((s) => <label key={s}><input type="checkbox" checked={form.supplies.includes(s)} onChange={() => set("supplies", toggle(form.supplies, s))} />{SUPPLY_LABEL[s]}</label>)}</div>
          </Field>
          <Field label="목표 전용면적 (㎡)" hint="쉼표로 구분 · 예: 26, 36, 46 (비우면 용도별 기본 타입)"><input value={typeText} onChange={(e: { target: { value: string } }) => setTypeText(e.target.value)} placeholder="26, 36" /></Field>
          <Field label="지구단위계획 획지번호 (알고 있으면)" hint="결정도로 확인한 경우만 입력 · 예: C04"><input value={form.blockNo ?? ""} onChange={(e: { target: { value: string } }) => set("blockNo", e.target.value)} /></Field>
          <Field label="합필 대상 추가 필지" wide hint="한 줄에 한 필지 · 대표 필지 제외"><textarea rows={2} value={parcelText} onChange={(e: { target: { value: string } }) => setParcelText(e.target.value)} /></Field>
        </div>
        <div className="form-actions"><button className="btn primary lg" disabled={!form.address.trim() || busy} onClick={submit}>{busy ? "조회 중…" : "생성하고 법규 자동조사 시작"}</button></div>
      </div>}

      <table className="grid-table project-table">
        <thead><tr><th>프로젝트명</th><th>대상지</th><th>검토일</th><th>법규검토</th><th>규모검토</th><th>상태</th><th></th></tr></thead>
        <tbody>
          {sorted.length === 0 && <tr><td colSpan={7} className="empty">저장된 프로젝트가 없습니다. 새 검토를 시작하세요.</td></tr>}
          {sorted.map((p) => {
            const progress = projectProgress(p);
            return <tr key={p.id} className="clickable" onClick={() => onOpen(p.id)}>
              <td><b>{p.name}</b></td>
              <td>{p.site.address}</td>
              <td>{(p.reviewedAt ?? p.updatedAt).slice(0, 10)}</td>
              <td>{p.legalDone ? <span className="done">완료</span> : <span className="todo">진행</span>}</td>
              <td>{p.massingDone ? <span className="done">완료</span> : <span className="todo">진행</span>}</td>
              <td><span className={`progress progress-${progress.tone}`}>{progress.label}</span></td>
              <td className="row-actions" onClick={(e: { stopPropagation: () => void }) => e.stopPropagation()}>
                <button className="btn sm" onClick={() => onOpen(p.id)}>열기</button>
                <button className="btn sm" onClick={() => onDuplicate(p.id)}>복제</button>
                <button className="btn sm danger" onClick={() => { if (window.confirm(`'${p.name}' 프로젝트를 삭제할까요?`)) onDelete(p.id); }}>삭제</button>
              </td>
            </tr>;
          })}
        </tbody>
      </table>
    </Panel>
  </div>;
}
