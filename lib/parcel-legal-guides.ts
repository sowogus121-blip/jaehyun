/**
 * Parcel-scoped evidence cards. Source excerpts are public law/notice material only.
 * Never publish appraisals, private ownership, lease schedules or user documents here.
 * Source provision confirmed !== parcel application confirmed.
 * Confirm parcel block against the currently effective cadastral overlay and any later amendments.
 * Updated 2026-11-11.
 */
export type ParcelGuideStatus = "source-confirmed" | "parcel-check" | "review";
export interface ParcelLegalRule {
  title: string;
  detail: string;
  basis: string;
  sourceUrl: string;
  status: ParcelGuideStatus;
}
export interface ParcelLegalGuide {
  id: "osong-bongsan-992" | "seoul-doksan-151-10";
  name: string;
  conclusion: string;
  caveat: string;
  rules: readonly ParcelLegalRule[];
}
const OSONG_GUIDE: ParcelLegalGuide = {
  id: "osong-bongsan-992",
  name: "오송읍 봉산리 992 · LH 매입약정 법규 선결검토",
  conclusion: "오송바이오폴리스 C계열 상업·업무시설 획지라면 LH 공동주택·오피스텔안 부적합. 현재 획지번호·최종 변경고시 대조 전에는 필지의 최종 판정 보류.",
  caveat: "2016년 구역 시행지침 원문을 확보했으나 봉산리 992의 C01~C18 세부 획지번호 및 이후 변경 이력은 확인 중입니다. 일반상업지역이라는 용도지역만으로 주거·오피스텔을 허용하거나 근생 허가연면적을 주거 규모로 환산하면 안 됩니다.",
  rules: [
    {
      title: "오송바이오폴리스지구 · 허용용도",
      detail: "시행지침 제27조 C01~C18 상업·업무시설용지는 공동주택을 허용용도에 열거하지 않고 '오피스텔 용도는 불허'를 명시. D계열도 오피스텔 불허, E계열은 근린생활시설만 허용.",
      basis: "청주시 오송2산단 지구단위계획 시행지침, PDF 13쪽(인쇄 11쪽), 제27조",
      sourceUrl: "https://cjic.cheongju.go.kr/DATA/download/cic/cts226_file.pdf",
      status: "parcel-check"
    },
    {
      title: "오송바이오폴리스지구 · 획지별 건폐율·용적률·층수",
      detail: "제28조 C01~C18: 건폐율 80% 이하, 용적률 1,000%, 최고층 C01~C06 15층 / C07~C18 10층. 이는 C계열 획지의 기준이며 주거 허용 근거가 아닙니다.",
      basis: "동 시행지침 PDF 14쪽(인쇄 12쪽), 제28조",
      sourceUrl: "https://cjic.cheongju.go.kr/DATA/download/cic/cts226_file.pdf",
      status: "parcel-check"
    },
    {
      title: "획지번호·건축선·차량출입 위치",
      detail: "최신 지적중첩 및 시행지침도에서 봉산리 992의 C/D/E 획지번호, 건축한계선, 보행동선, 차량출입불허구간, 개정 이력 확인. 별도 도면 조회 완료 전 수치 자동적용 금지.",
      basis: "청주시 공식 지구단위계획 / 오송2산단 시행지침 제4조제4항·제29조",
      sourceUrl: "https://cjic.cheongju.go.kr/cic/contents.do?key=226",
      status: "parcel-check"
    },
    {
      title: "청주시 일반상업지역 조례 일반값",
      detail: "청주시 도시계획 조례 제61조(80% 이하) 및 제67조(1,000% 이하). 지구단위계획의 용도 제한과 층수 제한을 해제하지 않음.",
      basis: "청주시 도시계획 조례 2026.09.23 시행, 조례 제1834호",
      sourceUrl: "https://law.go.kr/ordinSc.do?menuId=3&nwYn=1&query=%EC%B2%AD%EC%A3%BC%EC%8B%9C+%EB%8F%84%EC%8B%9C%EA%B3%84%ED%9A%8D+%EC%A1%B0%EB%A1%80&subMenu=1&subMenuId=27&tabMenuId=139",
      status: "source-confirmed"
    },
    {
      title: "청주시 주차장 조례 · 2026년 기계식 기준 개정",
      detail: "제15조제3항은 2026.09.23 개정. 기계식주차장은 30대 이상 설치하는 경우만 허용, 내부 방향전환장치 원칙. 구 50% 자주식 의무 문구를 현행으로 재사용하지 말 것. LH 인수조건은 별도.",
      basis: "청주시 주차장 조례 제15조·별표 7, 조례 제1823호(2026.09.23)",
      sourceUrl: "https://www.elis.go.kr/allalr/selectAlrBdtOne?alrNo=43990229333006&histNo=015&menuNm=main",
      status: "source-confirmed"
    },
    {
      title: "LH 충북지역본부 2026 민간신축 매입약정 4차 정정",
      detail: "2026.10.29 정정, 2026.11.30 접수마감. 청주시 대상이지만 지구단위계획 허용용도 및 공고의 주택 유형·입지·주차·가이드라인 충족이 우선. 매입약정 인수 확약으로 해석 금지.",
      basis: "LH 청약플러스 공고 원문(충북지역본부, 정정공고)",
      sourceUrl: "https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1632",
      status: "source-confirmed"
    },
    {
      title: "기존 건축허가·착공·매각상태",
      detail: "기존 비주거 건축허가의 변경·취소 가능성과 현재 착공·사용승인 상태를 청주시 건축행정자료에서 재확인. 토지비와 기존 허가량은 신축 LH 주거 적합성의 근거가 아님.",
      basis: "건축법 건축허가·변경허가 규정 / 세움터 확인 필요",
      sourceUrl: "https://www.eais.go.kr/",
      status: "review"
    },
    {
      title: "주차·LH 0.3대 특례 및 인수",
      detail: "LH 공고의 해당 공급유형·역세권 및 주택유형별 주차특례 적용조건, 자주식/기계식 인수제한과 주차장법 시행령 별표 1을 별도 대조. 자동 0.3대 적용 금지.",
      basis: "주차장법 시행령·청주시 주차장 조례·LH 공고 붙임 가이드라인",
      sourceUrl: "https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1632",
      status: "review"
    }
  ]
};
const DOKSAN_GUIDE: ParcelLegalGuide = {
  id: "seoul-doksan-151-10",
  name: "금천구 독산동 151-10 · LH 매입약정 법규 선결검토",
  conclusion: "준공업지역 일반 주거 250%, LH 공공매입임대 해당 시 300% 별도 특례 및 추가 공공임대 조건 시 최대 400%를 구분해야 함. 별표 12·17의 공장부지 판정과 2025 업무시설 허가 확인이 우선.",
  caveat: "공장부지/이적지·2008년 기준 공장비율, 주거용도 허용, 실제 LH 공공매입임대 해당성과 2025년 업무시설 신축허가의 현재 효력을 재검증해야 합니다. 기존 허가의 307.45%는 업무시설의 이력으로 LH 주거용도를 자동 허용하지 않습니다. 개인 감정평가서의 임대차·담보 정보는 사이트 공용 DB에 넣지 않습니다.",
  rules: [
    {
      title: "준공업지역 건폐율 60%",
      detail: "서울특별시 도시계획 조례 제44조상 준공업지역 건폐율 일반상한은 60%. 다른 특례·지구단위계획 적용 시 별도 검토.",
      basis: "서울특별시 도시계획 조례 제44조(2026.07.13 시행)",
      sourceUrl: "https://law.go.kr/ordinInfoP.do?ordinId=2000719",
      status: "source-confirmed"
    },
    {
      title: "준공업지역 공동주택·오피스텔 용적률 250%",
      detail: "동 조례 제50조제2호 가목: 공동주택·노인복지주택·오피스텔·다중생활시설 250% 이하. 공공시설 제공 등을 수반한 지구단위계획은 시장 기준에 따라 400%까지 가능하나 자동 부여가 아님.",
      basis: "서울특별시 도시계획 조례 제50조제2호 가목(2026.07.13)",
      sourceUrl: "https://law.go.kr/ordinInfoP.do?ordinId=2000719",
      status: "source-confirmed"
    },
    {
      title: "준공업지역 공장부지 공동주택 허용기준",
      detail: "별표 12(금지 건축물 예외)와 별표 17(공장부지 등 공동주택 허용기준) 동시 검토. 건물대장상 공장 존재만으로 공장부지 비율/이적지 해당성 및 지구단위계획 필요조건을 단정하지 말 것.",
      basis: "서울특별시 도시계획 조례 제33조제11호, 별표 12·17",
      sourceUrl: "https://law.go.kr/ordinInfoP.do?ordinId=2000719",
      status: "parcel-check"
    },
    {
      title: "LH 공공매입임대 300% 별도 용적률 특례",
      detail: "서울시 도시계획 조례 제50조제2호바목은 공공주택 특별법 시행령 제2조제1항제6호의 기존주택등매입임대주택에 300%를 정함. LH 매입약정 방식이 현행 해당 유형 및 세부운영기준을 충족하는지 확인 전 자동 적용 금지. 이는 일반 공동주택·오피스텔 250%와 별개의 조건부 경로.",
      basis: "서울특별시 도시계획 조례 제50조제2호바목(2026.07.13 시행), 서울시 2025.03.27 공보",
      sourceUrl: "https://law.go.kr/ordinInfoP.do?ordinId=2000719",
      status: "source-confirmed"
    },
    {
      title: "2025년 업무시설 신축허가 이력",
      detail: "국토부 건축데이터 공개 재게시(2025.06.02 기준): 2025.03.10 업무시설 신축허가, 71호/0세대, 건축면적 422.24㎡, 용적률 산정 3,362.26㎡, 전체 연면적 3,732.21㎡, 건폐율 38.61%, 용적률 307.45%. 주용도 업무시설로서 LH 주거 71호 허가가 아님. 최신 허가도서·착공·변경 여부 확인 필요.",
      basis: "국토교통부 건축행정 데이터 공개 재게시(2025.06.02)",
      sourceUrl: "https://www.sankun.com/site-info/5godjpfeENLzIx8n5u4VXgJ682e7EXxNAatQAqxewFQ",
      status: "review"
    },
    {
      title: "공공임대 추가용적률 특례",
      detail: "제50조제2호나목 및 바목 단서는 추가 공공임대주택 공급 등에 따라 400%까지 검토할 수 있도록 하되 완화되는 용적률의 50% 상당 면적을 공공임대주택으로 공급하도록 규정. 400%를 LH 300%에 무조건 중첩 적용하거나 주거용 오피스텔을 자동 공공임대로 간주하지 말 것.",
      basis: "서울특별시 도시계획 조례 제50조제2호 나목 / 공공주택 특별법 시행령 제2조",
      sourceUrl: "https://law.go.kr/ordinInfoP.do?ordinId=2000719",
      status: "review"
    },
    {
      title: "서울 주차장 설치 및 관리 조례",
      detail: "2026.10.01 시행 조례 제20조·별표 2의 주택·오피스텔 부설주차장 구분. 비주거 혼합 시 용도별 합산. 역세권 0.3대 특례 및 기계식 허용은 LH 공고·별표의 현행 요건 확인 후 입력.",
      basis: "서울특별시 주차장 설치 및 관리 조례 제20·21조, 별표 2·3",
      sourceUrl: "https://law.go.kr/LSW/ordinInfoP.do?chrClsCd=010202&gubun=&ordinSeq=2171833",
      status: "source-confirmed"
    },
    {
      title: "건축법·금천구 건축 조례",
      detail: "건축법 제42조 조경, 제43조 공개공지, 제46조 건축선, 제58조 대지안의 공지, 제61조 일조·채광 및 서울시·금천구 건축조례 시행요건 확인. 대지면적만으로 공개공지 의무 확정 불가.",
      basis: "건축법 및 서울시·금천구 건축조례",
      sourceUrl: "https://www.law.go.kr/법령/건축법",
      status: "review"
    },
    {
      title: "기존 공장 철거·환경 및 명도",
      detail: "현재 건축물대장·공장등록 여부, 해체허가·신고, 토양오염 우려와 임대차 명도, 공장 이전·대체 산업시설 관련 제한 검토. 과거 감정평가서는 현재 법적 상태의 증거가 아님.",
      basis: "건축물관리법 · 토양환경보전법 · 건축물대장·등기 열람",
      sourceUrl: "https://www.law.go.kr/법령/건축물관리법",
      status: "review"
    },
    {
      title: "LH 서울지역본부 2026년 7차 민간신축 매입약정",
      detail: "2026.11.06 공고, 11.30 접수마감. 금천구 대상여부/유형·호당 면적·주차·커뮤니티·설계시공 가이드라인·매입단가 산정 확인. 토지가격이 LH 매입예상가 이하라고 단정 금지.",
      basis: "LH 청약플러스 서울지역본부 2026년 7차 공고 목록",
      sourceUrl: "https://apply.lh.or.kr/lhapply/apply/pch/list.do?mi=1076",
      status: "source-confirmed"
    }
  ]
};

export const PARCEL_LEGAL_GUIDES = [OSONG_GUIDE, DOKSAN_GUIDE] as const;

export function getParcelLegalGuide(address: string): ParcelLegalGuide | null {
  const key = (address || "").replace(/[\s\-]/g, "").toLowerCase();
  if (key.includes("봉산리992") && (key.includes("오송") || key.includes("청주"))) return OSONG_GUIDE;
  if (key.includes("독산동15110")) return DOKSAN_GUIDE;
  return null;
}
