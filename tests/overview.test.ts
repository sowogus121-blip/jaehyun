import { describe, expect, it } from "vitest";
import ExcelJS from "exceljs";
import { POST } from "../app/api/export/overview/route";
import { buildDetailedOverview } from "../lib/report/detailed-overview";
import { newProject } from "../lib/project/store";
import { defaultScenario, runScenario, DEFAULT_ASSUMPTIONS } from "../lib/massing/engine";
import type { ResolvedParams } from "../lib/review/params";

describe("상세 개요표 (실무 양식)", () => {
  const project = newProject({ address: "서울특별시 금천구 독산동 151-10", uses: ["officetel"] });
  const params = {
    siteArea: { key: "siteArea", value: 1093.6, rowId: "site.area", status: "verified", label: "" },
    bcr: { key: "bcr", value: 60, rowId: "plan.bcrfar", status: "verified", label: "" },
    far: { key: "far", value: 250, rowId: "plan.bcrfar", status: "verified", label: "" },
    parkingOfficetel: { key: "parkingOfficetel", value: 0.5, rowId: "park.officetel", status: "verified", label: "" },
    useOfficetel: { key: "useOfficetel", value: "allowed", rowId: "plan.use", status: "verified", label: "" },
  } as unknown as ResolvedParams;
  const result = runScenario({ params, scenario: defaultScenario("officetel", "s1", { name: "오피스텔 기본" }), assumptions: DEFAULT_ASSUMPTIONS, site: project.site });

  it("층별 면적 합계가 지상 연면적과 맞는다", () => {
    const sheet = buildDetailedOverview(project, result);
    expect(sheet.cells["C25"]).toBeCloseTo(result.aboveGroundArea, 1);
    expect(Number(sheet.cells["Y30"])).toBeCloseTo(result.aboveGroundArea, 0);
    expect(sheet.cells["AA30"]).toBe(result.units);
    expect(sheet.cells["L29"]).toBe("지상1층");
  });

  it("템플릿 양식(병합 포함)을 유지한 채 대안마다 시트를 만든다", async () => {
    const sheets = [buildDetailedOverview(project, result), { ...buildDetailedOverview(project, result), name: "오피스텔 400" }];
    const res = await POST(new Request("http://x/api/export/overview", { method: "POST", body: JSON.stringify({ sheets }) }) as never);
    expect(res.status).toBe(200);
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.load(await res.arrayBuffer());
    expect(wb.worksheets.map((w) => w.name)).toEqual(["오피스텔 기본", "오피스텔 400"]);
    const ws = wb.worksheets[0];
    expect(String(ws.getCell("B5").value)).toContain("공 사 명");
    expect(ws.getCell("C7").value).toBe("서울특별시 금천구 독산동 151-10");
    expect((ws.model as unknown as { merges: string[] }).merges.length).toBeGreaterThan(50);
  });
});
