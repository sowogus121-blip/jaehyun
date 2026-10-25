import type { ProjectInput } from "./types";
import type { LhNotice } from "./server/lh-notice";

export type LhParkingStatus = "source-verified" | "extracted-unverified" | "unknown";
export type LhApplicability = "conditional" | "not-applicable" | "needs-original" | "design-guidance";
export interface LhParkingEvidence {
  id: string;
  category: "기본 주차" | "기계식 주차" | "0.3대 특례" | "설계·운영";
  title: string;
  detail: string;
  conditions: string[];
  applicability: LhApplicability;
  status: LhParkingStatus;
  sourcePage: string | null;
  sourceUrl: string | null;
  quote?: string;
}
export interface LhParkingReview {
  noticeTitle: string | null;
  noticeUrl: string | null;
  sourceUrl: string | null;
  verifiedOriginal: boolean;
  clauses: LhParkingEvidence[];
  warnings: string[];
}
const group=(id:string,category:LhParkingEvidence["category"],title:string,detail:string,conditions:string[],page:string,applicability:LhApplicability="conditional"):LhParkingEvidence=>({
 id,category,title,detail,conditions,applicability,status:"source-verified",sourcePage:page,sourceUrl:null
});
/** Only the exact verified 2026 경기북부 4차 source PDF pp.5,9,11.
 * This is LH purchase screening evidence, NOT parcel-level approval.
 */
export function getLhParkingReview(notice:LhNotice|null,input:ProjectInput):LhParkingReview {
  if(!notice)return {noticeTitle:null,noticeUrl:null,sourceUrl:null,verifiedOriginal:false,
    clauses:[],warnings:["해당 지역 LH 공식 매입공고 확인이 필요해. 다른 지역 규칙은 가져오지 않았어."]};
  const url=notice.pdfUrl??notice.url;
  if(notice.rules){
    const r=notice.rules;
    const purchase=input.businessMode==="purchase";
    const youth=input.lhSupplyType==="youth";
    const newlywed=input.lhSupplyType==="newlywed";
    const applicableType=youth||newlywed;
    const clauses:LhParkingEvidence[]=[
      group("machine-location","기계식 주차","기계식 허용 입지","GTX역 포함 도시철도역 출구에서 직선 "+r.mechanicalTransitMaxMeters+"m 이내",
        ["역 출구~필지 직선거리 실측 필요","역·노선별 해당 여부 확인","수도권 및 해당 공고 적용 여부 확인"],"p.11"),
      group("machine-use","기계식 주차","기계식 허용 주택유형·공급대상",
        "주거용 오피스텔 또는 도시형생활주택 + 청년형 또는 신혼·신생아형",
        ["입지·공급유형·건축물 용도 3개 요건 모두 충족","일반 공동주택 A형은 도시형생활주택 해당 여부 미확인"],"p.11",
        !purchase || (input.lhSupplyType!=="undecided"&&!applicableType)?"not-applicable":"conditional"),
      group("machine-limit","기계식 주차","기계식 허용비율",
        "총 주차대수의 "+r.mechanicalMaxPercent+"% 이하",
        ["150세대 미만이면 기계식 20대 미만 우대(의무상한 아님)","기준 일부 초과 시 LH 심의에서 계획 적정성을 고려해 수용 여부 결정"],"p.11"),
      group("machine-other","기계식 주차","혼합 용도·입주유형의 필요주차",
        "허용 주택유형 외의 주택, 청년·신혼 외 공급유형, 근린생활시설의 주차는 자주식 계획",
        ["용도별 법정주차 대수 분리 산정","근생 주차를 기계식 배분에 포함하지 않음"],"p.11"),
      group("machine-03","기계식 주차","0.3대 특례와 기계식 병행",
        "0.3대/세대 완화를 적용받으면 기계식주차 설치 '지양'",
        ["원문상 지양이지 일률적인 법적 금지가 아님","완화 주차계수·기계식 병행은 LH 사전협의 필요"],"p.11","design-guidance"),
      group("machine-design","기계식 주차","기계식 설비·배치 기준",
        "승강기·평면왕복·다층순환 방식, 오토발렛 허용 가능",
        ["세대 벽 연접 불가·진동/소음 완충공간","주차타워 상부 주거세대 불가(커뮤니티 가능)","기계식 주차관리실 설치"],"p.11","design-guidance"),
      group("parking03-scope","0.3대 특례","세대당 0.3대 완화 대상",
        "전용 30㎡ 미만의 청년형 또는 고령자형",
        ["청년형: GTX 포함 도시철도역 출구 또는 대학교 교문 직선 500m 이내","고령자형: 공고상 입지 제한 없음","매입약정·공공주택 특별법 시행령 제37조제4항·허가권자 적용 확인"],"p.9",
        !purchase || (input.lhSupplyType!=="undecided"&&!youth&&input.lhSupplyType!=="senior")?"not-applicable":"conditional"),
      group("parking03-community","0.3대 특례","0.3대 완화 시 추가 협의사항",
        "공공기여 방안 추가 제시 및 LH 협의",
        ["추가 공공기여의 구체적 범위·면적 협의","0.3대 특례 자동 승인 아님"],"p.9","design-guidance"),
      group("parking-design","설계·운영","50대 이상 경사로",
        "총 주차대수 50대 이상이면 2차선 경사로(폭 6,000mm 이상) 계획",
        ["진·출입차선 분리","도로 폭원·대기공간·회차 동선 검토"],"p.5","design-guidance"),
      group("parking-depth","설계·운영","지하 과다 굴착 지양",
        "터파기 20m 초과 또는 지하 5층 이상 지양",
        ["공고상 지양: 절대 금지나 자동 탈락이 아님"],"p.5","design-guidance"),
      group("parking-ratio","기본 주차","일반 법정주차계수",
        "LH 공고의 기계식 상한·0.3대 특례와 별도로 관할 법정주차 산정",
        ["주차장법령·조례·건축물 용도별 별표 대조","LH 공고만으로 일반 법정계수가 확정되는 것은 아님"],"p.9–11","design-guidance"),
    ];
    return {noticeTitle:notice.title,noticeUrl:notice.url,sourceUrl:url,verifiedOriginal:true,
      clauses:clauses.map(row=>({...row,sourceUrl:url})),warnings:notice.warnings};
  }
  const all=notice.extractedCriteria??[];
  const seen=new Set<string>();
  const clauses=all.filter(row=>/주차|기계식|0[.]3|역세권|승강기|교통|차량|카리프트|완화|커뮤니티|주차장/i.test(row.quote+" "+row.topic))
    .map((row,i):LhParkingEvidence=>{
      const combined=row.topic+" "+row.quote;
      const category:LhParkingEvidence["category"]=/0[.]3|특례|완화/.test(combined)?"0.3대 특례":
        /기계식|카리프트|승강기|주차타워|오토발렛/.test(combined)?"기계식 주차":
          /주차/.test(combined)?"기본 주차":"설계·운영";
      return {id:"pdf-extract-"+i,category,title:row.topic,detail:row.quote,
        conditions:["공고 원문에서 추출한 후보 문장이야. 대상지 적용조건·예외·각주 대조 필요"],
        applicability:"needs-original",status:"extracted-unverified",sourcePage:null,sourceUrl:url,quote:row.quote};
    }).filter(row=>{
      const key=row.detail.replace(/\s+/g,"").slice(0,90);
      if(seen.has(key))return false;
      seen.add(key);return true;
    }).slice(0,24);
  return {noticeTitle:notice.title,noticeUrl:notice.url,sourceUrl:url,verifiedOriginal:false,
    clauses,warnings:[...notice.warnings,...(clauses.length===0?["지역 공고는 확인했지만 주차 관련 문구 자동 추출에 실패했어. PDF·가이드라인 ZIP 원문을 대조해야 해."]:[])]};
}
