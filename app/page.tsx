"use client";

import { useEffect, useMemo, useState } from "react";
import type { Project } from "@/lib/review/types";
import type { SiteReviewResult, UploadedDocument } from "@/lib/types";
import { applyReview, duplicateProject, importProjectJson, loadProjects, newProject, rebuildRows, saveProjects } from "@/lib/project/store";
import { ProjectsView, type NewProjectForm } from "./components/ProjectsView";
import { LegalView } from "./components/LegalView";
import { MassingView } from "./components/MassingView";
import { OutputView } from "./components/OutputView";

type View = "projects" | "legal" | "massing" | "output";
const NAV: Array<{ id: View; no: string; label: string; sub: string }> = [
  { id: "projects", no: "①", label: "프로젝트", sub: "목록·새 검토" },
  { id: "legal", no: "②", label: "법규검토", sub: "법규검토표·원문" },
  { id: "massing", no: "③", label: "규모검토", sub: "대안·건축개요" },
  { id: "output", no: "④", label: "결과 출력", sub: "엑셀·PDF·JSON" },
];

export default function Home() {
  const [projects, setProjects] = useState<Project[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [currentId, setCurrentId] = useState<string | null>(null);
  const [view, setView] = useState<View>("projects");
  const [refreshing, setRefreshing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    setProjects(loadProjects(window.localStorage));
    setLoaded(true);
    // 과거 버전이 브라우저에 남긴 API 키 흔적 제거 (키는 서버 환경변수에서만 사용)
    for (const k of ["lh-plan-vworld-key", "lh-plan-law-oc"]) { window.localStorage.removeItem(k); window.sessionStorage.removeItem(k); }
  }, []);
  useEffect(() => {
    if (!loaded) return;
    try { saveProjects(window.localStorage, projects); }
    catch { setToast("브라우저 저장 공간이 부족합니다. JSON 백업 후 오래된 프로젝트를 정리하세요."); }
  }, [projects, loaded]);
  useEffect(() => { if (!toast) return; const t = setTimeout(() => setToast(null), 5000); return () => clearTimeout(t); }, [toast]);

  const project = useMemo(() => projects.find((p) => p.id === currentId) ?? null, [projects, currentId]);
  const upsert = (p: Project) => setProjects((list) => list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? { ...p, updatedAt: new Date().toISOString() } : x)) : [p, ...list]);
  const change = (p: Project, rebuild = false) => upsert(rebuild ? rebuildRows(p) : p);

  const runReview = async (p: Project) => {
    setRefreshing(true);
    try {
      const res = await fetch("/api/site-review", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ address: p.site.address, parcelAddresses: p.site.extraParcels, businessMode: p.site.business === "lh-purchase" ? "purchase" : "other", lhSupplyType: p.site.supplies[0] }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "공식자료 조회 실패");
      setProjects((list) => list.map((x) => (x.id === p.id ? applyReview(x, data as SiteReviewResult) : x)));
      setToast("공식자료 조회 완료 · 법규검토표를 갱신했습니다. 검토자 수정 행은 유지됩니다.");
    } catch (e) {
      setToast(e instanceof Error ? e.message : "공식자료 조회 실패");
    }
    setRefreshing(false);
  };

  const create = (form: NewProjectForm) => {
    let p = newProject({ address: form.address, extraParcels: form.extraParcels, siteAreaOverride: form.siteArea, business: form.business, uses: form.uses, supplies: form.supplies, blockNo: form.blockNo?.trim() || undefined }, form.name);
    if (form.types.length) p = { ...p, scenarios: p.scenarios.map((s) => ({ ...s, types: form.types.map((t) => ({ ...t })) })) };
    upsert(p);
    setCurrentId(p.id);
    setView("legal");
    void runReview(p);
  };

  const upload = async (files: File[]) => {
    if (!project) return;
    const pending: UploadedDocument[] = files.map((f) => ({ id: "doc-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), name: f.name, size: f.size, category: "검토자료", sourceAddress: project.site.address, status: "analyzing", uploadedAt: new Date().toISOString() }));
    upsert({ ...project, documents: [...project.documents, ...pending] });
    const done = await Promise.all(files.map(async (file, i) => {
      const form = new FormData(); form.append("file", file);
      try {
        const res = await fetch("/api/documents/analyze", { method: "POST", body: form });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "분석 실패");
        return { ...pending[i], status: "analyzed" as const, analysis: data.analysis };
      } catch (e) { return { ...pending[i], status: "failed" as const, error: e instanceof Error ? e.message : "분석 실패" }; }
    }));
    setProjects((list) => list.map((x) => x.id === project.id ? { ...x, documents: x.documents.map((d) => done.find((n) => n.id === d.id) ?? d) } : x));
    setToast(`문서 ${done.filter((d) => d.status === "analyzed").length}/${done.length}건 분석 완료 · 추출값은 후보로만 표시됩니다.`);
  };

  const go = (v: View) => { if (v !== "projects" && !project) return; setView(v); };

  return <div className="app">
    <aside className="side">
      <div className="brand"><b>LH Plan Lab</b><small>법규검토 · 규모검토</small></div>
      <nav>{NAV.map((n) => <button key={n.id} className={`${view === n.id ? "active" : ""}`} disabled={n.id !== "projects" && !project} onClick={() => go(n.id)}>
        <span className="no">{n.no}</span><span><b>{n.label}</b><small>{n.sub}</small></span>
        {project && n.id === "legal" && <i className={`dot ${project.legalDone ? "done" : ""}`} />}
        {project && n.id === "massing" && <i className={`dot ${project.massingDone ? "done" : ""}`} />}
      </button>)}</nav>
      {project && <div className="side-project"><small>현재 프로젝트</small><b>{project.name}</b><span>{project.site.address}</span>
        <input className="rename" value={project.name} onChange={(e: { target: { value: string } }) => upsert({ ...project, name: e.target.value })} aria-label="프로젝트명" />
      </div>}
      <p className="side-foot">법규 수치는 공식 원문 확인 또는 검토자 입력 행만 계산에 사용합니다.</p>
    </aside>
    <main className="main">
      {view === "projects" && <ProjectsView projects={projects} busy={refreshing}
        onOpen={(id) => { setCurrentId(id); setView("legal"); }}
        onCreate={create}
        onDuplicate={(id) => { const p = projects.find((x) => x.id === id); if (p) upsert(duplicateProject(p)); }}
        onDelete={(id) => { setProjects((list) => list.filter((x) => x.id !== id)); if (currentId === id) setCurrentId(null); }}
        onImport={(text) => { try { const p = importProjectJson(text); upsert(p); setCurrentId(p.id); setView("legal"); setToast("프로젝트를 불러왔습니다."); } catch (e) { setToast(e instanceof Error ? e.message : "불러오기 실패"); } }} />}
      {view === "legal" && project && <LegalView project={project} onChange={change} refreshing={refreshing} onRefresh={() => runReview(project)} onUpload={upload} />}
      {view === "massing" && project && <MassingView project={project} onChange={(p) => {
        // 규모검토에서 새 용도(예: 도시형생활주택) 대안을 만들면 법규검토 대상 용도에도 넣고 행(주차기준 등)을 다시 만든다.
        const extra = [...new Set(p.scenarios.map((s) => s.use))].filter((u) => !p.site.uses.includes(u));
        change(extra.length ? { ...p, site: { ...p.site, uses: [...p.site.uses, ...extra] } } : p, extra.length > 0);
      }} onGoLegal={() => setView("legal")} />}
      {view === "output" && project && <OutputView project={project} notify={setToast} />}
    </main>
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>;
}
