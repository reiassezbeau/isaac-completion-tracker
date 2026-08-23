// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * ThemeBackdrop - an ORIGINAL background per theme (a place from the world of Isaac).
 * Procedural patterns (hand-rolled SVG/CSS): basement bricks, Sheol cracks,
 * Void stars, Corpse veins, Cathedral light shafts.
 * Fixed, very subtle, tinted with the theme accent (never behind data).
 */
import type { ReactNode } from "react";
import type { ThemeId } from "../store";

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/**
 * The Basement floor: mortared brick, overlaid with the silhouette every Isaac
 * player recognises instantly — a room with a doorway centred on each of its four
 * walls, tiled out like a floor map. Plain geometry, so it evokes the game without
 * using a single pixel of it.
 */
function Basement() {
  return (
    <svg width="100%" height="100%" style={{ display: "block" }}>
      <defs>
        <pattern id="bd-brick" width="76" height="38" patternUnits="userSpaceOnUse">
          <path d="M0 0h76M0 19h76M0 38h76" stroke="currentColor" strokeWidth={1} fill="none" />
          <path d="M0 0v19M38 19v19M76 0v19" stroke="currentColor" strokeWidth={1} fill="none" />
        </pattern>
        <pattern id="bd-room" width="260" height="180" patternUnits="userSpaceOnUse">
          <g stroke="currentColor" fill="none" strokeLinecap="square">
            {/* walls, broken in the middle of each side: those gaps are the doors */}
            <g strokeWidth={2.5}>
              <path d="M22 18h84M154 18h84" />
              <path d="M22 162h84M154 162h84" />
              <path d="M22 18v52M22 110v52" />
              <path d="M238 18v52M238 110v52" />
            </g>
            {/* the thresholds themselves, drawn lighter */}
            <g strokeWidth={1} opacity={0.45}>
              <path d="M106 18h48M106 162h48M22 70v40M238 70v40" />
            </g>
          </g>
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#bd-brick)" />
      <rect width="100%" height="100%" fill="url(#bd-room)" opacity={0.6} />
    </svg>
  );
}

function Sheol() {
  const rnd = rng(6613);
  const cracks: ReactNode[] = [];
  for (let i = 0; i < 22; i++) {
    const x = rnd() * 100;
    const len = 10 + rnd() * 45;
    cracks.push(
      <path
        key={i}
        d={`M${x} 100 q${(rnd() - 0.5) * 8} ${-len * 0.5} ${(rnd() - 0.5) * 12} ${-len}`}
        vectorEffect="non-scaling-stroke"
        stroke="currentColor"
        strokeWidth={1.2}
        fill="none"
        opacity={0.4 + rnd() * 0.4}
      />,
    );
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
      <g filter="url(#wob1)">{cracks}</g>
    </svg>
  );
}

function Void() {
  const rnd = rng(9041);
  const stars: ReactNode[] = [];
  for (let i = 0; i < 90; i++) {
    stars.push(<circle key={i} cx={rnd() * 100} cy={rnd() * 100} r={rnd() * 0.4 + 0.06} fill="currentColor" opacity={0.3 + rnd() * 0.7} />);
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
      {stars}
      <g transform="translate(50 50)" fill="none" stroke="currentColor">
        <circle r={16} strokeWidth={0.12} vectorEffect="non-scaling-stroke" strokeDasharray="1 1.4" />
        <circle r={28} strokeWidth={0.1} vectorEffect="non-scaling-stroke" strokeDasharray="1 2" />
        <circle r={40} strokeWidth={0.08} vectorEffect="non-scaling-stroke" strokeDasharray="1 3" />
      </g>
    </svg>
  );
}

function Corpse() {
  const rnd = rng(4477);
  const veins: ReactNode[] = [];
  for (let i = 0; i < 14; i++) {
    let cx = rnd() * 100;
    let cy = rnd() * 100;
    let d = `M${cx} ${cy}`;
    for (let k = 0; k < 4; k++) {
      const nx = cx + (rnd() - 0.5) * 24;
      const ny = cy + (rnd() - 0.5) * 24;
      d += ` Q${cx + (rnd() - 0.5) * 12} ${cy + (rnd() - 0.5) * 12} ${nx} ${ny}`;
      cx = nx;
      cy = ny;
    }
    veins.push(<path key={i} d={d} vectorEffect="non-scaling-stroke" stroke="currentColor" strokeWidth={1} fill="none" opacity={0.3 + rnd() * 0.4} />);
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
      <g filter="url(#wob3)">{veins}</g>
    </svg>
  );
}

function Cathedral() {
  const rays: ReactNode[] = [];
  for (let i = 0; i < 9; i++) {
    const x = 8 + i * 11;
    rays.push(<path key={i} d={`M50 -6 L${x} 120 L${x + 5} 120 Z`} fill="currentColor" opacity={0.08 + (i % 2) * 0.05} />);
  }
  return (
    <svg width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ display: "block" }}>
      {rays}
      <g transform="translate(50 38)" stroke="currentColor" fill="none">
        <path d="M0 -20 V20 M-11 -8 H11" strokeWidth={0.6} vectorEffect="non-scaling-stroke" />
      </g>
    </svg>
  );
}

const MAP: Record<ThemeId, () => ReactNode> = {
  basement: Basement,
  sheol: Sheol,
  void: Void,
  corpse: Corpse,
  cathedral: Cathedral,
};

export function ThemeBackdrop({ theme }: { theme: ThemeId }) {
  const Body = MAP[theme] ?? Basement;
  // Raised from the near-invisible values it shipped with: the backdrop is meant to
  // read as a place, not as noise. Still well under the data, and the light Cathedral
  // theme needs a higher value to register at all against vellum.
  const opacity = theme === "cathedral" ? 0.62 : theme === "void" ? 0.24 : theme === "sheol" ? 0.2 : 0.17;
  return (
    <div className="pointer-events-none fixed inset-0 text-isaac-accent" style={{ zIndex: 0, opacity }} aria-hidden="true">
      <Body />
    </div>
  );
}
