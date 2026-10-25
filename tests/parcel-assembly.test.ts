import { describe, expect, it } from "vitest";
import type { SiteReviewResult } from "../lib/types";
import { assessParcelAssembly, normalizeAssemblyAddresses, splitAssemblyAddresses, MAX_EXTRA_PARCELS } from "../lib/parcel-assembly";

const ref=(area:number|null,zone:string,pnu:string,name:string)=>{
  return {inputAddress:name,location:{address:name,parcelAddress:name,x:"127.05",y:"37.75"},
    parcel:area?{area,landCategory:"대",pnu,source:"VWorld 지적",approximate:false}:null,
    landUse:zone?[{category:"용도지역",name:zone,code:"LT_C_UQ111",source:"VWorld",status:"verified"}]:[],
    errors:[]};
};
const zone2="제2종일반주거지역",zone3="제3종일반주거지역";
const ordinances=[
 {sourceTitle:"의정부시 도시계획 조례",sourceUrl:"https://www.law.go.kr/LSW/main.html",
  topic:"건폐율",article:"제42조 · 용도지역안에서의 건폐율",excerpt:"제2종일반주거지역:60퍼센트 제3종일반주거지역:50퍼센트 자연녹지지역:20퍼센트",verified:false},
 {sourceTitle:"의정부시 도시계획 조례",sourceUrl:"https://www.law.go.kr/LSW/main.html",
  topic:"용적률",article:"제46조 · 용도지역안에서의 용적률",excerpt:"제2종일반주거지역:250퍼센트 제3종일반주거지역:300퍼센트 자연녹지지역:100퍼센트",verified:false}
];
const study=(rows:ReturnType<typeof ref>[],area:number|null):SiteReviewResult=>
 ({parcels:rows,parcel:area?{area,landCategory:"대",pnu:null,source:"합계",approximate:false}:null,
  ordinanceArticleCandidates:ordinances,mixedUseZones:new Set(rows.map(x=>x.landUse[0]?.name)).size>1,
  landUse:rows.flatMap(x=>x.landUse),laws:[],ordinances:[]}) as unknown as SiteReviewResult;

describe("hypothetical merged-lot feasibility",()=>{
  it("normalizes same-neighborhood shorthand and never duplicates the representative parcel",()=>{
    expect(normalizeAssemblyAddresses("경기도 의정부시 가능동 75-1",
      ["가능동 72-5","75-2","경기도 의정부시 가능동 75-1","가능동 72-5"]))
      .toEqual(["경기도 의정부시 가능동 72-5","경기도 의정부시 가능동 75-2"]);
  });
  it("sums known areas and keeps a single zone's legally sourced ordinary limits",()=>{
    const result=assessParcelAssembly(study([
      ref(1467,zone2,"4115011000100750001","가능동 75-1"),
      ref(628,zone2,"4115011000100720005","가능동 72-5")
    ],2095));
    expect(result?.status).toBe("ready");
    expect(result?.totalArea).toBe(2095);
    expect(result?.ordinary).toEqual({bcr:60,far:250});
    expect(result?.weightedCandidate).toBeNull();
  });
  it("computes mixed-zone weighted reference without making it a confirmed zoning right",()=>{
    const result=assessParcelAssembly(study([
      ref(1467,zone2,"pnu1","첫째"),
      ref(200,zone3,"pnu2","둘째")
    ],1667));
    expect(result?.status).toBe("mixed");
    expect(result?.ordinary).toBeNull();
    expect(result?.weightedCandidate?.smallestZoneArea).toBe(200);
    expect(result?.weightedCandidate?.farArea).toBe(4267.5);
    expect(result?.canPreviewWeighted).toBe(true);
    expect(result?.notes.some(n=>n.includes("가중평균")||n.includes("법적"))).toBe(true);
  });
  it("does not offer national Article 84 weighted shortcut when minor zone exceeds 330sqm",()=>{
    const result=assessParcelAssembly(study([
      ref(1467,zone2,"one","첫째"),
      ref(400,zone3,"two","둘째")
    ],1867));
    expect(result?.weightedCandidate?.smallestZoneArea).toBe(400);
    expect(result?.canPreviewWeighted).toBe(false);
  });
  it("blocks area aggregation for duplicate PNU, missing area or inconsistent API totals",()=>{
    const one=ref(100,zone2,"same","가");
    expect(assessParcelAssembly(study([one,{...ref(200,zone2,"same","나")}],300))?.totalArea).toBeNull();
    expect(assessParcelAssembly(study([one,ref(null,zone2,"other","나")],100))?.totalArea).toBeNull();
    expect(assessParcelAssembly(study([one,ref(200,zone2,"other","나")],280))?.totalArea).toBeNull();
  });

  it("supports 19 extra addresses and bulk separators without silently dropping parcels",()=>{
    const bulk=Array.from({length:MAX_EXTRA_PARCELS},(_,i)=>"가능동 "+(80+i)+"-1").join(" + ");
    expect(splitAssemblyAddresses(bulk)).toHaveLength(19);
    const normalized=normalizeAssemblyAddresses("경기도 의정부시 가능동 75-1",[bulk]);
    expect(normalized).toHaveLength(19);
    expect(normalized[0]).toBe("경기도 의정부시 가능동 80-1");
    expect(normalized[18]).toBe("경기도 의정부시 가능동 98-1");
    expect(normalizeAssemblyAddresses("경기도 의정부시 가능동 75-1",[bulk,"99-1"])).toHaveLength(20);
  });
  it("expands nested city-and-borough shorthand for Changwon and Suwon",()=>{
    expect(normalizeAssemblyAddresses("경상남도 창원시 성산구 가음동 1-1",["가음동 1-2","2-1"]))
      .toEqual(["경상남도 창원시 성산구 가음동 1-2","경상남도 창원시 성산구 가음동 2-1"]);
    expect(normalizeAssemblyAddresses("부산광역시 서구 동대신동1가 10-1",["동대신동1가 10-2"]))
      .toEqual(["부산광역시 서구 동대신동1가 10-2"]);
  });
  it("screens green-area Article 84 exception only when green is the smallest <=330sqm part",()=>{
    const z="자연녹지지역";
    const minorGreen=assessParcelAssembly(study([ref(1467,zone2,"p1","주거"),ref(200,z,"p2","소규모녹지")],1667));
    expect(minorGreen?.weightedCandidate?.eligibleForStatutoryThreshold).toBe(true);
    const majorGreen=assessParcelAssembly(study([ref(200,zone2,"p3","소규모주거"),ref(1467,z,"p4","큰녹지")],1667));
    expect(majorGreen?.weightedCandidate?.eligibleForStatutoryThreshold).toBe(false);
  });
  it("rejects zone-weighting when one original lot spans more than one zoning area",()=>{
    const mixed=ref(1300,zone2,"x","대지");
    mixed.landUse.push({category:"용도지역",name:zone3,code:"LT_C_UQ111",source:"VWorld",status:"verified"});
    const result=assessParcelAssembly(study([mixed,ref(200,zone3,"y","대지2")],1500));
    expect(result?.totalArea).toBe(1500);
    expect(result?.ordinary).toBeNull();
    expect(result?.weightedCandidate).toBeNull();
    expect(result?.canPreviewWeighted).toBe(false);
  });
});
