import { describe, it, expect } from "vitest";
import { parseParcelList } from "../lib/parcel-list";

const base = "충청북도 청주시 흥덕구 오송읍 만수리 866";
describe("합필 필지 입력", () => {
  it("번지만 적으면 대표 필지의 리를 붙인다", () => {
    expect(parseParcelList("867, 869번지, 870", base)).toEqual([
      "충청북도 청주시 흥덕구 오송읍 만수리 867",
      "충청북도 청주시 흥덕구 오송읍 만수리 869",
      "충청북도 청주시 흥덕구 오송읍 만수리 870",
    ]);
  });
  it("대표 필지·중복 제거, 전체 주소는 그대로", () => {
    expect(parseParcelList("866\n867\n867\n충청북도 청주시 흥덕구 오송읍 연제리 832\n12-3", base)).toEqual([
      "충청북도 청주시 흥덕구 오송읍 만수리 867",
      "충청북도 청주시 흥덕구 오송읍 연제리 832",
      "충청북도 청주시 흥덕구 오송읍 만수리 12-3",
    ]);
  });
});
