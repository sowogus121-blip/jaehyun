/**
 * 2026-10-31 source-backed preliminary checks for 의왕시 초평동 630-1.
 * Do not mistake statutory base zoning (VWorld) for district-plan parcel use.
 * The 2026 C1/C2 rule is clear; its spatial applicability to cadastral 630-1
 * requires overlaying the latest approved building-control diagram.
 */
export const UIWANG_6301 = {
  address: "경기도 의왕시 초평동 630-1",
  pnu: "4143011100106300001",
  historicalArea: 1498,
  currentVworldZone: "준주거지역",
  zoneLayer: "LT_C_UQ111",
  districtPlanLayer: "LT_C_UPISUQ161",
  plan: "의왕초평 공공지원민간임대주택 공급촉진지구",
  ministryNotice: "국토교통부 고시 제2026-308호 (2026-06-30, 지구계획 변경 8차)",
  ministryNoticeUrl: "https://www.eum.go.kr/web/gs/gv/gvGosiDet.jsp?seq=637163",
  supply2023Url: "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?aisTpCd=01&ccrCnntSysDsCd=01&mi=1062&panId=BN-0004868&uppAisTpCd=01",
  supply2023Category: "일반상업용지",
  supply2023Area: 1498,
  supply2023ReferencePrice: 7280280000,
  districtGuidelineUrl: "https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68944321",
  districtGuidelineTitle: "의왕초평 지구단위계획 시행지침 (2026년 10월 LH 첨부 원문)",
  controlPlanUrl: "https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68944315",
  landSupply2026Url: "https://apply.lh.or.kr/lhapply/apply/wt/wrtanc/selectWrtancInfo.do?aisTpCd=01&ccrCnntSysDsCd=01&mi=1062&panId=BN-0008074&uppAisTpCd=01",
  districtUses: {
    commercial: {
      blocks: ["C1", "C2"],
      maxCoverage: 70,
      maxFar: 450,
      maxFloors: 7,
      apartmentAllowed: false,
      officetelAllowed: false,
      note: "시행지침 제Ⅱ편 제4장 제2조 <표Ⅱ-4-2>, PDF p.38: 허용용도 외 불허; 제14호 업무시설에서 오피스텔 제외. 공동주택은 허용용도 열거에서 제외. 해당 지번의 C1/C2 획지 일치 검증 전 확정 판정 불가.",
    },
    office: {
      blocks: ["B1"],
      maxCoverage: 70,
      maxFar: 450,
      maxFloors: 10,
      note: "업무시설용지 B1은 C1/C2와 허용용도가 다름. 지번의 획지 일치 검증 전 B1 기준 자동 적용 불가.",
    },
  },
  lhPurchaseThird: {
    title: "[경기남부] 2026년도 3차 민간 신축 매입약정",
    officialUrl: "https://apply.lh.or.kr/lhapply/apply/pch/view.do?mi=1076&pchPanSn=1716",
    pdfUrl: "https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68596216",
    publishedAt: "2026.09.15",
    closesAt: "2026.10.15",
    minimumHomesRegulated: 10,
    minimumHomesUnregulated: 30,
    coveredCity: "의왕시",
    sourceNotes: [
      "공고 p.1: 의왕시를 당시 조정대상지역 목록에 포함, 최소 10세대 기준 명시",
      "공고 p.3: 의왕시 담당 031-250-8387",
      "공고 p.4: 주거용 오피스텔 및 공동주택 유형은 매입가능 주택 종류이나 지구단위계획의 건축허용용도를 대체하지 않음",
      "접수 마감 2026-10-15: 2026-10-31 현재 접수 종료. 이 공고의 기준을 신규 신청에 자동 적용 금지",
    ],
  },
  warnings: [
    "VWorld 최신 공간정보: 준주거지역 및 지구단위계획구역 확인(2026-10-31). 2023 LH 공급자료의 일반상업용지는 '공급용도' 표기이므로 용도지역과 혼동하면 안 됩니다.",
    "2026 지구단위계획 시행지침 p.38: 상업시설용지 C1/C2는 주거용 오피스텔 제외, 공동주택 허용용도 열거 없음. 630-1이 해당 획지에 속하면 LH 청년형·신혼형 사업계획에 중대한 제한이 생깁니다.",
    "C1/C2 상한 70%/450%/7층은 원문 확인값이지만, 지번-획지 공간 대조 전에는 630-1의 법정 상한으로 계산 반영하지 않습니다.",
    "LH 경기남부 2026년 3차 공고는 2026-10-15 마감. 의왕시는 당시 공고상 규제지역으로 최소 10호 기준이지만 신규 접수는 후속 공고 확인 필요.",
    "VWorld 지적도형 면적 약 1,507.9㎡는 개략 수치. LH 2023 공급자료 1,498㎡와 토지대장 면적의 대조가 필요합니다.",
    "의왕역 280m는 사용자 제시 거리. 지구단위계획의 허용용도가 선결조건이며 LH 0.3대·기계식 주차 완화가 금지용도를 허용하지 않습니다.",
    "지구단위계획 p.40: 차량 진출입은 낮은 위계 도로 또는 장변 원칙, 도로 가각 및 출입금지구간 제한. 제공된 28m/12m 접도만으로 진출입 승인 확정 불가.",
  ],
} as const;

export function isUiwangChopyeong6301(address: string): boolean {
  const text = address.replace(/\s+/g, "");
  return /(?:^|경기도|의왕시)(?:의왕시)?초평동630-1$/.test(text) || text === "초평동630-1";
}
