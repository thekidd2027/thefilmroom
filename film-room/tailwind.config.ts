import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Film Room editorial palette
        // Jelly Bean #25799B · Sinbad #A2C5D8 · Sidecar #F7E6CB · Milan Red #CB1B03
        ink: "#17313A",       // deep blue-charcoal text
        bay: "#FFFDF8",       // warm paper panel
        bay2: "#F7E6CB",      // Sidecar cream
        rule: "#D9D1C4",      // soft editorial divider
        paper: "#17313A",     // primary text
        dim: "#6F7D7E",       // muted secondary text
        tally: "#25799B",     // Jelly Bean primary accent
        wire: "#A2C5D8",      // Sinbad secondary accent
        signal: "#CB1B03",    // Milan Red signal/accent
        go: "#4D8064",        // calm approval green
        sidecar: "#F7E6CB",
        jelly: "#25799B",
        sinbad: "#A2C5D8",
        milan: "#CB1B03",
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
      boxShadow: {
        editorial: "0 18px 45px rgba(37, 121, 155, 0.10)",
        lift: "0 12px 28px rgba(23, 49, 58, 0.12)",
      },
    },
  },
  plugins: [],
};
export default config;
