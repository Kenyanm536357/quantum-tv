/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}", "./public/index.html"],
  theme: {
    extend: {
      fontFamily: {
        heading: ["Unbounded", "sans-serif"],
        body: ["Outfit", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        bg: { base: "#060714", surface: "#0D0E23", highlight: "#1A1C3A" },
        brand: { purple: "#8B5CF6", cyan: "#06B6D4" },
      },
      boxShadow: {
        glow: "0 0 24px rgba(139, 92, 246, 0.35)",
        cyan: "0 0 24px rgba(6, 182, 212, 0.25)",
      },
    },
  },
  plugins: [],
};
