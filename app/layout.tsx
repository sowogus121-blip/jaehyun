import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LH Plan Lab | 공공임대 사업성 검토",
  description: "LH 공공임대주택 법규 및 건축규모 통합 검토 시스템",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
