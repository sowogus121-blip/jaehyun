import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import { OVERVIEW_TEMPLATE_BASE64 } from "../../../../lib/templates/overview-template";
import type { OverviewSheet } from "../../../../lib/report/detailed-overview";

export const runtime = "nodejs";

/** 상세 개요표: 실무 양식 템플릿에 대안별 값을 채워 대안마다 한 시트로 내려준다. */
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as { sheets?: OverviewSheet[] } | null;
  const sheets = (body?.sheets ?? []).slice(0, 12);
  if (!sheets.length) return NextResponse.json({ error: "출력할 대안이 없습니다." }, { status: 400 });
  try {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(Buffer.from(OVERVIEW_TEMPLATE_BASE64, "base64") as unknown as ArrayBuffer);
    const template = wb.worksheets[0];
    const used = new Set<string>();
    sheets.forEach((sheet, i) => {
      let name = sheet.name || `대안${i + 1}`;
      while (used.has(name)) name = name.slice(0, 26) + "_" + (i + 1);
      used.add(name);
      const ws = wb.addWorksheet(name);
      // 양식 복사: 열 너비·행 높이·병합·서식·인쇄영역 (exceljs: getter는 merges, setter는 mergeCells)
      const model = template.model as unknown as Record<string, unknown>;
      ws.model = { ...model, mergeCells: model.merges, name } as unknown as typeof ws.model;
      ws.name = name;
      ws.pageSetup = { ...template.pageSetup, printArea: "B2:AB71" };
      for (const [addr, value] of Object.entries(sheet.cells)) {
        const cell = ws.getCell(addr);
        cell.value = value === null ? null : value;
      }
    });
    wb.removeWorksheet(template.id);
    wb.calcProperties = { fullCalcOnLoad: true };
    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer as ArrayBuffer, {
      headers: { "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Content-Disposition": "attachment; filename=overview.xlsx" },
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "개요표 생성 실패" }, { status: 500 });
  }
}
