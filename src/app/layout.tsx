import type { Metadata, Viewport } from "next";
import { Georama } from "next/font/google";
import { Providers } from "@/components/Providers";
import { SiteNav } from "@/components/SiteNav";
import { SiteFooter } from "@/components/SiteFooter";
import "./globals.css";

const georama = Georama({
  variable: "--font-georama",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: { default: "Wink | Send a gift worth opening", template: "%s | Wink" },
  description:
    "Wink is a personal crypto gifting app on BOT Chain. Send BOT with a note, share a link, and let them open it.",
};

export const viewport: Viewport = {
  themeColor: "#050505",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={georama.variable}>
      <head>
        {/* Satoshi from Fontshare. Georama is loaded through next/font. */}
        <link rel="stylesheet" href="https://api.fontshare.com/v2/css?f[]=satoshi@400,500,700&display=swap" />
      </head>
      <body className="min-h-screen flex flex-col">
        <a href="#main" className="sr-only-focusable btn btn-white" style={{ left: 8, top: 8, zIndex: 100 }}>
          Skip to content
        </a>
        <Providers>
          <SiteNav />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter />
        </Providers>
      </body>
    </html>
  );
}
