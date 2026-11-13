/** 행별 근거 보완 탐색 대상 (국가법령정보센터 조문 검색) */
export interface LookupHint { source: string; terms: string[]; label: string }

export function lookupHint(rowId: string): LookupHint | null {
  switch (rowId) {
    case "plan.use": return { source: "도시계획 조례", terms: ["건축할 수 있는 건축물", "건축할 수 없는 건축물"], label: "도시계획 조례 · 건축제한 조문·별표" };
    case "plan.bcrfar": return { source: "도시계획 조례", terms: ["안에서의 건폐율", "안에서의 용적률", "안의 건폐율", "안의 용적률"], label: "도시계획 조례 · 용도지역별 건폐율·용적률" };
    case "plan.relax": return { source: "도시계획 조례", terms: ["임대주택", "공공임대"], label: "도시계획 조례 · 임대주택 용적률 완화" };
    case "plan.height": return { source: "도시계획 조례", terms: ["높이", "고도지구"], label: "도시계획 조례 · 높이 관련 조문" };
    case "bld.sunlight": return { source: "건축 조례", terms: ["일조", "정북"], label: "건축 조례 · 일조 등의 확보" };
    case "bld.spacing": return { source: "건축 조례", terms: ["인동", "채광"], label: "건축 조례 · 채광·인동거리" };
    case "bld.setback": return { source: "건축 조례", terms: ["대지 안의 공지", "대지안의 공지"], label: "건축 조례 · 대지 안의 공지" };
    case "bld.landscape": return { source: "건축 조례", terms: ["대지의 조경", "조경"], label: "건축 조례 · 대지의 조경" };
    case "bld.openspace": return { source: "건축 조례", terms: ["공개공지", "공개 공지"], label: "건축 조례 · 공개공지" };
    case "park.mech.ord": return { source: "주차장 설치 및 관리 조례", terms: ["기계식"], label: "주차장 조례 · 기계식주차장" };
    case "park.ordinance":
    case "park.apartment":
    case "park.urban":
    case "park.officetel": return { source: "주차장 설치 및 관리 조례", terms: ["부설주차장의 설치기준", "설치기준", "오피스텔", "공동주택"], label: "주차장 조례 · 부설주차장 설치기준·별표" };
    case "bld.amenity": return { source: "법령:주택건설기준 등에 관한 규정", terms: ["관리사무소", "주민공동시설"], label: "주택건설기준 등에 관한 규정" };
    case "park.lh03": return { source: "법령:공공주택 특별법 시행령", terms: ["주차"], label: "공공주택 특별법 시행령 · 주차 특례" };
    default: return null;
  }
}

/** 공식 원문 사이트 바로가기 (자동 탐색으로 확보되지 않을 때) */
export function officialLinks(address: string): Array<{ label: string; url: string }> {
  const parts = address.split(/\s+/).filter(Boolean);
  const city = parts[1] ?? parts[0] ?? "";
  const q = (kind: string) => "https://www.law.go.kr/ordinSc.do?menuId=3&query=" + encodeURIComponent(`${city} ${kind}`);
  return [
    { label: "토지이음 토지이용계획", url: "https://www.eum.go.kr/web/ar/lu/luLandDet.jsp" },
    { label: "토지이음 고시정보(지구단위계획)", url: "https://www.eum.go.kr/web/gs/gv/gvGosiList.jsp" },
    { label: "도시계획 조례", url: q("도시계획 조례") },
    { label: "건축 조례", url: q("건축 조례") },
    { label: "주차장 조례", url: q("주차장 조례") },
    { label: "LH 청약플러스 매입임대 공고", url: "https://apply.lh.or.kr/lhapply/apply/pch/list.do?mi=1076" },
  ];
}
