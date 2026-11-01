/**
 * Metropolitan-area ordinance evidence library (research snapshot 2026-11-01).
 *
 * THE PROOF MODEL MATTERS:
 * - A published municipal clause is NOT a parcel-level entitlement.
 * - An ordinance's date/version and the source's review-status travel with it.
 * - Conditional relaxations NEVER feed straight into ProjectInput or approved FAR.
 * - Official district-unit plans, separate-law use limits, LH procurement criteria
 *   and building permissions can all be more restrictive than these clauses.
 *
 * Add entries via the municipality profiles + rule records below. Do not
 * quietly upgrade "needs-current-recheck" to verified statutory applicability.
 */
export type MetroRegion = "서울" | "경기" | "인천";
export type MetroRuleKind = "일반용적률" | "임대주택완화" | "역세권·접도완화" | "주상복합" | "지구단위" | "주차·LH" | "용도제한" | "특별조건" | "자료연결";
export type MetroEvidenceStatus = "clause-checked" | "needs-current-recheck" | "source-indexed";
export interface MetroOrdinanceSource {
  city: string;
  region: MetroRegion;
  title: string;
  effectiveDate: string;
  ordinanceNo: string;
  url: string;
  status: "official-effective-version" | "official-index-recheck";
}
export interface MetroRule {
  id: string;
  city: string;
  kind: MetroRuleKind;
  article: string;
  title: string;
  detail: string;
  conditions: string;
  zones: string[];
  evidence: MetroEvidenceStatus;
  /** This database is for manual screening only; no automatic legal relaxation. */
  automaticApplication: false;
}

export const METRO_ORDINANCE_SOURCES: MetroOrdinanceSource[] = [
  {city:"서울특별시",region:"서울",title:"서울특별시 도시계획 조례",effectiveDate:"2026-07-13",ordinanceNo:"제10139호",url:"https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2149501",status:"official-effective-version"},
  {city:"인천광역시",region:"인천",title:"인천광역시 도시계획 조례",effectiveDate:"2026-07-13",ordinanceNo:"제7763호",url:"https://law.go.kr/LSW/ordinInfoP.do?ordinId=2140009",status:"official-effective-version"},
  {city:"안양시",region:"경기",title:"안양시 도시계획 조례",effectiveDate:"2026-03-31",ordinanceNo:"제3846호",url:"https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2117933",status:"official-effective-version"},
  {city:"하남시",region:"경기",title:"하남시 도시계획 조례",effectiveDate:"2026-10-01",ordinanceNo:"제2544호",url:"https://www.law.go.kr/ordinSc.do?menuId=3&query=%ED%95%98%EB%82%A8%EC%8B%9C+%EB%8F%84%EC%8B%9C%EA%B3%84%ED%9A%8D+%EC%A1%B0%EB%A1%80",status:"official-effective-version"},
  {city:"파주시",region:"경기",title:"파주시 도시계획 조례",effectiveDate:"2025-03-20",ordinanceNo:"제2204호",url:"https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2022815",status:"official-effective-version"},
  {city:"부천시",region:"경기",title:"부천시 도시계획 조례",effectiveDate:"2026-07-06",ordinanceNo:"제4327호",url:"https://www.law.go.kr/ordinSc.do?menuId=3&query=%EB%B6%80%EC%B2%9C%EC%8B%9C+%EB%8F%84%EC%8B%9C%EA%B3%84%ED%9A%8D+%EC%A1%B0%EB%A1%80",status:"official-index-recheck"},
  {city:"고양시",region:"경기",title:"고양시 도시계획 조례",effectiveDate:"2026-09-22",ordinanceNo:"제3023호",url:"https://www.law.go.kr/ordinSc.do?menuId=3&query=%EA%B3%A0%EC%96%91%EC%8B%9C+%EB%8F%84%EC%8B%9C%EA%B3%84%ED%9A%8D+%EC%A1%B0%EB%A1%80",status:"official-index-recheck"},
  {city:"수원시",region:"경기",title:"수원시 도시계획 조례",effectiveDate:"2025-12-31",ordinanceNo:"제4816호",url:"https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2102141",status:"official-effective-version"},
  {city:"성남시",region:"경기",title:"성남시 도시계획 조례",effectiveDate:"2026-10-26",ordinanceNo:"제4446호",url:"https://www.law.go.kr/LSW/ordinInfoP.do?ordinId=2146953",status:"official-effective-version"},
  {city:"김포시",region:"경기",title:"김포시 도시계획 조례",effectiveDate:"2025-05-12",ordinanceNo:"제2216호",url:"https://law.go.kr/ordinInfoP.do?ordinId=2041966",status:"official-effective-version"},
  {city:"의왕시",region:"경기",title:"의왕시 도시계획 조례 · 주차장 설치 및 관리 조례",effectiveDate:"2026-05-07",ordinanceNo:"주차장조례 제2336호",url:"https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2153459",status:"official-effective-version"},
];

const rule = (
  id:string, city:string, kind:MetroRuleKind, article:string,
  title:string, detail:string, conditions:string,
  zones:string[]=[], evidence:MetroEvidenceStatus="clause-checked",
):MetroRule=>({id,city,kind,article,title,detail,conditions,zones,evidence,automaticApplication:false});

export const METRO_ORDINANCE_RULES:MetroRule[] = [
  // Seoul city-wide zoning: special district plans/land-use decisions take precedence.
  rule("seoul-rental-long20","서울특별시","임대주택완화","제51조제1항제1호가목","20년 이상 임대주택 용적률 완화","조례 제48조 해당 용적률의 20% 범위 추가 건설 규정","제1종전용주거~준주거 등 해당 범위, 법정 공공·민간임대 유형, 임대의무 20년 이상(또는 20년 운영계획 인정) 조건. 단순 LH 매입 예정만으로 자동 적용 불가"),
  rule("seoul-rental-long10","서울특별시","임대주택완화","제51조제1항제1호나·다목","10년·5년 임대의무기간 차등완화","임대의무기간 10년 이상 15%, 5년 이상 10% 범위","적법한 해당 임대주택 유형·기간·용도지역·관할 승인에 따름. 동일 주택에 20%/15%/10%를 중복 가산하지 않음"),
  rule("seoul-district-110","서울특별시","지구단위","제49조제2항","지구단위계획구역 용적률 검토","규칙과 법령상 요건을 충족할 때 조례 제48조 제2호~제10호의 110% 범위 규정","개별 지구단위계획 결정·규칙·기준/허용/상한용적률 확인. 110%가 모든 필지의 자동 상한을 뜻하지 않음"),
  rule("seoul-mixed-use-appendix16","서울특별시","주상복합","제50조제1호 및 별표16","상업지역 주거복합 별표16 우선","일반 상업지역 용적률을 공동주택 복합건축물에 그대로 대입하지 않고 별표16 적용","제48조제7호~제9호 해당 상업지역, 공동주택·비주거 혼합비율과 해당 별표 버전 검토 필수"),
  rule("seoul-social-donation","서울특별시","특별조건","제51조제1항제6호","사회복지시설 기부 용적률","기부하는 사회복지시설 연면적 2배 이내 추가 용적률 및 제48조 기준 120%·상위법 최대한도 제한","법정 해당 시설을 설치하여 기부, 다른 법령·지구단위의 요건 확인. 자동 120% 적용 금지"),
  // Incheon: 2025 text checked; newer 2026 ordinance exists so flag as requiring date-scoped reverification.
  rule("incheon-semi-residential-general","인천광역시","일반용적률","제65조제1항제6호","준주거 일반 500% / 순수 공동주택 300%","2025.11.12. 조문에는 준주거지역 500%, 순수 주거용 공동주택 300% 구분","2026.7.13 개정 시행본에서 동일 조항 유지 여부 재대조 필요. 용도별 상한을 혼동하거나 임의로 주거 500% 적용 금지",["준주거지역"],"needs-current-recheck"),
  rule("incheon-building-zone","인천광역시","용도제한","제34조","제2종일반주거지역 건축물 허용범위","제2종일반주거지역은 시행령 별표 5와 인천시 별도 허용용도·특별경관구역 층수 규정을 함께 확인","법정 도시계획위원회 심의·지정고시 구역은 별도 고시 층수 적용",["제2종일반주거지역"]),
  // Anyang: latest March 2026 ordinance, precise numerical text verified.
  rule("anyang-semi-far","안양시","일반용적률","용도지역 안에서의 용적률 제1항제6호","준주거지역 일반 용적률","450% 이하","관할 건폐율·지구단위·정비계획·주거복합 등 특별 제한 선확인",["준주거지역"]),
  rule("anyang-commercial-far","안양시","일반용적률","용도지역 안에서의 용적률 제1항제8호","일반상업지역 일반 용적률","800% 이하","공동주택이 혼합되는 주상복합은 별표17 별도 적용. 순수 주거에 800% 적용 불가",["일반상업지역"]),
  rule("anyang-mixed-appendix17","안양시","주상복합","용도지역 안에서의 용적률 제2항·별표17","상업지역 주상복합 별표17","상업지역에서 공동주택과 다른 용도를 함께 건축하면 별표17의 용적률 적용","별표17 원문·주거비율·면적산정 방법을 검토해야 하며 800%가 그대로 허용되지 않음",["일반상업지역"]),
  // Hanam: October 2026 amended §56 changes weighting to include officetel as residential.
  rule("hanam-commercial-mixed-formula","하남시","주상복합","제56조제1항 (2026.10.01 개정)","상업지역 주상복합·오피스텔 가중식","(상업용도 비율 × 해당 상업지역 용적률) + (주거·오피스텔 비율 × 제53조제1항제6호 용적률)","공동주택+오피스텔 혼합 시 오피스텔도 주거용으로 계산. 지구단위·실제 용도면적·상업용도 필수조건 확인",["일반상업지역","중심상업지역","근린상업지역"]),
  rule("hanam-mixed-donation-100pp","하남시","주상복합","제56조제2항 (2026.10.01 개정)","상업지역 주거복합 기부채납 가산","제56조제1항 가중식에 최대 100%포인트 가산 가능","시 도시계획위원회/도시건축공동위원회 심의와 기반시설·정책목적 시설 기부채납 충족, 제53조제1항 용적률 상한 내. 자동 +100%p 금지",["일반상업지역"]),
  rule("hanam-land-donation","하남시","특별조건","제55조 공공시설부지 제공","공공시설부지 제공 용적률","[(1 + 0.3a) / (1-a)] × 해당 용적률 산식 명시(a=제공부지/제공 전 대지)","법정 심의·공공시설 제공·상위법 범위 충족. 상업지역으로 종상향 시 일부 예외 적용 안 됨"),
  // Paju, ordinance March 2025 remains cited in official collection.
  rule("paju-zone-semi","파주시","일반용적률","제33조제1항제6호","준주거 일반 용적률","300% 이하","산업단지 지원시설용지·지구단위계획 등 개별 용도와 높이 제한 별도 확인",["준주거지역"]),
  rule("paju-public-rental-120","파주시","임대주택완화","제33조제4항","공공임대주택 등 120% 완화","제33조제1항제1호~제6호 용적률의 120% 이내로 완화 가능","공공주택 특별법 시행령 제2조 공공임대주택 또는 임대의무 8년 이상 민간임대, 해당 지역·사업 인허가·지구단위 적용 관계 확인. 준주거 300%→360%는 조건부 예시",["준주거지역","제2종일반주거지역","제3종일반주거지역"]),
  rule("paju-road-120","파주시","역세권·접도완화","제63조제2호","25m 도로 20m 접도 완화","25m 이상 도로에 20m 이상 접한 대지: 해당 용도지역 용적률 × 120% 범위","법정 대상 용도지역 한정, 경관·교통·방화·위생 지장 없고 시 도시계획위원회 심의, 실제 접도길이 확인. 공공임대120%와 임의 중복 금지"),
  rule("paju-mixed-appendix26","파주시","주상복합","제33조제3항·별표26","상업지역 주상복합 별표26","상업지역 공동주택+비주거의 주거용 비율에 따른 별표26 용적률 적용","상업지역 혼합비율 산정 및 별표 원문 대조 필요. 900% 일반상업 상한을 순수 주거에 그대로 대입 금지",["일반상업지역"]),
  // Bucheon: current July 2026 is indexed; restrictions below located in early-2026 texts.
  rule("bucheon-rental-120","부천시","임대주택완화","용도지역별 용적률 제10항제1호","장기 임대주택 120% 완화","제1항제1호~제6호 범위에서 8년 이상 공공·민간임대의 용도지역별 상한 120% 이내","2026.2 확인된 문구를 2026.7.6 개정 원문과 대조 필요. 해당 사업·공고의 임대기간과 심의 요건 미확정; 자동 적용 금지",["제2종일반주거지역","제3종일반주거지역","준주거지역"],"needs-current-recheck"),
  rule("bucheon-semi-apartment-360","부천시","용도제한","용도지역별 용적률 제3항·제10항제1호","준주거 공동주택 용적률 300/360 별도제한","준주거 공동주택은 일반 준주거 최대용적률과 다르며, 8년 이상 임대 완화 적용 시 공동주택 부분 360% 이하","2026.7.6 시행본의 상세 조문 재대조 필요. 지구단위/특별정비구역 고시 우선 검토",["준주거지역"],"needs-current-recheck"),
  rule("bucheon-district-plan-priority","부천시","지구단위","용도지역별 용적률 제8항","지구단위계획 우선","지구단위계획을 수립·결정한 경우 해당 계획에 따른다는 조항 확인","최신 2026.7 개정 내용·지구단위/특별정비구역 개별고시 대조가 필요",[], "needs-current-recheck"),
  // Goyang: 2026.09 revised law; 2025 version's substantive clauses need rechecking.
  rule("goyang-semi-far","고양시","일반용적률","제61조제1항제6호","준주거 일반 380%, 리모델링 400%","2025 조례 본문 준주거 380%, 주택법상 리모델링 400%","2026.9.22 개정 시행본 동일조항 유지 재확인. 리모델링은 신축의 일반 상한이 아님",["준주거지역"],"needs-current-recheck"),
  rule("goyang-rental-120","고양시","임대주택완화","제61조 임대주택 특례","공공·장기 민간임대 120%","2025 조례에는 공공임대 또는 임대의무 8년 이상 민간임대의 해당지역 용적률 120% 규정","2026.9.22 시행본 재확인 필요. 해당 조문·사업 인허가·지구단위계획·일반 상한의 중복 적용 불가",[],"needs-current-recheck"),
  rule("goyang-residential-2-3","고양시","일반용적률","제61조제1항제4·5호","제2종 230% / 제3종 250%","2025 조례 기준: 2종일반주거 230%, 3종일반주거 250%; 리모델링은 각 250%, 300%","2026.9.22 시행본 재대조 필요, 신축과 리모델링 수치 혼동 금지",["제2종일반주거지역","제3종일반주거지역"],"needs-current-recheck"),
  // Uiwang: specific official city annex direct read, separate from C1 plot.
  rule("uiwang-parking-standard","의왕시","주차·LH","주차장 설치 및 관리 조례 제16조 별표5","공동주택·오피스텔 주차 원칙","전용 85㎡ 이하의 합계/85㎡ 산정, 세대·호실당 최소 1대","일반 법정기준. 특별완화·다른 주차제도·LH 지역공고·지단 허용용도 별도 검토"),
  rule("uiwang-parking-lh03","의왕시","주차·LH","주차장 설치 및 관리 조례 제16조 별표5","LH 매입약정 30㎡ 미만 주차 0.3대","공공주택사업자와 매도약정 체결 및 전용 30㎡ 미만의 경우 0.3대 적용 가능","역 500m 등 LH 공급유형별 요건·허가권자 인정 필수. 주거 불허 C1 블록에는 의미 없음"),
  rule("uiwang-mechanical-30","의왕시","주차·LH","주차장 설치 및 관리 조례 제20조","기계식주차 최대 30%","법정주차대수 30% 이하, 총주차 20대 이하 기계식 설치 불가","LH 공고상 0.3대 특례와 기계식 병행금지 및 현장 기계식 허용조건 별도 대조"),
  // Index-only coverage: source exists but substantive terms not yet extracted.
  rule("suwon-index","수원시","자료연결","현행 도시계획 조례 원문","수원시 도시계획조례 데이터 원문 연결","2025.12.31 시행본 조례 원문 연결 완료","건폐율·용적률·상업주거복합·임대 완화 및 건축/주차 별표 세부 검증 전. 자동 법규 수치 생성 금지",[],"source-indexed"),
  rule("seongnam-index","성남시","자료연결","현행 도시계획 조례 원문","성남시 도시계획조례 데이터 원문 연결","2026.10.26 시행본 조례 원문 연결 완료","최신 조례의 용도지역별 숫자·임대특례·상업지역 제한은 원문 발췌 전. 자동 적용 금지",[],"source-indexed"),
  rule("gimpo-index","김포시","자료연결","현행 도시계획 조례 원문","김포시 도시계획조례 데이터 원문 연결","2025.5.12 시행본 조례 원문 연결 완료","개별 개발행위·역세권·LH 완화 기준은 조문 검증 전; 지구단위/허용용도 우선",[],"source-indexed"),
];

export function findMetroOrdinanceSource(address:string):MetroOrdinanceSource|null {
  const normalized=address.replace(/\s+/g,"");
  if (!normalized) return null;
  // City-name matches are deliberately exact; generic "경기도" must NOT load
  // some other city's rules. Seoul/Incheon are not district city matches.
  return METRO_ORDINANCE_SOURCES.find(({city})=>{
    if (city==="서울특별시") return normalized.includes("서울특별시") || normalized.startsWith("서울");
    if (city==="인천광역시") return normalized.includes("인천광역시") || normalized.startsWith("인천");
    return normalized.includes(city);
  })??null;
}
export function findMetroOrdinanceRules(address:string):MetroRule[] {
  const source=findMetroOrdinanceSource(address);
  return source ? METRO_ORDINANCE_RULES.filter(item=>item.city===source.city):[];
}
export const METRO_ORDINANCE_CATALOG_UPDATED_AT="2026-11-01";
