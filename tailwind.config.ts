import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./hooks/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        navy: { 950: "#001122", 900: "#0A192F", 800: "#0F2440", 700: "#16304F", 600: "#1E3D63" },
        arc: { DEFAULT: "#64FFDA", soft: "#9DF5E3", glow: "#38BDF8" },
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
