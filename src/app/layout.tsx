import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Ledger for Quotes | Singer Industrial",
  description: "Quote follow-up engine",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
