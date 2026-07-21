import type { Metadata, Viewport } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const spaceGrotesk = Space_Grotesk({
  variable: "--font-space-grotesk",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "Talk Me Out of It — Your brutally honest fitting-room friend",
  description:
    "A virtual fitting room that does not help you buy faster. It helps you decide whether you should buy at all. Powered by YouCam Apparel Virtual Try-On.",
  keywords: [
    "virtual try-on",
    "YouCam",
    "Apparel VTO",
    "anti-impulse shopping",
    "fitting room",
    "purchase decision",
  ],
  authors: [{ name: "Talk Me Out of It" }],
  openGraph: {
    title: "Talk Me Out of It",
    description:
      "Your brutally honest fitting-room friend. Anti-impulse shopping, powered by YouCam Apparel VTO.",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Talk Me Out of It",
    description:
      "Your brutally honest fitting-room friend. Anti-impulse shopping, powered by YouCam Apparel VTO.",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#0a0a0a",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="dark">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} antialiased bg-background text-foreground min-h-screen`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
