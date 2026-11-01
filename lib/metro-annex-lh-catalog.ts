import { METRO_ORDINANCE_SOURCES, findMetroOrdinanceSource, type MetroRegion } from "./metro-ordinance-catalog";

/**
 * Official annex/source registry — 2026-11-01 snapshot.
 * Status "verified-title" means the exact title/annex number is shown in
 * the published ordinance, NOT that its whole numerical matrix was extracted.
 * The fallback "lookup-only" means the annex itself was NOT read. No numbers
 * are generated for lookup-only entries.
 */
export type AnnexEvidenceLevel = "verified-title" | "direct-excerpt" | "lookup-only";
export type AnnexTopic = "건축조례·대지안공지" | "도시계획조례·허용용도/주거복합" | "주차장조례·부설주차" | "주차장조례·설치제한";
export interface MetroAnnexRecord {
  id:string; city:string; region:MetroRegion; topic:AnnexTopic; title:string;
  appendix:string | null; sourceUrl:string; evidence:AnnexEvidenceLevel;
  conditions:string; lastCheckedAt:string; automaticApplication:false;
}
function officialOrdinanceQuery(city:string,kind:string) {
  return "https://www.law.go.kr/ordinSc.do?menuId=3&query="+encodeURIComponent(city+" "+kind+" 조례");
}
function annex(
  id:string, city:string, region:MetroRegion, topic:AnnexTopic, title:string,
  appendix:string|null, sourceUrl:string, evidence:AnnexEvidenceLevel,
  conditions:string,
):MetroAnnexRecord{
  return {id,city,region,topic,title,appendix,sourceUrl,evidence,conditions,lastCheckedAt:"2026-11-01",automaticApplication:false};
}
const SUPPORTED_CITIES=METRO_ORDINANCE_SOURCES.map(({city,region})=>({city,region}));
const INDEX_TOPICS:Array<{suffix:string;topic:AnnexTopic;title:string;kind:string;conditions:string}>=[
  {suffix:"building-setback",topic:"건축조례·대지안공지",title:"건축조례 대지 안의 공지·건축선·조경",kind:"건축",conditions:"정확한 별표번호·유효 개정본·건축용도별 이격거리 및 필지별 건축한계선은 미추출. 건축법 제58조·시행령 제80조의2와 조례를 함께 확인."},
  {suffix:"planning-use",topic:"도시계획조례·허용용도/주거복합",title:"도시계획조례 용도지역별 허용·금지 용도 및 주상복합 별표",kind:"도시계획",conditions:"준주거·상업지역 일반수치와 주거복합 전용 별표, 지구단위계획 허용용도를 별개로 대조. 별표번호 및 수치가 확인되지 않은 지역은 자동 적용 금지."},
  {suffix:"parking-general",topic:"주차장조례·부설주차",title:"주차장조례 부설주차장 설치기준·기계식주차 조건",kind:"주차장 설치 및 관리",conditions:"공동주택·오피스텔·근생·업무시설별 법정주차, 완화·장애인·전기차·기계식 설치비율은 해당 지자체 별표 및 현행 시행일 확인 필요."},
  {suffix:"parking-restricted",topic:"주차장조례·설치제한",title:"부설주차장 설치제한·역세권 특례 적용범위",kind:"주차장 설치 및 관리",conditions:"설치제한구역 해당 여부, 역 출구 기준 거리, 허가권자 인정, LH 공고의 별도 인수조건 확인 전 감면 적용 금지."},
];
const discovered=SUPPORTED_CITIES.flatMap(({city,region})=>INDEX_TOPICS.map(t=>annex(
  city+"-"+t.suffix,city,region,t.topic,t.title,null,
  officialOrdinanceQuery(city,t.kind),"lookup-only",t.conditions
)));
const PRECISE:MetroAnnexRecord[]=[
  annex("seoul-building-annex4","서울특별시","서울","건축조례·대지안공지","서울특별시 건축 조례 제30조 대지 안의 공지","별표 4","https://www.law.go.kr/LSW/ordinSideInfoP.do?chrClsCd=010202&docCls=jo&gubun=&joBrNo=00&joNo=0030&ordinSeq=2116749&urlMode=ordinScJoAllRltInfoR","verified-title","2026.3.30 시행 제10083호 제30조가 건축선·인접대지 이격기준을 별표4로 위임. 구체 거리값은 별표 원문 숫자 직접 대조 전까지 미확정."),
  annex("seoul-parking-annex2","서울특별시","서울","주차장조례·부설주차","서울특별시 주차장 설치 및 관리 조례 부설주차장 설치기준","별표 2","https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2147707","verified-title","2026.7.13 시행 제10142호 제20조 관련 별표2 확인. 2026.10.1 후속 개정 존재 여부는 허가 단계 재대조. 실제 용도별 주차 수치는 미추출."),
  annex("seoul-parking-annex3","서울특별시","서울","주차장조례·설치제한","서울특별시 부설주차장 설치제한지역 시설물별 기준","별표 3","https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2147707","verified-title","별표3은 설치제한 지역에만 해당하는 별도 기준. 주소별 설치제한구역 포함여부·2026.10 이후 개정본 대조 없이 자동 감면 금지."),
  annex("paju-building-annex3","파주시","경기","건축조례·대지안공지","파주시 건축 조례 대지 안의 공지 기준","별표 3","https://law.go.kr/LSW/ordinInfoP.do?ordinSeq=2022817","verified-title","2025.3.20 시행 제2205호 별표3 명칭 확인. 용도·층수별 건축선 및 인접대지 이격 수치와 이후 변경은 별도 대조."),
  annex("hanam-building-annex3","하남시","경기","건축조례·대지안공지","하남시 건축 조례 제31조 대지 안의 공지 기준","별표 3","https://law.go.kr/LSW/ordinInfoP.do?ordinSeq=2076419","verified-title","2025.10.2 시행 제2464호 제31조 관련 별표3 명칭 확인. 건축형태별 이격 수치 및 최신 지구단위 건축한계선은 별도 대조."),
  annex("bucheon-building-annex4","부천시","경기","건축조례·대지안공지","부천시 건축 조례 대지 안의 공지 기준","별표 4","https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2095387","verified-title","2025.12.22 시행 제4290호 별표4 명칭 확인. 부천시 최신 개정본의 본문·수치, 특수건축물 등 개별 적용성 확인 필요."),
  annex("seongnam-building-annex3","성남시","경기","건축조례·대지안공지","성남시 건축 조례 제24조 대지 안의 공지 기준","별표 3","https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2019919","verified-title","2025.3.10 시행 제4204호 제24조 관련 별표3 명칭 확인. 2026 현재 새 개정 조례가 있는지 재검증 및 이격 수치 미추출."),
  annex("uiwang-zoning-annex6","의왕시","경기","도시계획조례·허용용도/주거복합","의왕시 도시계획조례 준주거지역 건축금지 목록","별표 6","https://www.law.go.kr/LSW/flDownload.do?flSeq=157487925","direct-excerpt","준주거 일반 금지목록에 공동주택·오피스텔 명시가 없어도 개별 지구단위계획의 C1 등 허용용도가 우선."),
  annex("uiwang-parking-annex5","의왕시","경기","주차장조례·부설주차","의왕시 주차장 설치 및 관리 조례 부설주차 설치대상·기준","별표 5","https://www.law.go.kr/LSW/flDownload.do?flSeq=167475619","direct-excerpt","2026.5.7 시행 조례: 통상 전용85㎡ 이하 세대·호실 최소 1대, 공공주택사업자 매도약정 전용30㎡ 미만 0.3대 조건부. 기계식 제20조 최대30% 등 별도."),
];
// When a precise source is available, suppress its generic indexed duplicate.
const REPLACED:Record<string,string>={
  "서울특별시-building-setback":"seoul-building-annex4",
  "서울특별시-parking-general":"seoul-parking-annex2",
  "서울특별시-parking-restricted":"seoul-parking-annex3",
  "파주시-building-setback":"paju-building-annex3",
  "하남시-building-setback":"hanam-building-annex3",
  "부천시-building-setback":"bucheon-building-annex4",
  "성남시-building-setback":"seongnam-building-annex3",
  "의왕시-planning-use":"uiwang-zoning-annex6",
  "의왕시-parking-general":"uiwang-parking-annex5",
};
export const METRO_ANNEX_RECORDS:ReadonlyArray<MetroAnnexRecord>=[
  ...PRECISE,...discovered.filter(x=>!REPLACED[x.id]),
];
export function findMetroAnnexRecords(address:string):MetroAnnexRecord[]{
  const city=findMetroOrdinanceSource(address)?.city;
  return city?METRO_ANNEX_RECORDS.filter(x=>x.city===city):[];
}

export type LhRegion="서울" | "경기북부" | "경기남부" | "인천·부천";
export interface LhPurchaseNoticeEvidence {
  id:string; region:LhRegion; title:string; noticeUrl:string; noticePdfUrl:string;
  guidelineZipUrl:string; publishedAt:string; startDate:string; closeDate:string;
  pdfPages:number; sourceStatus:"official-pdf-read";
  /** Directly source-verified minimum in the latest region-specific notice. */
  normalMinimumHomes:number; regulatedMinimumHomes:number;
  scopeNote:string; revisionNote:string; automaticApplication:false;
}
export const LH_PURCHASE_NOTICES:ReadonlyArray<LhPurchaseNoticeEvidence>=[
  {id:"seoul-6th-corrected-2026",region:"서울",title:"2026 서울지역 6차 민간신축 매입약정 (정정공고)",noticeUrl:"https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1745",noticePdfUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=69046535",guidelineZipUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=69046536",publishedAt:"2026-10-14",startDate:"2026-10-14",closeDate:"2026-11-05",pdfPages:34,sourceStatus:"official-pdf-read",normalMinimumHomes:30,regulatedMinimumHomes:10,scopeNote:"서울특별시 대상; 자치구별 매입가능지역·입지 기준 공고 별도 확인",revisionNote:"반드시 정정공고 ID 1745와 69046535를 사용. 1735 원공고 68970416으로 대체 금지.",automaticApplication:false},
  {id:"north-4th-2026",region:"경기북부",title:"2026 경기북부 4차 민간신축 매입약정",noticeUrl:"https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1730",noticePdfUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68899892",guidelineZipUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68899893",publishedAt:"2026-10-07",startDate:"2026-10-07",closeDate:"2026-11-06",pdfPages:32,sourceStatus:"official-pdf-read",normalMinimumHomes:30,regulatedMinimumHomes:10,scopeNote:"의정부·고양·남양주·구리·동두천·하남·파주·김포·양주·포천·연천·가평·양평",revisionNote:"2026 경기북부 4차 본부 공고가 3차 정정보다 후속. 건축허용용도·구역별 제외 대상은 별도 확인.",automaticApplication:false},
  {id:"south-3rd-2026",region:"경기남부",title:"2026 경기남부 3차 민간신축 매입약정",noticeUrl:"https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1716",noticePdfUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68596216",guidelineZipUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68589951",publishedAt:"2026-09-15",startDate:"2026-09-16",closeDate:"2026-10-15",pdfPages:32,sourceStatus:"official-pdf-read",normalMinimumHomes:30,regulatedMinimumHomes:10,scopeNote:"수원·성남·안양·광명·평택·안산·과천·오산·시흥·군포·의왕·용인·이천·안성·화성·광주·여주",revisionNote:"2026-11-01 현재 접수 종료. 과거 공고의 주차·면적 등은 참고 가능하나 신규 신청에 유효한 것으로 표시 금지.",automaticApplication:false},
  {id:"incheon-3rd-2026",region:"인천·부천",title:"2026 인천지역본부 3차 민간신축 매입약정",noticeUrl:"https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1741",noticePdfUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=69011056",guidelineZipUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=69011057",publishedAt:"2026-10-16",startDate:"2026-10-16",closeDate:"2026-11-05",pdfPages:32,sourceStatus:"official-pdf-read",normalMinimumHomes:20,regulatedMinimumHomes:10,scopeNote:"인천광역시 각 매입대상 구·군 및 경기도 부천시 포함. 인천형 특화주택 별도 첨부 제공.",revisionNote:"인천 일반지역 최소20호는 경기남북·서울의 30호와 다름 (PDF 1쪽). 착공·인수 조건은 인천 본부 공고 우선.",automaticApplication:false},
];
const NORTH_CITIES=["의정부시","동두천시","고양시","구리시","남양주시","하남시","파주시","김포시","양주시","포천시","연천군","가평군","양평군"];
const SOUTH_CITIES=["수원시","성남시","안양시","광명시","평택시","안산시","과천시","오산시","시흥시","군포시","의왕시","용인시","이천시","안성시","화성시","광주시","여주시"];
export function matchLhRegion(address:string):LhRegion|null{
  const a=address.replace(/\s/g,"");
  if(/^(?:서울특별시|서울시|서울)/.test(a))return "서울";
  if(/^(?:인천광역시|인천시|인천)/.test(a))return "인천·부천";
  if(!/^(?:경기도|경기)/.test(a))return null;
  if(/부천시/.test(a))return "인천·부천";
  if(NORTH_CITIES.some(city=>a.includes(city)))return "경기북부";
  if(SOUTH_CITIES.some(city=>a.includes(city)))return "경기남부";
  return null;
}
export function noticeIsOpen(notice:LhPurchaseNoticeEvidence,asOf:string):boolean{
  return asOf>=notice.startDate && asOf<=notice.closeDate;
}
export function koreaLocalDay():string {
  return new Date().toLocaleDateString("sv-SE",{timeZone:"Asia/Seoul"});
}
export function findLhPurchaseNotice(address:string):LhPurchaseNoticeEvidence|null{
  const region=matchLhRegion(address);
  return LH_PURCHASE_NOTICES.find(x=>x.region===region)??null;
}
export interface LhGuidelineEvidence {
  id:string; topic:string; detail:string; sourceLocation:string;
  conditions:string; evidence:"direct-excerpt" | "attachment-index";
  applicableRegions:LhRegion[]; automaticApplication:false;
}
export const LH_GUIDELINE_EVIDENCE:ReadonlyArray<LhGuidelineEvidence>=[
  {id:"lh-guideline-design-checklist",topic:"설계 체크리스트",detail:"LH 설계·시공 가이드라인에 따른 설계 확인 결과 제출 및 변경·무단착공 시 약정 해제 위험",sourceLocation:"2026 경기북부 4차 첨부 개정전문 XLSX · 설계 가이드라인(1) G10~G11",conditions:"본부 및 공고별 최신 적용본과 설계도면·서식 검토 필수",evidence:"direct-excerpt",applicableRegions:["경기북부"],automaticApplication:false},
  {id:"lh-guideline-area-85",topic:"단위세대 면적",detail:"세대 전용면적 85㎡ 이하 설계; 원룸형은 36㎡ 이하 설계 체크 항목",sourceLocation:"2026 경기북부 4차 설계가이드 XLSX · 설계 가이드라인(1) G12",conditions:"임대유형별 별도 전용면적 범위 및 오피스텔/주택 구분은 지역본부 공고와 대조",evidence:"direct-excerpt",applicableRegions:["경기북부"],automaticApplication:false},
  {id:"lh-guideline-elevator-4",topic:"승강기",detail:"4층 이상(필로티 포함) 또는 고령자 대상 주택은 승강기 의무; 대상 장애인 주차구획 시 장애인용 승강기 필수",sourceLocation:"2026 경기북부 4차 설계가이드 XLSX · 설계 가이드라인(1) G22",conditions:"건축법상 승강기 설치의무와 별개인 LH 매입 기준. 미설치 시 매입제외 언급",evidence:"direct-excerpt",applicableRegions:["경기북부"],automaticApplication:false},
  {id:"lh-guideline-exterior-fire",topic:"외벽 마감",detail:"외벽·필로티 외기에 면하는 천장·벽·보 등에 불연·준불연 마감재 적용",sourceLocation:"2026 경기북부 4차 설계가이드 XLSX · 설계 가이드라인(1) G21",conditions:"구체 자재 인증, 건축법 및 방화구조 기준과 함께 확인",evidence:"direct-excerpt",applicableRegions:["경기북부"],automaticApplication:false},
  {id:"lh-seoul-community",topic:"커뮤니티",detail:"청년·신혼형 커뮤니티 원칙 세대당 1㎡ 이상, 커뮤니티 0.3대 특례 공공기여 추가협의",sourceLocation:"2026 서울 6차 정정공고 PDF p.7~8",conditions:"세대수 기준·유형·LH 사전심의·허가권자 협의 확인",evidence:"direct-excerpt",applicableRegions:["서울"],automaticApplication:false},
  {id:"lh-seoul-parking03",topic:"0.3대 주차특례",detail:"전용 30㎡ 미만 청년형은 역·대학 교문 직선 500m, 고령자형은 입지 제한 없음",sourceLocation:"2026 서울 6차 정정공고 PDF p.8,25",conditions:"매도약정, 허가권자 인정, 공공기여 별도 협의; 역 출구 거리 실측 전 자동 적용 금지",evidence:"direct-excerpt",applicableRegions:["서울"],automaticApplication:false},
  {id:"lh-seoul-mechanical",topic:"기계식주차",detail:"요건 충족 시 총주차 50% 이내 계획; 0.3대 완화 적용 시 기계식 설치 지양",sourceLocation:"2026 서울 6차 정정공고 PDF p.10",conditions:"LH가 '지양'으로 표현. 경기남부 등 다른 지역 공고의 금지와 혼동 금지. 지자체 조례의 더 엄격한 비율·허용구역 우선.",evidence:"direct-excerpt",applicableRegions:["서울"],automaticApplication:false},
  {id:"lh-incheon-minimum20",topic:"매입 최소 세대수",detail:"인천지역본부 2026 3차는 비규제지역 20호 이상, 규제지역 10호 이상",sourceLocation:"2026 인천 3차 공고 PDF p.1",conditions:"매입대상 유형 및 규제지역 시행일·부분매입 조건은 별도 확인",evidence:"direct-excerpt",applicableRegions:["인천·부천"],automaticApplication:false},
  {id:"lh-incheon-quality",topic:"인천형 특화주택",detail:"인천형 특화주택(매입 선호 건축계획 및 입지) 별도 PDF와 지역수요 맞춤형 주택 안내 첨부",sourceLocation:"2026 인천 3차 첨부 ZIP · 첨부5, 첨부6",conditions:"공고에 별도 첨부돼 있는 가이드 원문 세부 설계 지표는 미추출: 특정 성능·면적 수치 임의 생성 금지",evidence:"attachment-index",applicableRegions:["인천·부천"],automaticApplication:false},
  {id:"lh-incheon-structure-safety",topic:"구조·현장 관리",detail:"준공 후 전문기관 안전진단 및 구조·레미콘·매립공종 영상기록물 제출 의무 안내",sourceLocation:"2026 인천 3차 공고 PDF p.1",conditions:"가이드라인의 구체 영상 촬영 범위·구조확인서와 단계별 서류 별도 검토",evidence:"direct-excerpt",applicableRegions:["인천·부천"],automaticApplication:false},
  {id:"lh-south-mechanical03",topic:"기계식주차·0.3대 병행",detail:"2026 경기남부 3차 공고는 0.3대 완화를 적용한 매입약정 계획에 기계식주차 병행 불허/매입제외 기준 안내",sourceLocation:"2026 경기남부 3차 공고 PDF p.8~10",conditions:"2026.10.15 접수 종료: 신규 신청에 조건 자동 승인 불가. 지역 조례·LH 후속 공고 확인",evidence:"direct-excerpt",applicableRegions:["경기남부"],automaticApplication:false},
  {id:"lh-guideline-master",topic:"설계·시공 원문",detail:"서울·경기남부·경기북부·인천에서 각각 신청서식 및 설계·시공 가이드라인 ZIP 제공",sourceLocation:"2026 해당 본부 LH 매입약정 공고 첨부파일 목록",conditions:"각 ZIP 내 XLSX/문서 개정본은 주택 유형과 지역에 맞춰 적용. 본문 전 항목 자동 숫자 추출·적용은 아직 미완료",evidence:"attachment-index",applicableRegions:["서울","경기북부","경기남부","인천·부천"],automaticApplication:false},
];
export function findLhGuidelines(address:string):LhGuidelineEvidence[]{
  const region=matchLhRegion(address);
  return region?LH_GUIDELINE_EVIDENCE.filter(x=>x.applicableRegions.includes(region)):[];
}
export const ANNEX_LH_CATALOG_SNAPSHOT="2026-11-01";
