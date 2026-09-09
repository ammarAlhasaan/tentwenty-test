import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { Providers } from "./providers";
import { AppNav } from "@/components/app-nav";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: {
    default: "Margin Dashboard",
    template: "%s · Margin Dashboard",
  },
  description:
    "Hours, cost, revenue and margin for the agency's projects and people.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="flex min-h-full flex-col bg-background text-foreground">
        <Providers>
          <header className="sticky top-0 z-10 border-b bg-background/95 backdrop-blur">
            <div className="mx-auto flex max-w-7xl items-center gap-4 px-4 py-3 sm:px-6">
              <Link
                href="/"
                className="font-heading text-base font-semibold tracking-tight outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
              >
                Margin Dashboard
              </Link>
            </div>
            <nav
              aria-label="Sections"
              className="mx-auto max-w-7xl px-4 pb-2 sm:px-6 md:hidden"
            >
              <AppNav layout="bar" />
            </nav>
          </header>

          <div className="mx-auto flex w-full max-w-7xl flex-1 gap-8 px-4 py-6 sm:px-6">
            <nav
              aria-label="Sections"
              className="hidden w-52 shrink-0 md:block"
            >
              <div className="sticky top-24">
                <AppNav layout="rail" />
              </div>
            </nav>

            <main className="min-w-0 flex-1">{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
