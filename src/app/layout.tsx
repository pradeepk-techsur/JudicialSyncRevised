import type { Metadata } from "next";
import "./globals.scss";
import { Providers } from "./providers";
import { AppShell } from "@/components/shell/AppShell";
import { ibmPlexSans, ibmPlexMono } from "@/lib/fonts";

export const metadata: Metadata = {
  title: "JudicialSync",
  description: "Courtroom exhibit tracking — append-only event ledger foundation",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className={`${ibmPlexSans.variable} ${ibmPlexMono.variable}`}>
      <body>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
