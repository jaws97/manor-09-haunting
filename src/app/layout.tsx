import { Analytics } from "@vercel/analytics/next";
import type { Metadata, Viewport } from "next";
import { Cinzel_Decorative, Grenze_Gotisch, IM_Fell_English, Pinyon_Script } from "next/font/google";
import { event } from "@/data/event";
import "./globals.css";

const display = Grenze_Gotisch({
  variable: "--font-display",
  subsets: ["latin"],
});

/** the title card's one word: blackletter capitals don't read at a glance, and the pun needs to */
const title = Cinzel_Decorative({
  variable: "--font-title",
  subsets: ["latin"],
  weight: "900",
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
  title: `${event.manor} · ${event.show}`,
  description: `You are cordially summoned. ${event.tagline}`,
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#0a0710",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${title.variable} ${serif.variable} ${script.variable}`}>
      <body>
        {children}
        <Analytics />
      </body>
    </html>
  );
}
