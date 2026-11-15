import { describe, it, expect } from "vitest";
import { matchLibrary, osong1BlockOf, autoBlockOf } from "../lib/review/library";

const addr = (lot: string) => `충청북도 청주시 흥덕구 오송읍 만수리 ${lot}`;

describe("오송생명과학단지(오송1산단) 지구단위계획", () => {
  it("결정조서 지번으로 상업4 가구 ⑤ 획지를 찾는다", () => {
    for (const n of ["866", "867", "869", "870"]) expect(osong1BlockOf(addr(n))).toBe("상업4-5");
    expect(osong1BlockOf(addr("868"))).toBe("");
    expect(osong1BlockOf(addr("866-1"))).toBe("");
    expect(autoBlockOf(addr("866"))).toBe("상업4-5");
  });

  it("만수리는 오송바이오폴리스가 아닌 오송1산단 기준을 적용한다", () => {
    const ctx = { address: addr("866"), zones: ["일반상업지역"], districtPlan: true, blockNo: "" };
    const ids = matchLibrary(ctx).map((e) => e.id);
    expect(ids).toContain("osong1-life-science");
    expect(ids).not.toContain("osong-biopolis");
    const rows = matchLibrary(ctx).find((e) => e.id === "osong1-life-science")!.rows(ctx);
    const use = rows.find((r) => r.id === "plan.use")!;
    expect(use.params).toMatchObject({ useApartment: "prohibited", useUrban: "prohibited", useOfficetel: "allowed" });
    expect(rows.find((r) => r.id === "plan.bcrfar")!.params).toMatchObject({ bcr: 80, far: 1300 });
    expect(rows.find((r) => r.id === "plan.district")!.content).toContain("513.7");
  });

  it("봉산리 등 다른 오송읍 지번은 기존 바이오폴리스 항목을 유지한다", () => {
    const ctx = { address: "충청북도 청주시 흥덕구 오송읍 봉산리 100", zones: ["일반상업지역"], districtPlan: true, blockNo: "" };
    expect(matchLibrary(ctx).map((e) => e.id)).toContain("osong-biopolis");
  });
});
