import { describe, it, expect } from "vitest";
import { extractLhMechRule } from "../lib/review/parking-rules";

describe("LH 공고 기계식주차 매입제외", () => {
  it("충북본부 2026 공고 ⑰ 문구를 매입제외로 읽는다", () => {
    const r = extractLhMechRule(["분양이 완료되지 아니한 미분양아파트. ⑰ 기계식 주차 방식을 적용·설계한 경우 ⑱ 신청필지에 대해 토지소유권 미확보"]);
    expect(r?.excluded).toBe(true);
    expect(r?.excludedQuote).toContain("기계식 주차 방식을 적용");
  });
  it("수도권식 허용요건 문구는 매입제외가 아님", () => {
    const r = extractLhMechRule(["⑤ 기계식 주차 설치 허용기준 ㅇ (대상요건) (1) 서울·인천·경기도 역세권(GTX역 포함 도시철도역 출구로부터 직선거리 500m 내), (2) 청년용 (3) 주거용오피스텔 또는 도시형생활주택(3가지 요건 모두 충족 시)"]);
    expect(r?.excluded).toBe(false);
  });
});
