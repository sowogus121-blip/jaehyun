import { afterEach, describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import {
  collectOfficialDocuments,
  discoverAttachmentLinks,
  isSafeOfficialDocumentUrl,
  selectOfficialDocumentSources,
} from "../lib/server/official-document-ingest";
import type { OfficialSearchResult } from "../lib/server/official-search";

const search = (url: string, title: string, query: string): OfficialSearchResult => ({
  url, title, description: title, query, sourceDomain: new URL(url).hostname, official: true,
});

async function hwpxDocument() {
  const zip = new JSZip();
  zip.file("Contents/section0.xml", "<hp:p><hp:t>용적률은 230% 이하로 계획한다.</hp:t></hp:p>");
  return new Uint8Array(await zip.generateAsync({ type: "uint8array" }));
}

afterEach(() => vi.unstubAllGlobals());

describe("official planning and LH document ingestion", () => {
  it("rejects insecure, off-domain, port and credentials URLs", () => {
    expect(isSafeOfficialDocumentUrl("https://www.gangnam.go.kr/a.pdf")).toBe(true);
    expect(isSafeOfficialDocumentUrl("https://www.lh.or.kr/a.hwpx")).toBe(true);
    expect(isSafeOfficialDocumentUrl("http://www.lh.or.kr/a.pdf")).toBe(false);
    expect(isSafeOfficialDocumentUrl("https://127.0.0.1/private.pdf")).toBe(false);
    expect(isSafeOfficialDocumentUrl("https://www.lh.or.kr.evil.test/a.pdf")).toBe(false);
    expect(isSafeOfficialDocumentUrl("https://user:pass@www.lh.or.kr/a.pdf")).toBe(false);
    expect(isSafeOfficialDocumentUrl("https://www.lh.or.kr:444/a.pdf")).toBe(false);
  });

  it("keeps unrelated municipalities out and never resolves off-site attachment links", () => {
    const rows = [
      search("https://www.gangnam.go.kr/files/plan.hwpx", "서울특별시 강남구 역삼 지구단위계획 시행지침", "서울특별시 강남구 지구단위계획 결정 고시"),
      search("https://www.seocho.go.kr/files/plan.hwpx", "서울특별시 서초구 잠원 지구단위계획 시행지침", "서울특별시 강남구 지구단위계획 결정 고시"),
      search("https://www.lh.or.kr/files/guide.hwpx", "LH 경기북부 매입약정 설계지침", "LH 경기북부지역본부 신축매입약정 공고 설계지침"),
    ];
    const selected = selectOfficialDocumentSources(rows, "서울특별시 강남구");
    expect(selected).toHaveLength(2);
    expect(selected.some((item) => item.result.url.includes("seocho"))).toBe(false);
    expect(discoverAttachmentLinks('<a href="/files/plan.pdf">PDF</a><a href="https://evil.example/a.pdf">bad</a>',
      "https://www.gangnam.go.kr/notice/12")).toEqual(["https://www.gangnam.go.kr/files/plan.pdf"]);
  });

  it("automatically follows an official bulletin to HWPX, extracts candidates and never marks applicability verified", async () => {
    const hwpx = await hwpxDocument();
    vi.stubGlobal("fetch", vi.fn(async (input: string | URL | Request) => {
      const url = String(input);
      if (url.endsWith("/board/plan")) {
        return new Response('<html><a href="/files/plan.hwpx">지구단위계획 결정도서</a></html>', {
          headers: { "Content-Type": "text/html;charset=utf-8" },
        });
      }
      if (url.endsWith("/files/plan.hwpx")) {
        return new Response(new Uint8Array(hwpx), { headers: { "Content-Type": "application/octet-stream" } });
      }
      return new Response("not found", { status: 404 });
    }));
    const result = await collectOfficialDocuments([
      search("https://www.gangnam.go.kr/board/plan", "서울특별시 강남구 역삼 지구단위계획 시행지침", "서울특별시 강남구 역삼동 지구단위계획 결정 고시"),
    ], "서울특별시 강남구");

    expect(result.documents).toHaveLength(1);
    const found = result.documents[0];
    expect(found.status).toBe("analyzed");
    expect(found.format).toBe("hwpx");
    expect(found.sourceUrl).toContain("plan.hwpx");
    expect(found.landingPage).toContain("/board/plan");
    expect(found.candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ topic: "용적률", value: 230, verified: false }),
    ]));
    expect(found.applicable).toBe(false);
    expect(found.siteMatchVerified).toBe(false);
    expect(result.analysisComplete).toBe(false);
  });

  it("does not automatically chase redirects or treat HTML as a PDF", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, {
      status: 302, headers: { location: "http://127.0.0.1:8080/admin" },
    })));
    const result = await collectOfficialDocuments([
      search("https://www.lh.or.kr/files/notice.pdf", "LH 경기북부 신축매입약정 공고", "LH 경기북부지역본부 신축매입약정 공고 설계지침"),
    ], "의정부시");
    expect(result.documents[0].status).toBe("failed");
    expect(result.documents[0].warnings[0]).toContain("리다이렉트");
  });

  it("does not attempt unsupported legacy HWP or generic search snippets", async () => {
    const docs = await collectOfficialDocuments([
      search("https://www.lh.or.kr/files/old.hwp", "LH 경기북부 신축매입약정 공고", "LH 신축매입약정 공고"),
      search("https://www.gangnam.go.kr/notice", "강남구 버스노선 안내", "서울특별시 강남구 지구단위계획 결정"),
    ], "강남구");
    expect(docs.documents.every((doc) => doc.status !== "analyzed")).toBe(true);
  });
});
