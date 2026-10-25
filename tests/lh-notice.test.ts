import { describe, expect, it, vi } from "vitest";
import { findLatestLhPurchaseNotice, parseLhAttachments, parseLhPurchaseList, buildLhPagingBody, countLhListPages, isSameProvinceNotice } from "../lib/server/lh-notice";
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
  it("finds Seoul regional bulletin when the 25-gu list abbreviation omits 강남구",async()=>{
    const page='<table><tr><td>14</td><td>민간신축 매입약정</td><td><a data-id1="2901" class="slpaInfoBtn"><span>[정정공고](서울지역) 2026년 6차 민간신축 매입약정 공고</span></a></td><td>종로구, 중구, 용산구, 성동구, ...</td><td>첨부파일</td><td>2026.10.14</td><td>2026.11.05</td></tr></table>';
    const mock=vi.spyOn(globalThis,"fetch").mockImplementation(async url=>new Response(String(url).includes("/pch/view.do")
      ? '<a href="/lhapply/lhFile.do?fileid=999995" title="file">공고문.pdf</a>'
      : page,{headers:{"Content-Type":"text/html"}}));
    try{
      const result=await findLatestLhPurchaseNotice("강남구","서울특별시 강남구");
      expect(result?.id).toBe("2901");
      expect(result?.matchedDistrict).toBe("강남구");
      expect(result?.rules).toBeNull();
      expect(result?.warnings.some(x=>x.includes("실제 공고 대상 여부"))).toBe(true);
    }finally{mock.mockRestore()}
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
  it("disambiguates same-named districts across metropolitan areas", () => {
    expect(isSameProvinceNotice("(부산지역) 신축 매입약정 공고","서구","부산광역시 서구")).toBe(true);
    expect(isSameProvinceNotice("(대전충남지역본부) 신축 매입약정 공고","서구","부산광역시 서구")).toBe(false);
    expect(isSameProvinceNotice("(광주전남) 공고","북구","광주광역시 북구")).toBe(true);
    expect(isSameProvinceNotice("(대구경북) 공고","북구","광주광역시 북구")).toBe(false);
    expect(isSameProvinceNotice("(경기북부) 공고","의정부시","경기도 의정부시")).toBe(true);
  });
  it("uses LH's POST currPage paging form to cover notices outside page one", () => {
    const withPager=html+'<form name="pagingForm" method="post"><input type="hidden" name="currPage" value="1"/><input type="hidden" name="panEdDt" value="20261025"/><input type="hidden" name="mi" value="1076"/><a onclick="goPaging(2)">2</a></form>';
    expect(countLhListPages(withPager)).toBe(2);
    const body=buildLhPagingBody(withPager,2);
    expect(body?.get("currPage")).toBe("2");
    expect(body?.get("panEdDt")).toBe("20261025");
    expect(body?.get("mi")).toBe("1076");
    expect(buildLhPagingBody(withPager,7)).toBeNull();
  });
  it("finds a different municipality notice on page two without inheriting 2026 경기북부 numeric rules", async () => {
    const firstPage=html+'<form name="pagingForm"><input type="hidden" name="currPage" value="1"/><input type="hidden" name="mi" value="1076"/><a onclick="goPaging(2)">2</a></form>';
    const secondPage='<tr><td>1</td><td>민간신축 매입약정</td><td><a data-id1="1950" class="slpaInfoBtn"><span>(전북지역) 2026년 익산시 민간 신축 매입약정 공고</span></a></td><td>익산시</td><td>2026.10.20</td><td>2026.11.20</td></tr>';
    const fetchMock=vi.spyOn(globalThis,"fetch").mockImplementation(async (url,init)=>{
      const str=String(url);
      if(str.includes("/pch/view.do"))return new Response('<a href="/lhapply/lhFile.do?fileid=991991" title="file">최신공고문.pdf</a>',{headers:{"Content-Type":"text/html"}});
      return new Response(init?.method==="POST"?secondPage:firstPage,{headers:{"Content-Type":"text/html"}});
    });
    try{
      const result=await findLatestLhPurchaseNotice("익산시","전북특별자치도 익산시");
      expect(result?.id).toBe("1950");
      expect(result?.matchedDistrict).toBe("익산시");
      expect(result?.rules).toBeNull();
      expect(result?.pdfUrl).toContain("991991");
      expect(fetchMock.mock.calls.some((call)=>call[1]?.method==="POST")).toBe(true);
    }finally{fetchMock.mockRestore()}
  });

});
