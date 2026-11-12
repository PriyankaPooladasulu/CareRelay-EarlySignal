import type { Metadata, Viewport } from "next";
import { Atkinson_Hyperlegible_Next, Newsreader, Noto_Sans_Devanagari, Noto_Sans_Tamil } from "next/font/google";
import "./globals.css";

// Variable fonts: Atkinson 200–800 (display uses 200/300, UI headings 600–700); Newsreader for record quotes only.
const atkinson = Atkinson_Hyperlegible_Next({ variable: "--font-atkinson", subsets: ["latin", "latin-ext"], adjustFontFallback: false });
const newsreader = Newsreader({ variable: "--font-newsreader", subsets: ["latin"], style: ["normal", "italic"] });
const deva = Noto_Sans_Devanagari({ variable: "--font-deva", subsets: ["devanagari"], weight: ["400", "700"], preload: false });
const tamil = Noto_Sans_Tamil({ variable: "--font-tamil", subsets: ["tamil"], weight: ["400", "700"], preload: false });

export const metadata: Metadata = {
  title: "CareRelay EarlySignal: from missed signals to completed care",
  description:
    "A synthetic demonstration. CareRelay reads fragmented records, checks whether a recommended follow-up can be confirmed, and helps a patient close the loop with approval at every step. Not a diagnostic tool.",
  icons: { icon: "/icon.svg" },
};

export const viewport: Viewport = { themeColor: "#f2f5f7", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${atkinson.variable} ${newsreader.variable} ${deva.variable} ${tamil.variable} antialiased`}>
      <body className="min-h-dvh">{children}</body>
    </html>
  );
}
