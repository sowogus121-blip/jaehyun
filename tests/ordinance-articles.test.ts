import { describe, expect, it } from "vitest";
import { extractOrdinanceArticles } from "../lib/server/ordinance-articles";

describe("official ordinance source evidence", () => {
  it("extracts clause context without incorrectly verifying applicability", () => {
    const response = {
      자치법규: {
        조문: [
          { 조문번호: "12", 조제목: "건폐율", 조내용: "건폐율은 해당 용도지역과 법령에 따른다." },
          { 조문번호: "13", 조제목: "주차", 조내용: "부설주차장 설치기준을 준수하여야 한다." },
        ],
      },
    };
    const results = extractOrdinanceArticles(response, "가상시 건축 조례", "https://www.law.go.kr/example");
    expect(results).toHaveLength(2);
    expect(results.map((item) => item.topic)).toEqual(["건폐율", "주차"]);
    expect(results.every((item) => item.verified === false)).toBe(true);
    expect(results[0].article).toContain("제12조");
    expect(results[0].sourceUrl).toBe("https://www.law.go.kr/example");
  });

  it("does not treat a search-result title as substantive proof", () => {
    const results = extractOrdinanceArticles({ name: "용적률 완화", status: "검색 완료" }, "제목", "https://www.law.go.kr/");
    expect(results).toHaveLength(0);
  });

  it("does not crash for unexpected empty body structures", () => {
    expect(extractOrdinanceArticles({ 자치법규: null, 조문: [] }, "빈조례", "https://www.law.go.kr/")).toEqual([]);
  });
});

import { findArticlesByKeyword } from "../lib/server/ordinance-articles";
describe("행별 근거 보완 탐색", () => {
  it("검색어가 포함된 조문을 항 내용까지 원문 그대로 돌려준다", () => {
    const payload = { 자치법규: { 조문: { 조: [
      { 조문번호: "46", 조제목: "용도지역안에서의 용적률", 조내용: "제46조(용도지역안에서의 용적률)", 항: [{ 항내용: "① 제2종일반주거지역: 250퍼센트 이하" }] },
      { 조문번호: "47", 조제목: "기타", 조내용: "제47조(기타) 관계없는 조문" },
    ] } } };
    const found = findArticlesByKeyword(payload, ["안에서의 용적률", "용적률"]);
    expect(found).toHaveLength(1);
    expect(found[0].article).toContain("제46조");
    expect(found[0].text).toContain("250퍼센트");
  });
});
