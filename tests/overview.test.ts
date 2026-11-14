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

import { resolveHighlights } from "../lib/report/format";
describe("형광펜 문장 단위", () => {
  it("짧은 낱말은 대상지 용도지역 문장 하나로만 칠한다", () => {
    const t = "제44조(건폐율) ① 다음과 같다.\n1. 제1종전용주거지역: 50퍼센트\n3. 제1종일반주거지역: 60퍼센트\n10. 준공업지역: 60퍼센트\n11. 보전녹지지역: 20퍼센트";
    const hs = resolveHighlights(t, ["60퍼센트"], ["준공업지역"]);
    expect(hs).toHaveLength(1);
    expect(hs[0]).toContain("준공업지역");
  });
  it("다른 용도지역만 언급한 문장은 칠하지 않는다", () => {
    expect(resolveHighlights("2. 자연경관지구 안에서 건폐율은 40퍼센트 이하로 한다.\n3. 자연녹지지역: 20퍼센트", ["20퍼센트"], ["준공업지역"])).toEqual([]);
  });
});
describe("형광펜 관련성", () => {
  it("대상지와 무관한 지구·타 용도·조 제목만 있는 문장은 제외", () => {
    const t = "제45조(그 밖의 건폐율)\n1. 취락지구: 60퍼센트\n2. 공원시설: 20퍼센트\n3. 판매시설 시설면적 134㎡당 1대\n4. 공동주택 건폐율은 60퍼센트 이하로 한다.";
    expect(resolveHighlights(t, ["제45조(그 밖의 건폐율)", "60퍼센트", "20퍼센트", "134㎡당"], ["준공업지역"])).toEqual(["4. 공동주택 건폐율은 60퍼센트 이하로 한다."]);
  });
});
