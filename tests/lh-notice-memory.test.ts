import { describe, expect, it } from "vitest";
import { getNoticeMemoryStatus, LH_NOTICE_MEMORY, noticeAppliesToAddress } from "../lib/lh-notice-memory";
import { findSitePreset } from "../lib/site-presets";

describe("Persisted Seoul LH notice and parcel evidence", () => {
  it("stores source-page-linked Seoul sixth notice criteria without treating it as a national rule", () => {
    const seoul = LH_NOTICE_MEMORY.find(x=>x.region==="서울특별시");
    expect(seoul?.rules.length).toBeGreaterThan(10);
    expect(seoul?.rules.find(x=>x.topic==="용적률 120%")?.sourcePage).toBe(24);
    expect(seoul?.revisionWarning).toContain("정정공고");
    expect(seoul?.originalSha256?.length).toBe(64);
  });
  it("does not apply a Seoul notice to Paju and shows correct regional candidate", () => {
    const rows=getNoticeMemoryStatus("경기도 파주시 파주읍 봉암리 1343-2");
    expect(rows.find(x=>x.notice.region==="서울특별시")?.applicable).toBe(false);
    expect(rows.find(x=>x.notice.region==="경기북부")?.applicable).toBe(true);
    expect(noticeAppliesToAddress(LH_NOTICE_MEMORY[0],"서울특별시 강남구 역삼동 1-1")).toBe(true);
    expect(noticeAppliesToAddress(LH_NOTICE_MEMORY[1],"부산광역시 파주시 파주읍 봉암리 1343-2")).toBe(false);
  });
  it("retrieves the exact certified Paju parcel facts instead of guessed site-area values", () => {
    const parcel=findSitePreset("경기도 파주시 파주읍 봉암리 1343-2");
    expect(parcel).toMatchObject({siteArea:3236.5,zone:"준주거지역",districtPlan:true,landCategory:"대"});
    expect(findSitePreset("파주시 봉암리 1343-2")?.id).toBe(parcel?.id);
    expect(parcel?.restrictions.join(" ")).toContain("35m");
    expect(parcel?.warnings.join(" ")).toContain("360%");
  });
});
