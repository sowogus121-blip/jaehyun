"use client";

import type { ReactNode } from "react";
import { emphasizeNumbers, highlightRuns } from "@/lib/report/format";
import type { RowStatus } from "@/lib/review/types";
import { STATUS_LABEL } from "@/lib/review/types";

export function Emph({ text }: { text: string }) {
  return <>{text.split("\n").map((line, i) => (
    <span className="line" key={i}>{emphasizeNumbers(line).map((r, j) => r.emphasis ? <b className="num" key={j}>{r.text}</b> : <span key={j}>{r.text}</span>)}</span>
  ))}</>;
}

export function Marked({ text, highlights }: { text: string; highlights?: string[] }) {
  return <>{highlightRuns(text, highlights).map((r, i) => r.emphasis ? <mark key={i}>{r.text}</mark> : <span key={i}>{r.text}</span>)}</>;
}

export function StatusChip({ status, compact = false }: { status: RowStatus; compact?: boolean }) {
  return <span className={`chip chip-${status}`} title={STATUS_LABEL[status]}>{compact ? STATUS_LABEL[status].slice(0, 2) : STATUS_LABEL[status]}</span>;
}

export function Field({ label, hint, children, wide }: { label: string; hint?: string; children: ReactNode; wide?: boolean }) {
  return <label className={`field ${wide ? "wide" : ""}`}><span className="field-label">{label}</span>{children}{hint && <small>{hint}</small>}</label>;
}

export function Num({ value, onChange, step = 1, min, placeholder, suffix }: { value: number | undefined; onChange: (v: number | undefined) => void; step?: number; min?: number; placeholder?: string; suffix?: string }) {
  return <span className="num-input">
    <input type="number" step={step} min={min} placeholder={placeholder} value={value ?? ""}
      onChange={(e: { target: { value: string } }) => onChange(e.target.value === "" ? undefined : Number(e.target.value))} />
    {suffix && <em>{suffix}</em>}
  </span>;
}

export function Panel({ title, sub, actions, children, className = "" }: { title: string; sub?: string; actions?: ReactNode; children: ReactNode; className?: string }) {
  return <section className={`panel ${className}`}>
    <header className="panel-head"><div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>{actions && <div className="panel-actions">{actions}</div>}</header>
    {children}
  </section>;
}

export function downloadBlob(content: BlobPart, type: string, filename: string) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
