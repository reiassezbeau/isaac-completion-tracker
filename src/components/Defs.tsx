// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * Defs - the 8 "material" SVG filters of art direction v2 (cursed grimoire).
 * 100% original (feTurbulence / feDisplacementMap): no bitmaps, no
 * downloads. Mounted once in the Shell; referenced through
 * `filter: url(#wob1)` and friends by the glyphs, sigils and chrome.
 *   wob1/2/3: shaky ink line · etch: engraving · splat: splatter
 *   grain: soot · blotch: stain · tornEdge: torn edge
 */
export function Defs() {
  return (
    <svg width="0" height="0" aria-hidden="true" style={{ position: "absolute" }}>
      <defs>
        <filter id="wob1" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.052" numOctaves={3} seed={11} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={1.7} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="wob2" x="-30%" y="-30%" width="160%" height="160%">
          <feTurbulence type="fractalNoise" baseFrequency="0.07" numOctaves={3} seed={29} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={1.1} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="wob3" x="-40%" y="-40%" width="180%" height="180%">
          <feTurbulence type="fractalNoise" baseFrequency="0.038" numOctaves={4} seed={5} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={2.6} xChannelSelector="R" yChannelSelector="G" result="d" />
          <feGaussianBlur in="d" stdDeviation={0.13} />
        </filter>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.92" numOctaves={4} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <filter id="blotch">
          <feTurbulence type="fractalNoise" baseFrequency="0.009" numOctaves={4} seed={41} />
          <feColorMatrix type="saturate" values="0" />
          <feComponentTransfer>
            <feFuncA type="gamma" exponent={6} amplitude={2.4} />
          </feComponentTransfer>
        </filter>
        <filter id="tornEdge" x="-8%" y="-8%" width="116%" height="116%">
          <feTurbulence type="fractalNoise" baseFrequency="0.014 0.11" numOctaves={3} seed={17} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={7} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="splat" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves={3} seed={63} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={6} xChannelSelector="R" yChannelSelector="G" />
        </filter>
        <filter id="etch" x="-25%" y="-25%" width="150%" height="150%">
          <feTurbulence type="fractalNoise" baseFrequency="0.06" numOctaves={3} seed={23} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={1.3} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </defs>
    </svg>
  );
}
