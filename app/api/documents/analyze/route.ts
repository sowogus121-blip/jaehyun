import { NextRequest, NextResponse } from "next/server";
import { parseUploadedDocument } from "../../../../lib/server/document-parser";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "분석할 문서 파일이 필요합니다." }, { status: 400 });
  try {
    const analysis = await parseUploadedDocument(file);
    return NextResponse.json({ status: "analyzed", analysis });
  } catch (error) {
    return NextResponse.json({ status: "failed", error: error instanceof Error ? error.message : "문서 분석 실패" }, { status: 422 });
  }
}
