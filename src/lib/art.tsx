// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * art - ORIGINAL iconography for art direction v2 (cursed grimoire).
 * Ending glyphs (occult), character sigils (head + attribute), emblem,
 * hand-drawn nav icons, Dead God gauge, blood splatters.
 * Everything is hand-rolled shaky-line SVG (filters from `Defs`). NO sprite from
 * the game. Colors come from `currentColor` (driven by the text class).
 */
import type { CSSProperties, ReactNode } from "react";

type Shape = {
  p?: string[];
  c?: [number, number, number][];
  cd?: [number, number, number, string][];
  e?: [number, number, number, number][];
  r?: [number, number, number, number, number][];
  d?: [number, number, number][];
  t?: [number, number][];
  dash?: string;
};

function svgKids(s: Shape, prefix: string): ReactNode[] {
  const out: ReactNode[] = [];
  (s.p || []).forEach((d, i) => out.push(<path key={`${prefix}p${i}`} d={d} strokeDasharray={s.dash} />));
  (s.c || []).forEach((v, i) => out.push(<circle key={`${prefix}c${i}`} cx={v[0]} cy={v[1]} r={v[2]} />));
  (s.cd || []).forEach((v, i) => out.push(<circle key={`${prefix}q${i}`} cx={v[0]} cy={v[1]} r={v[2]} strokeDasharray={v[3]} />));
  (s.e || []).forEach((v, i) => out.push(<ellipse key={`${prefix}e${i}`} cx={v[0]} cy={v[1]} rx={v[2]} ry={v[3]} />));
  (s.r || []).forEach((v, i) => out.push(<rect key={`${prefix}r${i}`} x={v[0]} y={v[1]} width={v[2]} height={v[3]} rx={v[4]} fill="currentColor" stroke="none" />));
  (s.d || []).forEach((v, i) => out.push(<circle key={`${prefix}d${i}`} cx={v[0]} cy={v[1]} r={v[2]} fill="currentColor" stroke="none" />));
  (s.t || []).forEach((v, i) =>
    out.push(
      <path
        key={`${prefix}t${i}`}
        d={`M${v[0]} ${v[1]}c0 0 2 2.6 2 4 0 1.2-.9 2.1-2 2.1s-2-.9-2-2.1c0-1.4 2-4 2-4Z`}
        fill="currentColor"
        stroke="none"
      />,
    ),
  );
  return out;
}

function Drawn({ shape, size, sw = 1.7, filter = "wob1", prefix = "g" }: { shape: Shape; size: number; sw?: number; filter?: string | false; prefix?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={sw}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ display: "block", overflow: "visible" }}
    >
      <g filter={filter === false ? undefined : `url(#${filter})`}>{svgKids(shape, prefix)}</g>
    </svg>
  );
}

// ── The 12 signs (redrawn occult iconography) ────────────────────────
export const ENDINGS: Record<string, Shape> = {
  moms_heart: { p: ["M12 20.4C6.1 15.3 3.7 11.7 3.7 8.8 3.7 6.2 5.7 4.3 8.1 4.3 9.9 4.3 11.3 5.3 12 6.8 12.7 5.3 14.1 4.3 15.9 4.3 18.3 4.3 20.3 6.2 20.3 8.8 20.3 11.7 17.9 15.3 12 20.4Z", "M12 1.6V9.2", "M9.7 2.4h4.6"] },
  isaac: { p: ["M12 13.2a4.9 4.9 0 100-9.8 4.9 4.9 0 000 9.8Z"], e: [[12, 4.1, 6.2, 2.1]], t: [[13.2, 15.4]] },
  satan: { p: ["M12 5.6v15.2", "M7.2 16.4h9.6", "M12 5.6C9.4 4.4 8.2 2.4 9.4 1.8", "M12 5.6c2.6-1.2 3.8-3.2 2.6-3.8"] },
  boss_rush: { p: ["M5.2 4.2C7.2 8.8 8.6 14.4 8 19.6", "M11.6 3.2C13.7 8.2 15.1 14.2 14.5 19.9", "M18.1 4.6c1.8 4.6 2.8 9.8 2.2 14.6"] },
  blue_baby: { p: ["M5.4 20.6V10.2a6.6 6.6 0 0113.2 0v10.4l-2.2-1.8-2.2 1.8-2.2-1.8-2.2 1.8-2.2-1.8-2.2 1.8Z"], d: [[9.7, 10.8, 1.35], [14.3, 10.8, 1.35]] },
  lamb: { p: ["M7.5 12.6a4.5 4.5 0 019 0v2.6c0 2.4-2 4.4-4.5 4.4s-4.5-2-4.5-4.4Z", "M7.5 12.6C4.7 11.4 4.6 8.2 6.9 8.8", "M16.5 12.6c2.8-1.2 2.9-4.4.6-3.8"], e: [[12, 4.4, 5.3, 1.8]], d: [[10, 15, 1.15], [14, 15, 1.15]] },
  mega_satan: { p: ["M12 19.4 7.65 6.01 19.04 14.29 4.96 14.29 16.35 6.01Z"], c: [[12, 12, 8.5]] },
  greed: { p: ["M12 3.7l-2.4 4.5 2.7 3.3-1.9 3.5 2 5.2"], c: [[12, 12, 8.4], [12, 12, 5.4]] },
  hush: { p: ["M3.5 12.4S7.1 7.6 12 7.6s8.5 4.8 8.5 4.8", "M3.5 12.4h17", "M7.6 10.6 6.4 8.4", "M12 9.2V6.7", "M16.4 10.6l1.2-2.2"] },
  delirium: { p: ["M6.6 12.2s2.4-3.2 5.4-3.2 5.4 3.2 5.4 3.2-2.4 3.2-5.4 3.2-5.4-3.2-5.4-3.2Z"], cd: [[12, 12, 8.6, "3.2 3.4"]], d: [[12, 12.2, 1.5]] },
  mother: { p: ["M4.7 20.5v-7.3a7.3 7.3 0 0114.6 0v7.3", "M8.6 20.5v-7.2", "M15.4 20.5v-7.2"], e: [[12, 12.6, 3.3, 2.3]], d: [[12, 12.6, 1.05]] },
  beast: { p: ["M2.9 12.6C7.1 7 17 7 21.1 12.6 17 18.1 7.1 18.1 2.9 12.6Z", "M12 9.4v6.4", "M4.9 8.6C3.3 5.9 4.8 4.5 6.2 6.3", "M19.1 8.6c1.6-2.7.1-4.1-1.3-2.3"] },
};

/** Glyph for an ending (id = the ones in endings.json). currentColor = color. */
export function Glyph({ id, size = 18, sw = 1.7, filter = "wob1" }: { id: string; size?: number; sw?: number; filter?: string | false }) {
  const shape = ENDINGS[id];
  if (!shape) return null;
  return <Drawn shape={shape} size={size} sw={sw} filter={filter} prefix={`e_${id}`} />;
}

// -- The 17 character portraits ---------------------------------------------
// Faces, not monograms. Isaac's visual DNA is a big bald head with oversized eyes
// and a tiny mouth, so that is the base every character is built from, and each
// one keeps exactly the trait a player identifies them by: Cain's patch, Judas's
// cowl, Azazel's horns, Keeper's coin. Drawn from primitives in a 24x24 box - not
// one pixel comes from the game, which is what lets this ship under GPL-3.0.
//
// `d` = filled circle (pupils), `r` = filled rect, `t` = filled teardrop,
// `p`/`c`/`e` = stroked. Every colour comes from `currentColor`.
const PORTRAITS: Record<string, Shape> = {
  // The face everything else is a variation of: bald head, wide eyes, one tear.
  isaac: {
    c: [[12, 11.6, 7.5]],
    d: [[9.3, 10.4, 1.6], [14.7, 10.4, 1.6]],
    p: ["M10.1 15.5c1.2 1 2.6 1 3.8 0"],
    t: [[8.4, 13.2]],
  },
  // A bow above the brow.
  magdalene: {
    c: [[12, 12.4, 7.2]],
    d: [[9.4, 11.4, 1.55], [14.6, 11.4, 1.55]],
    p: [
      "M9.6 5.1C7.3 3.4 8.4 1 10.7 2.3L12 4l1.3-1.7c2.3-1.3 3.4 1.1 1.1 2.8",
      "M10.3 16.4c1.1.9 2.3.9 3.4 0",
    ],
  },
  // One eye, and the patch strap crossing the other.
  cain: {
    c: [[12, 11.8, 7.5]],
    d: [[14.7, 10.6, 1.6]],
    r: [[6.4, 8.8, 4.2, 3.4, 0.8]],
    p: ["M4.8 8.2 19.2 12.4", "M10.2 15.8c1.2.9 2.5.9 3.7 0"],
  },
  // Under the cowl, only the eyes.
  judas: {
    p: [
      "M4.6 21.2C4.6 12.4 7.9 6.8 12 6.8s7.4 5.6 7.4 14.4Z",
      "M12 6.8V3.4",
    ],
    d: [[9.6, 13.6, 1.5], [14.4, 13.6, 1.5]],
  },
  // ???: the dripping silhouette and blank square eyes.
  blue_baby: {
    p: ["M5.6 21V10.6a6.4 6.4 0 0112.8 0V21l-2.1-1.8-2.1 1.8-2.2-1.8-2.1 1.8-2.2-1.8Z"],
    r: [[8.7, 10.2, 2.3, 3.1, 0.5], [13, 10.2, 2.3, 3.1, 0.5]],
  },
  // Long hair down both sides.
  eve: {
    c: [[12, 12, 7]],
    d: [[9.5, 11, 1.5], [14.5, 11, 1.5]],
    p: [
      "M5.3 10.4C4.6 6 7.6 2.6 12 2.6s7.4 3.4 6.7 7.8",
      "M5.4 11.2c-.5 4.4-.2 7.6.9 9.8",
      "M18.6 11.2c.5 4.4.2 7.6-.9 9.8",
    ],
  },
  // Mane and a hard brow.
  samson: {
    c: [[12, 12.4, 7]],
    d: [[9.5, 11.6, 1.5], [14.5, 11.6, 1.5]],
    p: [
      "M7.4 9.2 10.6 10.2", "M16.6 9.2 13.4 10.2",
      "M5.2 12c-1.6-4.2.4-8.2 3.4-9.2", "M18.8 12c1.6-4.2-.4-8.2-3.4-9.2",
    ],
  },
  // Horns, no eyes, and the beam he is known for.
  azazel: {
    c: [[12, 12.6, 6.8]],
    p: [
      "M7 8C4.2 6.6 2.6 4 2.4 1.4 5.2 2.4 7 5 7 8Z",
      "M17 8c2.8-1.4 4.4-4 4.6-6.6C18.8 2.4 17 5 17 8Z",
      "M8.6 14.4h6.8",
    ],
    r: [[9.4, 15.6, 5.2, 2, 1]],
  },
  // Eyes shut, hair falling forward.
  lazarus: {
    c: [[12, 12.2, 7.2]],
    p: [
      "M8.4 11.2c.9-.8 1.9-.8 2.8 0", "M12.8 11.2c.9-.8 1.9-.8 2.8 0",
      "M5.6 11c-.6-4.6 2.2-8 6.4-8s7 3.4 6.4 8",
      "M9 3.6 8.2 10.4", "M15 3.6l.8 6.8",
    ],
  },
  // Mismatched eyes and a crown of petals - nothing about Eden is fixed.
  eden: {
    c: [[12, 12.6, 6.8], [14.6, 11.6, 1.5]],
    d: [[9.4, 11.6, 1.5]],
    p: [
      "M12 5.8c-1.6-1-1.6-3.4 0-4.4 1.6 1 1.6 3.4 0 4.4Z",
      "M8 7.2C6.2 7 5 5 5.8 3.4 7.6 3.9 8.5 5.7 8 7.2Z",
      "M16 7.2c1.8-.2 3-2.2 2.2-3.8-1.8.5-2.7 2.3-2.2 3.8Z",
      "M10.4 16.2c1.1.9 2.3.9 3.4 0",
    ],
  },
  // A shade: the outline is there, the substance is not.
  the_lost: {
    p: ["M6.2 21V10.8a5.8 5.8 0 0111.6 0V21l-2-1.7-1.9 1.7-1.9-1.7-1.9 1.7Z"],
    dash: "2.4 2.2",
    d: [[9.9, 11, 1.35], [14.1, 11, 1.35]],
  },
  // Horns and the blindfold.
  lilith: {
    c: [[12, 12.4, 7]],
    r: [[5.4, 10.4, 13.2, 2.8, 1]],
    p: [
      "M7.2 6.6C5.6 4.8 5.4 2.6 6.4 1.6 8 2.6 8.8 4.6 8.6 6.8",
      "M16.8 6.6c1.6-1.8 1.8-4 .8-5-1.6 1-2.4 3-2.2 5.2",
      "M10.4 16.6c1.1.9 2.3.9 3.4 0",
    ],
  },
  // A coin for a head, held together with a plaster.
  keeper: {
    c: [[12, 12, 8], [12, 12, 5.6]],
    d: [[10, 11, 1.3], [14, 11, 1.3]],
    p: ["M6.6 6.6 17.4 17.4", "M9.4 15.4h5.2"],
  },
  // The hood, and the hole where a face should be.
  apollyon: {
    p: ["M4.6 21.2C4.6 12.4 7.9 6.8 12 6.8s7.4 5.6 7.4 14.4Z"],
    cd: [[12, 13.4, 3.4, "2.2 2"]],
    d: [[12, 13.4, 1.5]],
  },
  // Bone: sockets and a jaw.
  the_forgotten: {
    p: [
      "M6.4 13.8a5.6 5.6 0 1111.2 0v2.8H6.4Z",
      "M8 17.4v3.4", "M12 17.4v3.4", "M16 17.4v3.4",
      "M6.4 16.6h11.2",
    ],
    d: [[9.5, 12.6, 1.6], [14.5, 12.6, 1.6]],
  },
  // The halo.
  bethany: {
    c: [[12, 13, 6.8]],
    d: [[9.6, 12, 1.5], [14.4, 12, 1.5]],
    e: [[12, 4.4, 4.6, 1.6]],
    p: ["M10.4 16.8c1.1.9 2.3.9 3.4 0"],
  },
  // Two of them, always.
  jacob_esau: {
    c: [[8.2, 13, 5], [15.8, 13, 5]],
    d: [[6.7, 12, 1.15], [9.7, 12, 1.15], [14.3, 12, 1.15], [17.3, 12, 1.15]],
    p: ["M7 15.6c.8.6 1.6.6 2.4 0", "M14.6 15.6c.8.6 1.6.6 2.4 0"],
  },
};


/**
 * Character sigil on a plaque: regular = bone on engraved stone; Tainted =
 * the same sigil inked in blood + a slash. `id` = character id (Tainted and
 * alternate forms fall back to their base through `baseSigilId`).
 */
export function Portrait({ id, size = 22, tainted = false }: { id: string; size?: number; tainted?: boolean }) {
  const shape = PORTRAITS[basePortraitId(id)] ?? PORTRAITS.isaac;
  const inner = Math.round(size * 0.74);
  const radius = Math.round(size * 0.28);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        position: "relative",
        background: tainted ? "linear-gradient(165deg,#1a0d0d,#100908)" : "linear-gradient(165deg,#241d15,#16110c)",
        boxShadow: tainted
          ? "inset 0 0 0 1px rgba(140,26,26,.55), inset 0 1px 0 rgba(255,255,255,.05)"
          : "inset 0 0 0 1px #3a2f22, inset 0 1px 0 rgba(255,255,255,.055)",
      }}
    >
      <div style={{ display: "flex", position: "relative", color: tainted ? "#c4565c" : "#cfc3ad" }}>
        <Drawn shape={shape} size={inner} sw={1.7} filter={tainted ? "wob2" : "wob1"} prefix={`por_${id}`} />
      </div>
      {tainted && (
        <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
          <svg width={size} height={size} viewBox="0 0 24 24" style={{ display: "block" }}>
            <path d="M4.4 19.6 19.6 4.4" stroke="#8c1a1a" strokeWidth={2.2} strokeLinecap="round" filter="url(#wob2)" opacity={0.92} />
          </svg>
        </div>
      )}
    </div>
  );
}

/** Maps a character id (form/alt/Tainted) back to its base sigil. */
export function basePortraitId(id: string): string {
  let base = id.startsWith("tainted_") ? id.slice("tainted_".length) : id;
  const alias: Record<string, string> = {
    forgotten: "the_forgotten",
    lost: "the_lost",
    jacob: "jacob_esau",
    esau: "jacob_esau",
  };
  base = alias[base] ?? base;
  return PORTRAITS[base] ? base : "isaac";
}

// ── Emblem (cross + heart + tear) ─────────────────────────────────────────
export function Emblem({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", overflow: "visible" }}>
      <g filter="url(#wob1)">
        <path d="M12 2.4v19.2" />
        <path d="M6.4 7.6h11.2" />
        <path d="M12 17.8c-2.6-2.2-3.7-3.8-3.7-5.1 0-1.2.9-2.1 2-2.1.7 0 1.3.4 1.7 1 .4-.6 1-1 1.7-1 1.1 0 2 .9 2 2.1 0 1.3-1.1 2.9-3.7 5.1Z" fill="currentColor" stroke="none" opacity={0.9} />
      </g>
    </svg>
  );
}

// ── Hand-drawn nav icons ───────────────────────────────────────────
const NAV: Record<string, Shape> = {
  dash: { p: ["M4.2 5.2h6.2v6.2H4.2Z", "M13.6 5.2h6.2v3.6h-6.2Z", "M13.6 11h6.2v7.8h-6.2Z", "M4.2 14h6.2v4.8H4.2Z"] },
  user: { p: ["M12 11.6a4 4 0 100-8 4 4 0 000 8Z", "M5.4 20.4c0-3.4 3-5.4 6.6-5.4s6.6 2 6.6 5.4"] },
  wand: { p: ["M5 19.4 15.6 8.6", "M13.8 3.4l1.2 2.6 2.6 1.2-2.6 1.2-1.2 2.6-1.2-2.6L10 7.6l2.6-1.2Z"] },
  list: { p: ["M4.4 7h3.4", "M4.4 12h3.4", "M4.4 17h3.4", "M10.6 7h9", "M10.6 12h9", "M10.6 17h9"] },
  map: { p: ["M3.4 6.4 9 4l6 2.6L20.6 4v13.6L15 20l-6-2.6L3.4 20Z", "M9 4v13.4", "M15 6.6V20"] },
  target: { p: ["M12 3.4v3", "M12 17.6v3"], c: [[12, 12, 7.8], [12, 12, 3.2]] },
  flask: { p: ["M9.4 3.2v6L5 18.4c-.6 1.4.4 2.6 1.8 2.6h10.4c1.4 0 2.4-1.2 1.8-2.6L14.6 9.2v-6", "M8.4 3.2h7.2", "M7.4 15h9.2"] },
  chart: { p: ["M4.4 20.4V10", "M10 20.4V4.2", "M15.6 20.4v-7", "M20.4 20.4h-17"] },
  image: { p: ["M4 5.4h16v13.2H4Z", "M4.6 17 9.6 12.4l3.4 2.8 3-2.4 3.4 3.2"], d: [[9, 10, 1.6]] },
  steth: { p: ["M12 20.2C7.4 16.6 5.6 14 5.6 11.6c0-2 1.6-3.6 3.4-3.6 1.3 0 2.4.7 3 1.8.6-1.1 1.7-1.8 3-1.8 1.8 0 3.4 1.6 3.4 3.6 0 2.4-1.8 5-6.4 8.6Z", "M12 3.4v3.2", "M9.8 5h4.4"] },
  gear: { p: ["M12 3.4v2.4M12 18.2v2.4M4 12H1.8M22.2 12H20M6.4 6.4 4.8 4.8M19.2 19.2l-1.6-1.6M17.6 6.4l1.6-1.6M4.8 19.2l1.6-1.6"], c: [[12, 12, 3.2]] },
  info: { p: ["M6 3.4h9.4l3.6 3.6v13.6H6Z", "M12 10.6v6", "M15.4 3.6v3.8h3.4"], d: [[12, 8.6, 0.85]] },
  grid: { p: ["M4 4h5.2v5.2H4Z", "M10.8 4H16v5.2h-5.2Z", "M17.2 4h2.8v5.2h-2.8Z", "M4 10.8h5.2V16H4Z", "M10.8 10.8H16V16h-5.2Z", "M17.2 10.8h2.8V16h-2.8Z", "M4 17.2h5.2V20H4Z", "M10.8 17.2H16V20h-5.2Z"] },
};

export function NavGlyph({ kind, size = 15 }: { kind: string; size?: number }) {
  const shape = NAV[kind] ?? NAV.info;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" style={{ display: "block", overflow: "visible" }}>
      <g filter="url(#wob2)">{svgKids(shape, `nav_${kind}`)}</g>
    </svg>
  );
}

// ── Library of objects from the world of Isaac (ORIGINAL, shaky line) ──
export const ICONS: Record<string, Shape> = {
  coin: { c: [[12, 12, 8], [12, 12, 4.6]], d: [[12, 12, 1]] },
  key: { c: [[8.4, 8.4, 3.4]], p: ["M10.6 10.6 18.6 18.6", "M16.4 16.4l2.2-2.2", "M18.4 18.4l1.8-1.8"] },
  bomb: { c: [[11, 15, 6.3]], p: ["M14.6 9.8c1-1.7 2.6-2.6 3.6-2.3", "M18.2 7.5l1.2-1.2M18.8 9l1.4-.5M20 6.6l-.5-1.4"] },
  heart: { p: ["M12 20.5C5.9 15.2 3.4 11.5 3.4 8.5 3.4 5.8 5.4 3.9 7.9 3.9 9.8 3.9 11.3 5 12 6.6 12.7 5 14.2 3.9 16.1 3.9 18.6 3.9 20.6 5.8 20.6 8.5 20.6 11.5 18.1 15.2 12 20.5Z"] },
  soul_heart: { p: ["M12 20.5C5.9 15.2 3.4 11.5 3.4 8.5 3.4 5.8 5.4 3.9 7.9 3.9 9.8 3.9 11.3 5 12 6.6 12.7 5 14.2 3.9 16.1 3.9 18.6 3.9 20.6 5.8 20.6 8.5 20.6 11.5 18.1 15.2 12 20.5Z"], dash: "2 2" },
  bone_heart: { p: ["M12 20.5C5.9 15.2 3.4 11.5 3.4 8.5 3.4 5.8 5.4 3.9 7.9 3.9 9.8 3.9 11.3 5 12 6.6 12.7 5 14.2 3.9 16.1 3.9 18.6 3.9 20.6 5.8 20.6 8.5 20.6 11.5 18.1 15.2 12 20.5Z", "M9 8l6 6M15 8l-6 6"] },
  pill: { p: ["M6.6 13.4 13.4 6.6a4 4 0 015.7 5.7l-6.8 6.8a4 4 0 01-5.7-5.7Z", "M10 10l4 4"] },
  card: { p: ["M6.5 4.2h11a1 1 0 011 1v13.6a1 1 0 01-1 1h-11a1 1 0 01-1-1V5.2a1 1 0 011-1Z", "M12 8l1.2 2.6 2.8.3-2.1 1.9.6 2.8-2.5-1.4-2.5 1.4.6-2.8-2.1-1.9 2.8-.3Z"] },
  dice: { p: ["M7 4.5h10a2.5 2.5 0 012.5 2.5v10a2.5 2.5 0 01-2.5 2.5H7A2.5 2.5 0 014.5 17V7A2.5 2.5 0 017 4.5Z"], d: [[8.2, 8.2, 1.1], [15.8, 8.2, 1.1], [8.2, 15.8, 1.1], [15.8, 15.8, 1.1], [12, 12, 1.1]] },
  battery: { p: ["M5 7.5h12a1.5 1.5 0 011.5 1.5v6a1.5 1.5 0 01-1.5 1.5H5A1.5 1.5 0 013.5 15V9A1.5 1.5 0 015 7.5Z", "M20.5 10.5v3", "M11.5 9.5 9.5 13h3l-2 3.5"] },
  pedestal: { c: [[12, 9, 4.2]], p: ["M8.4 19h7.2l-1.1-3H9.5Z", "M9.4 16h5.2", "M12 3.4v1.7M9.3 4.6l.9 1M14.7 4.6l-.9 1"] },
  chest: { p: ["M5 10.5h14V19H5Z", "M5 10.5a7 4 0 0114 0", "M5 13.6h14"], d: [[12, 13.8, 1]] },
  skull: { c: [[12, 10.5, 5.6]], d: [[9.9, 10.6, 1.5], [14.1, 10.6, 1.5]], p: ["M8.4 15.6v3M11 16.2v2.6M13 16.2v2.6M15.6 15.6v3", "M8.4 15.6h7.2"] },
  poop: { p: ["M7 20h10a3 3 0 00.4-6 2.6 2.6 0 00-1.2-3.5A3 3 0 0012 8a3 3 0 00-4.2 2.5A2.6 2.6 0 006.6 14 3 3 0 007 20Z", "M9.6 12.6c.6.5 1.3.7 2.4.6M9.2 16.2c1.2.7 3 .7 4 0"] },
  tear: { p: ["M12 3.4c0 0 6 8 6 12a6 6 0 01-12 0c0-4 6-12 6-12Z"], d: [[9.8, 14.5, 1.2]] },
  fire: { p: ["M12 3.4c2 3 5 5 5 9a5 5 0 01-10 0c0-2.2 1.1-3.2 2.1-4.2.3 1 .8 1.7 1.6 2.1.3-2.2.4-4.4 1.3-6.9Z"] },
  fly: { c: [[12, 13, 3]], e: [[7.6, 10.2, 3, 2], [16.4, 10.2, 3, 2]], p: ["M12 16v3M10.4 19h3.2"] },
  star: { p: ["M12 3.4l2.5 5.6 6.1.6-4.6 4 1.4 6-5.4-3.2-5.4 3.2 1.4-6-4.6-4 6.1-.6Z"] },
  spikes: { p: ["M4 19 7 11l3 8M10 19l3-8 3 8M16 19l3-8 3 8M3 19h18"] },
  horns: { p: ["M4 6c1 6 4 9 8 9s7-3 8-9c-2 2-4 3-5 2.5C13 12 12 14 12 14s-1-2-3-2.5C8 12 6 11 4 6Z"] },
  wing: { p: ["M20 5c-6 0-11 3-14 9 3-1 5-1 6 0-2 1-3 2.5-3.5 4.5C12 15 17 12 20 5Z"] },
};

/** An icon from the world of Isaac (currentColor = color). */
export function Icon({ name, size = 18, sw = 1.7, filter = "wob1" }: { name: string; size?: number; sw?: number; filter?: string | false }) {
  const shape = ICONS[name];
  if (!shape) return null;
  return <Drawn shape={shape} size={size} sw={sw} filter={filter} prefix={`ic_${name}`} />;
}

// ── Dead God gauge: 12 engraved rings (one per ending) ─────────────────────
function arc(cx: number, cy: number, r: number, a0: number, a1: number): string {
  const p = (a: number): [number, number] => {
    const t = ((a - 90) * Math.PI) / 180;
    return [cx + r * Math.cos(t), cy + r * Math.sin(t)];
  };
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${x0.toFixed(2)} ${y0.toFixed(2)}A${r} ${r} 0 ${a1 - a0 > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

/** `perEnding` = 12 entries {hard, normal} (counted across the 34 characters). */
export function DeadGodGauge({ perEnding, size = 246, total = 34 }: { perEnding: { hard: number; normal: number }[]; size?: number; total?: number }) {
  const cx = 200;
  const cy = 200;
  const a0 = 215;
  const sweep = 290;
  const arcs: ReactNode[] = [];
  perEnding.forEach((p, i) => {
    const r = 86 + i * 8.6;
    const fh = total > 0 ? p.hard / total : 0;
    const fn = total > 0 ? (p.hard + p.normal) / total : 0;
    arcs.push(<path key={`sh${i}`} d={arc(cx, cy + 1.4, r, a0, a0 + sweep)} stroke="#000" strokeWidth={5.6} fill="none" strokeLinecap="round" opacity={0.55} filter="url(#etch)" />);
    arcs.push(<path key={`tr${i}`} d={arc(cx, cy, r, a0, a0 + sweep)} stroke="#211a12" strokeWidth={5.2} fill="none" strokeLinecap="round" filter="url(#etch)" />);
    if (fn > 0.004) arcs.push(<path key={`n${i}`} d={arc(cx, cy, r, a0, a0 + sweep * fn)} stroke="#2a7a56" strokeWidth={5.2} fill="none" strokeLinecap="round" filter="url(#etch)" />);
    if (fh > 0.004)
      arcs.push(
        <path key={`h${i}`} d={arc(cx, cy, r, a0, a0 + sweep * fh)} stroke="#c9a94a" strokeWidth={5.2} fill="none" strokeLinecap="round" filter="url(#etch)">
          <title>{`${p.hard}/${total} Hard`}</title>
        </path>,
      );
  });
  arcs.push(<path key="in" d={arc(cx, cy, 78, a0, a0 + sweep)} stroke="#3a2f22" strokeWidth={1} fill="none" filter="url(#etch)" />);
  return (
    <svg width={size} height={size} viewBox="0 0 400 400" style={{ display: "block" }}>
      {arcs}
    </svg>
  );
}

// ── Blood splatter (decoration, never behind the data) ──────────────────────
function rngFn(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export function Splatter({ w, h, seed, n = 22, style }: { w: number; h: number; seed: number; n?: number; style?: CSSProperties }) {
  const rnd = rngFn(seed);
  const kids: ReactNode[] = [];
  for (let i = 0; i < n; i++) {
    const cx = rnd() * w;
    const cy = rnd() * h;
    const r = 2 + rnd() * rnd() * 26;
    kids.push(<ellipse key={`e${i}`} cx={cx} cy={cy} rx={r} ry={r * (0.7 + rnd() * 0.6)} fill="currentColor" opacity={0.25 + rnd() * 0.6} />);
  }
  for (let i = 0; i < Math.round(n / 3); i++) {
    const x = rnd() * w;
    const y = rnd() * h;
    const l = 8 + rnd() * 30;
    const r = 2 + rnd() * 4;
    kids.push(
      <path
        key={`t${i}`}
        d={`M${x.toFixed(1)} ${y.toFixed(1)}c${-r} ${l * 0.5} ${-r * 0.4} ${l} ${r} ${l}s${r * 1.4} ${-l * 0.4} ${r} ${-l}Z`}
        fill="currentColor"
        opacity={0.3 + rnd() * 0.4}
      />,
    );
  }
  return (
    <svg width="100%" height="100%" viewBox={`0 0 ${w} ${h}`} style={{ display: "block", overflow: "visible", ...style }} aria-hidden="true">
      <g filter="url(#splat)">{kids}</g>
    </svg>
  );
}
