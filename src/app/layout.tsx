import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Anh Hung Smart ERP",
  description:
    "He thong quan tri doanh nghiep thong minh chay cuc bo cho van hanh nha dat va tai chinh.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
