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
import localFont from "next/font/local";

/* Self-hosted fonts: deterministic builds, no render-blocking third-party
   CSS, no runtime dependency on network access from the build machine. */
const inter = localFont({
  src: [
    { path: "../public/fonts/Inter-400.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Inter-500.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/Inter-600.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/Inter-700.ttf", weight: "700", style: "normal" },
    { path: "../public/fonts/Inter-800.ttf", weight: "800", style: "normal" },
  ],
  variable: "--font-inter",
  display: "swap",
});
const jetbrains = localFont({
  src: [
    { path: "../public/fonts/JetBrainsMono-400.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/JetBrainsMono-500.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-jetbrains",
  display: "swap",
});
const instrument = localFont({
  src: [
    { path: "../public/fonts/InstrumentSans-500.ttf", weight: "500", style: "normal" },
    { path: "../public/fonts/InstrumentSans-600.ttf", weight: "600", style: "normal" },
    { path: "../public/fonts/InstrumentSans-700.ttf", weight: "700", style: "normal" },
  ],
  variable: "--font-instrument",
  display: "swap",
});
const newsreader = localFont({
  src: [
    { path: "../public/fonts/Newsreader-400.ttf", weight: "400", style: "normal" },
    { path: "../public/fonts/Newsreader-500.ttf", weight: "500", style: "normal" },
  ],
  variable: "--font-newsreader",
  display: "swap",
});
const fragment = localFont({
  src: "../public/fonts/FragmentMono-400.ttf",
  variable: "--font-fragment",
  display: "swap",
});

export const metadata = {
  title: { default: "Decentra", template: "%s · Decentra" },
  description: "Decentra turns meetings into decisions, owners and actions - every commitment pinned to the second it was spoken. Evidence-first, human-in-the-loop meeting intelligence.",
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

