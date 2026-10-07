import type { Metadata } from "next";

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
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
