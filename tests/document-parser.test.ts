import { describe, expect, it } from "vitest";
import { extractRuleCandidates } from "../lib/server/document-parser";

describe("official document candidate extraction", () => {
  it("extracts numeric legal-rule candidates without marking them verified", () => {
    const candidates = extractRuleCandidates("제10조에 따라 건폐율은 60% 이하로 한다. 주차장은 세대당 0.5대를 설치한다.");
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ topic: "건폐율", value: 60, unit: "%", verified: false }),
      expect.objectContaining({ topic: "주차", value: 0.5, verified: false }),
    ]));
  });
});
