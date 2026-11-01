/**
 * National statutes / design gating checklist, cross-checked in official law
 * text 2026-11-01. Cross-references must be read together with the actually
 * applicable municipal ordinance, district plan, LH notice and annexes.
 */
export type NationalRuleCategory="지구단위계획·허용용도" | "도로·공지·대지" | "일조·채광·면적산정" | "주차·피난·방화" | "주택·주민공동시설" | "에너지·접근성";
export interface NationalScreeningRule{
 id:string;category:NationalRuleCategory;title:string;law:string;article:string;
 description:string;screeningQuestion:string;sourceUrl:string;
 screeningPriority:"사업불가 선결"|"규모 영향"|"인허가 상세";
 verifiedAt:string;automaticApplication:false;
}
function item(
 id:string,category:NationalRuleCategory,title:string,law:string,article:string,
 description:string,screeningQuestion:string,sourceUrl:string,
 priority:NationalScreeningRule["screeningPriority"]
):NationalScreeningRule{
 return {id,category,title,law,article,description,screeningQuestion,sourceUrl,
 screeningPriority:priority,verifiedAt:"2026-11-01",automaticApplication:false};
}
export const NATIONAL_SCREENING_RULES:ReadonlyArray<NationalScreeningRule>=[
 item("nup-plan-content","지구단위계획·허용용도","지구단위계획에 포함할 내용","국토계획법","제52조",
 "지구단위계획에서 건축물 용도, 건폐율·용적률·높이와 건축선 등을 정할 수 있음.",
 "해당 대지의 지구단위계획·시행지침과 획지별 결정도 원문이 확인됐는가?",
 "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033201117","사업불가 선결"),
 item("nup-plan-compliance","지구단위계획·허용용도","구역 내 건축의 계획 적합 의무","국토계획법","제54조",
 "지구단위계획이 수립된 구역은 건축·용도변경 시 그 계획에 맞아야 함.",
 "법정 용도지역 일반 허용을 이유로 지구단위 허용용도 제외를 무시하지 않았는가?",
 "https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033881091","사업불가 선결"),
 item("nup-ordinance-tension","지구단위계획·허용용도","지단과 개정 조례의 충돌 검토","법제처 법령해석","법령해석 사례",
 "기존 지단이 용도를 허용해도 개정된 도시군계획조례가 금지한 경우 원칙적으로 해당 용도 건축 불허라는 법제처 해석.",
 "구역 당시 조례와 현재 조례·지구단위계획 변경 후속고시 중 어느 것이 적용되는가?",
 "https://www.moleg.go.kr/lawinfo/nwLwAnInfo.mo?cs_seq=366954&mid=a10106020000","사업불가 선결"),
 item("building-road","도로·공지·대지","접도·도로의 법정 요건","건축법","제44조",
 "원칙적으로 대지는 도로에 2m 이상 접해야 하며 건축규모·출입 조건별 추가기준이 있음.",
 "제공받은 12m·28m 폭이 법정 현황도로인지, 접도길이·차량 출입 허용구간은 확인됐는가?",
 "https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1029367605","사업불가 선결"),
 item("building-open-space","도로·공지·대지","대지 안의 공지","건축법","제58조",
 "건축선·인접대지 경계에서 띄는 거리: 국토계획상 용도지역과 용도·규모별 조례·시행령 기준을 함께 검토.",
 "해당 지자체 건축조례의 대지안 공지 별표 숫자 및 지단 건축한계선을 모두 확보했는가?",
 "https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1025276943","규모 영향"),
 item("building-setback-decree","도로·공지·대지","대지 안의 공지 시행령 별표2","건축법 시행령","제80조의2·별표2",
 "시행령 별표2로 이격거리 범위를 정하고 지역 건축조례 수치를 적용하는 구조.",
 "건축물 종류별 대지경계·건축선 이격거리를 해당 지자체 별표로 확인했는가?",
 "https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1033360207","규모 영향"),
 item("daylight-law","일조·채광·면적산정","정북 일조·공동주택 채광·인동거리 구분","건축법","제61조",
 "정북 일조는 원칙적으로 전용·일반주거지역 건축물에, 공동주택 채광·인동은 별도의 적용 기준으로 규정됨.",
 "준주거라서 모든 일조/인동 제한이 면제된다고 오판하지 않았는가?",
 "https://www.law.go.kr/lsLinkCommonInfo.do?lsJoLnkSeq=1034175539","규모 영향"),
 item("daylight-decree","일조·채광·면적산정","채광창·맞동 간격·일조 예외","건축법 시행령","제86조",
 "정북 기준·채광창 이격·동간거리, 20m 이상 도로에 접한 특정 구역의 예외 등은 각각 요건이 다름.",
 "공동주택 채광창·동간거리 및 해당 조례, 지구단위계획과 면제 조건을 따로 확인했는가?",
 "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1032188855","규모 영향"),
 item("floor-area","일조·채광·면적산정","건축면적·바닥면적·연면적·층수 산정","건축법 시행령","제119조",
 "건축면적·바닥면적·층수와 높이 산정 및 피트층·발코니 등 산입/제외는 용도별 법정 세부기준에 따름.",
 "공급·전용·기타공용/기전실과 법정 용적률 산정면적을 혼동하지 않았는가?",
 "https://law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1023926549","규모 영향"),
 item("egress","주차·피난·방화","계단·출입구·복도 및 피난통로","건축법","제49조",
 "용도·규모에 따른 복도·계단·출입구·피난통로 및 방화구획을 시행령·규칙에 맞게 설치.",
 "승강기 대수만이 아니라 직통계단·피난동선·방화구획을 기준층 계획에 반영했는가?",
 "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1028916557","인허가 상세"),
 item("fire-compartment","주차·피난·방화","방화구획의 설치와 예외","건축법 시행령","제46조",
 "주요구조부 내화·불연 건축물로 연면적 1,000㎡ 초과하는 경우의 방화구획 원칙과 예외 규정.",
 "피트·주차·근생·주거 혼합 부위별 방화구획 및 피난 기준을 검토했는가?",
 "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1030364433","인허가 상세"),
 item("community-national","주택·주민공동시설","주택건설기준상 주민공동시설","주택건설기준 등에 관한 규정","제55조의2",
 "100세대 이상 공동주택단지 주민공동시설은 규모별 기준이 있고 시군 조례로 25% 범위 강화·완화 가능.",
 "법정 공동주택 부대복리시설과 LH 별도 50호 이상 커뮤니티 요구를 서로 구분했는가?",
 "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1033715335","규모 영향"),
 item("green-building","에너지·접근성","에너지절약계획서 제출 여부","녹색건축물 조성 지원법","제14조",
 "대통령령 해당 건축물은 건축허가·용도변경 시 에너지절약계획서를 제출해야 함.",
 "주택/오피스텔/근생 복합건물의 연면적 및 제출예외에 해당하는가?",
 "https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1026439655","인허가 상세"),
 item("green-building-threshold","에너지·접근성","에너지절약계획서 500㎡ 기준·제외","녹색건축물 조성 지원법 시행령","제10조",
 "연면적 합계 500㎡ 이상 건축물을 원칙 대상에 포함하나 단독주택 등 법정 예외가 있음.",
 "연면적이 500㎡ 이상인가? 법정 예외 용도인지 확인했는가?",
 "https://www.law.go.kr/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1011789573","인허가 상세"),
 item("accessibility","에너지·접근성","편의시설 설치대상·종류·기준","장애인등편의법 시행령","제3·4조 및 별표1·2",
 "편의시설 대상시설은 별표1, 대상시설별 편의시설 종류/기준은 별표2로 정함.",
 "주거약자·장애인 공급 유형과 공용부·승강기·주차 시설의 설치대상 여부를 확인했는가?",
 "https://www.law.go.kr/lsInfoP.do?lsiSeq=281167","인허가 상세"),
];
export const NATIONAL_SCREENING_UPDATED="2026-11-01";
