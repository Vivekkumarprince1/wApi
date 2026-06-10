import type { ReactNode } from "react";
import { Fraunces, Mona_Sans, IBM_Plex_Mono } from "next/font/google";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-display",
  display: "swap",
  style: ["normal", "italic"],
});

const monaSans = Mona_Sans({
  subsets: ["latin"],
  variable: "--font-sans",
  display: "swap",
});

const plexMono = IBM_Plex_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
  display: "swap",
  weight: ["400", "500", "600"],
});

export const metadata = {
  title: "wApi — The Business Wire",
  description:
    "wApi is the inbox, the campaigns, and the storefront — all on WhatsApp. Built for the 2.8-billion-strong messaging economy.",
};

export default function LandingV2Layout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <div
      className={`${fraunces.variable} ${monaSans.variable} ${plexMono.variable}`}
    >
      {children}
    </div>
  );
}
