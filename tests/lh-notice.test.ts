import { describe, expect, it, vi } from "vitest";
import { findLatestLhPurchaseNotice, parseLhAttachments, parseLhPurchaseList } from "../lib/server/lh-notice";
import { ALTERNATIVES, DEFAULT_INPUT, calculateAlternative, calculateFacilities } from "../lib/calculator";
import { DEFAULT_CALCULATION_CONTEXT } from "../lib/calculator";

const html = String.raw`<table>
<tr><td>10</td><td>민간신축 매입약정</td>
<td class="mVw bbs_tit"><a href="javascript:" data-id1="1730" class="slpaInfoBtn"><span>(경기북부) '26-4차 민간 신축 매입약정 방식 매입 공고</span></a></td>
<td>의정부시, 양주시</td><td>다운로드</td><td>2026.10.07</td><td>2026.11.06</td></tr>
<tr><td>9</td><td>민간신축 매입약정</td>
<td><a href="javascript:" data-id1="1714" class="slpaInfoBtn"><span>경기북부 3차 매입 공고</span></a></td><td>의정부시</td><td>다운로드</td><td>2026.09.11</td><td>2026.10.02</td></tr>
</table>`;
const detail = String.raw`<div><a href="/lhapply/lhFile.do?fileid=68899892" title="파일 다운로드">1.'26-4차경기북부민간신축매입약정방식공고문.pdf</a>
<a href="/lhapply/lhFile.do?fileid=68899893" title="파일 다운로드">2.매입신청서식,가이드라인등('26-4차공고).zip</a></div>`;

describe("Official LH purchase announcements",()=>{
  it("finds latest region-specific announcement and original attachments",()=>{
    const list=parseLhPurchaseList(html,"의정부시");
    expect(list).toHaveLength(2);
    expect(list[0]).toMatchObject({id:"1730",publishedAt:"2026.10.07",closesAt:"2026.11.06"});
    expect(parseLhPurchaseList(html,"남양주시")).toEqual([]);
    expect(parseLhAttachments(detail)).toEqual({
      pdfUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68899892",
      guideUrl:"https://apply.lh.or.kr/lhapply/lhFile.do?fileid=68899893",
    });
  });
  it("attaches verified numbers ONLY to the exact verified 4th notice PDF",async()=>{
    const fetchMock=vi.spyOn(globalThis,"fetch").mockImplementation(async (url)=>{
      const value=String(url);
      return new Response(value.includes("/pch/list.do")?html:detail,{headers:{"Content-Type":"text/html"}});
    });
    try {
      const found=await findLatestLhPurchaseNotice("의정부시");
      expect(found?.id).toBe("1730");
      expect(found?.rules).toMatchObject({minimumHomes:30,newlywedMinimumArea:36,youthMinimumArea:19,mechanicalMaxPercent:50,mechanicalTransitMaxMeters:500});
      expect(found?.pdfUrl).toContain("68899892");
    }finally{fetchMock.mockRestore()}
  });
  it("excludes mechanized apartment planning under verified LH notice",()=>{
    const input={...DEFAULT_INPUT,businessMode:"purchase" as const,siteArea:1467,baseFar:250,buildingCoverageRatio:60,maxFloors:10,apartmentParkingRatio:1,officetelParkingRatio:0.5,mechanicalMaxRatio:50};
    const ctx={...DEFAULT_CALCULATION_CONTEXT,lhPurchaseMechanicalRestrictedToOfficetelOrUrban:true};
    const apt=calculateAlternative(input,ALTERNATIVES[1],ctx);
    const office=calculateAlternative(input,ALTERNATIVES[3],ctx);
    expect(apt.eligibility).toBe("ineligible");
    expect(apt.parking.mechanicalCount).toBe(0);
    expect(office.parking.mechanicalCount).toBeGreaterThan(0);
    expect(office.parking.mechanicalCount).toBeLessThanOrEqual(Math.floor(office.parking.finalCount*.5));
  });
  it("includes mandatory 1 sqm per home community space for >=50 homes on verified LH purchase scenario",()=>{
    const context={...DEFAULT_CALCULATION_CONTEXT,lhCommunityMinimumHomes:50,lhCommunitySqmPerHome:1};
    const apartment=calculateFacilities("apartment",58,context).find(x=>x.name==="주민공동공간");
    const office=calculateFacilities("officetel",64,context).find(x=>x.name==="공용 라운지");
    expect(apartment?.required).toBe(true);
    expect(apartment?.area).toBeGreaterThanOrEqual(58);
    expect(office?.required).toBe(true);
    expect(office?.area).toBeGreaterThanOrEqual(64);
    expect(calculateFacilities("officetel",49,context).find(x=>x.name==="공용 라운지")?.required).toBe(false);
    const baseline=calculateFacilities("apartment",58);
    expect(baseline.find(x=>x.name==="주민공동공간")?.area).toBe(0);
  });
});
