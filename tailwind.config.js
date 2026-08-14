// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * Direction artistique « grimoire maudit » — SYSTÈME DE THÈMES autour de
 * l'univers d'Isaac (Sous-sol / Sheol / le Vide / Corpse / Cathédrale).
 * Tout est piloté par variables CSS : les neutres, l'accent de chrome ET les
 * accents sémantiques (or=Hard, jade=Normal, sang=à faire) — le thème bascule,
 * aucune classe des 13 vues ne change. Namespace `isaac-*` conservé.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Rampes fixes (nuances précises : barres, hover, data-viz).
        blood: {
          300: "#ef6a72", 400: "#dd4049", 500: "#c1272d",
          600: "#9b1c22", 700: "#71141a", 900: "#8c1a1a", 950: "#2a0a0d",
        },
        gold: {
          200: "#f6e6ae", 300: "#ecd280", 400: "#d3b455", 500: "#c9a94a",
          600: "#9c7c26", 700: "#7d641b", 950: "#2b2209",
        },
        jade: {
          300: "#8ce3b6", 400: "#58d09a", 500: "#3ec07f",
          600: "#2e9662", 700: "#216d48", 950: "#0c2a1c",
        },
        viz: { azure: "#5b9dd9", violet: "#9d7fd6", ember: "#e08c3c" },

        // Namespace historique — tout via variables CSS (thémable).
        isaac: {
          bg: "rgb(var(--i-bg) / <alpha-value>)",
          surface: "rgb(var(--i-surface) / <alpha-value>)",
          surface2: "rgb(var(--i-surface2) / <alpha-value>)",
          surface3: "rgb(var(--i-surface3) / <alpha-value>)",
          border: "rgb(var(--i-border) / <alpha-value>)",
          "border-strong": "rgb(var(--i-border2) / <alpha-value>)",
          text: "rgb(var(--i-text) / <alpha-value>)",
          muted: "rgb(var(--i-muted) / <alpha-value>)",
          faint: "rgb(var(--i-faint) / <alpha-value>)",
          // Accent de chrome (change selon le lieu).
          accent: "rgb(var(--i-accent) / <alpha-value>)",
          dried: "rgb(var(--i-accent) / <alpha-value>)",
          // Sémantiques (constantes en sombre, ajustées en Cathédrale/clair).
          gold: "rgb(var(--i-gold) / <alpha-value>)",
          "gold-dim": "#9c7c26",
          done: "rgb(var(--i-jade) / <alpha-value>)",
          "done-hard": "rgb(var(--i-gold) / <alpha-value>)",
          blood: "rgb(var(--i-blood) / <alpha-value>)",
          "blood-dim": "#71141a",
          "blood-light": "#c4565c",
          todo: "rgb(var(--i-blood) / <alpha-value>)",
        },
      },
      fontFamily: {
        sans: ["Segoe UI Variable Text", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
        display: ["Cinzel", "Georgia", "Book Antiqua", "Palatino Linotype", "Palatino", "serif"],
        mono: ["ui-monospace", "Cascadia Mono", "Segoe UI Mono", "Consolas", "monospace"],
      },
      borderRadius: { lg: "0.625rem", xl: "0.875rem" },
      keyframes: {
        barGrow: { from: { transform: "scaleX(0)" }, to: { transform: "scaleX(1)" } },
        fadeSlide: { from: { opacity: "0", transform: "translateY(8px)" }, to: { opacity: "1", transform: "translateY(0)" } },
        gaugeReveal: { from: { opacity: "0", transform: "scale(.9) rotate(-6deg)" }, to: { opacity: "1", transform: "scale(1) rotate(0)" } },
        emberPulse: { "0%,100%": { opacity: ".5" }, "50%": { opacity: ".9" } },
        glowPulse: { "0%,100%": { filter: "brightness(1)" }, "50%": { filter: "brightness(1.18)" } },
        drip: { "0%": { transform: "translateY(-100%)", opacity: "0" }, "12%": { opacity: ".7" }, "100%": { transform: "translateY(140%)", opacity: "0" } },
      },
      animation: {
        barGrow: "barGrow .8s cubic-bezier(.2,.8,.25,1) both",
        fadeSlide: "fadeSlide .38s cubic-bezier(.2,.8,.25,1) both",
        gaugeReveal: "gaugeReveal .7s cubic-bezier(.2,.8,.25,1) both",
        emberPulse: "emberPulse 3.4s ease-in-out infinite",
        glowPulse: "glowPulse 3.6s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
