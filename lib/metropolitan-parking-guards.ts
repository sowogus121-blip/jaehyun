import type { SiteReviewResult, ProjectInput } from "./types";
import { findLhPurchaseNotice, noticeIsOpen, koreaLocalDay } from "./metro-annex-lh-catalog";

/**
 * Conservative municipal parking design constraints, NOT parking stall ratios.
 * The local numerical apartment/officetel tables remain unextracted.
 * These caps only RESTRICT, never grant a construction/parking approval.
 */
export interface MunicipalMechanicalGuard {
  id: string;
  city: string;
  sourceArticle: string;
  sourceUrl: string;
  lastChecked: string;
  evidence: "municipal-ordinance-clause";
  maxMechanicalPercent: number;
  minMechanicalStalls: number;
  apartmentProhibited: boolean;
  officeMinimumGrossSqmOrFloors: {grossSqm:number;floors:number} | null;
  note: string;
  applicableToOneVerifiedParcelOnly: true;
}
const PAJU_URL="https://law.go.kr/LSW/ordinInfoP.do?ordinSeq=2073597";
const UIJEONGBU_URL="https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2107023";
const CHEONGJU_URL="https://www.law.go.kr/LSW/ordinInfoR.do?ordinSeq=2170297";

export const METROPOLITAN_MECHANICAL_REFERENCES = [
  {id:"paju-2025-2293",city:"파주시",sourceArticle:"파주시 주차장 설치 및 관리 조례 제19조제3항",sourceUrl:PAJU_URL,
   lastChecked:"2026-11-01",maxMechanicalPercent:30,minMechanicalStalls:0,
   notes:"부설주차장 기계식 장치의 비율 30% 이하. 대지·건축물 허용용도 및 별표 주차대수 미확정."},
  {id:"cheongju-2026-1823",city:"청주시",sourceArticle:"청주시 주차장 조례 제15조제3항",sourceUrl:CHEONGJU_URL,
   lastChecked:"2026-11-12",maxMechanicalPercent:100,minMechanicalStalls:30,
   notes:"2026.09.23 시행: 기계식 30대 이상 설치 시 허용, 종전 자주식 비율 의무 삭제. 100은 해당 조례상 별도 퍼센트 상한이 없는 경우의 계산용 sentinel이며 법률상 100% 승인이 아님."},
  {id:"uijeongbu-2026-annex3",city:"의정부시",sourceArticle:"의정부시 주차장 설치 및 관리 조례 제11조의2, 별표3",sourceUrl:UIJEONGBU_URL,
   lastChecked:"2026-11-01",maxMechanicalPercent:20,minMechanicalStalls:20,
   notes:"제2·3종일반주거 공동주택은 기계식 설치대상에서 제외. 비공동주택도 연면적 1,000㎡ 이상 또는 5층 이상. 기계식은 총 의무주차의 20% 이하·20대 미만 불허."}
] as const;

/** Require VWorld cadastral confirmation and exact municipal zoning before applying any hard stop. */
export function getMunicipalMechanicalGuard(review:SiteReviewResult|null,input:ProjectInput):MunicipalMechanicalGuard|null{
 if(!review?.location?.parcelAddress || !review.parcel?.pnu ||
    review.mixedUseZones || review.parcels?.length!==1)return null;
 const location=review.location.parcelAddress.replace(/\s+/g,"");
 const governingCity=location.includes("의정부시")?"의정부시":location.includes("파주시")?"파주시":location.includes("청주시")?"청주시":null;
 if(!governingCity || !review.ordinances?.some(x=>x.name.includes("주차장")&&x.name.includes(governingCity)))return null;
 const zones=review.landUse.filter(x=>x.category==="용도지역").map(x=>x.name);
 if(zones.length!==1)return null;
 const zone=zones[0].replace(/\s+/g,"");
 if(location.includes("청주시")){
  return {id:"cheongju-2026-1823",city:"청주시",
    sourceArticle:"청주시 주차장 조례 제15조제3항·제4항(2026.09.23)",
    sourceUrl:CHEONGJU_URL,lastChecked:"2026-11-12",evidence:"municipal-ordinance-clause",
    maxMechanicalPercent:100,minMechanicalStalls:30,apartmentProhibited:false,
    officeMinimumGrossSqmOrFloors:null,
    note:"기계식으로 설치하는 대수 30대 이상. 종전 비율상한 삭제(100은 계산용 무상한 sentinel일 뿐 법적 설치 100% 허용 의미 아님). 방향전환장치·건축물 내부 설치·주차관리실·LH 인수 별도 검증.",
    applicableToOneVerifiedParcelOnly:true};
 }

 if(location.includes("의정부시")){
  const eligibleZoning=["중심상업지역","일반상업지역","근린상업지역","유통상업지역","준주거지역",
    "전용공업지역","일반공업지역","준공업지역","제2종일반주거지역","제3종일반주거지역"];
  if(!eligibleZoning.includes(zone))return null;
  const residentialZoning=zone==="제2종일반주거지역"||zone==="제3종일반주거지역";
  return {id:"uijeongbu-2026-annex3",city:"의정부시",
    sourceArticle:"의정부시 주차장 설치 및 관리 조례 제11조의2 (별표3 설치대수 기준 별도)",
    sourceUrl:UIJEONGBU_URL,lastChecked:"2026-11-01",evidence:"municipal-ordinance-clause",
    maxMechanicalPercent:20,minMechanicalStalls:20,apartmentProhibited:residentialZoning,
    officeMinimumGrossSqmOrFloors:residentialZoning?{grossSqm:1000,floors:5}:null,
    note:residentialZoning
       ?"제2·3종일반주거지 공동주택 기계식 제외; 기타 시설은 연면적 1,000㎡ 이상 또는 5층 이상, 20% 이하 및 20대 미만 불허."
       :"기계식 총 주차대수 20% 이하, 기계식 20대 미만 불허. 용도별 별표3 주차계수 추가 확인.",
    applicableToOneVerifiedParcelOnly:true};
 }
 if(location.includes("파주시")){
  return {id:"paju-2025-2293",city:"파주시",sourceArticle:"파주시 주차장 설치 및 관리 조례 제19조제3항",
    sourceUrl:PAJU_URL,lastChecked:"2026-11-01",evidence:"municipal-ordinance-clause",
    maxMechanicalPercent:30,minMechanicalStalls:0,apartmentProhibited:false,
    officeMinimumGrossSqmOrFloors:null,
    note:"부설주차장 중 기계식 장치 비율 30% 이하. 단, 산단 지구단위·건축물 허용용도 및 LH 기준 별도 확인.",
    applicableToOneVerifiedParcelOnly:true};
 }
 return null;
}

/** Official regional notice minimums are only a screening threshold. */
export function screenRegionalLhHomes(address:string,noticeId:string|null,units:number,asOf=koreaLocalDay()):{
 label:string;status:"reference-only"|"below-smallest-threshold"|"regulated-area-check"|"count-clears-general-minimum";
 minGeneral:number|null;minRegulated:number|null;sourceUrl:string|null
}{
 const record=findLhPurchaseNotice(address);
 const matches=record && new URL(record.noticeUrl).searchParams.get("pchPanSn")===noticeId;
 if(!record || !matches || !noticeIsOpen(record,asOf)){
  return {label:"현재 공고·관할·접수기간 대조 전 — 호수 기준 신규 신청 자동 승인 불가",status:"reference-only",
    minGeneral:null,minRegulated:null,sourceUrl:record?.noticePdfUrl??null};
 }
 const minGeneral=record.normalMinimumHomes,minRegulated=record.regulatedMinimumHomes;
 if(units<minRegulated)return {label:"일반·규제지역 최소 호수 미달 가능: 최소 "+minRegulated+"호 기준 (공고 공급유형별 예외 별도확인)",
  status:"below-smallest-threshold",minGeneral,minRegulated,sourceUrl:record.noticePdfUrl};
 if(units<minGeneral)return {label:"일반 최소 "+minGeneral+"호 미달 · 규제지역 "+minRegulated+"호 적용 여부 확인 필요",
  status:"regulated-area-check",minGeneral,minRegulated,sourceUrl:record.noticePdfUrl};
 return {label:"일반 최소 "+minGeneral+"호 수량 충족 · 실제 공고 지역·주택유형·인수조건은 미확정",
  status:"count-clears-general-minimum",minGeneral,minRegulated,sourceUrl:record.noticePdfUrl};
}
