/** 업무일지: 날짜별 프로젝트 진행 기록 (브라우저 저장) */
export const WORKLOG_KEY = "lh-plan-lab:v1:worklog";

export const WORK_STAGES = ["검토 착수", "법규검토", "규모검토", "결과 출력·보고", "LH 접수·제출", "협의·심의", "설계·인허가", "기타"] as const;
export type WorkStage = (typeof WORK_STAGES)[number];

/** 진행 상태: 중단은 사유와 함께 '검토 중단(타절)'으로 남긴다 */
export const WORK_STATUS = {
  progress: { label: "진행 중", tone: "progress" },
  done: { label: "완료", tone: "done" },
  submitted: { label: "제출·접수", tone: "done" },
  hold: { label: "보류(대기)", tone: "hold" },
  rework: { label: "반려·재검토", tone: "hold" },
  stopped: { label: "검토 중단(타절)", tone: "stop" },
} as const;
export type WorkStatus = keyof typeof WORK_STATUS;

export const STOP_REASONS = ["사업성 부족(세대수·용적률)", "법규상 불가(용도·주차·높이)", "LH 매입기준 미충족", "토지주 협의 결렬", "상위계획·인허가 리스크", "타 대안으로 전환", "기타"] as const;

export interface WorkEntry {
  id: string;
  date: string;            // YYYY-MM-DD
  projectId?: string;      // 연결된 프로젝트
  projectName: string;     // 표시용 (직접 입력 가능)
  address?: string;
  stage: WorkStage;
  status: WorkStatus;
  reason?: string;         // 보류·중단 사유
  content: string;         // 진행사항
  next?: string;           // 다음 할 일
  createdAt: string;
  updatedAt: string;
}

type StorageLike = Pick<Storage, "getItem" | "setItem">;
export function loadWorklog(storage: StorageLike): WorkEntry[] {
  try { const v = JSON.parse(storage.getItem(WORKLOG_KEY) ?? "[]"); return Array.isArray(v) ? v : []; } catch { return []; }
}
export function saveWorklog(storage: StorageLike, list: WorkEntry[]) { storage.setItem(WORKLOG_KEY, JSON.stringify(list)); }

export function todayLocal(d = new Date()) {
  const z = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return z.toISOString().slice(0, 10);
}
export function newEntry(partial: Partial<WorkEntry> = {}): WorkEntry {
  const now = new Date().toISOString();
  return { id: "w-" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), date: todayLocal(), projectName: "", stage: "법규검토", status: "progress", content: "", createdAt: now, updatedAt: now, ...partial };
}

export function sortEntries(list: WorkEntry[]) {
  return [...list].sort((a, b) => b.date.localeCompare(a.date) || b.createdAt.localeCompare(a.createdAt));
}

/** 프로젝트별 최근 상태 */
export function latestByProject(list: WorkEntry[]) {
  const map = new Map<string, WorkEntry>();
  for (const e of sortEntries(list)) { const key = e.projectId ?? e.projectName; if (key && !map.has(key)) map.set(key, e); }
  return [...map.values()];
}

/** 엑셀에서 바로 열리는 CSV (UTF-8 BOM) */
export function worklogCsv(list: WorkEntry[]) {
  const head = ["날짜", "프로젝트", "주소", "단계", "상태", "사유", "진행사항", "다음 할 일"];
  const esc = (v: string | undefined) => `"${(v ?? "").replace(/"/g, '""')}"`;
  const rows = sortEntries(list).map((e) => [e.date, e.projectName, e.address, e.stage, WORK_STATUS[e.status].label, e.reason, e.content, e.next].map(esc).join(","));
  return "﻿" + [head.join(","), ...rows].join("\r\n");
}
