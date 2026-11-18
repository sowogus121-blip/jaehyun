import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { findParcelBlock, findBuildingRule, buildingTableUnchanged } from "../lib/review/gosi-decision";
import { placeLotOf } from "../lib/review/plan-decision";

const fx = (n: string) => readFileSync(join(__dirname, "fixtures", n), "utf8");

describe("결정고시 가구·획지·건축물 결정 추출", () => {
  const g2018 = fx("osong-2018-698-excerpt.txt");
  const g2024 = fx("osong-2024-948-p53-55.txt");
  it("2018-698: 만수리 866 → 상업4 가구5 획지1, C1 80%/1,000%", () => {
    expect(findParcelBlock(g2018, "만수리", "866")).toMatchObject({ label: "상업4", block: "5", lot: "1", area: 513.7 });
    expect(findBuildingRule(g2018, "상업4")).toMatchObject({ use: "C1", bcr: 80, far: 1000 });
    expect(findBuildingRule(g2018, "상업1")).toMatchObject({ use: "C2", bcr: 80, far: 800 });
    expect(buildingTableUnchanged(g2018)).toBe(false);
  });
  it("2024-948(기정·변경 열): 지번은 찾고 건축물 결정조서는 변경없음", () => {
    expect(findParcelBlock(g2024, "만수리", "870")).toMatchObject({ label: "상업4", block: "5", lot: "4", area: 514.6 });
    expect(findParcelBlock(g2024, "만수리", "868")).toBeNull();
    expect(findBuildingRule(g2024, "상업4")).toBeNull();
    expect(buildingTableUnchanged(g2024)).toBe(true);
  });
  it("주소에서 리·지번", () => {
    expect(placeLotOf("충청북도 청주시 흥덕구 오송읍 만수리 866")).toEqual({ place: "만수리", lot: "866" });
    expect(placeLotOf("서울특별시 노원구 상계동 1268")).toEqual({ place: "상계동", lot: "1268" });
  });
});
