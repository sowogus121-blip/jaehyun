import { describe, expect, it } from "vitest";
import { getParcelMechanicalReview } from "./parcel-mechanical-parking-review";

describe("2026 mechanical parking source and LH acceptance gates", () => {
  it("requires 30+ actual machine stalls in Cheongju instead of a universal 50% cap",()=>{
    const r=getParcelMechanicalReview("충청북도 청주시 흥덕구 오송읍 봉산리 992");
    expect(r?.id).toBe("osong");
    expect(r?.ordinanceGate).toBe("allowed-conditionally");
    expect(r?.lhGate).toBe("blocked-by-use");
    expect(r?.ordinanceRule).toContain("30대 이상");
    expect(r?.ordinanceRule).toContain("비율 제한 삭제");
    expect(r?.mechanicalScenarios[0].verdict).toContain("설치 불가");
    expect(r?.sourceRecords.some(s=>s.id==="cheongju-parking-annex7")).toBe(true);
  });
  it("does not claim 7th LH approval or automatically use the prior 6th 500m/50% rule",()=>{
    const r=getParcelMechanicalReview("서울특별시 금천구 독산동 151-10");
    expect(r?.id).toBe("doksan");
    expect(r?.lhGate).toBe("unverified");
    expect(r?.ordinanceRule).toContain("단순 2단식");
    expect(r?.lhRule).toContain("7차");
    expect(r?.lhRule).toContain("입증되지");
    const sc=r!.mechanicalScenarios;
    expect(sc.map(x=>x.assumedTotal)).toEqual([40,44,27]);
    expect(sc.map(x=>x.illustrativeHalfMechanical)).toEqual([20,22,13]);
    expect(sc.map(x=>x.illustrativeHalfSelf)).toEqual([20,22,14]);
    expect(r?.sourceRecords.find(x=>x.id==="lh-seoul-2026-7-zip")?.verification).toBe("download-linked-unread");
    expect(r?.sourceRecords.some(x=>x.id==="seoul-rule-art7")).toBe(true);
  });
  it("includes the 2026 national safety and inspection annexes but only for the exact known parcels",()=>{
    const r=getParcelMechanicalReview("서울 금천구 독산동 151-10")!;
    for(const annex of ["device-2026-160-annex1","device-2026-160-annex2","device-2026-160-annex2-2","device-2026-160-annex3","device-2026-160-annex4"]){
      expect(r.sourceRecords.some(s=>s.id===annex)).toBe(true);
    }
    expect(getParcelMechanicalReview("서울 금천구 독산동 151-11")).toBeNull();
    expect(getParcelMechanicalReview("충북 청주시 오송읍 봉산리 993")).toBeNull();
  });
});
