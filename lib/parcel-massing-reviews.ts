/**
 * Separate preliminary legal/massing comparison of two public parcels.
 * NOT an entitlement engine. All residential unit scenarios are conditional
 * gross-floor-area feasibility checks and must never change validated
 * permit / land-use / LH parking inputs.
 * Updated 2026-11-11.
 */
import { getParcelLegalGuide } from "./parcel-legal-guides";

export interface ParcelMassingScenario {
  title: string;
  condition: string;
  farPercent: number;
  bcrPercent: number;
  maximumBuildingArea: number;
  farArea: number;
  maxFloors: number | null;
  /** Sum of uppermost possible floor plate * floor cap, BEFORE setbacks. */
  simpleEnvelopeArea: number | null;
  /** Intersection of FAR, coverage, floor-count if applicable. */
  conditionalUpperArea: number;
  apt46Theoretical: number | null;
  officetel25Theoretical: number | null;
  equivalentFloorsAt422sqm: number | null;
}
export interface ParcelMassingReview {
  name: string;
  siteArea: number;
  category: "commercial-only" | "conditional-residential";
  overallConclusion: string;
  legalGate: string;
  existingPermit: string;
  scenarioExplanation: string;
  scenarios: ParcelMassingScenario[];
  checks: string[];
  sources: {name:string;url:string}[];
}
const osongArea=1265.7;
const doksanArea=1093.6;

function osongScenario(title:string, floorCap:number,condition:string):ParcelMassingScenario {
  const bcr=80, far=1000, buildingArea=osongArea*bcr/100;
  const farArea=osongArea*far/100, envelope=buildingArea*floorCap;
  return {
    title,condition,farPercent:far,bcrPercent:bcr,
    maximumBuildingArea:buildingArea,farArea,
    maxFloors:floorCap,simpleEnvelopeArea:envelope,
    conditionalUpperArea:Math.min(farArea,envelope),
    apt46Theoretical:null,officetel25Theoretical:null,
    equivalentFloorsAt422sqm:null,
  };
}
/**
 * Gross FAR after 5% nonhousing/common allowance.
 * 46 sqm apartment with 75% FAR-level efficiency and 25 sqm officetel
 * with 70% ABOVE-GROUND efficiency; contract-area efficiency 45% is different.
 * No legal parking, LH facility minima, circulation geometry, setback,
 * daylight, or height determination in this theoretical count.
 */
function doksanScenario(title:string,far:number,condition:string):ParcelMassingScenario {
  const bcr=60, buildingArea=doksanArea*bcr/100,farArea=doksanArea*far/100;
  return {
    title,condition,farPercent:far,bcrPercent:bcr,
    maximumBuildingArea:buildingArea,farArea,
    maxFloors:null,simpleEnvelopeArea:null,conditionalUpperArea:farArea,
    apt46Theoretical:Math.floor(farArea*0.95*0.75/46),
    officetel25Theoretical:Math.floor(farArea*0.95*0.70/25),
    equivalentFloorsAt422sqm:farArea/422.24,
  };
}
const osong:ParcelMassingReview={
  name:"오송읍 봉산리 992",
  siteArea:osongArea,category:"commercial-only",
  overallConclusion:"C계열 상업·업무시설용지라는 조건이라면 현행 확인 지침상 LH 신혼형 공동주택·청년형 오피스텔 규모는 산정 보류(용도 제한 우선). 하단 연면적은 상업·업무시설만의 이론값.",
  legalGate:"청주시 오송바이오폴리스 최신 결정도에 봉산리 992 획지번호(C01~C18 등)를 대조하고 2016년 이후 변경고시를 확인하기 전에는 주거용도 허용 확정 불가.",
  existingPermit:"과거 공개 건축행정자료상 2022.07.22 제1종근린생활시설 신축허가, 2025.07.21 착공신고; 건축면적 955.55㎡, 용적률 산정연면적 8,077.92㎡, 전체 연면적 11,211.77㎡. 2026년 현재 허가변경/착공상태 미확인.",
  scenarioExplanation:"상업·업무 C획지별 지구단위계획상 건폐율 80%, 용적률 1,000%, 최고층 15층 또는 10층을 동시에 적용한 단순 상한. 각 층을 건폐율만큼 꽉 채우는 비현실적인 상한이며 대지안의 공지·건축한계선·일조·기전실·주차 등 제외. 지침의 개정 및 정확한 획지번호 미확인.",
  scenarios:[
    osongScenario("C01~C06 획지 가정",15,"해당 블록이면 15층 이하. 비주거 시설만 조건부 검토."),
    osongScenario("C07~C18 획지 가정",10,"해당 블록이면 10층 이하. 80% × 10개층 때문에 1,000% FAR 이론상 동시 도달 불가."),
  ],
  checks:[
    "봉산리 992의 현행 C/D/E 세부 획지 및 변경고시·지적중첩 결정도 확인",
    "공동주택·오피스텔 허용용도 변경 여부 확인(확인 전 LH 세대수 0이 아닌 '미산정')",
    "기존 근생 신축허가·착공·허가변경 및 공매 낙찰/소유권 이전 상태 확인",
    "지구단위 건축한계선·차량출입·전면공지·최고층·대지내공지를 반영한 CAD 배치",
    "LH 충북지역본부 정정공고의 주택유형·부설주차·기계식 제한·부대시설 조건 확인"
  ],
  sources:[
    {name:"청주시 오송바이오폴리스 지구단위계획 시행지침 제27·28조",url:"https://cjic.cheongju.go.kr/DATA/download/cic/cts226_file.pdf"},
    {name:"LH 충북지역본부 2026 정정 신축매입공고",url:"https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1632"},
  ]
};
const doksan:ParcelMassingReview={
  name:"금천구 독산동 151-10",
  siteArea:doksanArea,category:"conditional-residential",
  overallConclusion:"서울 준공업지역 일반 주거 250%, LH 공공매입임대 해당 시 300%, 추가 공공임대 조건 충족 시 400% 시나리오. 실제 건축 가능성과 사업성은 LH 공고·공장부지·건축허가·주차 검증 전 보류.",
  legalGate:"서울시 도시계획 조례 제50조제2호바목의 매입임대주택 300%를 신청사업이 충족하는지, 별표 12·17 공장비율(2008.1.31) 및 예외 적용·현행 건축허가를 확인해야 함. 400%는 추가 공공임대 공급 조건부.",
  existingPermit:"감정평가서(2024.11)상의 기존 건물과 달리, 국토교통부 건축데이터 2025.06.02 기준 공개 재게시: 2025.03.10 업무시설 신축허가, 건축면적 422.24㎡, 용적률 산정 연면적 3,362.26㎡, 총 연면적 3,732.21㎡, FAR 307.45%, 71호/0세대. 업무시설 71호를 LH 주거 71호로 오인하면 안 됨. 현재 허가 변경·착공 여부 재조회 필요.",
  scenarioExplanation:"용적률산정 연면적의 5%를 부대/기계실 등에 배분, 공동주택 46㎡ 전용률 75%, 오피스텔 25㎡ 지상층 전용률 70%를 적용한 단순 상한 호수. 오피스텔 계약면적 전용률 45%는 본 FAR 호실수 계산에 사용하지 않음. 일조, 도로/공지, 층별 배치, 주차, 50호 이상 LH 커뮤니티, 주택유형 적합성 미반영.",
  scenarios:[
    doksanScenario("일반 준공업 주거 기준",250,"조례 제50조제2호가목. 공장부지 등 용도허용과 별개이며 민간 공동주택 허가로 확정된 것 아님."),
    doksanScenario("LH 공공매입임대 특례",300,"제50조제2호바목 공공주택 특별법 시행령 제2조제1항제6호 유형 해당이 필수. LH 약정/인수 적합성 확인 전 조건부."),
    doksanScenario("추가 공공임대 상한",400,"공공임대 추가공급 및 완화되는 용적률의 50% 해당 면적 공공임대 공급 등 조건부. 자동 적용 금지."),
  ],
  checks:[
    "2025.03.10 업무시설 신축허가의 허가도서·층수·세부용도(일반업무/오피스텔)와 현재 허가상태 재확인",
    "2008.01.31 기준 공장비율, 현행 건축물대장·공장등록 및 별표 12·17에 따른 공장부지 적용 예외 판정",
    "LH 서울 2026년 7차 공고의 매입임대 유형·면적·설계시공·필수 시설·인수조건과 제50조 300% 해당성 확인",
    "2024 감정가와 현재 매도가, 기존 시설 철거·토양오염·명도비 및 LH 매입가격을 별도로 수지 검토",
    "주차장 조례 별표 2/3, LH 자주식·기계식·0.3대 특례 적용요건, 대지안의 공지·일조·소방·승강기 반영해 실제 호수 재산정"
  ],
  sources:[
    {name:"서울특별시 도시계획 조례 제50조제2호 가·나·바목, 별표 12·17",url:"https://law.go.kr/ordinInfoP.do?ordinId=2000719"},
    {name:"서울시 준공업지역 공공매입임대 300%·최대 400% 공식 설명",url:"https://www.seoul.go.kr/news/news_report.do?nttNo=432092&tr_code=snews"},
    {name:"LH 서울지역본부 2026년 7차 매입약정 공고",url:"https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1754"},
    {name:"2025.06 국토교통부 건축허가 데이터 공개 재게시",url:"https://www.sankun.com/site-info/5godjpfeENLzIx8n5u4VXgJ682e7EXxNAatQAqxewFQ"},
  ]
};

export function getParcelMassingReview(address:string):ParcelMassingReview|null {
  const match=getParcelLegalGuide(address);
  if(!match) return null;
  return match.id==="osong-bongsan-992" ? osong : doksan;
}
