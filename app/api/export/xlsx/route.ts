import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import type { ReviewRow } from "../../../../lib/review/types";
import { STATUS_LABEL } from "../../../../lib/review/types";
import { emphasizeNumbers, citeLine } from "../../../../lib/report/format";
import type { ExportBody } from "../../../../lib/report/export-types";

export const runtime = "nodejs";

const NAVY = "FF4E6487";
const GROUP_FILL = "FFDCE1EA";
const BORDER = { style: "thin" as const, color: { argb: "FF8A94A6" } };
const ALL_BORDERS = { top: BORDER, left: BORDER, bottom: BORDER, right: BORDER };
const BASE_FONT = { name: "맑은 고딕", size: 10 };

function rich(text: string) {
  return { richText: emphasizeNumbers(text).map((r) => ({ text: r.text, font: { ...BASE_FONT, ...(r.emphasis ? { color: { argb: "FFE60012" } } : {}) } })) };
}
function lineCount(text: string, width: number) {
  return text.split("\n").reduce((n, line) => n + Math.max(1, Math.ceil((line.length * 1.9) / width)), 0);
}

function legalSheet(wb: ExcelJS.Workbook, body: ExportBody) {
  const ws = wb.addWorksheet("법규검토", { pageSetup: { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0, margins: { left: 0.4, right: 0.4, top: 0.5, bottom: 0.5, header: 0.2, footer: 0.2 } } });
  ws.columns = [{ width: 13 }, { width: 11 }, { width: 62 }, { width: 34 }, { width: 34 }];
  ws.addRow(["LH 공공임대 법규검토"]);
  ws.mergeCells("A1:E1");
  ws.getCell("A1").font = { ...BASE_FONT, size: 14, bold: true, color: { argb: "FF1F3A68" } };
  ws.addRow([body.projectName || body.address]);
  ws.mergeCells("A2:E2");
  ws.getCell("A2").font = { ...BASE_FONT, size: 18, bold: true, color: { argb: "FF1F3A68" } };
  ws.getRow(2).height = 30;
  const header = ws.addRow(["구분", "", "내용", "관련 법령", "비고"]);
  ws.mergeCells(header.number, 1, header.number, 2);
  header.height = 20;
  header.eachCell((cell) => {
    cell.font = { ...BASE_FONT, bold: true, color: { argb: "FFFFFFFF" } };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } };
    cell.alignment = { horizontal: "center", vertical: "middle" };
    cell.border = ALL_BORDERS;
  });

  const rows = (body.rows ?? []).filter((r) => r.content.trim() || r.status !== "missing");
  let i = 0;
  while (i < rows.length) {
    const group = rows[i].group;
    let j = i;
    while (j < rows.length && rows[j].group === group && rows[j].sub) j++;
    const block = j > i ? rows.slice(i, j) : [rows[i]];
    const start = ws.rowCount + 1;
    for (const row of block) {
      const content = row.content || (row.missing ? `[근거 누락] ${row.missing}` : "");
      const note = [row.note, row.status === "candidate" ? "※ 후보·조건부 (원문 대조 필요)" : row.status === "missing" ? "※ 근거 누락" : ""].filter(Boolean).join("\n");
      const r = ws.addRow([row.group, row.sub ?? "", "", row.law, ""]);
      r.getCell(3).value = rich(content);
      r.getCell(5).value = rich(note);
      r.height = Math.max(22, 14 * Math.max(lineCount(content, 62), lineCount(row.law, 34), lineCount(note, 34)) + 6);
      r.eachCell({ includeEmpty: true }, (cell, col) => {
        cell.border = ALL_BORDERS;
        cell.alignment = { vertical: "middle", horizontal: col <= 2 ? "center" : "left", wrapText: true };
        if (col <= 2) {
          cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_FILL } };
          cell.font = { ...BASE_FONT, bold: true };
        } else if (col === 4) cell.font = BASE_FONT;
      });
      if (!row.sub) ws.mergeCells(r.number, 1, r.number, 2);
    }
    if (block.length > 1 || block[0].sub) {
      const end = start + block.length - 1;
      if (end > start) ws.mergeCells(start, 1, end, 1);
    }
    i = j > i ? j : i + 1;
  }

  // 근거 목록 시트
  const src = wb.addWorksheet("근거 목록");
  src.columns = [{ width: 18 }, { width: 12 }, { width: 46 }, { width: 14 }, { width: 60 }];
  const h = src.addRow(["구분", "상태", "근거 (법령·조항·별표·고시)", "시행일", "원문 링크"]);
  h.eachCell((c) => { c.font = { ...BASE_FONT, bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; c.border = ALL_BORDERS; });
  for (const row of body.rows ?? []) {
    const label = row.sub ? `${row.group} · ${row.sub}` : row.group;
    if (!row.sources.length) {
      const r = src.addRow([label, STATUS_LABEL[row.status], row.missing ? "누락: " + row.missing : "-", "", ""]);
      r.eachCell((c) => { c.border = ALL_BORDERS; c.font = BASE_FONT; c.alignment = { wrapText: true, vertical: "top" }; });
      continue;
    }
    for (const s of row.sources) {
      const r = src.addRow([label, STATUS_LABEL[row.status], citeLine(s), s.effectiveDate ?? "", s.url ? { text: s.url, hyperlink: s.url } : ""]);
      r.eachCell((c) => { c.border = ALL_BORDERS; c.font = BASE_FONT; c.alignment = { wrapText: true, vertical: "top" }; });
      r.getCell(5).font = { ...BASE_FONT, color: { argb: "FF1F5FBF" }, underline: true };
    }
  }
}

function summarySheet(wb: ExcelJS.Workbook, body: ExportBody) {
  const scenarios = body.scenarios ?? [];
  const ws = wb.addWorksheet("건축개요", { pageSetup: { paperSize: 9, orientation: "portrait", fitToPage: true, fitToWidth: 1, fitToHeight: 0 } });
  ws.columns = [{ width: 20 }, ...scenarios.map(() => ({ width: 34 }))];
  ws.addRow(["건축개요 (개략 검토)"]);
  ws.mergeCells(1, 1, 1, Math.max(2, scenarios.length + 1));
  ws.getCell("A1").font = { ...BASE_FONT, size: 16, bold: true, color: { argb: "FF1F3A68" } };
  ws.addRow([`${body.projectName} · ${body.address}`]);
  ws.mergeCells(2, 1, 2, Math.max(2, scenarios.length + 1));
  const header = ws.addRow(["구분", ...scenarios.map((s) => `${s.name}\n[${s.feasibility}]`)]);
  header.height = 34;
  header.eachCell((c) => { c.font = { ...BASE_FONT, bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; c.alignment = { horizontal: "center", vertical: "middle", wrapText: true }; c.border = ALL_BORDERS; });
  const labels = scenarios[0]?.summary.map(([k]) => k) ?? [];
  labels.forEach((label, idx) => {
    const r = ws.addRow([label, ...scenarios.map((s) => s.summary[idx]?.[1] ?? "")]);
    r.eachCell({ includeEmpty: true }, (c, col) => {
      c.border = ALL_BORDERS;
      c.font = col === 1 ? { ...BASE_FONT, bold: true } : BASE_FONT;
      c.alignment = { horizontal: col === 1 ? "center" : "left", vertical: "middle", wrapText: true };
      if (col === 1) c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: GROUP_FILL } };
    });
    r.height = 20;
  });
  const foot = ws.addRow(["※ 설계도서 이전 개략 검토값입니다. 계산식은 '산식' 시트 참조."]);
  ws.mergeCells(foot.number, 1, foot.number, Math.max(2, scenarios.length + 1));
  foot.getCell(1).font = { ...BASE_FONT, italic: true, color: { argb: "FF666666" } };

  const types = wb.addWorksheet("타입별 세대수");
  types.columns = [{ width: 30 }, { width: 12 }, { width: 14 }, { width: 10 }, { width: 18 }, { width: 16 }];
  const th = types.addRow(["대안", "타입", "전용면적(㎡)", "세대(호)", "공급/지상면적(㎡)", "계약면적(㎡)"]);
  th.eachCell((c) => { c.font = { ...BASE_FONT, bold: true, color: { argb: "FFFFFFFF" } }; c.fill = { type: "pattern", pattern: "solid", fgColor: { argb: NAVY } }; c.border = ALL_BORDERS; });
  for (const s of scenarios) for (const t of s.types) {
    const r = types.addRow([s.name, t.name, t.exclusive, t.count, t.supplyArea, t.contractArea]);
    r.eachCell((c) => { c.border = ALL_BORDERS; c.font = BASE_FONT; });
    [3, 5, 6].forEach((n) => { r.getCell(n).numFmt = "#,##0.00"; });
  }

  const f = wb.addWorksheet("산식");
  f.columns = [{ width: 30 }, { width: 120 }];
  for (const s of scenarios) {
    const t = f.addRow([s.name]);
    t.font = { ...BASE_FONT, bold: true, color: { argb: "FF1F3A68" } };
    s.formulas.forEach((line) => f.addRow(["", line]).eachCell((c) => { c.font = BASE_FONT; }));
    s.notes.forEach((line) => f.addRow(["검토사항", line]).eachCell((c) => { c.font = { ...BASE_FONT, color: { argb: "FFB04500" } }; }));
    f.addRow([]);
  }
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as ExportBody | null;
  if (!body || (body.kind !== "legal" && body.kind !== "summary")) return NextResponse.json({ error: "출력 종류(kind)가 필요합니다." }, { status: 400 });
  if (body.kind === "legal" && !Array.isArray(body.rows)) return NextResponse.json({ error: "법규검토표 행이 필요합니다." }, { status: 400 });
  if (body.kind === "summary" && (!Array.isArray(body.scenarios) || body.scenarios.length === 0)) return NextResponse.json({ error: "건축개요 대안이 필요합니다." }, { status: 400 });
  const wb = new ExcelJS.Workbook();
  wb.creator = "LH Plan Lab";
  wb.created = new Date();
  if (body.kind === "legal") legalSheet(wb, body);
  else summarySheet(wb, body);
  const buffer = await wb.xlsx.writeBuffer();
  const name = `${body.kind === "legal" ? "법규검토표" : "건축개요표"}_${(body.projectName || "project").replace(/[\\/:*?"<>|]/g, "_")}.xlsx`;
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(name)}`,
      "Cache-Control": "no-store",
    },
  });
}
