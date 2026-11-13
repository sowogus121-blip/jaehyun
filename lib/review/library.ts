/**
 * 검증 근거 라이브러리.
 *
 * 공식 원문을 직접 대조해 확인한 지자체·지구단위계획·LH 기준을 "적용 조건"과 함께 보관한다.
 * - 지자체 조례 기준은 관할 + 용도지역이 정확히 일치할 때만 매칭한다.
 * - 지구단위계획 획지 기준은 검토자가 획지번호를 지정했을 때만 매칭한다.
 *   (구역 포함 사실만으로 특정 획지 기준을 일괄 적용하지 않는다)
 * - 행 상태는 원문 대조 결과에 따라 지정되며, 조건이 남은 항목은 candidate로 둔다.
 *
 * 새 지역 근거를 추가할 때는 원문 URL·조항·시행일·발췌문을 반드시 함께 기록한다.
 */
import type { ReviewRow, RuleParams, SourceRef } from "./types";

export interface LibraryContext {
  address: string;      // 정규화 전 주소 (지번 우선)
  zones: string[];      // 정확한 용도지역 이름 목록
  districtPlan: boolean | null;
  blockNo: string;      // 대문자, 공백 제거
}

export type RowPatch = Partial<Omit<ReviewRow, "id" | "origin">> & { id: string };

export interface LibraryEntry {
  id: string;
  title: string;
  checkedAt: string;
  match: (ctx: LibraryContext) => boolean;
  rows: (ctx: LibraryContext) => RowPatch[];
}

const compact = (v: string) => v.replace(/\s+/g, "");
const inCity = (ctx: LibraryContext, ...names: string[]) => names.some((n) => compact(ctx.address).includes(n));
const singleZone = (ctx: LibraryContext, zone: string) => ctx.zones.length === 1 && compact(ctx.zones[0]) === zone;

// ───────── 서울특별시 ─────────
const SEOUL_PLAN_URL = "https://law.go.kr/ordinInfoP.do?ordinId=2000719";
const SEOUL_PARKING_URL = "https://law.go.kr/LSW/ordinInfoP.do?chrClsCd=010202&gubun=&ordinSeq=2171833";
const seoulPlan = (article: string, excerpt: string, highlights: string[]): SourceRef => ({
  title: "서울특별시 도시계획 조례", article, effectiveDate: "2026-07-13", url: SEOUL_PLAN_URL,
  excerpt, highlights, kind: "ordinance",
});

const seoulSemiIndustrial: LibraryEntry = {
  id: "seoul-semi-industrial",
  title: "서울특별시 준공업지역 (도시계획 조례 제44·50조, 별표 12·17)",
  checkedAt: "2026-11-11",
  match: (ctx) => inCity(ctx, "서울특별시", "서울시") && singleZone(ctx, "준공업지역"),
  rows: (ctx) => [
    {
      id: "plan.use",
      content: "공동주택: 공장부지 등 공동주택 허용기준(별표 17) 충족 시 허용\n오피스텔(업무시설): 별표 12 건축제한 범위 내 허용",
      law: "서울시 도시계획 조례 제33조제11호, 별표 12·17",
      note: "건축물대장상 공장 존재만으로 공장부지 비율·이적지 해당성을 단정하지 않음. 공장비율 산정 후 확정",
      status: "candidate",
      params: { useApartment: "conditional", useUrban: "conditional", useOfficetel: "conditional" },
      sources: [seoulPlan("제33조제11호, 별표 12·17", "준공업지역 안에서 공장부지 등에 공동주택을 건축하는 경우 별표 17의 허용기준에 따른다.", ["별표 17", "공동주택"])],
      missing: "대상지 공장부지 비율(2008년 기준) 및 별표 17 해당 유형",
    },
    {
      id: "plan.bcrfar",
      content: "건폐율 60% 이하\n용적률 250% 이하 (공동주택·오피스텔)",
      law: "서울시 도시계획 조례 제44조, 제50조제2호가목",
      note: ctx.districtPlan ? "지구단위계획구역 검출: 획지 기준 확인 전까지 조례 일반값은 후보" : "지구단위계획 미검출 시 조례 일반값 적용",
      status: ctx.districtPlan ? "candidate" : "verified",
      params: { bcr: 60, far: 250 },
      sources: [
        seoulPlan("제44조", "준공업지역: 60퍼센트 이하", ["60퍼센트"]),
        seoulPlan("제50조제2호가목", "준공업지역: 공동주택·노인복지주택·오피스텔·다중생활시설 250퍼센트 이하", ["250퍼센트", "공동주택", "오피스텔"]),
      ],
    },
    {
      id: "plan.relax",
      content: "LH 기존주택등매입임대주택: 용적률 300% 이하 (별도 경로)\n추가 공공임대 공급 시 최대 400% 검토 (완화분 50% 공공임대 공급)",
      law: "서울시 도시계획 조례 제50조제2호바목·나목",
      note: "공공주택 특별법 시행령 제2조제1항제6호 해당 여부 확인 전 자동 적용 금지. 250%와 300%는 별개 경로이며 400%를 300%에 중첩하지 않음",
      status: "candidate",
      params: { relaxedFar: 300 },
      sources: [seoulPlan("제50조제2호바목", "「공공주택 특별법 시행령」 제2조제1항제6호에 따른 기존주택등매입임대주택: 300퍼센트 이하", ["300퍼센트", "기존주택등매입임대주택"])],
      missing: "LH 매입약정 방식의 매입임대 해당성 확인",
    },
    {
      id: "extra.factory",
      group: "공장부지 공동주택",
      section: "extra",
      content: "공장부지·이적지 비율에 따른 공동주택 허용기준 및 지구단위계획 수립 요건 검토",
      law: "서울시 도시계획 조례 별표 17",
      note: "공장비율 산정(건축물대장·공장등록), 산업시설 확보 의무 여부 확인",
      status: "candidate",
      sources: [seoulPlan("별표 17", "준공업지역 안에서의 공동주택 허용기준", ["공동주택 허용기준"])],
    },
    {
      id: "park.ordinance",
      group: "주차", sub: "조례 기준",
      section: "parking",
      content: "주택·오피스텔 부설주차장 설치기준 (별표 2), 비주거 혼합 시 용도별 합산",
      law: "서울시 주차장 설치 및 관리 조례 제20·21조, 별표 2·3",
      note: "전용면적 구간별 대수는 별표 2 원문에서 입력",
      status: "candidate",
      sources: [{ title: "서울특별시 주차장 설치 및 관리 조례", article: "제20조, 별표 2", effectiveDate: "2026-10-01", url: SEOUL_PARKING_URL, kind: "ordinance" }],
    },
  ],
};

// ───────── 청주시 ─────────
const CHEONGJU_PLAN_URL = "https://law.go.kr/ordinSc.do?menuId=3&nwYn=1&query=%EC%B2%AD%EC%A3%BC%EC%8B%9C+%EB%8F%84%EC%8B%9C%EA%B3%84%ED%9A%8D+%EC%A1%B0%EB%A1%80";
const CHEONGJU_PARKING_URL = "https://www.law.go.kr/LSW/ordinInfoR.do?ordinSeq=2170297";

const cheongjuCommercial: LibraryEntry = {
  id: "cheongju-general-commercial",
  title: "청주시 일반상업지역 (도시계획 조례 제61·67조)",
  checkedAt: "2026-11-11",
  match: (ctx) => inCity(ctx, "청주시") && singleZone(ctx, "일반상업지역"),
  rows: (ctx) => [{
    id: "plan.bcrfar",
    content: "건폐율 80% 이하\n용적률 1,000% 이하 (조례 일반기준)",
    law: "청주시 도시계획 조례 제61조, 제67조",
    note: ctx.districtPlan ? "지구단위계획구역: 획지별 기준이 우선하며 조례 일반값은 획지 확인 전 후보" : "지구단위계획 미검출",
    status: ctx.districtPlan ? "candidate" : "verified",
    params: { bcr: 80, far: 1000 },
    sources: [
      { title: "청주시 도시계획 조례", article: "제61조", effectiveDate: "2026-09-23", url: CHEONGJU_PLAN_URL, excerpt: "일반상업지역: 80퍼센트 이하", highlights: ["80퍼센트"], kind: "ordinance" },
      { title: "청주시 도시계획 조례", article: "제67조", effectiveDate: "2026-09-23", url: CHEONGJU_PLAN_URL, excerpt: "일반상업지역: 1천퍼센트 이하", highlights: ["1천퍼센트"], kind: "ordinance" },
    ],
  }],
};

const cheongjuParking: LibraryEntry = {
  id: "cheongju-mechanical",
  title: "청주시 주차장 조례 기계식 기준 (2026.09.23 개정)",
  checkedAt: "2026-11-12",
  match: (ctx) => inCity(ctx, "청주시"),
  rows: () => [{
    id: "park.mech.ord",
    content: "기계식주차장은 30대 이상 설치하는 경우에 한해 허용, 건축물 내부 방향전환장치 원칙\n종전 자주식 비율 의무 삭제",
    law: "청주시 주차장 조례 제15조제3항·제4항, 별표 7",
    note: "구 조례의 50% 자주식 의무 문구를 현행으로 사용하지 않음. LH 인수기준은 별도",
    status: "verified",
    params: { mechApartment: "allowed", mechUrban: "allowed", mechOfficetel: "allowed", mechMinStalls: 30 },
    sources: [{ title: "청주시 주차장 조례", article: "제15조제3항", effectiveDate: "2026-09-23", url: CHEONGJU_PARKING_URL, excerpt: "기계식주차장은 30대 이상 설치하는 경우에만 설치할 수 있다.", highlights: ["30대 이상"], kind: "ordinance" }],
  }],
};

// ───────── 오송바이오폴리스 지구단위계획 ─────────
const OSONG_GUIDE_URL = "https://cjic.cheongju.go.kr/DATA/download/cic/cts226_file.pdf";
const osongBlock = (ctx: LibraryContext) => /^C(0[1-9]|1[0-8])$/.test(ctx.blockNo);
const osongBiopolis: LibraryEntry = {
  id: "osong-biopolis",
  title: "오송바이오폴리스지구 지구단위계획 시행지침 (C01~C18 상업·업무시설용지)",
  checkedAt: "2026-11-11",
  match: (ctx) => inCity(ctx, "청주시", "오송읍") && compact(ctx.address).includes("오송읍"),
  rows: (ctx) => {
    const plan: RowPatch = {
      id: "plan.district",
      content: ctx.blockNo
        ? `오송바이오폴리스지구 지구단위계획 · 획지 ${ctx.blockNo} (검토자 지정)`
        : "오송바이오폴리스지구 지구단위계획구역 해당 가능 · 획지번호 미확인",
      law: "청주시 오송2산단(오송바이오폴리스) 지구단위계획 시행지침 제4조·제27~29조",
      note: ctx.blockNo ? "획지번호는 결정도·지적중첩으로 재확인. 건축한계선·차량출입불허구간은 시행지침도 대조" : "결정도에서 획지번호(C/D/E 계열) 확인 후 입력해야 획지 기준이 적용됨",
      status: ctx.blockNo ? "user" : "candidate",
      sources: [{ title: "오송바이오폴리스지구 지구단위계획 시행지침", article: "제4조제4항, 제29조", url: OSONG_GUIDE_URL, kind: "plan" }],
      missing: ctx.blockNo ? undefined : "해당 필지 획지번호",
    };
    if (!osongBlock(ctx)) return [plan];
    const floors = Number(ctx.blockNo.slice(1)) <= 6 ? 15 : 10;
    return [plan, {
      id: "plan.use",
      content: "C계열 상업·업무시설용지: 공동주택 허용용도 미열거(불허), 오피스텔 용도 불허 명시",
      law: "오송바이오폴리스지구 지구단위계획 시행지침 제27조",
      note: "일반상업지역 용도지역만으로 주거·오피스텔을 허용하지 않음. 획지 기준이 조례에 우선",
      status: "user",
      params: { useApartment: "prohibited", useUrban: "prohibited", useOfficetel: "prohibited" },
      sources: [{ title: "오송바이오폴리스지구 지구단위계획 시행지침", article: "제27조", url: OSONG_GUIDE_URL, excerpt: "C01~C18 상업·업무시설용지 … 오피스텔 용도는 불허한다.", highlights: ["오피스텔 용도는 불허"], kind: "plan" }],
    }, {
      id: "plan.bcrfar",
      content: `건폐율 80% 이하\n용적률 1,000% 이하 (획지 ${ctx.blockNo})`,
      law: "오송바이오폴리스지구 지구단위계획 시행지침 제28조",
      note: "조례 일반값과 같은 수치이나 근거는 획지 기준",
      status: "user",
      params: { bcr: 80, far: 1000 },
      sources: [{ title: "오송바이오폴리스지구 지구단위계획 시행지침", article: "제28조", url: OSONG_GUIDE_URL, excerpt: "C01~C18: 건폐율 80% 이하, 용적률 1,000% 이하, 최고층수 C01~C06 15층, C07~C18 10층", highlights: ["80%", "1,000%", `${floors}층`], kind: "plan" }],
    }, {
      id: "plan.height",
      content: `최고층수 ${floors}층 (획지 ${ctx.blockNo})`,
      law: "오송바이오폴리스지구 지구단위계획 시행지침 제28조",
      note: "C01~C06 15층 / C07~C18 10층",
      status: "user",
      params: { maxFloors: floors },
      sources: [{ title: "오송바이오폴리스지구 지구단위계획 시행지침", article: "제28조", url: OSONG_GUIDE_URL, excerpt: "최고층수 C01~C06 15층, C07~C18 10층", highlights: [`${floors}층`], kind: "plan" }],
    }];
  },
};

// ───────── 의정부시 (사용자 법규검토표 기준) ─────────
const UIJEONGBU_PLAN_URL = "https://www.law.go.kr/ordinSc.do?menuId=3&query=" + encodeURIComponent("의정부시 도시계획 조례");
const UIJEONGBU_BUILDING_URL = "https://www.law.go.kr/ordinSc.do?menuId=3&query=" + encodeURIComponent("의정부시 건축 조례");
const UIJEONGBU_PARKING_URL = "https://www.law.go.kr/LSW/ordinInfoP.do?ordinSeq=2107023";
const ujb = (title: string, article: string, url: string, excerpt?: string, highlights?: string[]): SourceRef =>
  ({ title, article, url, excerpt, highlights, kind: "ordinance" });

const uijeongbu2nd: LibraryEntry = {
  id: "uijeongbu-2nd-general",
  title: "의정부시 제2종일반주거지역 (사용자 법규검토표 가능동 75-1 기준)",
  checkedAt: "2026-11-13",
  match: (ctx) => inCity(ctx, "의정부시") && singleZone(ctx, "제2종일반주거지역"),
  rows: (ctx) => [
    {
      id: "plan.use",
      content: "나. 「건축법 시행령」 별표 1 제2호의 공동주택\n파. 별표 1 제14호 업무시설 중 오피스텔 등으로서 해당 용도 바닥면적 합계 3천㎡ 미만",
      law: "의정부시 도시계획 조례 제26조, 별표 4",
      note: "용적률 250%(완화 시 300%) 충족 시 3,000㎡ 초과 오피스텔 설치 불가",
      status: "user",
      params: { useApartment: "allowed", useUrban: "allowed", useOfficetel: "conditional" },
      sources: [ujb("의정부시 도시계획 조례", "제26조, 별표 4", UIJEONGBU_PLAN_URL, "오피스텔·금융업소·사무소로서 해당 용도에 쓰이는 바닥면적의 합계가 3천제곱미터 미만인 것", ["3천제곱미터 미만"])],
    },
    {
      id: "plan.bcrfar",
      content: "건폐율 60% 이하\n용적률 250% 이하",
      law: "의정부시 도시계획 조례 제42조, 제46조제1항",
      note: ctx.districtPlan ? "지구단위계획구역 검출: 획지 기준 확인 필요" : "",
      status: ctx.districtPlan ? "candidate" : "user",
      params: { bcr: 60, far: 250 },
      sources: [ujb("의정부시 도시계획 조례", "제42조", UIJEONGBU_PLAN_URL, "제2종일반주거지역: 60퍼센트 이하", ["60퍼센트"]), ujb("의정부시 도시계획 조례", "제46조제1항", UIJEONGBU_PLAN_URL, "제2종일반주거지역: 250퍼센트 이하", ["250퍼센트"])],
    },
    {
      id: "plan.relax",
      content: "조건 충족 시 기본 용적률의 120% 범위, 최대 300% 검토",
      law: "의정부시 도시계획 조례 제46조제3·4항",
      note: "공공임대 해당성·완화 요건 확인 후 적용",
      status: "candidate",
      params: { relaxedFar: 300 },
      sources: [ujb("의정부시 도시계획 조례", "제46조제3·4항", UIJEONGBU_PLAN_URL, "기본 용적률의 120퍼센트 이하의 범위", ["120퍼센트"])],
      missing: "공공임대 완화 적용요건 충족 여부",
    },
    {
      id: "bld.sunlight",
      content: "10m 이하 1.5m, 초과 부분 H/2",
      law: "의정부시 건축조례 제43조",
      note: "",
      status: "user",
      sources: [ujb("의정부시 건축 조례", "제43조", UIJEONGBU_BUILDING_URL)],
    },
    {
      id: "bld.setback",
      content: "건축선으로부터 띄어야 하는 거리: 3m 이상(공동주택) / 폭 12m 이상 도로: 1m 이상(오피스텔)\n인접대지경계선으로부터 띄어야 하는 거리: 3m 이상(공동주택) / 0.5m 이상(오피스텔)",
      law: "의정부시 건축조례 제45조",
      note: "",
      status: "user",
      sources: [ujb("의정부시 건축 조례", "제45조", UIJEONGBU_BUILDING_URL)],
    },
    {
      id: "park.mech.ord",
      content: "제2·3종일반주거지역은 공동주택 제외, 연면적 1,000㎡ 이상 또는 5층 이상에 적용 가능\n주차대수의 20% 이하, 기계식 20대 미만 설치 불가",
      law: "의정부시 주차장조례 제11조의2",
      note: "공동주택 기계식 설치 불가",
      status: "user",
      params: { mechApartment: "prohibited", mechUrban: "prohibited", mechOfficetel: "conditional", mechMaxPercent: 20, mechMinStalls: 20 },
      sources: [ujb("의정부시 주차장 설치 및 관리 조례", "제11조의2", UIJEONGBU_PARKING_URL, "제2종일반주거지역 및 제3종일반주거지역의 공동주택은 제외 … 주차대수의 100분의 20 이하", ["공동주택은 제외", "100분의 20"])],
    },
    {
      id: "park.apartment",
      content: "조례상 전용면적 기준 및 세대당 최소대수 적용. 46㎡형은 1.0대/세대 우선 검토",
      law: "의정부시 주차장조례 별표 3",
      note: "",
      status: "user",
      params: { parkingApartment: 1.0 },
      sources: [ujb("의정부시 주차장 설치 및 관리 조례", "별표 3", UIJEONGBU_PARKING_URL)],
    },
  ],
};

export const LIBRARY: LibraryEntry[] = [seoulSemiIndustrial, cheongjuCommercial, cheongjuParking, osongBiopolis, uijeongbu2nd];

export function matchLibrary(ctx: LibraryContext): LibraryEntry[] {
  return LIBRARY.filter((entry) => entry.match(ctx));
}

export function applyParamsFromLibrary(rows: RowPatch[]): RuleParams {
  return rows.reduce<RuleParams>((acc, row) => ({ ...acc, ...(row.params ?? {}) }), {});
}
