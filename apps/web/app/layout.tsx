import "./globals.css";
import "./tokens.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";
import { PaletteProvider } from "@/components/command-palette";
import { TransitionProvider } from "@/components/immersive/3d/TransitionProvider";
import { CursorGlow } from "@/components/immersive/3d/CursorGlow";
import { ScrollProgress } from "@/components/immersive/3d/ScrollProgress";
import { ImmersiveBackdrop } from "@/components/immersive/3d/ImmersiveBackdrop";
import { ThemeProvider } from "@/components/theme-provider";
import {
  Inter,
  JetBrains_Mono,
  Instrument_Sans,
  Newsreader,
  Fragment_Mono,
} from "next/font/google";

/* Self-hosted + preloaded by Next.js: no render-blocking third-party CSS,
   no FOUT, no extra DNS/TLS round trip to fonts.googleapis.com. */
const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-jetbrains",
  display: "swap",
});
const instrument = Instrument_Sans({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-instrument",
  display: "swap",
});
const newsreader = Newsreader({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-newsreader",
  display: "swap",
});
const fragment = Fragment_Mono({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-fragment",
  display: "swap",
});

export const metadata = {
  title: { default: "Decentra — Meetings end. Commitments shouldn't.", template: "%s · Decentra" },
  description: "Decentra turns meetings into decisions, owners and actions — every commitment pinned to the second it was spoken. Evidence-first, human-in-the-loop meeting intelligence.",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  robots: { index: true, follow: true },
};

const fontVars = [
  inter.variable,
  jetbrains.variable,
  instrument.variable,
  newsreader.variable,
  fragment.variable,
].join(" ");

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={fontVars} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{var t=localStorage.getItem('dec:theme');var d=t||(window.matchMedia('(prefers-color-scheme: light)').matches?'light':'dark');document.documentElement.classList.toggle('light',d==='light');document.documentElement.classList.toggle('dark',d==='dark');document.documentElement.style.colorScheme=d;}catch(e){}})();` }} />
      </head>
      <body className="bg-[var(--bg)] text-[var(--text)] antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 z-[300] rounded-[8px] bg-white px-3 py-2 text-black">
          Skip to content
        </a>
        <ImmersiveBackdrop />
        <ThemeProvider>
          <AuthProvider>
            <ToastProvider>
              <PaletteProvider>
                <TransitionProvider>{children}</TransitionProvider>
                <ScrollProgress />
                <CursorGlow />
              </PaletteProvider>
            </ToastProvider>
          </AuthProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
