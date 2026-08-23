import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./app/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // "Film Room" palette: dark editing-bay charcoal, tungsten amber
        // tally-light accent, cool slate for secondary UI. Avoids the
        // generic cream/terracotta AI-default palette on purpose.
        ink: "#0E0F0D",       // near-black, slightly warm (raw stock)
        bay: "#17181A",       // panel background
        bay2: "#1F2123",      // raised panel
        rule: "#2B2D30",      // hairline dividers
        paper: "#EDEAE2",     // primary text, warm white (light table)
        dim: "#9A9C97",       // secondary text
        tally: "#E2A33B",     // amber tally-light accent (record indicator)
        wire: "#5B8C8A",      // cool teal, secondary accent (slate/scope line)
        signal: "#C0432F",    // rejection / live-record red
        go: "#6E9B5C",        // approval green, desaturated
      },
      fontFamily: {
        display: ["var(--font-display)"],
        body: ["var(--font-body)"],
        mono: ["var(--font-mono)"],
      },
    },
  },
  plugins: [],
};
export default config;
