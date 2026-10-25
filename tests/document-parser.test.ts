import { describe, expect, it } from "vitest";
import { extractRuleCandidates, parseUploadedDocument } from "../lib/server/document-parser";

describe("official document candidate extraction", () => {
  it("extracts numeric legal-rule candidates without marking them verified", () => {
    const candidates = extractRuleCandidates("제10조에 따라 건폐율은 60% 이하로 한다. 주차장은 세대당 0.5대를 설치한다.");
    expect(candidates).toEqual(expect.arrayContaining([
      expect.objectContaining({ topic: "건폐율", value: 60, unit: "%", verified: false }),
      expect.objectContaining({ topic: "주차", value: 0.5, verified: false }),
    ]));
  });
});


function minimalPdf(text: string) {
  const stream = "BT /F1 12 Tf 40 180 Td (" + text + ") Tj ET";
  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>",
    "<< /Length " + Buffer.byteLength(stream) + " >>\nstream\n" + stream + "\nendstream",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(Buffer.byteLength(pdf));
    pdf += String(i + 1) + " 0 obj\n" + objects[i] + "\nendobj\n";
  }
  const startxref = Buffer.byteLength(pdf);
  pdf += "xref\n0 6\n0000000000 65535 f \n";
  pdf += offsets.slice(1).map((n) => String(n).padStart(10, "0") + " 00000 n \n").join("");
  pdf += "trailer\n<< /Root 1 0 R /Size 6 >>\nstartxref\n" + startxref + "\n%%EOF\n";
  return new File([new Uint8Array(Buffer.from(pdf))], "official.pdf", { type: "application/pdf" });
}

describe("pdf parser server compatibility", () => {
  it("loads PDFParse only when PDF is being analyzed and extracts text", async () => {
    const result = await parseUploadedDocument(minimalPdf("PDF TEXT OK"));
    expect(result.format).toBe("pdf");
    expect(result.pageCount).toBe(1);
    expect(result.preview).toContain("PDF TEXT OK");
  });
});
