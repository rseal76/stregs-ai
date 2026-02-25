import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "STRegs.ai — Know the STR rules before you list",
  description:
    "Instant short-term rental regulatory intelligence for any address. Type in an address, get the regulations in plain English. Always up to date. Colorado to start, national expansion in progress.",
  openGraph: {
    title: "STRegs.ai — Know the STR rules before you list",
    description:
      "Instant STR regulatory intelligence. Type any address, get permit requirements, fees, and restrictions in plain English.",
    siteName: "STRegs.ai",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
