import { afterEach, describe, expect, it } from "vitest";
import { searchOfficialSources } from "../lib/server/official-search";

const originalKey = process.env.BRAVE_SEARCH_API_KEY;

afterEach(() => {
  if (originalKey === undefined) delete process.env.BRAVE_SEARCH_API_KEY;
  else process.env.BRAVE_SEARCH_API_KEY = originalKey;
});

describe("official web fallback", () => {
  it("reports a missing server credential without pretending the search completed", async () => {
    delete process.env.BRAVE_SEARCH_API_KEY;
    const result = await searchOfficialSources({ address: "서울특별시 강남구 역삼동 1", localGovernment: "서울특별시 강남구" });
    expect(result.status).toBe("not-configured");
    expect(result.results).toEqual([]);
    expect(result.errors[0]).toContain("BRAVE_SEARCH_API_KEY");
  });
});
