/**
 * 2026-10-31 verified source chain for 의왕시 초평동 630-1.
 * Historical LH 2023 cadastral sale: 630-1 area 1498m2 price 7,280,280,000 KRW;
 * same LH auction pamphlet and official notice: C1-2 area 1498m2 same price.
 * 2026 building-control diagram still names C1 block and 2026 execution guideline
 * excludes apartments and officetels from its permitted uses.
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
  /** 2024-12-30 ordinance annex 6 HWP, directly downloaded and text-checked. */
  cityZoningAnnex: {
    effectiveDate: "2024-12-30",
    ordinance: "의왕시 도시계획 조례 제32조제6호",
    ordinanceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinId=2105386",
    appendixTitle: "[별표 6] 준주거지역에서 건축할 수 없는 건축물",
    appendixOriginalUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=157487925",
    apartmentProhibitedInGeneralZone: false,
    officetelProhibitedInGeneralZone: false,
    salesLargeAreaSqm: 3000,
    salesExceptionMinRoadM: 15,
    salesExceptionMinFrontageM: 15,
    notes: "별표6에는 공동주택·오피스텔 자체를 금지하는 항목 없음. 판매시설 3,000㎡ 이상은 너비 15m 이상의 도로에 15m 이상 접한 대지 예외. 별도 C1-2 허용용도가 우선 적용.",
  },
  /** Ordinance 2336, 2026-05-07 appendix 5, original HWP decoded from official law.go.kr. */
  cityParkingAnnex: {
    effectiveDate: "2026-05-07",
    ordinance: "의왕시 주차장설치 및 관리 조례 제16조제1항 [별표 5]",
    ordinanceUrl: "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2153459",
    appendixOriginalUrl: "https://www.law.go.kr/LSW/flDownload.do?flSeq=167475619",
    apartmentOfficetelStandardSqmPerSpace: 85,
    apartmentOfficetelMinPerHome: 1,
    purchaseAgreementParkingPerSmallHome: 0.3,
    purchaseAgreementMaxExclusiveAreaSqm: 30, // strictly less than 30
    commercialParkingSqmPerSpace: 100,
    neighborhoodParkingSqmPerSpace: 120,
    machineMaxPercentCity: 30,
    machineNotAllowedWhenTotalSpacesAtMost: 20,
    notes: "별표5: 전용면적 85㎡ 이하 전체 전용면적/85㎡로 산정하되 세대·호실당 최소 1대. 공특법 시행령 §37④ 매도약정·전용30㎡ 미만 세대는 0.3대 적용 가능. 제20조: 기계식 최대30%, 총 법정주차 20대 이하면 불가.",
  },
  verifiedDistrictLot: "C1-2",
  verifiedBlock: "C1",
  historicalPamphletUrl: "https://apply.lh.or.kr/lhapply/lhFile.do?fileid=51778558",
  historicalNoticePdfUrl: "https://apply.lh.or.kr/lhapply/lhFile.do?fileid=51778730",
  historicalMatchingEvidence: "2023 LH 공급공고·팸플릿 C1-2(1,498㎡, 7,280,280천원) = 동일 공고 지번별 목록 초평동 630-1(1,498㎡, 7,280,280,000원); 2026 지구단위 결정도 C1 유지",
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
      note: "확인된 지번 630-1=C1-2(2023 LH 공급공고 면적·가격 대조) 및 2026 결정도 C1 블록. 시행지침 제Ⅱ편 제4장 제2조 표Ⅱ-4-2, PDF p.38: 공동주택 허용용도 미열거, 업무시설 오피스텔 명시 제외.",
    },
    office: {
      blocks: ["B1"],
      maxCoverage: 70,
      maxFar: 450,
      maxFloors: 10,
      note: "업무시설용지 B1은 C1-2가 아닌 별개 획지이므로 초평동 630-1에는 적용 불가.",
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
    "초평동 630-1은 2023 LH 공급공고 및 분양 팸플릿의 면적·가격 완전일치로 C1-2 획지 확인. 2026 C1 블록 지구단위 시행지침 p.38상 공동주택 허용용도 미열거, 주거용 오피스텔 명시 제외: LH 신혼형 공동주택 및 청년형 오피스텔 신축 부적합.",
    "C1-2에 적용되는 C1 상업시설용지 시행지침상 건폐율 70%, 용적률 450%, 최고 7층. 조례 일반 준주거 500%로 주거형 세대수 계산 금지.",
    "LH 경기남부 2026년 3차 공고는 2026-10-15 마감. 의왕시는 당시 공고상 규제지역으로 최소 10호 기준이지만 신규 접수는 후속 공고 확인 필요.",
    "VWorld 지적도형 면적 약 1,507.9㎡는 개략 수치. LH 2023 공급자료 1,498㎡와 토지대장 면적의 대조가 필요합니다.",
    "의왕시 도시계획조례 별표6(2024-12-30)에서는 공동주택·오피스텔의 준주거지역 일반 금지가 없으나, C1-2 별도 허용용도에 두 용도가 포함되지 않아 신축 불가.",
    "의왕시 주차장 조례 별표5(2026-05-07): 공동주택·오피스텔 통상 호실당 최소1대, LH 매도약정·전용30㎡ 미만은 조건부 0.3대. 이 대상지는 현재 주거 허용용도 자체가 없으므로 특례로 사업가능 판정 불가.",
    "의왕시 주차장 조례 제20조: 기계식은 법정주차대수 30% 이하, 총 20대 이하 기계식 불가. LH 경기남부 3차 공고 p.8은 50% 이내 계획하나 0.3대 적용 주택에는 기계식 금지; 더 엄격한 의왕시 기준 확인.",
    "의왕역 280m는 사용자 제시 거리. LH 경기남부 3차 공고 p.6 청년형 0.3대는 역 출구·대학 교문 직선 500m 이내, 고령자형 입지 제한 없음; 지구단위 허용용도를 우선 확인.",
    "지구단위계획 p.40: 차량 진출입은 낮은 위계 도로 또는 장변 원칙, 도로 가각 및 출입금지구간 제한. 제공된 28m/12m 접도만으로 진출입 승인 확정 불가.",
  ],
} as const;

export function isUiwangChopyeong6301(address: string): boolean {
  const text = address.replace(/\s+/g, "");
  return /(?:^|경기도|의왕시)(?:의왕시)?초평동630-1$/.test(text) || text === "초평동630-1";
}
