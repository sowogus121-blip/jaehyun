/**
 * Official-reference directory for LH development review, snapshot 2026-11-11.
 * Reference availability != approval, annex content extracted, or parcel applicability.
 * No restricted appraisals, leases, ownership, or user uploads in this public module.
 */
import { getParcelLegalGuide } from "./parcel-legal-guides";

export type AnnexScope = "공통" | "오송" | "독산";
export type AnnexKind = "별표" | "법령" | "조례" | "고시" | "지구단위 지침" | "결정도" | "LH 공고" | "LH 첨부파일" | "LH 가이드라인" | "인허가";
export interface ParcelAnnexSource {
  id: string;
  scope: AnnexScope;
  kind: AnnexKind;
  title: string;
  purpose: string;
  url: string;
  /** Explicit reading/verification limit; this directory never grants legal applicability. */
  reviewStatus: string;
}

export const PARCEL_ANNEX_SOURCES: readonly ParcelAnnexSource[] = [
  { id:"building-decree-annex-1", scope:"공통",kind:"별표",title:"건축법 시행령 별표 1 · 용도별 건축물 종류",purpose:"공동주택과 업무시설(오피스텔), 근린생활시설의 용도 구분을 선결 확인",url:"https://www.law.go.kr/법령/건축법시행령",reviewStatus:"원문 위치 확인 · 현행 별표 세부항목 검토 필요" },
  { id:"parking-decree-annex-1", scope:"공통",kind:"별표",title:"주차장법 시행령 별표 1 · 부설주차장 설치기준",purpose:"건축물 용도에 따른 일반 기준 확인. 지자체 별표 및 LH 인수기준과 교차 검토",url:"https://www.law.go.kr/법령/주차장법시행령",reviewStatus:"원문 위치 확인 · 지역 조례 우선 대조" },
  { id:"housing-construction-standards", scope:"공통",kind:"법령",title:"주택건설기준 등에 관한 규정 제27조 등",purpose:"공동주택 주차장 및 주민공동시설 등의 기준을 LH 요구와 구분해 적용",url:"https://www.law.go.kr/법령/주택건설기준등에관한규정",reviewStatus:"원문 위치 확인 · 세대수별 적용 미판정" },
  { id:"officetel-construction-standard", scope:"공통",kind:"고시",title:"오피스텔 건축기준",purpose:"업무시설 오피스텔 구획·피난·설비 및 주거용 설계조건 대조",url:"https://www.law.go.kr/LSW/admRulInfoP.do?admRulSeq=2100000252038&chrClsCd=010201",reviewStatus:"행정규칙 원문 링크 · 개정 여부 확인" },
  { id:"building-act-common", scope:"공통",kind:"법령",title:"건축법 제42·43·46·58·61조",purpose:"조경·공개공지·건축선·대지 안의 공지·일조 및 채광 검토. 지역별 조례 별표와 연동",url:"https://www.law.go.kr/법령/건축법",reviewStatus:"법령 원문 링크 · 용도별 요건 미판정" },
  { id:"public-housing-special", scope:"공통",kind:"법령",title:"공공주택 특별법 및 시행령",purpose:"민간 신축매입약정과 법정 공공임대주택의 정의·사업주체·특례적용 요건 구분",url:"https://www.law.go.kr/법령/공공주택특별법시행령",reviewStatus:"원문 위치 확인 · 자동 용적률 완화 금지" },
  { id:"barrier-free-annex", scope:"공통",kind:"별표",title:"장애인등편의법 시행령 별표 1·2",purpose:"편의시설 설치대상·의무시설을 규모와 용도별로 판단",url:"https://www.law.go.kr/법령/장애인ㆍ노인ㆍ임산부등의편의증진보장에관한법률시행령",reviewStatus:"별표 위치 확인 · 개별 시설 기준 미산정" },
  { id:"lh-design-2026", scope:"공통",kind:"LH 가이드라인",title:"2026년 신축 매입임대주택 설계 및 시공 가이드라인(첨부자료 포함)",purpose:"LH 본사 자료실 2026.09.02 게시. 세대 유형·전용면적·부대시설·설계/시공 체크리스트의 공통 기준 후보. 신청 지역본부 공고 붙임 우선 대조",url:"https://apply.lh.or.kr/lhapply/apply/noti/an/list.do?mi=1080&slBbsKdCd=02",reviewStatus:"공식 자료실 제목·게시일 확인 · 첨부 전문 미열람" },
  { id:"lh-cost-estimate-2026", scope:"공통",kind:"LH 가이드라인",title:"LH 신축 매입약정 공사비 연동형 내역서 양식 개정본",purpose:"공사비·매입예정가격 검토 시 적용 공고 및 가격형식 확인. 일반 건축 법규 상한으로 혼용 금지",url:"https://apply.lh.or.kr/lhapply/apply/noti/an/list.do?mi=1080&slBbsKdCd=02",reviewStatus:"2026.10.19 자료실 게시 확인 · 내역서 원문 미열람" },
  { id:"osong-article27", scope:"오송",kind:"지구단위 지침",title:"오송바이오폴리스 지구단위 시행지침 제27조 · 건축물 용도제한표",purpose:"상업·업무시설용지 C01~C18은 오피스텔을 불허, 공동주택은 허용용도에 없음. 해당 획지번호 및 변경고시 확정 전 필지판정 보류",url:"https://cjic.cheongju.go.kr/DATA/download/cic/cts226_file.pdf",reviewStatus:"원문 PDF 13쪽(인쇄 11쪽) 대조 · 획지 적용 미확정" },
  { id:"osong-article28", scope:"오송",kind:"지구단위 지침",title:"오송바이오폴리스 시행지침 제28·29조 · 규모제한·건축선",purpose:"C01~C18: 건폐율 80% 이하 / 용적률 1000% / C01~06 최고 15층·C07~18 최고 10층; 지원·근린생활 획지는 별도 기준. 주거용도 허용 의미 아님",url:"https://cjic.cheongju.go.kr/DATA/download/cic/cts226_file.pdf",reviewStatus:"원문 PDF 14쪽(인쇄 12쪽) 대조 · 획지 적용 미확정" },
  { id:"osong-district-map", scope:"오송",kind:"결정도",title:"청주시 오송바이오폴리스 지구단위 결정도·시행지침도",purpose:"봉산리 992의 정확한 C/D/E 획지번호, 건축한계선, 차량출입·보행동선, 후속 변경고시 확인 필요. 용도지역 일반값만 자동 적용 금지",url:"https://cjic.cheongju.go.kr/cic/contents.do?key=226",reviewStatus:"공식 지구단위 자료실 확인 · 현행 필지중첩 미확인" },
  { id:"osong-city-parking-annex7", scope:"오송",kind:"별표",title:"청주시 주차장 조례 제15조·별표 7 · 설치대상 및 주차대수",purpose:"부설주차장 용도별 산정표. 2026.09.23 개정 제15조제3항: 기계식 30대 이상 설치하는 경우에만 허용; 방향전환장치 규정 확인. LH 인수 기준 별도",url:"https://www.law.go.kr/LSW/ordinInfoR.do?chrClsCd=010202&ordinSeq=2170297",reviewStatus:"현행 조례 제15조·별표7 목록 검증 · 별표 표내용 미추출" },
  { id:"osong-city-building-annex4", scope:"오송",kind:"별표",title:"청주시 건축 조례 별표 4 · 대지 안의 공지",purpose:"대지경계·도로·용도·규모별 이격기준 검토; 건축선과 지구단위 결정도 중복 제한 확인",url:"https://law.go.kr/ordinInfoP.do?ordinId=2126720",reviewStatus:"현행 조례 링크 확보 · 별표 내용·필지적용 미판정" },
  { id:"osong-city-plan-ordinance", scope:"오송",kind:"조례",title:"청주시 도시계획 조례 · 일반상업지역 일반기준",purpose:"일반상업지역 조례 건폐율·용적률과 지구단위 지침의 획지별 용도·최고층이 충돌하지 않도록 중첩 확인",url:"https://www.law.go.kr/자치법규/청주시도시계획조례",reviewStatus:"원문 확인 대상 · 획지별 특수기준 우선" },
  { id:"osong-lh-notice-2026", scope:"오송",kind:"LH 공고",title:"LH 충북지역본부 2026년 민간신축 매입약정 정정공고",purpose:"공고일 2026.04.30 / 접수 마감 2026.11.30. 사업유형·주차·접수조건 및 첨부 지침의 현행판 확인",url:"https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1632",reviewStatus:"공식 LH 공고와 정정 상태 확인" },
  { id:"osong-lh-zip", scope:"오송",kind:"LH 첨부파일",title:"[붙임] 충북지역본부 민간신축 매입약정 신청서식 및 설계시공 가이드라인(정정).zip",purpose:"2026 공고 정정 첨부를 직접 내려받아 지역본부별 설계 시공표·유형·주차·특례를 검증해야 함. 사이트는 파일 링크만 제공",url:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=66672954",reviewStatus:"공고 첨부 링크 확인 · 압축파일 내부 미열람" },
  { id:"osong-building-permit", scope:"오송",kind:"인허가",title:"세움터 건축허가·착공신고 및 허가변경 확인",purpose:"기존 근생 등 비주거 건축허가의 법적 상태와 취소/변경 조건 확인. 과거 허가 면적을 LH 공동주택/오피스텔 계획값으로 전용하지 않음",url:"https://www.eais.go.kr/",reviewStatus:"공식 인허가 시스템 · 해당 필지 현황 미조회" },
  { id:"doksan-industrial-annex12", scope:"독산",kind:"별표",title:"서울특별시 도시계획 조례 별표 12 · 준공업지역 금지 건축물",purpose:"제33조제11호에 따른 준공업지역 불허용도 및 예외조건. 지구단위계획·기존 공장부지와 연계",url:"https://law.go.kr/ordinInfoP.do?ordinId=2000719",reviewStatus:"현행 조례 별표 목록 확인 · 표 전문 미추출" },
  { id:"doksan-industrial-annex17", scope:"독산",kind:"별표",title:"서울특별시 도시계획 조례 별표 17 · 준공업지역 공동주택 허용기준",purpose:"공장부지·공장이적지의 공동주택 허용 요건과 기존 공장시설 현황 등 확인. 적용성 확인 전 공동주택 적합 처리 금지",url:"https://law.go.kr/ordinInfoP.do?ordinId=2000719",reviewStatus:"현행 별표 목록 확인 · 필지 공장부지 해당 여부 미확정" },
  { id:"doksan-industrial-bcr-far", scope:"독산",kind:"조례",title:"서울특별시 도시계획 조례 제44·50조 · 준공업지역 건폐율·용적률",purpose:"준공업지역 일반 건폐율 60%; 공동주택·오피스텔 용적률 250% 기준. 최대 400% 특례는 공공시설 제공·지구단위 요건 충족 시 별도 심사; 자동반영 금지",url:"https://law.go.kr/ordinInfoP.do?ordinId=2000719",reviewStatus:"조례 본문 근거 확인 · 특례 적용 별도" },
  { id:"doksan-seoul-parking-annex2", scope:"독산",kind:"별표",title:"서울특별시 주차장 설치 및 관리 조례 별표 2 · 부설주차장 설치기준",purpose:"용도별 법정 주차대수 기준. 공동주택/오피스텔/근생 혼합 시 용도별 산정체계 구별",url:"https://www.law.go.kr/LSW/ordinInfoP.do?chrClsCd=010202&gubun=&ordinSeq=2171833",reviewStatus:"현행 조례 원문 링크 · 표 전문 미추출" },
  { id:"doksan-seoul-parking-annex3", scope:"독산",kind:"별표",title:"서울특별시 주차장 설치 및 관리 조례 별표 3 · 설치제한지역 기준",purpose:"주차장 설치 제한지역 해당 여부가 확인될 때만 적용하는 별도 기준; 전용 30㎡ 미만 주차특례로 자동 대체 불가",url:"https://www.law.go.kr/LSW/ordinInfoP.do?chrClsCd=010202&gubun=&ordinSeq=2171833",reviewStatus:"현행 조례 별표 대상 · 제한지역 해당 미확인" },
  { id:"doksan-seoul-building-annex4", scope:"독산",kind:"별표",title:"서울특별시 건축 조례 제30조·별표 4 · 대지 안의 공지",purpose:"건축법 제58조 위임 별표. 공동주택·업무시설 층수/높이·인접대지/도로 조건별 이격 검토",url:"https://law.go.kr/ordinInfoP.do?ordinId=2000120",reviewStatus:"현행 조례 확인 · 세부 이격표 미추출" },
  { id:"doksan-seoul-building-open-space", scope:"독산",kind:"조례",title:"서울특별시 건축 조례 · 공개공지·조경",purpose:"건축법 제42·43조 위임 기준. 대상용도·대지/연면적·공개공지 의무조건 대조 전 확보면적 임의확정 금지",url:"https://law.go.kr/ordinInfoP.do?ordinId=2000120",reviewStatus:"조례 원문 링크 · 해당 대상 여부 미판정" },
  { id:"doksan-lh-notice-2026-7", scope:"독산",kind:"LH 공고",title:"LH 서울지역본부 2026년 7차 민간신축 매입약정 공고",purpose:"2026.11.06 공고, 2026.11.30 마감; 접수·대상지역·유형·주차·부대시설을 최신 7차 첨부로 판정. 구 서울 6차 수치 자동 재사용 금지",url:"https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1754",reviewStatus:"공식 공고일·마감·첨부 존재 확인" },
  { id:"doksan-lh-zip", scope:"독산",kind:"LH 첨부파일",title:"[첨부] 신청서식 및 설계시공 가이드라인 등(2026년 7차).zip",purpose:"해당 서울 7차의 설계·시공 기준·체크리스트 및 LH 주차인수 조건 공식 압축파일. 다운로드 제공, 내부 표 수치는 미검증",url:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=69293403",reviewStatus:"공고 첨부 링크 확인 · 압축파일 내부 미열람" },
  { id:"doksan-factory-deconstruction", scope:"독산",kind:"법령",title:"건축물관리법 · 공장 해체 및 기존건축물 현황",purpose:"기존 공장/창고 등 건축물대장·해체허가 여부·환경조사·토양오염 및 지장물 검토. LH 매입예정가의 사업성 분리",url:"https://www.law.go.kr/법령/건축물관리법",reviewStatus:"법령 링크 · 개별 현황 확인 전" }
];

export function getParcelAnnexSources(address: string): ParcelAnnexSource[] {
  const parcel = getParcelLegalGuide(address);
  if (!parcel) return [];
  const scope: AnnexScope = parcel.id === "osong-bongsan-992" ? "오송" : "독산";
  return PARCEL_ANNEX_SOURCES.filter(s => s.scope === "공통" || s.scope === scope);
}
