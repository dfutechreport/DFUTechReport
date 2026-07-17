import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "DFU Bakım ve Teknik Yönetim Sistemi",
  description: "DFU Donuk Fırıncılık Ürünleri A.Ş. Teknik Bakım, Arıza Bildirim ve Puantaj (İSG) Yönetim Portalı.",
  icons: {
    icon: "/dfulogo.png",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="tr">
      <body className={inter.className}>{children}</body>
    </html>
  );
}