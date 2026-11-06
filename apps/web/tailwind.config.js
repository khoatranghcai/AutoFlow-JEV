/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { navy: "#0a0f1d", panel: "#0f1629", line: "#1c2742", ink: "#e4ecff", muted: "#7d8bb0", cyan: "#00f3ff", emerald: "#00ff9d", amber: "#ffb700", magenta: "#ff0055" },
      fontFamily: { body: ["Chakra Petch", "ui-sans-serif", "system-ui", "sans-serif"], mono: ["JetBrains Mono", "ui-monospace", "monospace"] },
      boxShadow: { glowCyan: "0 0 18px -4px rgba(0,243,255,.55)", glowEmerald: "0 0 18px -4px rgba(0,255,157,.5)", glowAmber: "0 0 18px -4px rgba(255,183,0,.55)", glowMagenta: "0 0 18px -4px rgba(255,0,85,.6)" },
    },
  },
  plugins: [],
};
