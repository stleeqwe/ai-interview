import type { Metadata } from "next";
import localFont from "next/font/local";
import { Toaster } from "@/components/ui/sonner";
import { StoreHydrator } from "@/components/StoreHydrator";
import "./globals.css";

const pretendard = localFont({
  src: [
    {
      path: "../public/fonts/PretendardVariable.woff2",
      style: "normal",
    },
  ],
  variable: "--font-pretendard",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AI 모의면접",
  description: "AI 기반 기술 모의면접 서비스",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body className={`${pretendard.variable} font-sans antialiased`}>
        <StoreHydrator />
        {children}
        <Toaster richColors position="top-center" />
      </body>
    </html>
  );
}
