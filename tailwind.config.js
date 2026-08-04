/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Palette « Isaac » — charbon très sombre, rouge sang + doré (Golden God / Dead God).
        isaac: {
          bg: "#0a0a0c",
          surface: "#141418",
          surface2: "#1c1c22",
          border: "#2a2a33",
          text: "#eae7e1",
          muted: "#9b968c",
          blood: "#c1272d",
          "blood-dim": "#7f1416",
          gold: "#d4af37",
          "gold-dim": "#a8862b",
          // statuts de complétion
          done: "#4caf50",
          "done-hard": "#d4af37",
          todo: "#c1272d",
        },
      },
      fontFamily: {
        sans: [
          "Inter",
          "Segoe UI",
          "system-ui",
          "-apple-system",
          "sans-serif",
        ],
      },
      borderRadius: {
        xl: "0.85rem",
      },
    },
  },
  plugins: [],
};
