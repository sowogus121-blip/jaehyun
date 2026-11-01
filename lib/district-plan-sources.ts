/**
 * Official district-unit / special-plan source collection.
 * A source listing is NOT a verified polygon overlay. Never infer a
 * parcel's block/allowed uses merely from a district name or street.
 */
import { findMetroOrdinanceSource, METRO_ORDINANCE_SOURCES, type MetroRegion } from "./metro-ordinance-catalog";
import { UIWANG_6301, isUiwangChopyeong6301 } from "./uiwang-chopyeong-6301";

export type PlanEvidenceLevel="official-notice" | "official-notice-and-guidance";
export type PlanMatchLevel="user-map-confirmed-block" | "district-name-candidate" | "city-only-source";
export type PlanType="지구단위계획" | "특별정비계획";
export interface DistrictPlanSource{
  id:string; city:string; region:MetroRegion; name:string; type:PlanType;
  noticeNo:string; noticeDate:string; officialNoticeUrl:string; documents:ReadonlyArray<{kind:string;url:string;note:string}>;
  planEvidence:PlanEvidenceLevel;
  scopeHint:string;
  /** Rules may NOT be applied from keyword matches without polygon verification. */
  applicabilityRule:"exact-user-map" | "named-district-only" | "city-only";
  checkedAt:string;
  warnings:ReadonlyArray<string>;
}
export const DISTRICT_PLAN_SOURCES:ReadonlyArray<DistrictPlanSource>=[
  {
    id:"uiwang-chopyeong-2026-308",city:"의왕시",region:"경기",type:"지구단위계획",
    name:"의왕초평 공공지원민간임대주택 공급촉진지구 지구계획 변경 8차",
    noticeNo:"국토교통부 고시 제2026-308호",noticeDate:"2026-06-30",
    officialNoticeUrl:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=637163",
    planEvidence:"official-notice-and-guidance",
    scopeHint:"의왕시 초평동 공공지원민간임대주택 공급촉진지구. 초평동 전체가 아님.",
    applicabilityRule:"exact-user-map",checkedAt:"2026-11-01",
    documents:[
      {kind:"공식 지형도면 고시",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=637163",note:"2026-308호 고시 첨부 총괄·01·02 지형도면"},
      {kind:"건축물 등에 관한 결정도",url:UIWANG_6301.controlPlanUrl,note:"2026 LH 토지공급 안내 첨부 06; 블록 번호 확인용"},
      {kind:"획지 결정도",url:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68944318",note:"2026 LH 토지공급 안내 첨부 07; 630-1과 C1-2 세부 필지번호 공식 동일성은 미확보"},
      {kind:"지구단위계획 시행지침",url:UIWANG_6301.districtGuidelineUrl,note:"2026 LH PDF 113쪽; C1 상업시설용지 허용용도 표Ⅱ-4-2"},
      {kind:"LH 상업시설용지 공급자료",url:"https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?aisTpCd=01&ccrCnntSysDsCd=01&mi=1062&panId=BN-0008074&uppAisTpCd=01",note:"부동산 공급 관련 자료, 토지이용·획지 지도의 인허가 최종 증거는 아님"},
    ],
    warnings:["630-1의 C1 블록 위치는 사용자가 지도를 대조해 확인한 실무근거이고 공식 지적도 중첩 결과는 아님.","세부 획지 C1-2와 기존 예정지번 401-2→현재 630-1의 이력은 확정하지 않음.","C1 공통 주거불허와 70/450/7층을 초평동 전체 또는 다른 주소에 적용하지 말 것."],
  },
  {
    id:"bucheon-eunha-2026-107",city:"부천시",region:"경기",type:"특별정비계획",
    name:"은하마을 노후계획도시 특별정비계획 결정 및 특별정비구역·선도지구 지정",
    noticeNo:"부천시 고시 제2026-107호",noticeDate:"2026-06-15",
    officialNoticeUrl:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=636087",
    planEvidence:"official-notice",
    scopeHint:"부천시 중동 1036번지 일원 은하마을 특별정비구역. 중동 모든 필지에 적용되지 않음.",
    applicabilityRule:"named-district-only",checkedAt:"2026-11-01",
    documents:[
      {kind:"특별정비계획 및 구역지정 원문",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=636087",note:"고시문 PDF 353KB; 결정조서 및 지형도면 첨부 열람"},
      {kind:"부천시 공식 시보",url:"https://bucheon.go.kr/site/program/board/basicboard/view?boardid=1199881&boardtypeid=26758&menuid=148002002007",note:"2026-06-15 시보 제1990호 부천 고시 2026-107 (p.25 이후)"},
    ],
    warnings:["노후계획도시 특별정비계획은 개별사업 확정고시. 일반 마스터플랜과 혼동 금지.","주소에 중동 1036 또는 은하마을이라고 표시돼도 구역경계의 포함 여부는 공식 지형도면으로 별도 확인.","LH 공공임대 매입공고의 사업유형을 은하마을 재건축에 일괄 적용하지 말 것."],
  },
  {
    id:"bucheon-sangdong-2026-124",city:"부천시",region:"경기",type:"지구단위계획",
    name:"부천 상동지구 도시관리계획(지구단위계획) 결정변경 및 지형도면",
    noticeNo:"부천시 고시 제2026-124호",noticeDate:"2026-07-06",
    officialNoticeUrl:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=637530",
    planEvidence:"official-notice",
    scopeHint:"부천시 상동지구 지구단위계획. 상동이라는 법정동명만으로 구역 포함 확정 금지.",
    applicabilityRule:"named-district-only",checkedAt:"2026-11-01",
    documents:[
      {kind:"2026-07-06 결정변경·지형도면",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=637530",note:"최신 확인 2026-124호. 변경 조서 및 결정도 해당필지 검토 필요"},
      {kind:"2026-06-15 변경고시 이력",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=636433",note:"고시 2026-110호, 7/6 후속 결정과 차이 확인"},
      {kind:"2026-06-22 지형도면 보완고시",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=637528",note:"고시 2026-122호. 앞선 지형도면 누락을 보완했다는 본문 확인"},
    ],
    warnings:["2026-110호 이후 지형도면 고시 누락 보완(122호) 및 추가변경(124호) 이력을 분리해 저장.","개별 획지·건축허용용도·수치계획은 결정도 원문 확보 전 자동 적용 금지."],
  },
];
export interface DistrictPlanEvidenceMatch{
  plan:DistrictPlanSource; level:PlanMatchLevel; message:string;
  /** Always false: even map-confirmed source is NOT a license/relaxation engine. */
  automaticallyApply:false;
}
export function findDistrictPlanEvidence(address:string, opts:{includeCitySources?:boolean}={}):DistrictPlanEvidenceMatch[]{
  const a=address.replace(/\s+/g,"");
  const city=findMetroOrdinanceSource(address)?.city;
  if(!city || a.length<3)return [];
  const matches:DistrictPlanEvidenceMatch[]=[];
  for(const p of DISTRICT_PLAN_SOURCES){
    if(p.city!==city)continue;
    if(p.id==="uiwang-chopyeong-2026-308" && isUiwangChopyeong6301(address)){
      matches.push({plan:p,level:"user-map-confirmed-block",message:"초평동 630-1 C1 블록 지도 위치는 사용자 대조 확인. 세부 획지 및 법정 지적 중첩 별도.",automaticallyApply:false});
    } else if(p.id==="bucheon-eunha-2026-107" && (a.includes("은하마을") || /중동1036(?:-|$|번지|일원)/.test(a))){
      matches.push({plan:p,level:"district-name-candidate",message:"은하마을·중동1036 지명 일치만 확인. 정확한 지형도면 경계 포함 미검증.",automaticallyApply:false});
    } else if(p.id==="bucheon-sangdong-2026-124" && (a.includes("상동지구") || a.includes("부천시상동"))){
      matches.push({plan:p,level:"district-name-candidate",message:"상동지구 또는 부천 상동 지명 후보. 구역의 실제 포함 여부 미검증.",automaticallyApply:false});
    } else if(opts.includeCitySources){
      matches.push({plan:p,level:"city-only-source",message:"시군 단위 관련 계획 자료: 해당 필지에 적용된다는 근거 없음.",automaticallyApply:false});
    }
  }
  return matches;
}
export interface DistrictPlanDiscovery {
 city:string;region:MetroRegion;sourceTitle:string;searchUrl:string;requiredDocuments:ReadonlyArray<string>;
 verification:"city-search-only";
}
export const DISTRICT_PLAN_DISCOVERY:ReadonlyArray<DistrictPlanDiscovery>=
  METRO_ORDINANCE_SOURCES.map(({city,region})=>({
    city,region,sourceTitle:city+" 지구단위계획·도시관리계획 공식 고시 탐색",
    searchUrl:"https://www.eum.go.kr/",verification:"city-search-only",
    requiredDocuments:["최신 결정고시 및 정정/변경고시","지형도면과 필지 지적도 경계 대조","가구·획지 결정도","건축물 용도·건폐율·용적률·높이 결정도","지구단위계획 시행지침·허용용도 표","건축한계선·공공보행통로·도로 및 주차계획"],
  }));
