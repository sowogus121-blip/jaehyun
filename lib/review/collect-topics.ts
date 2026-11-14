/**
 * 대상지 조회 시 자동 수집하는 "규모검토 필요 조문" 목록.
 * 실무 건축사가 개략 규모검토 전에 확인하는 조문을 법규검토표 행과 1:1로 묶는다.
 * 수집된 조문은 원문 그대로 행 근거에 첨부되며, 수치 확정은 검토자가 한다.
 */
export interface CollectedArticle {
  topic: string;
  rowId: string;
  title: string;
  url: string;
  effectiveDate: string | null;
  article: string;
  text: string;
  kind: "ordinance" | "law";
  /** 별표 원본 PDF (부록 원본 이미지판) */
  pdfUrl?: string;
}

export interface OrdinanceTopic { id: string; rowId: string; label: string; ordinance: "도시계획" | "건축" | "주차장"; terms: string[] }

export const ORDINANCE_TOPICS: OrdinanceTopic[] = [
  { id: "use", rowId: "plan.use", label: "용도지역 건축제한", ordinance: "도시계획", terms: ["건축할 수 있는 건축물", "건축할 수 없는 건축물", "안에서의 건축제한", "안의 건축제한"] },
  { id: "bcr", rowId: "plan.bcrfar", label: "용도지역별 건폐율", ordinance: "도시계획", terms: ["안에서의 건폐율", "안의 건폐율"] },
  { id: "far", rowId: "plan.bcrfar", label: "용도지역별 용적률", ordinance: "도시계획", terms: ["안에서의 용적률", "안의 용적률"] },
  { id: "relax", rowId: "plan.relax", label: "임대주택 용적률 완화", ordinance: "도시계획", terms: ["임대주택"] },
  { id: "height", rowId: "plan.height", label: "건축물 높이 제한", ordinance: "건축", terms: ["높이 제한", "높이제한", "가로구역"] },
  { id: "sun", rowId: "bld.sunlight", label: "일조 등의 확보", ordinance: "건축", terms: ["일조"] },
  { id: "spacing", rowId: "bld.spacing", label: "채광·인동거리", ordinance: "건축", terms: ["인동", "채광"] },
  { id: "setback", rowId: "bld.setback", label: "대지 안의 공지", ordinance: "건축", terms: ["대지 안의 공지", "대지안의 공지"] },
  { id: "landscape", rowId: "bld.landscape", label: "대지의 조경", ordinance: "건축", terms: ["대지의 조경", "조경면적", "조경의 기준"] },
  { id: "openspace", rowId: "bld.openspace", label: "공개공지", ordinance: "건축", terms: ["공개공지", "공개 공지"] },
  { id: "parking", rowId: "park.ordinance", label: "부설주차장 설치기준", ordinance: "주차장", terms: ["부설주차장의 설치기준", "부설주차장 설치기준", "부설주차장의 설치대상"] },
  { id: "mech", rowId: "park.mech.ord", label: "기계식주차장", ordinance: "주차장", terms: ["기계식"] },
  { id: "parkLimit", rowId: "park.ordinance", label: "주차장 설치제한", ordinance: "주차장", terms: ["설치제한", "설치 제한", "설치를 제한"] },
];

export interface NationalArticle { rowId: string; law: string; no: number; branch?: number; label: string; /** 조 제목 확인 (번호 개정으로 다른 조문이 잡히지 않게) */ title?: RegExp }

export const NATIONAL_ARTICLES: NationalArticle[] = [
  { rowId: "plan.bcrfar", law: "국토의 계획 및 이용에 관한 법률 시행령", no: 84, label: "용도지역 건폐율 상한" },
  { rowId: "plan.bcrfar", law: "국토의 계획 및 이용에 관한 법률 시행령", no: 85, label: "용도지역 용적률 상한" },
  { rowId: "bld.sunlight", law: "건축법 시행령", no: 86, label: "일조 등의 확보를 위한 높이 제한" },
  { rowId: "bld.setback", law: "건축법 시행령", no: 80, branch: 2, label: "대지 안의 공지" },
  { rowId: "bld.openspace", law: "건축법 시행령", no: 27, branch: 2, label: "공개공지 등의 확보" },
  { rowId: "bld.landscape", law: "건축법 시행령", no: 27, label: "대지의 조경" },
  { rowId: "park.apartment", law: "주택건설기준 등에 관한 규정", no: 27, label: "주택단지 주차장" },
  { rowId: "bld.amenity", law: "주택건설기준 등에 관한 규정", no: 28, label: "관리사무소 등" },
  { rowId: "bld.amenity", law: "주택건설기준 등에 관한 규정", no: 55, branch: 2, label: "주민공동시설" },
  { rowId: "park.lh03", law: "공공주택 특별법 시행령", no: 37, label: "공공주택 건설 특례(주차)" },
  { rowId: "type.urban", law: "주택법 시행령", no: 10, label: "도시형 생활주택", title: /도시형/ },
  { rowId: "type.approval", law: "주택법 시행령", no: 27, label: "사업계획의 승인", title: /사업계획/ },
  { rowId: "bld.noise", law: "주택건설기준 등에 관한 규정", no: 9, label: "소음방지대책", title: /소음/ },
  { rowId: "bld.safety", law: "주택건설기준 등에 관한 규정", no: 15, label: "승강기 등", title: /승강기/ },
  { rowId: "park.mech.ord", law: "주차장법 시행규칙", no: 16, branch: 2, label: "기계식주차장의 설치기준", title: /기계식/ },
  { rowId: "bld.green", law: "녹색건축물 조성 지원법 시행령", no: 11, branch: 3, label: "에너지효율등급·제로에너지건축물 인증", title: /인증|제로에너지|에너지효율/ },
];

export const NATIONAL_LAWS = [...new Set(NATIONAL_ARTICLES.map((a) => a.law))];

/** LH 공고문 추출 문구 → 법규검토표 행 */
export function lhCriterionRow(quote: string): string | null {
  if (/기계식|주차대수의\s*\d+\s*%/.test(quote)) return "park.mech.lh";
  if (/0[.]3\s*대|0[.]3대|주차.*완화/.test(quote)) return "park.lh03";
  if (/커뮤니티|관리사무소|경비실|주민공동/.test(quote)) return "lh.community";
  if (/주차/.test(quote)) return null;
  if (/전용|호\s*이상|세대\s*이상|최소|방\s*\d|침실/.test(quote)) return "lh.scale";
  return null;
}
