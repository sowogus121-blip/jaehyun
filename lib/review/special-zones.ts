/**
 * 토지이용계획확인서의 「다른 법령 등에 따른 지역·지구 등」을 근거 법률과 규모검토 확인사항으로 연결한다.
 * 지정명만으로 행위제한·완화 수치를 확정하지 않으며, 모두 '후보' 행으로 만든다.
 */
export interface LandUseDesignation { name: string; conflict: string | null; code: string | null }

export interface SpecialZoneRule {
  id: string;
  pattern: RegExp;
  law: string;
  check: string;
  /** 해당 시 공식 고시·계획 검색어에 덧붙일 단어 */
  search?: string;
  /** 규모(용적률·높이·용도)에 직접 영향 */
  scale: boolean;
}

export const SPECIAL_ZONE_RULES: SpecialZoneRule[] = [
  { id: "aging-new-town", pattern: /노후계획도시|특별정비(예정)?구역/, law: "노후계획도시 정비 및 지원에 관한 특별법", check: "노후계획도시정비 기본계획·특별정비계획의 기준용적률·상한, 이주대책, 공공기여 비율 확인", search: "노후계획도시 정비 기본계획", scale: true },
  { id: "redevelopment", pattern: /정비구역|정비예정구역|주거환경개선|재개발|재건축/, law: "도시 및 주거환경정비법", check: "정비계획 결정 여부·정비계획상 용도·용적률·높이, 구역 내 개별 건축행위 제한(제19조)", search: "정비계획 결정 고시", scale: true },
  { id: "renewal-promotion", pattern: /재정비촉진/, law: "도시재정비 촉진을 위한 특별법", check: "재정비촉진계획의 존치·정비구역 구분, 건축 제한 및 용적률 특례", search: "재정비촉진계획 결정 고시", scale: true },
  { id: "small-scale", pattern: /소규모주택정비|관리지역|가로주택|자율주택/, law: "빈집 및 소규모주택 정비에 관한 특례법", check: "소규모주택정비 관리계획의 용도지역 상향·용적률 특례, 사업 방식 제한", search: "소규모주택정비 관리계획 고시", scale: true },
  { id: "public-housing-district", pattern: /공공주택지구/, law: "공공주택 특별법", check: "공공주택지구 지구계획·지구단위계획 획지별 기준 우선", search: "공공주택지구 지구계획 변경", scale: true },
  { id: "housing-site", pattern: /택지개발(예정)?지구/, law: "택지개발촉진법", check: "택지개발지구 지구단위계획 우선. 준공 후 20년 이상·100만㎡ 이상이면 노후계획도시 특별법 대상 여부 확인", search: "택지개발지구 지구단위계획", scale: true },
  { id: "urban-development", pattern: /도시개발구역/, law: "도시개발법", check: "도시개발사업 실시계획·지구단위계획의 획지별 기준", search: "도시개발구역 실시계획 고시", scale: true },
  { id: "industrial-complex", pattern: /산업단지|산업시설구역|지원시설구역/, law: "산업입지 및 개발에 관한 법률", check: "산업단지 관리기본계획·실시계획의 용도 구역(산업·지원·공공시설) 및 허용업종, 공동주택 허용 여부", search: "산업단지 관리기본계획", scale: true },
  { id: "urban-regeneration", pattern: /도시재생|재생활성화/, law: "도시재생 활성화 및 지원에 관한 특별법", check: "도시재생활성화계획·혁신지구 특례 여부", search: "도시재생활성화계획", scale: false },
  { id: "station-area", pattern: /역세권(개발)?구역|역세권/, law: "역세권의 개발 및 이용에 관한 법률", check: "역세권개발구역 지정 여부·용적률 완화 특례", search: "역세권 개발구역", scale: true },
  { id: "greenbelt", pattern: /개발제한구역/, law: "개발제한구역의 지정 및 관리에 관한 특별조치법", check: "개발제한구역 내 공동주택 등 신축 원칙적 불가", scale: true },
  { id: "military", pattern: /군사기지|군사시설|비행안전|대공방어|통제보호구역|제한보호구역/, law: "군사기지 및 군사시설 보호법", check: "건축물 높이 제한(비행안전구역)·관할 부대 협의 대상 여부", scale: true },
  { id: "airport", pattern: /공항|비행장|장애물제한표면|항공기소음/, law: "공항시설법", check: "장애물 제한표면에 따른 높이 제한, 소음대책지역 용도 제한", scale: true },
  { id: "heritage", pattern: /문화재|문화유산|국가유산|역사문화환경|보존지역|현상변경/, law: "문화유산의 보존 및 활용에 관한 법률", check: "역사문화환경 보존지역 현상변경 허용기준(높이·층수), 국가유산청 협의", search: "현상변경 허용기준 고시", scale: true },
  { id: "water", pattern: /상수원|수변구역|배출시설설치제한|특별대책지역|수질보전/, law: "수도법 · 한강수계 상수원수질개선 및 주민지원 등에 관한 법률", check: "상수원보호구역·수변구역·특별대책지역 내 건축 제한(용도·규모)", scale: true },
  { id: "capital-region", pattern: /과밀억제권역|성장관리권역|자연보전권역/, law: "수도권정비계획법", check: "권역별 규제(과밀부담금, 대규모 개발사업 심의, 자연보전권역 개발 제한)", scale: false },
  { id: "education", pattern: /교육환경보호구역|절대보호구역|상대보호구역/, law: "교육환경 보호에 관한 법률", check: "교육환경 평가 대상 여부(21층 이상 또는 연면적 10만㎡ 이상 등)·금지시설", scale: false },
  { id: "landscape", pattern: /경관지구|경관(중점)?관리구역/, law: "경관법 · 관할 경관조례", check: "경관계획 높이·입면 기준, 경관심의 대상 여부", search: "경관계획 고시", scale: true },
  { id: "height-district", pattern: /고도지구|최고고도|최고높이|가로구역/, law: "국토의 계획 및 이용에 관한 법률 · 도시관리계획", check: "고도지구 결정 높이(m/층) 확인", search: "고도지구 결정 고시", scale: true },
  { id: "fire-prevention", pattern: /방화지구/, law: "건축법 제51조", check: "주요구조부·외벽 내화구조, 방화문 등 방화지구 건축기준", scale: false },
  { id: "district-plan", pattern: /지구단위계획/, law: "국토의 계획 및 이용에 관한 법률 제49~54조", check: "결정조서·결정도·시행지침에서 해당 획지의 용도·건폐율·용적률·높이·건축선 확인", search: "지구단위계획 결정 고시 시행지침", scale: true },
  { id: "urban-facility", pattern: /^(광로|대로|중로|소로)\s*\d\s*류|^도로$|공공청사|노외주차장|^주차장$|^공원$|^녹지$|^학교$|도시계획시설|^광장$|유원지|하천$/, law: "국토의 계획 및 이용에 관한 법률 제64조 (도시·군계획시설)", check: "'포함·저촉'이면 도시계획시설 부지로 건축 제한·사업 시행 여부 확인, '접함'이면 접도 조건으로 활용", scale: true },
  { id: "traffic", pattern: /도시교통정비지역|교통권역/, law: "도시교통정비 촉진법", check: "교통영향평가 대상 규모(연면적 등) 여부 확인", scale: false },
  { id: "land-transaction", pattern: /토지거래계약|토지거래허가/, law: "부동산 거래신고 등에 관한 법률", check: "토지거래허가 대상(매입·약정 일정 영향)", scale: false },
  { id: "livestock", pattern: /가축사육제한/, law: "가축분뇨의 관리 및 이용에 관한 법률", check: "주거 환경 영향(용도 제한 없음, 참고)", scale: false },
  { id: "flood", pattern: /자연재해위험|침수|재해위험|급경사지/, law: "자연재해대책법", check: "재해영향평가·침수 대비 설계(지하층·전기실 배치)", scale: false },
];

/** 국토계획법상 용도지역 자체(규모검토표 다른 행에서 다룸)는 제외 */
const ZONING_ONLY = /^(도시지역|관리지역|농림지역|자연환경보전지역|.*(주거|상업|공업|녹지)지역|보전관리지역|생산관리지역|계획관리지역)$/;

export interface SpecialZoneMatch { rule: SpecialZoneRule | null; designations: LandUseDesignation[] }

export function classifyDesignations(list: LandUseDesignation[]): SpecialZoneMatch[] {
  const out = new Map<string, SpecialZoneMatch>();
  for (const d of list) {
    const name = d.name.trim();
    if (!name || ZONING_ONLY.test(name.replace(/\s+/g, ""))) continue;
    const rule = SPECIAL_ZONE_RULES.find((r) => r.pattern.test(name)) ?? null;
    const key = rule?.id ?? "other";
    const m = out.get(key) ?? { rule, designations: [] };
    if (!m.designations.some((x) => x.name === name)) m.designations.push({ ...d, name });
    out.set(key, m);
  }
  return [...out.values()].sort((a, b) => Number(b.rule?.scale ?? false) - Number(a.rule?.scale ?? false));
}

export const NEW_TOWN_HINT = /분당|일산|평촌|산본|중동신도시|부천\s*중동|상계|중계|목동|해운대\s*신시가지|둔산|수성/;
