/**
 * Persisted, human-reviewed excerpts from an uploaded 34-page LH notice.
 * THIS IS NOT A STORED COPY OF THE PDF AND IS NOT A NATIONAL LEGAL STANDARD.
 * Source is the 2026-10-14 Seoul 6th original (sha256 below); official LH
 * listing subsequently marks that original as corrected. Check final revision
 * before relying on an excerpt for Seoul submissions.
 */
export interface NoticeMemoryRule {
  topic: string;
  condition: string;
  sourcePage: number;
  status: "source-extracted";
}
export interface NoticeMemory {
  id: string;
  name: string;
  region: "서울특별시" | "경기북부";
  publishedAt: string;
  closesAt: string;
  officialUrl: string;
  sourceKind: string;
  revisionWarning: string;
  originalSha256?: string;
  rules: NoticeMemoryRule[];
}

export const LH_NOTICE_MEMORY: ReadonlyArray<NoticeMemory> = [
  {
    id: "lh-seoul-2026-6-upload-20261014",
    name: "(서울지역) 2026년 민간 신축 매입약정 방식 6차 공고 · 업로드 원문 분석",
    region: "서울특별시",
    publishedAt: "2026-10-14",
    closesAt: "2026-11-05",
    officialUrl: "https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1735",
    sourceKind: "사용자 업로드 34쪽 공고 PDF에서 추출·대조한 구조화 기준",
    originalSha256: "28e5e79c3a28beb14d976f3f5ae16347a8e6a9f3eb91bc25b741e238750d1532",
    revisionWarning: "원 공고는 공식 LH 사이트에서 정정공고중으로 표시됨. 본 보관본의 32쪽 마감일 요일(화)은 오류이고 2026-11-05은 목요일. 정정공고·최신 가이드라인을 반드시 우선 확인.",
    rules: [
      { topic: "지역", condition: "서울특별시 소재 주택만 매입대상 (파주시·경기북부 자동 적용 금지)", sourcePage: 3, status: "source-extracted" },
      { topic: "신혼·신생아Ⅰ·Ⅱ", condition: "전용 36~85㎡, 침실 2개 이상 원칙; 실사용면적 45㎡ 이상 권장", sourcePage: 3, status: "source-extracted" },
      { topic: "청년형", condition: "전용 19~60㎡, 방 1개 이상; 기숙사형 실사용면적 22~25㎡ 권장", sourcePage: 3, status: "source-extracted" },
      { topic: "신청 및 토지", condition: "토지소유권·매매계약 또는 감정평가 동의 조건 필요. 사유지 복수 필지 동의 75% 이상 및 면적 과반, 최종 100% 동의 필요", sourcePage: 4, status: "source-extracted" },
      { topic: "커뮤니티", condition: "청년·신혼형 50호 이상 커뮤니티 의무, 세대당 1.0㎡ 이상; 기타공용·지상 1층 원칙", sourcePage: 8, status: "source-extracted" },
      { topic: "경비·관리", condition: "경비실 50세대 이상, 관리사무소 150세대 이상 (유형·주택 형태 세부조건 대조)", sourcePage: 7, status: "source-extracted" },
      { topic: "근린생활시설", condition: "근린생활시설 매입은 원칙적으로 지양, 의무 설치 시 근생을 제외한 주택 매입 협의 가능", sourcePage: 8, status: "source-extracted" },
      { topic: "기계식 주차", condition: "GTX 포함 도시철도역 출구 직선 500m 이내 + 청년·신혼 + 주거용 오피스텔·도시형생활주택 세 조건 모두 충족; 총 주차의 50% 이하, 150세대 미만 20대 미만 우대", sourcePage: 10, status: "source-extracted" },
      { topic: "기계식·특례 병행", condition: "전용 30㎡ 미만 0.3대 완화 적용 시 기계식주차 설치 지양 (절대 금지와 구별)", sourcePage: 10, status: "source-extracted" },
      { topic: "0.3대 특례", condition: "전용 30㎡ 미만 청년·고령자 대상. 청년은 역 출구/대학 교문 직선 500m, 고령자는 입지 제한 없음; 매입약정·허가권자 협의 조건", sourcePage: 25, status: "source-extracted" },
      { topic: "용적률 120%", condition: "국토계획법 시행령 제85조제3항제1호의 공공임대주택 제도 소개로서 지자체 조례·지구단위·사업 요건 확인 전 자동 적용 불가", sourcePage: 24, status: "source-extracted" },
      { topic: "매입 제외", condition: "지구단위계획상 신축매입임대주택 건축 불가 시 매입 제외. 예정 변경사항을 미리 적용한 도면도 제외", sourcePage: 13, status: "source-extracted" },
      { topic: "사전상담", condition: "50호 이상 접수분은 접수마감 7일 전까지 사전컨설팅 신청 필수", sourcePage: 1, status: "source-extracted" },
      { topic: "매매대금", condition: "1·2차 감정평가, 매매예정금액 대비 최종대금 변동 상·하한 ±10% 등 세부요건", sourcePage: 16, status: "source-extracted" },
    ],
  },
  {
    id: "lh-gyeonggi-north-2026-4",
    name: "(경기북부) 2026년 4차 민간 신축 매입약정 방식 공고",
    region: "경기북부",
    publishedAt: "2026-10-07",
    closesAt: "2026-11-06",
    officialUrl: "https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1730",
    sourceKind: "기존 사이트에서 별도로 검증·적용 중인 경기북부 4차 공고의 연결",
    revisionWarning: "파주시는 경기북부 본부 대상. 서울 6차 공고 수치로 덮어쓰지 않고 해당 경기북부 원문 및 설계·시공 가이드라인으로 확인.",
    rules: [],
  },
];

export function noticeAppliesToAddress(notice: NoticeMemory, address: string): boolean {
  const normalized = address.replace(/\s+/g, "");
  if (notice.region === "서울특별시") return /^(?:서울특별시|서울시|서울)/.test(normalized);
  // Explicitly enumerate the LH 경기북부 4차 notice's municipal coverage;
  // never infer applicability from the mere word "경기".
  return /(?:의정부시|동두천시|고양시|구리시|남양주시|하남시|파주시|김포시|양주시|포천시|연천군|가평군|양평군)/.test(normalized)
    && !/^(?:서울|부산|대구|인천|광주|대전|울산|세종|제주)/.test(normalized);
}

export function getNoticeMemoryStatus(address: string) {
  return LH_NOTICE_MEMORY.map(notice => ({ notice, applicable: noticeAppliesToAddress(notice, address) }));
}
