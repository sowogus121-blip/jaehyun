import type { ProjectInput, SiteReviewResult, AlternativeResult } from "./types";
import { calculateAll } from "./calculator";
import { deriveCalculationContext } from "./regulatory-assessment";
import { getPreliminaryOrdinanceInputs } from "./massing-readiness";
import { assessParcelAssembly } from "./parcel-assembly";
import type { LegalReviewReport, LegalReviewRow } from "./legal-review-report";

export interface DecisionCheck {
  id:string;
  label:string;
  result:string;
  status:"source"|"conditional"|"unknown"|"user";
  why:string;
  url:string|null;
}
export interface DecisionDashboard {
  canEstimate:boolean;
  area:number|null;
  zone:string;
  ordinary:{bcr:number;far:number}|null;
  applied:{bcr:number;far:number;floors:number}|null;
  estimates:AlternativeResult[];
  checks:DecisionCheck[];
  blockers:string[];
  lhTitle:string|null;
  lhUrl:string|null;
  assumptions:string[];
  isMerged:boolean;
}
/** An architectural early-stage *scenario*, not a legally approved capacity.
 * Never invent a regulatory number when the governing text is missing.
 * For mixed zones, never apply weighted FAR without an explicit user action.
 */
export function buildDecisionDashboard(
  input:ProjectInput,review:SiteReviewResult|null,report:LegalReviewReport,
):DecisionDashboard {
  const assembly=assessParcelAssembly(review);
  const isMerged=Boolean(assembly?.isMultiple);
  const area=isMerged
    ? assembly?.status==="ready" ? assembly.totalArea : null
    : review?.parcel?.area && review.parcel.area>0 ? review.parcel.area : null;
  const rows=report.rows;
  const look=(id:string)=>rows.find(r=>r.id===id);
  const relevant=[
    ["use","건축 허용용도"],
    ["bcr","건폐율"],
    ["far","용적률"],
    ["plan","지구단위계획·건축선"],
    ["height","최고높이·층수"],
    ["sun","일조·채광·인동거리"],
    ["setback","대지 안의 공지"],
    ["apt-parking","공동주택 주차기준"],
    ["office-parking","오피스텔 주차기준"],
    ["special-parking","LH 주차 특례"],
    ["relax","공공주택 용적률 완화"],
  ] as const;
  const checks:DecisionCheck[]=relevant.map(([id,label])=>{
    const row=look(id);
    return {id,label,result:row?.detail??"적용 근거 미확인",status:row?.status??"unknown",
      why:row?.note??"관할 조문·별표 미확보",url:row?.sourceUrl??null};
  });
  const ordinary=isMerged
    ? assembly?.status==="ready" ? assembly.ordinary : null
    : getPreliminaryOrdinanceInputs(rows);
  const inputIsUserDefined=Boolean(input.buildingCoverageRatio>0 && input.baseFar>0);
  const bcr=input.buildingCoverageRatio>0?input.buildingCoverageRatio:ordinary?.bcr??0;
  const far=input.baseFar>0?input.baseFar:ordinary?.far??0;
  const floors=input.maxFloors>0?input.maxFloors:input.maxHeight>0?0:10;
  const applicableBase=area!==null && area>0 && bcr>0 && far>0 && floors>0;
  const blockers:string[]=[];
  if(!review)blockers.push("주소를 입력하고 공식자료 통합검토를 실행해 줘.");
  else {
    if(!review.location)blockers.push("대상지 지번·좌표를 확인하지 못했어. 올바른 지번인지 확인해 줘.");
    if(area===null)blockers.push(isMerged
      ? "합필할 필지 중 면적·용도지역·관할·중복 PNU 확인이 필요해. 통합 수량을 계산하지 않았어."
      : "지적 대지면적을 조회하지 못했어. 해당 대지의 토지대장 또는 지적 자료를 확인해야 해.");
    if(isMerged && assembly && assembly.status!=="ready")
      blockers.push("합필 예정지가 혼합 용도지역이거나 필지 조회가 불완전해. 합필 법적 적용과 가중평균을 확인해야 해.");
    if(bcr<=0 || far<=0)
      blockers.push("해당 용도지역의 조례 일반 건폐율·용적률 조문을 확인하지 못했어. 임의 수치를 사용하지 않아.");
    if(input.maxFloors<=0 && input.maxHeight<=0)
      blockers.push("최고층수·높이 미확인: 아래 수량은 '지상 10층'을 가정한 시험 계산이야.");
    if(input.apartmentParkingRatio<=0 || input.officetelParkingRatio<=0)
      blockers.push("법정 주차계수가 미확인되어 주차대수·지하층수를 확정할 수 없어.");
    if(review.districtPlan!==false)
      blockers.push("지구단위계획의 최신 결정도서·건축한계선·허용용적률 적용을 확인해야 해.");
    if(!review.lhNotice)
      blockers.push("이 지역에 적용 가능한 최신 LH 공고를 찾지 못했어. 사업·매입 적합성 판단이 필요해.");
    else if(!review.lhNotice.rules)
      blockers.push("LH 지역 공고는 찾았지만 대상지·공급유형별 수치가 검증되지 않아 자동 적용하지 않았어.");
    blockers.push(...(review.errors??[]).slice(0,3));
  }
  const assumptions=[
    "건폐율·용적률은 확인된 조례 일반기준 또는 사용자가 입력한 가정이며, 지구단위·완화 상한 적용확정 전",
    input.maxFloors>0?"층수는 사용자 계획 가정":input.maxHeight>0?"최고높이 입력값으로만 층수 환산":"지상 10층 가정 · 허가 가능한 최고층수 아님",
    "대지형상·접도·건축선·일조·코어·피난·소방의 상세 건축배치 미반영",
    "주차계수가 없는 경우 주차대수는 '미산정'이며 0대 허용을 의미하지 않음",
  ];
  let estimates:AlternativeResult[]=[];
  if(applicableBase){
    const trial:ProjectInput={
      ...input,siteArea:area!,buildingCoverageRatio:bcr,baseFar:far,
      relaxedFar:input.useRelaxedFar?input.relaxedFar:0,
      useRelaxedFar:input.useRelaxedFar&&input.relaxedFar>0,
      maxFloors:input.maxFloors>0?input.maxFloors:input.maxHeight>0?0:10,
    };
    estimates=calculateAll(trial,deriveCalculationContext(review,trial));
  }
  // A completed official-source search is not an application determination.
  return {
    canEstimate:estimates.length===4,area:area??null,zone:report.zone,ordinary:ordinary??null,
    applied:applicableBase?{bcr,far:input.useRelaxedFar&&input.relaxedFar>0?input.relaxedFar:far,floors}:null,
    estimates,checks,blockers: [...new Set(blockers)],lhTitle:review?.lhNotice?.title??null,
    lhUrl:review?.lhNotice?.url??null,assumptions,isMerged,
  };
}
