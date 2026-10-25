import { NextRequest, NextResponse } from "next/server";
import ExcelJS from "exceljs";
import type { AlternativeResult, ProjectInput, SiteReviewResult } from "../../../../lib/types";
import type { ReviewedRule } from "../../../../lib/rule-application";
import type { SiteLookupDetails } from "../../../../lib/types";
import { buildLegalReviewReport } from "../../../../lib/legal-review-report";

export const runtime = "nodejs";

type ExportBody = {
  input?: ProjectInput;
  results?: AlternativeResult[];
  reviewData?: SiteReviewResult | null;
  reviewedRules?: ReviewedRule[];
  lookupDetails?: SiteLookupDetails | null;
};

function styleHeader(row: ExcelJS.Row) {
  row.font = { bold: true, color: { argb: "FFFFFFFF" } };
  row.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF173A56" } };
  row.alignment = { vertical: "middle", horizontal: "center" };
}

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null) as ExportBody | null;
  if (!body?.input || !Array.isArray(body.results) || body.results.length !== 4) {
    return NextResponse.json({ error: "프로젝트 입력값과 4개 대안 결과가 필요합니다." }, { status: 400 });
  }

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "LH Plan Lab";
  workbook.created = new Date();
  workbook.calcProperties.fullCalcOnLoad = true;

  // A printable, audit-friendly summary matching the legal review screen.
  const legalReview = buildLegalReviewReport(body.input, body.reviewData ?? null, body.lookupDetails ?? null, body.reviewedRules ?? []);
  const legalSheet = workbook.addWorksheet("법규검토 총괄표");
  legalSheet.addRow(["LH Plan Lab | 법규검토 총괄표"]);
  legalSheet.mergeCells("A1:E1");
  legalSheet.getRow(1).font = { bold: true, size: 17, color: { argb: "FF193C57" } };
  legalSheet.getRow(1).height = 30;
  legalSheet.addRow(["대상지", body.input.address, "검토 기준", body.reviewData?.checkedAt ?? "실조회 전", "법규 원문 = 필지별 자동승인 아님"]);
  legalSheet.getRow(2).height = 24;
  legalSheet.addRow(["구분", "검토 내용", "관련 법령 / 조례", "판정", "비고 및 원문 링크"]);
  styleHeader(legalSheet.getRow(3));
  const labels: Record<string, string> = { source: "원문 확인 (적용검토 전)", conditional: "조건부 검토", unknown: "미확정", user: "계획 입력" };
  let currentSection = "";
  legalReview.rows.forEach((item) => {
    if (item.section !== currentSection) {
      currentSection = item.section;
      const sectionRow = legalSheet.addRow([currentSection]);
      legalSheet.mergeCells(sectionRow.number, 1, sectionRow.number, 5);
      sectionRow.font = { bold: true, color: { argb: "FF274B62" } };
      sectionRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFDEEAF0" } };
      sectionRow.height = 22;
    }
    const row = legalSheet.addRow([item.label, item.detail, item.citation, labels[item.status], item.note]);
    row.height = 52;
    row.getCell(1).font = { bold: true, color: { argb: "FF254357" } };
    row.getCell(1).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF3F7F9" } };
    row.getCell(4).font = { bold: true, color: { argb: item.status === "source" ? "FF23715D" :
      item.status === "conditional" ? "FFA1662C" : item.status === "user" ? "FF2D6487" : "FF7A8791" } };
    if (item.sourceUrl) {
      row.getCell(3).value = { text: item.citation, hyperlink: item.sourceUrl };
      row.getCell(3).font = { color: { argb: "FF25759B" }, underline: true };
    }
    if (item.excerpt) row.getCell(5).value = item.note + "\n[조문 발췌] " + item.excerpt;
  });
  legalSheet.addRow([]);
  const calcTitle = legalSheet.addRow(["규모검토 계산 입력값 · 법정상한과 구분"]);
  legalSheet.mergeCells(calcTitle.number, 1, calcTitle.number, 5);
  calcTitle.font = { bold: true, color: { argb: "FF193C57" } };
  legalReview.calculatedLimits.forEach((item) => legalSheet.addRow([item.label, item.value, item.source,
    labels[item.status], "조문·별표 적용조건 확인 필요"]));
  legalSheet.columns = [
    { width: 27 }, { width: 45 }, { width: 44 }, { width: 25 }, { width: 72 },
  ];
  legalSheet.views = [{ state: "frozen", ySplit: 3 }];
  legalSheet.pageSetup = { paperSize: 9, orientation: "landscape", fitToPage: true, fitToWidth: 1, fitToHeight: 0 };
  for (const column of [2, 3, 4, 5]) legalSheet.getColumn(column).alignment = { wrapText: true, vertical: "middle" };

  const inputs = workbook.addWorksheet("입력값");
  inputs.addRow(["항목", "값", "단위·상태"]);
  styleHeader(inputs.getRow(1));
  const inputRows: Array<[string, string | number | boolean, string]> = [
    ["사업명", body.input.projectName, "사용자 입력"],
    ["공동주택 전용률", body.input.apartmentEfficiency ?? 75, "% · 기본 75% / 사용자 변경 가능"],
    ["오피스텔 전용률", body.input.officetelEfficiency ?? 45, "% · 기본 45% / 사용자 변경 가능"],
    ["주소", body.input.address, "대상지"],
    ["대지면적", body.input.siteArea, "㎡"],
    ["건폐율 상한", body.input.buildingCoverageRatio, "%"],
    ["기본 용적률", body.input.baseFar, "%"],
    ["완화 용적률", body.input.relaxedFar, "% · 조건부"],
    ["최고층수", body.input.maxFloors, "층"],
    ["최고높이", body.input.maxHeight, "m"],
    ["공동주택 법정주차", body.input.apartmentParkingRatio, "대/세대"],
    ["오피스텔 법정주차", body.input.officetelParkingRatio, "대/호"],
    ["LH 주차계수 근거", body.input.lhParkingRatioVerified, body.input.lhParkingRatioVerified ? "확인" : "미확인"],
    ["0.3대 특례 승인", body.input.specialParkingApproval, "승인상태"],
  ];
  inputRows.forEach((row) => inputs.addRow(row));
  inputs.columns = [{ width: 24 }, { width: 48 }, { width: 22 }];
  inputs.views = [{ state: "frozen", ySplit: 1 }];

  const comparison = workbook.addWorksheet("4개 대안 비교");
  comparison.addRow(["대안", "용도", "적합성", "계획수량", "계획건축면적(㎡)", "용적률산정면적(㎡)", "계획건폐율(%)", "계획용적률(%)", "원 법정주차", "0.3대 조건부", "최종주차", "지하층", "보조점수"]);
  styleHeader(comparison.getRow(1));
  body.results.forEach((result, index) => {
    const rowNumber = index + 2;
    comparison.addRow([
      result.definition.id,
      result.definition.useType === "apartment" ? "공동주택" : "오피스텔",
      result.eligibility,
      result.unitCount,
      result.plannedBuildingArea,
      result.farCountedArea,
      { formula: `IFERROR(E${rowNumber}/'입력값'!B4*100,0)`, result: result.plannedBcr },
      { formula: `IFERROR(F${rowNumber}/'입력값'!B4*100,0)`, result: result.plannedFar },
      result.parking.originalLegalCount,
      result.parking.conditionalCount ?? "-",
      result.parking.finalCount,
      result.parking.basementFloors,
      result.score,
    ]);
  });
  comparison.columns = [{ width: 10 }, { width: 14 }, { width: 12 }, { width: 12 }, { width: 18 }, { width: 20 }, { width: 17 }, { width: 17 }, { width: 15 }, { width: 15 }, { width: 13 }, { width: 10 }, { width: 12 }];
  comparison.views = [{ state: "frozen", ySplit: 1 }];
  comparison.autoFilter = { from: "A1", to: "M5" };

  const formulas = workbook.addWorksheet("산식·제약조건");
  formulas.addRow(["대안", "구분", "내용"]);
  styleHeader(formulas.getRow(1));
  body.results.forEach((result) => {
    result.formulas.forEach((formula) => formulas.addRow([result.definition.id, "산식", formula]));
    result.blockingReasons.forEach((reason) => formulas.addRow([result.definition.id, "부적합", reason]));
    result.conditionalReasons.forEach((reason) => formulas.addRow([result.definition.id, "조건부", reason]));
  });
  formulas.columns = [{ width: 10 }, { width: 12 }, { width: 110 }];
  formulas.getColumn(3).alignment = { wrapText: true, vertical: "top" };

  const evidence = workbook.addWorksheet("법규 근거");
  evidence.addRow(["유형", "자료명·항목", "상태", "시행일·코드", "출처 URL·기관"]);
  styleHeader(evidence.getRow(1));
  const review = body.reviewData;
  review?.landUse.forEach((item) => evidence.addRow([item.category, item.name, "공간정보 확인", item.code, item.source]));
  review?.laws.forEach((law) => evidence.addRow(["국가법령", law.name, law.applicationStatus, law.enforcementDate || "", law.link]));
  review?.ordinances?.forEach((ordinance) => evidence.addRow(["자치법규", ordinance.name, ordinance.applicationStatus, ordinance.enforcementDate || "", ordinance.link]));
  review?.ruleFindings?.forEach((finding) => evidence.addRow([finding.topic, String(finding.value ?? ""), finding.outcome, finding.article || finding.effectiveDate || "", finding.sourceUrl]));
  review?.officialDocuments?.documents.forEach((document) => {
    const label = document.kind === "district-plan" ? "지구단위계획 검색자료" : "LH 공식 검색자료";
    evidence.addRow([label, document.title, document.status === "analyzed" ? "원문 분석 · 적용 미검증" : "원문 확보 미완료", document.format ?? "", document.sourceUrl]);
    document.candidates.forEach((candidate) => evidence.addRow([
      label, candidate.topic + " · " + candidate.quote.slice(0, 130),
      "수치 후보 · 적용 검증 전", candidate.value === null ? "" : String(candidate.value) + (candidate.unit ?? ""),
      document.sourceUrl,
    ]));
  });
  review?.unresolved.forEach((item) => evidence.addRow(["미확정", item, "확인 필요", "", ""]));
  body.reviewedRules?.forEach((rule) => evidence.addRow([
    "계산에 적용된 입력", rule.field, "검토자 확인 · 법규 자동확정 아님",
    String(rule.value) + " · " + rule.reviewedAt, rule.sourceTitle + " / " + rule.sourceUrl,
  ]));
  evidence.columns = [{ width: 16 }, { width: 42 }, { width: 18 }, { width: 22 }, { width: 70 }];
  evidence.getColumn(5).alignment = { wrapText: true, vertical: "top" };

  workbook.eachSheet((sheet) => {
    sheet.eachRow((row) => {
      row.height = Math.max(row.height || 15, 18);
      row.eachCell((cell) => { cell.border = { bottom: { style: "hair", color: { argb: "FFDDE5EA" } } }; });
    });
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return new NextResponse(Buffer.from(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": "attachment; filename=LH-Plan-Lab.xlsx",
      "Cache-Control": "no-store",
    },
  });
}
