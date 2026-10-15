import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "学习看板 · IELTS Study",
  description: "个人英语学习计划与每日打卡看板",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}