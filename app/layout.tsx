import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "LH Plan Lab | 법규검토 · 규모검토",
  description: "대상지 주소로 관련 법규·지침을 조사하고 법규검토표와 개략 건축개요를 작성하는 실무 도구",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ko">
      <body>{children}</body>
    </html>
  );
}
