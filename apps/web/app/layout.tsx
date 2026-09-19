import "./globals.css";
import "./tokens.css";
import { AuthProvider } from "@/lib/auth";
import { ToastProvider } from "@/components/ui/toast";
import { PaletteProvider } from "@/components/command-palette";
import { TransitionProvider } from "@/components/immersive/3d/TransitionProvider";
import { CursorGlow } from "@/components/immersive/3d/CursorGlow";
import { ScrollProgress } from "@/components/immersive/3d/ScrollProgress";
import { ImmersiveBackdrop } from "@/components/immersive/3d/ImmersiveBackdrop";

export const viewport = {
  themeColor: "#08090B",
};

export const metadata = {
  title: {
    default: "Decentra — Meetings end. Commitments shouldn't.",
    template: "%s · Decentra",
  },
  description:
    "Decentra turns meetings into decisions, owners and actions — every commitment pinned to the second it was spoken. Evidence-first, human-in-the-loop meeting intelligence.",
  keywords: ["meeting intelligence", "decision tracking", "action items", "transcription", "evidence", "AI assistant", "meeting notes"],
  authors: [{ name: "Decentra" }],
  themeColor: "#08090B",
  colorScheme: "dark",
  icons: { icon: "/icon.svg", apple: "/icon.svg" },
  robots: { index: true, follow: true },
  openGraph: {
    title: "Decentra — Meetings end. Commitments shouldn't.",
    description: "Decisions, owners and actions from every meeting — every one pinned to the second it was spoken.",
    type: "website",
    siteName: "Decentra",
  },
  twitter: {
    card: "summary_large_title",
    title: "Decentra — Meetings end. Commitments shouldn't.",
    description: "Decisions, owners and actions from every meeting — evidence-first, human-in-the-loop.",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark" style={{ colorScheme: "dark" }}>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <meta name="theme-color" content="#08090B" />
      </head>
      <body className="bg-[#08090B] text-[#F5F7FA] antialiased">
        <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 z-[300] rounded-[8px] bg-white px-3 py-2 text-black">
          Skip to content
        </a>
        <ImmersiveBackdrop />
        <AuthProvider>
          <ToastProvider>
            <PaletteProvider>
              <TransitionProvider>{children}</TransitionProvider>
              <ScrollProgress />
              <CursorGlow />
            </PaletteProvider>
          </ToastProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
