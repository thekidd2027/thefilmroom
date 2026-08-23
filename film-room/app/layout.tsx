import type { Metadata } from "next";
import { Oswald, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import "./globals.css";
import "./transitions.css";
import Nav from "@/components/Nav";
import RouteStage from "@/components/RouteStage";

const display = Oswald({ subsets: ["latin"], weight: ["500", "600", "700"], variable: "--font-display" });
const body = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--font-body" });
const mono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--font-mono" });

export const metadata: Metadata = {
  title: "Film Room — Daily Dose of College Sports",
  description: "Newsroom portal for the Daily Dose of College Sports pipeline.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body className="text-paper font-body min-h-screen antialiased">
        <div className="flex min-h-screen">
          <Nav />
          <main className="flex-1 min-w-0 route-perspective">
            <RouteStage>{children}</RouteStage>
          </main>
        </div>
      </body>
    </html>
  );
}
