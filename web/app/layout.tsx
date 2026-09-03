import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";

import { Nav } from "@/components/Nav";
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
  title: { default: "MochaGuard", template: "%s · MochaGuard" },
  description: "Sleep-safe leverage: explained by an AI copilot, provable on-chain.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <header className="sticky top-0 z-20 border-b border-border bg-background/80 backdrop-blur">
          <div className="mx-auto flex h-14 w-full max-w-6xl items-center justify-between gap-6 px-4 sm:px-6">
            <Link href="/" className="flex items-center gap-2 font-semibold tracking-tight">
              <span className="inline-block size-2.5 rounded-full bg-accent shadow-[0_0_12px] shadow-accent/60" />
              MochaGuard
            </Link>
            <div className="flex items-center gap-2">
              <Nav />
              <Link href="/login" className="rounded-lg border border-border px-3 py-1.5 text-sm text-muted hover:border-accent/50 hover:text-foreground">Sign in</Link>
            </div>
          </div>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8 sm:px-6">{children}</main>
        <footer className="border-t border-border py-4 text-center text-xs text-muted">
          Engine decides. Copilot narrates. Chain remembers. The LLM and Sepolia never sit in the decision path.
        </footer>
      </body>
    </html>
  );
}
