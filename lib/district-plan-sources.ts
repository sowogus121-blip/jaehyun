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
  lifecycle?:"effective"|"expired";
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
  {
    id:"hanam-yeokmal1-2026-152",city:"하남시",region:"경기",type:"지구단위계획",
    name:"하남 역말1지구 지구단위계획 경미한 변경·지형도면",
    noticeNo:"하남시 고시 제2026-152호",noticeDate:"2026-10-20",
    officialNoticeUrl:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=643518",
    planEvidence:"official-notice",scopeHint:"하남시 역말1지구에 한정. 덕풍동 일반 필지 전체 해당 아님.",
    applicabilityRule:"named-district-only",checkedAt:"2026-11-01",
    documents:[{kind:"결정변경·지형도면 원문",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=643518",note:"2026-152호 첨부 고시문 PDF와 역말1지구 지형도면 ZIP"}],
    warnings:["경미한 변경이라는 표현은 계획 전체가 자유롭게 변경된다는 뜻이 아님.","확정된 지구단위구역 경계·변경 대상 필지·건축물 용도표 확인 전 개별 대지에 규제 적용 금지."],
  },
  {
    id:"hanam-antergol2-expired-2026-121",city:"하남시",region:"경기",type:"지구단위계획",
    name:"하남 안터골2지구 지구단위계획 결정 실효·지형도면",
    noticeNo:"하남시 고시 제2026-121호",noticeDate:"2026-08-14",
    officialNoticeUrl:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=639476",
    planEvidence:"official-notice",scopeHint:"하남시 덕풍동 376-9번지 일원 안터골2지구.",
    applicabilityRule:"named-district-only",checkedAt:"2026-11-01",lifecycle:"expired",
    documents:[{kind:"실효 고시·환원 지형도면",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=639476",note:"2026-121호 첨부 기반시설·구역·용도지역 환원 결정도"}],
    warnings:["중요: 이 고시는 지구단위계획 효력 종료(실효) 사실을 확인함. 종전 2021/2024 지단 제한을 현재 유효 계획으로 적용하면 오류.","실효 이후 현재 용도지역·건축허용용도는 변경 후 도시관리계획으로 새로 확인."],
  },
  {
    id:"hanam-urban-revision-2026-78",city:"하남시",region:"경기",type:"지구단위계획",
    name:"하남 도시관리계획 재정비 변경 (미사·감일·현안2 등 지단 도면)",
    noticeNo:"하남시 고시 제2026-78호",noticeDate:"2026-05-12",
    officialNoticeUrl:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=633839",
    planEvidence:"official-notice",scopeHint:"미사1·2, 감일지구, 현안2지구 등 여러 별도 지구단위계획 도면을 포함한 재정비 고시.",
    applicabilityRule:"city-only",checkedAt:"2026-11-01",
    documents:[{kind:"재정비 고시·지구별 도면 첨부",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=633839",note:"미사1·2/감일/현안2 지구단위계획 PDF 등 고시문 첨부"}],
    warnings:["이 기록은 여러 지구의 자료 목록일 뿐, 하남시 임의의 필지에 공통 개발기준을 설정하는 고시가 아님.","실제 지구 이름·경계와 그 지구의 후속 개정고시를 확인해야 적용 가능."],
  },
  {
    id:"suwon-gwanggyo-2026-432",city:"수원시",region:"경기",type:"지구단위계획",
    name:"수원 광교지구 지구단위계획 결정변경·지형도면",
    noticeNo:"수원시 고시 제2026-432호",noticeDate:"2026-10-19",
    officialNoticeUrl:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=642966",
    planEvidence:"official-notice",scopeHint:"수원 광교지구 지구단위계획. 수원시 전체 또는 인근 영통구 전역 아님.",
    applicabilityRule:"named-district-only",checkedAt:"2026-11-01",
    documents:[{kind:"결정조서·지형도면 원문",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=642966",note:"고시 PDF 및 광교지구 변경 지형도면 PDF"}],
    warnings:["광교 명칭만으로 후보 표시. 개발획지의 구역포함·건축선·허용용도는 공식 도면 대조 필요.","이 변경이 기존 광교지구 전체 기준을 동일하게 변경하는 것은 아님."],
  },
  {
    id:"suwon-gokseon-2026-154",city:"수원시",region:"경기",type:"지구단위계획",
    name:"수원 곡선지구 지구단위계획 결정변경·지형도면",
    noticeNo:"수원시 고시 제2026-154호",noticeDate:"2026-05-06",
    officialNoticeUrl:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=633685",
    planEvidence:"official-notice",scopeHint:"수원 곡선지구 지구단위계획.",
    applicabilityRule:"named-district-only",checkedAt:"2026-11-01",
    documents:[{kind:"결정변경·가구 및 획지 도면",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=633685",note:"고시 HWP, 지형도면 PDF 및 가구획지 규모 결정(변경)도 PDF 첨부"}],
    warnings:["곡선동이라는 지명만으로 해당 획지의 건축허용용도를 확정할 수 없음.","후속 고시 여부·가구획지의 정확한 구역 적용 관계 추가 확인."],
  },
  {
    id:"suwon-gosaek2-2026-310",city:"수원시",region:"경기",type:"지구단위계획",
    name:"수원 고색2지구 지구단위계획 결정변경·지형도면",
    noticeNo:"수원시 고시 제2026-310호",noticeDate:"2026-07-24",
    officialNoticeUrl:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=638642",
    planEvidence:"official-notice",scopeHint:"수원 고색2지구 지구단위계획.",
    applicabilityRule:"named-district-only",checkedAt:"2026-11-01",
    documents:[{kind:"고색2 결정변경 고시 원문",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=638642",note:"고시 2026-310호 첨부 PDF. 세부 결정도는 시청 비치자료 확인 필요"}],
    warnings:["고색2지구 이름만 후보 매칭하며 고색동 전체로 적용 금지.","고시가 게재 생략한 결정도/시행지침의 실제 표 수치 미수집."],
  },
  {
    id:"goyang-ilsandong-2026-235",city:"고양시",region:"경기",type:"지구단위계획",
    name:"고양 일산동지구 지구단위계획 변경 (제1공영주차장 확장)",
    noticeNo:"고양시 고시 제2026-235호",noticeDate:"2026-08-25",
    officialNoticeUrl:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=639820",
    planEvidence:"official-notice",scopeHint:"고양시 일산서구 일산동 1673-4번지 일원 제1공영주차장 확장사업 관련 지단 변경.",
    applicabilityRule:"named-district-only",checkedAt:"2026-11-01",
    documents:[{kind:"도시관리계획 변경·지형도면",url:"https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=639820",note:"2026-235호 고시문 PDF 및 지형도면고시도 첨부"}],
    warnings:["도로·주차장 공공시설 관련 변경을 인접한 모든 공동주택의 건축 가능 용적률 변경으로 오인하지 말 것.","주소와 획지의 경계 대조 필수."],
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
    } else if(p.id==="hanam-antergol2-expired-2026-121" && (a.includes("안터골2") || a.includes("덕풍동376-9"))){
      matches.push({plan:p,level:"district-name-candidate",message:"안터골2지구 후보지명. 2026-08-14 계획 실효 확인: 종전 지단 규정 적용 금지.",automaticallyApply:false});
    } else if(p.id==="hanam-yeokmal1-2026-152" && a.includes("역말1")){
      matches.push({plan:p,level:"district-name-candidate",message:"역말1지구 이름 후보. 정확한 필지 경계 미확인.",automaticallyApply:false});
    } else if(p.id==="suwon-gwanggyo-2026-432" && a.includes("광교")){
      matches.push({plan:p,level:"district-name-candidate",message:"광교지구 이름 후보. 지단경계 미확인.",automaticallyApply:false});
    } else if(p.id==="suwon-gokseon-2026-154" && a.includes("곡선")){
      matches.push({plan:p,level:"district-name-candidate",message:"곡선지구 이름 후보. 획지 경계 미확인.",automaticallyApply:false});
    } else if(p.id==="suwon-gosaek2-2026-310" && a.includes("고색2")){
      matches.push({plan:p,level:"district-name-candidate",message:"고색2지구 이름 후보. 획지 경계 미확인.",automaticallyApply:false});
    } else if(p.id==="goyang-ilsandong-2026-235" && (a.includes("일산동지구") || a.includes("일산동1673-4"))){
      matches.push({plan:p,level:"district-name-candidate",message:"일산동 제1공영주차장 변경고시 근접 후보. 영향 구역 미확인.",automaticallyApply:false});
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
