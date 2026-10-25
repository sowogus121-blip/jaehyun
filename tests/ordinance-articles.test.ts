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
