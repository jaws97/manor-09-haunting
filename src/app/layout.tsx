import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Grenze_Gotisch, IM_Fell_English, Pinyon_Script } from "next/font/google";
import "./globals.css";

const display = Grenze_Gotisch({
  variable: "--font-display",
  subsets: ["latin"],
});

const serif = IM_Fell_English({
  variable: "--font-serif",
  subsets: ["latin"],
  weight: "400",
  style: ["normal", "italic"],
});

const script = Pinyon_Script({
  variable: "--font-script",
  subsets: ["latin"],
  weight: "400",
});

export const metadata: Metadata = {
  title: "Manor 09 · The Haunting",
  description: "You are cordially summoned. Twenty-seven residents. One night. Not one of them at rest.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0710",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${serif.variable} ${script.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
