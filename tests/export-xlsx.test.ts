import { describe,expect,it } from "vitest";
import ExcelJS from "exceljs";
import { NextRequest } from "next/server";
import { POST } from "../app/api/export/xlsx/route";
import { EXAMPLE_INPUT,calculateAll } from "../lib/calculator";

describe("XLSX export formula audit",()=>{
  it("references the actual land-area row and retains commercial/residential gross areas",async()=>{
    const input={...EXAMPLE_INPUT,commercialMixShare:20,baseFar:600,maxFloors:25,maxHeight:100};
    const result=await POST(new NextRequest("http://localhost/api/export/xlsx",{
      method:"POST",headers:{"content-type":"application/json"},
      body:JSON.stringify({input,results:calculateAll(input),reviewData:null,lookupDetails:null,reviewedRules:[]}),
    }));
    expect(result.status).toBe(200);
    const workbook=new ExcelJS.Workbook();
    await workbook.xlsx.load(Buffer.from(await result.arrayBuffer()));
    const inputSheet=workbook.getWorksheet("입력값")!;
    const areaRow=inputSheet.getColumn(1).values.findIndex(x=>x==="대지면적");
    expect(areaRow).toBeGreaterThan(3);
    expect(Number(inputSheet.getCell(areaRow,2).value)).toBe(input.siteArea);
    const comparison=workbook.getWorksheet("4개 대안 비교")!;
    expect((comparison.getCell("G2").value as ExcelJS.CellFormulaValue).formula)
      .toContain("$B$"+areaRow);
    expect((comparison.getCell("H2").value as ExcelJS.CellFormulaValue).formula)
      .toContain("$B$"+areaRow);
    expect(comparison.getCell("N2").value).toBeGreaterThan(0);
    expect(comparison.getCell("O2").value).toBeGreaterThan(0);
    expect(comparison.getCell("F2").value).toBeCloseTo(
      Number(comparison.getCell("N2").value)+Number(comparison.getCell("O2").value),1
    );
  });
});
