import { IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

// Self-host IBM Plex via next/font/google (ships with Next.js — zero new npm
// dependency). next/font downloads the real Google Fonts @font-face CSS at BUILD
// TIME and rewrites the `src` URLs to self-hosted files under .next/static/media,
// so there is no runtime network fetch. The registered @font-face family names are
// the literal "IBM Plex Sans" / "IBM Plex Mono", which is exactly what Carbon's own
// type styles reference — see src/app/globals.scss for the font-family wiring.
//
// Weights: only 400/600 for sans (matching the heading/StatusBadge `font-weight:
// 600` conventions already used across the SCSS modules) and 400 for mono — no
// extra weights are requested so next/font does not bundle anything unnecessary.

export const ibmPlexSans = IBM_Plex_Sans({
  weight: ["400", "600"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-sans",
  display: "swap",
});

export const ibmPlexMono = IBM_Plex_Mono({
  weight: ["400"],
  subsets: ["latin"],
  variable: "--font-ibm-plex-mono",
  display: "swap",
});
