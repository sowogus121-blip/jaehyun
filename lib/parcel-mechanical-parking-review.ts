/**
 * Parcel-level mechanical parking / LH acquisition pre-screening.
 *
 * Verified 2026 municipal clauses and national device standards are distinct
 * from LH acceptance conditions. Prior LH 서울 6차 extracted rules are NOT
 * confirmed rules for 서울 7차 and never authorize 0.3 or 50% mechanically.
 * Never mutate ProjectInput or claim final statutory parking counts.
 * Last reviewed 2026-11-12 KST.
 */
import { getParcelLegalGuide } from "./parcel-legal-guides";
export type ParkingGate = "allowed-conditionally"|"unverified"|"blocked-by-use";
export interface MechanicalReviewSource {
  id:string;
  title:string;
  reference:string;
  url:string;
  verification:"article-verified"|"annex-linked"|"download-linked-unread"|"conditional-check";
}
export interface MechanicalScenario {
  id:string;
  label:string;
  homes:number|null;
  assumedPerHome:number|null;
  assumedTotal:number|null;
  illustrativeHalfMechanical:number|null;
  illustrativeHalfSelf:number|null;
  verdict:string;
}
export interface MechanicalParcelReview {
  id:"osong"|"doksan";
  title:string;
  ordinanceGate:ParkingGate;
  lhGate:ParkingGate;
  headline:string;
  ordinanceRule:string;
  lhRule:string;
  localPermitChecks:string[];
  mechanicalScenarios:MechanicalScenario[];
  sourceRecords:MechanicalReviewSource[];
}
const source=(id:string,title:string,reference:string,url:string,verification:MechanicalReviewSource["verification"]):MechanicalReviewSource=>({id,title,reference,url,verification});
const common:MechanicalReviewSource[]=[
  source("parking-decree-annex1","주차장법 시행령 별표 1","부설주차장 시설별 설치기준(지자체 별표 병행)","https://www.law.go.kr/법령/주차장법시행령","annex-linked"),
  source("parking-act-mechanical","주차장법 제19조의6 이하","기계식주차장치 안전도인증, 관리 및 검사 관련 법체계","https://www.law.go.kr/법령/주차장법","article-verified"),
  source("parking-rule-device","주차장법 시행규칙 제16조의5~제16조의21","기계식장치 구조·안전·검사·유지관리·자체점검 세부조항","https://www.law.go.kr/법령/주차장법시행규칙","article-verified"),
  source("device-2026-160","국토교통부고시 제2026-160호 (2026.07.01 시행)","기계식주차장치 안전기준 및 검사기준 등에 관한 규정 · 자동이송, 입출고시간 등 개정","https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000276568&chrClsCd=010201","article-verified"),
  source("device-2026-160-annex1","고시 별표 1","기계식주차장치 사용검사 기준","https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000276568&chrClsCd=010201","annex-linked"),
  source("device-2026-160-annex2","고시 별표 2","기계식주차장치 정기검사 기준","https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000276568&chrClsCd=010201","annex-linked"),
  source("device-2026-160-annex2-2","고시 별표 2의2","기계식주차장치 수시검사 기준","https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000276568&chrClsCd=010201","annex-linked"),
  source("device-2026-160-annex3","고시 별표 3","기계식주차장치 정밀안전검사 기준","https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000276568&chrClsCd=010201","annex-linked"),
  source("device-2026-160-annex4","고시 별표 4","기계식주차장치 자체점검 항목 및 방법","https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000276568&chrClsCd=010201","annex-linked"),
];
const osongLocal:MechanicalReviewSource[]=[
  source("cheongju-2026-art15","청주시 주차장 조례 제15조제3·4항 (2026.09.23)","기계식 장치 30대 이상 허용, 내부 방향전환(전면공지 예외), 건축물 내부 설치 및 주차관리실 의무. 2026 개정으로 종전 비율 제한 삭제.","https://www.law.go.kr/LSW/ordinInfoR.do?ordinSeq=2170297","article-verified"),
  source("cheongju-parking-annex7","청주시 주차장 조례 별표 7","부설주차장 설치 대상시설·대수 산정기준","https://www.law.go.kr/LSW/ordinInfoR.do?ordinSeq=2170297","annex-linked"),
  source("cheongju-parking-annex6","청주시 주차장 조례 별표 6","주차방법 및 배치기준. 기계식 출입 동선·주차관리실과 별도 대조","https://www.law.go.kr/LSW/ordinInfoR.do?ordinSeq=2170297","annex-linked"),
  source("lh-chungbuk-2026-notice","LH 충북지역본부 2026년 민간신축 매입약정 정정공고","2026.11.30 마감. 주택유형·지역별 인수 주차기준 적용 필요","https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1632","article-verified"),
  source("lh-chungbuk-2026-zip","LH 충북지역 설계시공가이드라인(정정) ZIP","최신 지역본부 주차 설치형식·기계식 인수조건·0.3대 특례 확인 필수. ZIP 내부는 미열람.","https://apply.lh.or.kr/lhapply/lhFile.do?fileid=66672954","download-linked-unread"),
];
const doksanLocal:MechanicalReviewSource[]=[
  source("seoul-ordinance-2026-art20","서울특별시 주차장 설치 및 관리 조례 제20·21조(2026.10.01)","부설주차장 설치기준 및 주차장설치제한지역. 기계식 2단 이상 주차대수 인정은 시행규칙 위임.","https://www.law.go.kr/LSW/ordinInfoR.do?ordinSeq=2171833","article-verified"),
  source("seoul-rule-art7","서울특별시 주차장 설치 및 관리 조례 시행규칙 제7조","안전도인증받은 대수를 인정. 단순2단식(다른 차를 사람이 이동시켜야 출차)은 장치별 1대만 인정. 지역 주차대수 산정에서 필수.","https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=1412112","article-verified"),
  source("seoul-parking-annex2","서울특별시 주차장 설치 및 관리 조례 별표 2","부설주차장 법정 대수·오피스텔 및 공동주택 별도 산정","https://www.law.go.kr/LSW/ordinInfoR.do?ordinSeq=2171833","annex-linked"),
  source("seoul-parking-annex3","서울특별시 주차장 설치 및 관리 조례 별표 3","주차장 설치제한지역 별도 시설기준. 역 출구 500m LH 특례와 동치 아님.","https://www.law.go.kr/LSW/ordinInfoR.do?ordinSeq=2171833","annex-linked"),
  source("lh-seoul-2026-7-notice","LH 서울지역본부 2026년 7차 민간신축 매입약정","2026.11.06 공고 · 2026.11.30 마감. 본 공고·정정 여부와 최신 첨부 우선.","https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1754","article-verified"),
  source("lh-seoul-2026-7-zip","LH 서울 7차 신청서식·설계시공 가이드라인 ZIP","최신 인수/기계식 허용 입지·비율·관리실·인수예외 확인 필수. ZIP 내부 미열람으로 50% 허용 단정 금지.","https://apply.lh.or.kr/lhapply/lhFile.do?fileid=69293403","download-linked-unread"),
  source("lh-seoul-2026-6-reference","LH 서울 6차 과거 공고(2026.10.14)","기계식 역 출구 직선 500m, 주거용 오피스텔/도시형생활주택 + 청년/신혼, 총대수 50% 이하 및 0.3 특례 시 기계식 지양은 기존에 확보한 6차 원문 분석 결과. 현행 7차 기준 확정 아님.","https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1735","conditional-check"),
];
const ceil=(num:number)=>Math.ceil(num-1e-8);
function dScenario(id:string,label:string,homes:number,ratio:number,verdict:string):MechanicalScenario{
  const assumedTotal=ceil(homes*ratio);
  return {id,label,homes,assumedPerHome:ratio,assumedTotal,
    illustrativeHalfMechanical:Math.floor(assumedTotal*0.5),
    illustrativeHalfSelf:assumedTotal-Math.floor(assumedTotal*0.5),
    verdict};
}
const osong:MechanicalParcelReview={
  id:"osong",title:"오송읍 봉산리 992 · 기계식 설치·LH 인수",
  ordinanceGate:"allowed-conditionally",lhGate:"blocked-by-use",
  headline:"청주시 조례상 기계식 30대 이상 설치는 검토할 수 있으나, C계열 지구단위 주거용도 제한을 해소하기 전에는 LH 주거 인수용 기계식 주차계획을 승인할 수 없습니다.",
  ordinanceRule:"청주시 주차장 조례 제15조제3항: 부설주차장의 기계식주차장은 30대 이상 설치하는 경우에만 허용하며 내부 방향전환장치가 필요합니다(전면공지 방향전환 가능 예외). 제4항: 건축물 내부 설치·주차관리실. 2026.09 개정으로 종전 기계식 비율 제한 삭제. 이 내용은 '법정 30대의 총 주차장'이 아니라 기계식으로 설치하는 대수의 최소 규모입니다.",
  lhRule:"오송바이오폴리스 C계열 상업·업무용지의 공동주택 비열거·오피스텔 불허가 선결 장애입니다. 충북 정정공고 ZIP 내부의 기계식 인수조건을 아직 직접 확인하지 못하여 LH 기계식 인수 허용 여부도 미확정입니다.",
  localPermitChecks:[
    "봉산리 992 최신 결정도에서 세부 C/D/E 획지번호·허용용도와 2026 변경고시 확인",
    "법정 부설주차 총대수(지구단위 허용 비주거 사용면적 및 청주시 별표7) 산정",
    "기계식으로 설치하는 대수 30대 이상 확인(총 주차대수 30대만으로 요건 충족 아님)",
    "차량 대기·회차를 위한 방향전환장치 또는 전면공지 및 주차관리실·소음 완충공간 확보",
    "기존 근생 허가·착공상태 및 LH 충북지역 가이드라인 기계식 인수조건 원문 대조",
  ],
  mechanicalScenarios:[
    {id:"osong-under-30",label:"기계식 20대 가정",homes:null,assumedPerHome:null,assumedTotal:20,illustrativeHalfMechanical:20,illustrativeHalfSelf:null,verdict:"청주시 제15조제3항 30대 미만으로 설치 불가"},
    {id:"osong-30",label:"기계식 30대 가정",homes:null,assumedPerHome:null,assumedTotal:30,illustrativeHalfMechanical:30,illustrativeHalfSelf:null,verdict:"지자체 최소 규모만 충족. 비주거 허용·법정대수·배치·시설·LH 인수 별개"},
  ],
  sourceRecords:[...common,...osongLocal],
};
const doksan:MechanicalParcelReview={
  id:"doksan",title:"독산동 151-10 · 기계식 설치·LH 인수",
  ordinanceGate:"allowed-conditionally",lhGate:"unverified",
  headline:"서울시 조례상 기계식주차장 일률 금지를 확인하지 않았습니다. 안전도인증·인정대수·주차동선은 검토 가능하나 LH 서울 7차의 기계식 인수기준과 도시철도 출구 500m 충족 여부는 아직 입증되지 않았습니다.",
  ordinanceRule:"서울시 주차장 조례 제20조제2항 및 시행규칙 제7조: 안전도인증 대수 인정, 단순 2단식은 장치별 1대로만 인정. 제20조 별표2 용도별 법정주차, 제21조 별표3 설치제한지역은 별도로 확인해야 합니다.",
  lhRule:"LH 서울 6차 과거 공고에서 확인된 500m·청년/신혼·주거용 오피스텔/도시형생활주택·기계식 50% 이하·0.3대 특례 병행 지양은 현재 7차의 확정 조건으로 보지 않습니다. 7차 설계시공 ZIP을 확보해 전문 재대조하고 역 출구~대지 경계의 직선거리 측정을 해야 합니다. 임의로 0.3대/호 또는 LH 기계식 50%를 법정 계산에 반영하지 않습니다.",
  localPermitChecks:[
    "서울 2026년 7차 ZIP 최신판에서 기계식 비율·허용 주택유형·역세권 기준·주차관리 및 인수제한 확인",
    "독산동 151-10 좌표와 가장 가까운 도시철도역 실제 출구의 직선 500m 측정(행정동이나 역 이름으로 승인 금지)",
    "서울시 주차장 조례 별표2 일반 법정 주차대수 및 제21조 별표3 제한지역 포함 여부 확인",
    "46㎡ 일반 공동주택과 25㎡ 주거용 오피스텔의 LH 기계식 대상 주택유형 구분(도시형생활주택 여부 포함)",
    "전용 30㎡ 미만 청년형 0.3대 완화는 LH 매입약정·허가권자·입지요건·공고 확정 전 미승인",
    "기계식 장치의 안전도인증, 단순2단식 중복 인정 금지, 승강기 방식, 관리인 및 검사·유지관리 검토",
    "2025.03 업무시설 신축허가 도서가 기계식주차인지·현행 설계안과 충돌 여부 확인",
  ],
  mechanicalScenarios:[
    dScenario("doksan-apt46-08","LH 46㎡ 신혼형 50세대 · 0.8대 가정",50,0.8,"40대 가정: 기계식 20대 이하란 수치는 옛 서울 6차 50% 가정의 산술 예시일 뿐. 일반 공동주택은 LH 기계식 주택유형 적용 미확정"),
    dScenario("doksan-office25-05","LH 25㎡ 청년형 오피스텔 87호 · 0.5대 가정",87,0.5,"44대 가정: 예전 서울 6차 50%라면 기계식 최대 22대·자주식 최소 22대. 7차 인정과 역 500m 미확인"),
    dScenario("doksan-office25-03","LH 25㎡ 청년형 오피스텔 87호 · 0.3대 특례 가정",87,0.3,"27대 가정: 예전 50%는 13/14대이지만, 구 서울 6차 지침은 0.3 완화와 기계식 병행 지양. 특례와 기계식 모두 승인 전"),
  ],
  sourceRecords:[...common,...doksanLocal],
};
export function getParcelMechanicalReview(address:string):MechanicalParcelReview|null{
  const parcel=getParcelLegalGuide(address);
  if(!parcel)return null;
  return parcel.id==="osong-bongsan-992"?osong:doksan;
}
