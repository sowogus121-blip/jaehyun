import type { SiteReviewResult } from "./types";
import { getOrdinanceZoneStandards } from "./legal-review-report";

export const MAX_ASSEMBLY_PARCELS = 20;
export const MAX_EXTRA_PARCELS = MAX_ASSEMBLY_PARCELS - 1;

/** One address per row; commas and + also work for bulk pasting lot numbers. */
export function splitAssemblyAddresses(value: string): string[] {
  return value.split(/[\r\n,+]+/).map(s=>s.trim()).filter(Boolean);
}

export function normalizeAssemblyAddresses(primary: string, raw: string[]): string[] {
  const parts=primary.trim().split(/\s+/).filter(Boolean);
  // Gyeongnam Changwon-si Seongsan-gu Ga-eum-dong: preserve the borough too.
  const borough=parts[1]?.endsWith("시") && parts[2]?.endsWith("구");
  const region=parts.slice(0,borough?3:2).join(" ");
  const dong=parts[borough?3:2]??"";
  const seen=new Set([primary.replace(/\s+/g,"").trim()]);
  return raw.flatMap(splitAssemblyAddresses).map(x=>{
    if(/^\d+(?:-\d+)?$/.test(x) && dong)return region+" "+dong+" "+x;
    // "가능동 72-5", "동대신동1가 10-2", etc.
    if(/^[^\s]+\s+\d+(?:-\d+)?$/.test(x) && region)return region+" "+x;
    // A local district + neighborhood but missing only the province.
    if(/^(?:[^\s]+(?:시|군|구))\s+[^\s]+\s+\d+(?:-\d+)?$/.test(x) && parts[0])
      return parts[0]+" "+x;
    return x;
  }).filter(x=>{const key=x.replace(/\s+/g,"");if(seen.has(key))return false;seen.add(key);return true;});
}
export interface AssemblyParcel {
  number:number;address:string;area:number|null;zone:string|null;pnu:string|null;
  landCategory:string|null;source:string|null;bcr:number|null;far:number|null;errors:string[];
}
export interface AssemblyStudy {
  status:"single"|"ready"|"incomplete"|"mixed"|"duplicate";
  isMultiple:boolean;parcelCount:number;parcels:AssemblyParcel[];
  totalArea:number|null;sameZone:boolean;ordinary:{bcr:number;far:number}|null;
  weightedCandidate:{bcr:number;far:number;farArea:number;bcrArea:number;smallestZoneArea:number;eligibleForStatutoryThreshold:boolean}|null;
  canPreviewWeighted:boolean;notes:string[];
}
const round=(n:number)=>Math.round(n*100)/100;
/** One hypothetical merged site is not proof of lawful cadastral merger.
 * National Land Planning Act Art. 84 / Enforcement Decree Art. 94:
 * 330sqm generally, 660sqm if a qualifying commercial road strip; do not assume the exception.
 */
export function assessParcelAssembly(review: SiteReviewResult | null):AssemblyStudy|null {
  if(!review?.parcels.length)return null;
  const source=review.parcels;
  const seenPnus=new Set<string>();
  let duplicate=false;
  const parcels:AssemblyParcel[]=source.map((row,index)=>{
    const pnu=row.parcel?.pnu||null;
    if(pnu){if(seenPnus.has(pnu))duplicate=true;seenPnus.add(pnu);}
    const zs=[...new Set(row.landUse.filter(v=>v.category==="용도지역").map(v=>v.name))];
    const zone=zs.length===1?zs[0]:null;
    const limits=zone?getOrdinanceZoneStandards(review,zone):null;
    return {number:index+1,address:row.location?.parcelAddress||row.inputAddress,
      area:row.parcel?.area??null,zone:zs.length>1?zs.join(" / ")+" (필지 내 혼합)":zone,
      pnu,landCategory:row.parcel?.landCategory||null,source:row.parcel?.source||null,
      bcr:limits?.bcr??null,far:limits?.far??null,errors:row.errors||[]};
  });
  const isMultiple=source.length>1;
  const allAreas=parcels.every(p=>p.area!==null&&p.area>0);
  const allZones=source.every(p=>[...new Set(p.landUse.filter(l=>l.category==="용도지역").map(x=>x.name))].length===1);
  const sameZone=allZones && new Set(parcels.map(p=>p.zone)).size===1;
  const rawTotal=allAreas&&!duplicate?round(parcels.reduce((sum,p)=>sum+(p.area||0),0)):null;
  const serverTotal=review.parcel?.area??null;
  const consistent=rawTotal!==null&&serverTotal!==null&&Math.abs(rawTotal-serverTotal)<0.2;
  const allRatio=parcels.every(p=>p.bcr!==null&&p.far!==null);
  const ordinary=sameZone&&allRatio?{bcr:parcels[0].bcr!,far:parcels[0].far!}:null;
  let weightedCandidate:AssemblyStudy["weightedCandidate"]=null;
  if(isMultiple&&!sameZone&&allAreas&&allZones&&allRatio&&consistent&&!duplicate) {
    const map=new Map<string,{area:number;bcr:number;far:number}>();
    for(const p of parcels) {
      const old=map.get(p.zone!);
      if(old)old.area+=p.area!;
      else map.set(p.zone!,{area:p.area!,bcr:p.bcr!,far:p.far!});
    }
    const groups=[...map.values()];
    const smallestZoneArea=Math.min(...groups.map(g=>g.area));
    const greenGroups=[...map.entries()].filter(([zone])=>zone.includes("녹지지역"));
    // Art.84(3): the special exception applies if the smallest portion itself is green
    // and its area is within the statutory threshold. Other mixed-green cases
    // must not silently use a weighted whole-site FAR.
    const greenPermitted=greenGroups.length===0 || (greenGroups.length===1 &&
      greenGroups[0][1].area===smallestZoneArea && smallestZoneArea<=330);
    weightedCandidate={
      bcr:round(groups.reduce((sum,g)=>sum+g.area*g.bcr,0)/rawTotal!),
      far:round(groups.reduce((sum,g)=>sum+g.area*g.far,0)/rawTotal!),
      bcrArea:round(groups.reduce((sum,g)=>sum+g.area*g.bcr/100,0)),
      farArea:round(groups.reduce((sum,g)=>sum+g.area*g.far/100,0)),
      smallestZoneArea:round(smallestZoneArea),
      eligibleForStatutoryThreshold:smallestZoneArea<=330 && greenPermitted,
    };
  }
  const incomplete=source.some(p=>p.errors.length>0)||!consistent||!allZones;
  const status:AssemblyStudy["status"]=!isMultiple?"single":duplicate?"duplicate":incomplete?"incomplete":sameZone?"ready":"mixed";
  const notes=[
    "가상 합필 시뮬레이션이야. 필지 인접성, 소유권, 지목, 경계, 도로·건축선, 건축법상 1대지 인정 및 지적 합필 가능성은 별도로 확인해야 해.",
    "건축법 시행령 제3조에 따른 둘 이상 필지의 하나의 대지 인정 요건과 사용승인 전 합필 조건 등을 확인해야 해.",
  ];
  if(duplicate)notes.push("동일 PNU가 중복 조회돼 합계를 만들지 않았어.");
  if(incomplete)notes.push("일부 필지의 면적·용도지역 또는 합산 확인이 불완전해 통합 규모계산을 보류했어.");
  for(const p of parcels) if(p.errors.length)notes.push(`${p.address}: ${p.errors.join(" / ")}`);
  if(isMultiple&&!sameZone)notes.push("혼합 용도지역은 국토계획법 제84조와 시행령 제94조 검토가 필요해. 항상 가중평균 가능한 것은 아니야.");
  if(weightedCandidate&&!weightedCandidate.eligibleForStatutoryThreshold)
    notes.push("일반적인 330㎡ 면적요건 또는 녹지지역 예외 요건이 충족되지 않아 구역별 용도규정 검토가 필요해.");
  if(weightedCandidate?.eligibleForStatutoryThreshold)
    notes.push("가중 수치는 면적별 산술 참고치야. 허가권자의 경계·지구단위·조례·330㎡ 요건 검증 전에는 법적 상한이 아니야.");
  return {status,isMultiple,parcelCount:parcels.length,parcels,totalArea:consistent?rawTotal:null,
    sameZone,ordinary,weightedCandidate,canPreviewWeighted:Boolean(weightedCandidate?.eligibleForStatutoryThreshold),notes};
}
