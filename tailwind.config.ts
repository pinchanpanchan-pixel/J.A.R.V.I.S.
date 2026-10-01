import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Variables por estilo (app/globals.css). En «Actual» son los mismos colores de siempre.
        navy: {
          950: "rgb(var(--navy-950-rgb) / <alpha-value>)",
          900: "rgb(var(--navy-900-rgb) / <alpha-value>)",
          800: "rgb(var(--navy-800-rgb) / <alpha-value>)",
          700: "rgb(var(--navy-700-rgb) / <alpha-value>)",
          600: "rgb(var(--navy-600-rgb) / <alpha-value>)",
        },
        arc: { DEFAULT: "rgb(var(--accent) / <alpha-value>)", soft: "#9DF5E3", glow: "#38BDF8" },
        alert: "#FF3B30",
        gold: "#F5C451",
      },
      fontFamily: { sans: ["-apple-system", "BlinkMacSystemFont", "SF Pro Display", "Inter", "system-ui", "Segoe UI", "Roboto", "sans-serif"] },
      boxShadow: { card: "0 20px 60px rgba(0,0,0,0.5)" },
      borderRadius: { card: "32px" },
    },
  },
  plugins: [],
};
export default config;
