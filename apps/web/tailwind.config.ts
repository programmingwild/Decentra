import type { Config } from "tailwindcss";
const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./features/**/*.{ts,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "system-ui", "-apple-system", "sans-serif"],
        mono: ["JetBrains Mono", "Geist Mono", "monospace"],
        display: ["Instrument Sans", "Inter", "sans-serif"],
      },
      colors: {
        decentra: {
          bg: "#08090B",
          surface: "#101216",
          elevated: "#15181D",
          border: "rgba(255,255,255,0.08)",
          text: "#F5F7FA",
          muted: "#9AA1AC",
          subtle: "#656B75",
          accent: "#0EA5E9",
          success: "#10B981",
          warning: "#F59E0B",
          danger: "#EF4444",
        },
        border: "rgba(255,255,255,0.08)",
        background: "#08090B",
        foreground: "#F5F7FA",
      },
      borderRadius: { lg: "16px", md: "12px", sm: "8px", xl: "20px" },
      boxShadow: {
        soft: "0 1px 2px rgba(0,0,0,0.4), 0 4px 12px rgba(0,0,0,0.3)",
        medium: "0 4px 16px rgba(0,0,0,0.4), 0 1px 2px rgba(0,0,0,0.3)",
        elevated: "0 8px 32px rgba(0,0,0,0.5), 0 1px 2px rgba(0,0,0,0.3)",
      },
      animation: {
        "fade-in": "fadeIn 0.4s ease-out",
        "slide-up": "slideUp 0.35s cubic-bezier(0.16,1,0.3,1)",
        "slide-in": "slideIn 0.3s cubic-bezier(0.16,1,0.3,1)",
        "scale-in": "scaleIn 0.25s cubic-bezier(0.16,1,0.3,1)",
      },
      keyframes: {
        fadeIn: { "0%": { opacity: "0" }, "100%": { opacity: "1" } },
        slideUp: { "0%": { opacity: "0", transform: "translateY(10px)" }, "100%": { opacity: "1", transform: "translateY(0)" } },
        slideIn: { "0%": { transform: "translateX(100%)" }, "100%": { transform: "translateX(0)" } },
        scaleIn: { "0%": { opacity: "0", transform: "scale(0.97)" }, "100%": { opacity: "1", transform: "scale(1)" } },
      },
    },
  },
  plugins: [],
};
export default config;
