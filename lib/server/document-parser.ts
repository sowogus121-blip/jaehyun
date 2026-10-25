import ExcelJS from "exceljs";
import JSZip from "jszip";

export type DocumentCandidate = {
  topic: string;
  quote: string;
  value: number | null;
  unit: string | null;
  verified: false;
};

export type DocumentAnalysis = {
  format: "pdf" | "hwpx" | "docx" | "xlsx" | "txt";
  pageCount: number | null;
  textLength: number;
  preview: string;
  candidates: DocumentCandidate[];
  warnings: string[];
};

const MAX_TEXT = 1_000_000;

function decodeXml(value: string) {
  return value
    .replace(/<[^>]+>/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractRuleCandidates(text: string): DocumentCandidate[] {
  const sentences = text.split(/(?<=[다함음]\.|[。!?])|\n+/).map((item) => item.trim()).filter(Boolean);
  const topicPatterns: Array<[string, RegExp]> = [
    ["건폐율", /건폐율/],
    ["용적률", /용적률/],
    ["높이", /최고\s*높이|높이\s*제한|최고\s*층수/],
    ["주차", /주차.*(?:대|세대|호)|(?:세대|호)당.*주차/],
    ["조경", /조경\s*(?:면적|비율|기준)/],
    ["허용용도", /허용\s*용도|불허\s*용도|건축할\s*수\s*(?:있는|없는)/],
    ["대지 안의 공지", /대지\s*안의\s*공지/],
    ["일조", /일조|인동\s*거리/],
    ["완화", /완화|인센티브|상한용적률|공공기여/],
    ["LH 매입", /LH|한국토지주택공사|매입약정|매입임대/],
  ];
  const candidates: DocumentCandidate[] = [];
  for (const sentence of sentences) {
    if (sentence.length < 8 || sentence.length > 500) continue;
    for (const [topic, pattern] of topicPatterns) {
      if (!pattern.test(sentence)) continue;
      const number = sentence.match(/(-?\d+(?:\.\d+)?)\s*(%|퍼센트|대\/세대|대\/호|대|m|미터|층|㎡)/i);
      candidates.push({
        topic,
        quote: sentence.slice(0, 480),
        value: number ? Number(number[1]) : null,
        unit: number ? number[2] : null,
        verified: false,
      });
      break;
    }
    if (candidates.length >= 80) break;
  }
  return candidates;
}

async function parsePdf(data: Uint8Array) {
  // pdf-parse evaluates pdfjs-dist on import, which accesses DOMMatrix.
  // Import only during PDF extraction so the entire site-review route never
  // crashes at module startup in Vercel's Node.js serverless environment.
  // The worker sets up CanvasFactory before loading PDFParse.
  const { CanvasFactory } = await import("pdf-parse/worker");
  const { PDFParse } = await import("pdf-parse");
  const parser = new PDFParse({ data, CanvasFactory });
  try {
    const result = await parser.getText();
    return { text: result.text, pageCount: result.total || null };
  } finally {
    await parser.destroy();
  }
}

async function parseZipXml(data: Uint8Array, format: "hwpx" | "docx") {
  const zip = await JSZip.loadAsync(data);
  const pattern = format === "hwpx" ? /^Contents\/section\d+\.xml$/i : /^word\/document\.xml$/i;
  const files = Object.values(zip.files).filter((entry) => pattern.test(entry.name)).sort((a, b) => a.name.localeCompare(b.name));
  if (!files.length) throw new Error(`${format.toUpperCase()} 본문 XML을 찾지 못했습니다.`);
  const sections = await Promise.all(files.map(async (entry) => decodeXml(await entry.async("text"))));
  return sections.join("\n");
}

async function parseXlsx(data: Uint8Array) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(data as unknown as ExcelJS.Buffer);
  const lines: string[] = [];
  workbook.eachSheet((sheet) => {
    lines.push(`[시트] ${sheet.name}`);
    sheet.eachRow((row) => {
      const values = row.values as Array<unknown>;
      const text = values.slice(1).map((value) => {
        if (value && typeof value === "object" && "result" in value) return String((value as { result?: unknown }).result ?? "");
        return String(value ?? "");
      }).join(" | ").trim();
      if (text) lines.push(text);
    });
  });
  return lines.join("\n");
}

export async function parseUploadedDocument(file: File): Promise<DocumentAnalysis> {
  if (file.size > 20 * 1024 * 1024) throw new Error("문서 크기는 20MB를 초과할 수 없습니다.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const data = new Uint8Array(await file.arrayBuffer());
  let text = "";
  let pageCount: number | null = null;
  let format: DocumentAnalysis["format"];
  const warnings: string[] = [];

  if (extension === "pdf") {
    format = "pdf";
    const parsed = await parsePdf(data);
    text = parsed.text;
    pageCount = parsed.pageCount;
  } else if (extension === "hwpx") {
    format = "hwpx";
    text = await parseZipXml(data, "hwpx");
  } else if (extension === "docx") {
    format = "docx";
    text = await parseZipXml(data, "docx");
  } else if (extension === "xlsx") {
    format = "xlsx";
    text = await parseXlsx(data);
  } else if (extension === "txt") {
    format = "txt";
    text = new TextDecoder("utf-8").decode(data);
  } else if (extension === "hwp") {
    throw new Error("구형 HWP 바이너리는 직접 분석할 수 없습니다. HWPX 또는 PDF로 변환해 주세요.");
  } else {
    throw new Error("지원 형식은 PDF, HWPX, DOCX, XLSX, TXT입니다.");
  }

  const normalized = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").trim().slice(0, MAX_TEXT);
  if (!normalized) warnings.push("본문 텍스트를 추출하지 못했습니다. 스캔 PDF라면 OCR 연동이 필요합니다.");
  if (text.length > MAX_TEXT) warnings.push("본문이 길어 최초 100만 자만 분석했습니다.");
  return {
    format,
    pageCount,
    textLength: normalized.length,
    preview: normalized.slice(0, 1200),
    candidates: extractRuleCandidates(normalized),
    warnings,
  };
}
