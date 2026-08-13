// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * Direction artistique « grimoire maudit » (v2).
 * Neutres = charbon/suie CHAUD, pilotés par variables CSS (thème clair/sombre
 * sans toucher au JSX). Le namespace `isaac-*` est CONSERVÉ : aucune classe des
 * 13 vues ne change, seules les valeurs bougent. Accents rouge sang + or.
 */
/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Rampes complètes (états hover/active + data-viz).
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
        // Data-viz : séparées en teinte ET clarté (safe daltonisme).
        viz: { azure: "#5b9dd9", violet: "#9d7fd6", ember: "#e08c3c" },

        // Namespace historique — conservé. Neutres via variables CSS.
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
          // Accents (statuts) — fixes, compatibles avec les classes existantes.
          blood: "#c1272d",
          "blood-dim": "#71141a",
          dried: "#8c1a1a",
          "blood-light": "#c4565c",
          gold: "#c9a94a",
          "gold-dim": "#9c7c26",
          done: "#3ec07f",
          "done-hard": "#c9a94a",
          todo: "#c1272d",
        },
      },
      fontFamily: {
        sans: ["Segoe UI Variable Text", "Segoe UI", "system-ui", "-apple-system", "sans-serif"],
        // Titres « grimoire » — serif système (zéro téléchargement).
        display: ["Georgia", "Book Antiqua", "Palatino Linotype", "Palatino", "serif"],
        mono: ["ui-monospace", "Cascadia Mono", "Segoe UI Mono", "Consolas", "monospace"],
      },
      borderRadius: { lg: "0.625rem", xl: "0.875rem" },
    },
  },
  plugins: [],
};
