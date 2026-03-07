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
  title: "STRegs.ai — STR Regulation Lookup for Any US Address",
  description:
    "Instantly look up short-term rental regulations for any US address. Know permit requirements, fees, day caps, and restrictions before you buy or list. 1,000+ markets covered.",
  openGraph: {
    title: "STRegs.ai — STR Regulation Lookup for Any US Address",
    description:
      "Know the STR rules before you buy or list. Permit requirements, fees, and restrictions in plain English for 1,000+ US markets.",
    siteName: "STRegs.ai",
    url: "https://www.stregs.ai",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "STRegs.ai — STR Regulation Lookup",
    description: "Instantly look up short-term rental regulations for any US address.",
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
