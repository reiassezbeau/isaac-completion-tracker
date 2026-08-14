// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

/**
 * PageBackdrop — fond propre à CHAQUE page, tiré de l'univers d'Isaac.
 * Collage d'icônes ORIGINALES (pièces, cœurs, dés, piédestal, crâne, crotte…),
 * grand et très discret, teinté par l'accent du thème, derrière le contenu.
 * Le jeu comme noyau esthétique — jamais sous une donnée (opacité basse).
 */
import { useStore, type ViewId } from "../store";
import { Emblem, Glyph, Icon } from "../lib/art";

type El =
  | { t: "icon"; n: string; x: number; y: number; s: number; r?: number; o?: number }
  | { t: "glyph"; n: string; x: number; y: number; s: number; r?: number; o?: number }
  | { t: "emblem"; x: number; y: number; s: number; r?: number; o?: number };

const SCENES: Partial<Record<ViewId, El[]>> = {
  dashboard: [
    { t: "emblem", x: 84, y: 24, s: 230, r: 6, o: 0.5 },
    { t: "glyph", n: "mega_satan", x: 16, y: 74, s: 150, r: -8, o: 0.5 },
    { t: "icon", n: "heart", x: 70, y: 84, s: 78, r: 10, o: 0.7 },
    { t: "icon", n: "coin", x: 30, y: 20, s: 70, r: -14, o: 0.6 },
  ],
  character: [
    { t: "icon", n: "heart", x: 82, y: 26, s: 210, r: 6, o: 0.5 },
    { t: "icon", n: "soul_heart", x: 18, y: 72, s: 120, r: -10, o: 0.6 },
    { t: "icon", n: "tear", x: 66, y: 82, s: 70, r: 8, o: 0.6 },
  ],
  grid: [
    { t: "icon", n: "dice", x: 85, y: 24, s: 175, r: -8, o: 0.5 },
    { t: "icon", n: "coin", x: 14, y: 70, s: 90, r: 10, o: 0.6 },
    { t: "icon", n: "key", x: 30, y: 88, s: 66, r: -8, o: 0.6 },
    { t: "icon", n: "star", x: 90, y: 82, s: 64, r: 12, o: 0.6 },
  ],
  predictor: [
    { t: "icon", n: "dice", x: 84, y: 26, s: 210, r: 8, o: 0.5 },
    { t: "icon", n: "card", x: 16, y: 74, s: 120, r: -10, o: 0.6 },
    { t: "icon", n: "star", x: 70, y: 84, s: 60, r: 6, o: 0.6 },
  ],
  achievements: [
    { t: "icon", n: "star", x: 86, y: 22, s: 190, r: 8, o: 0.5 },
    { t: "icon", n: "card", x: 16, y: 78, s: 110, r: -12, o: 0.55 },
    { t: "icon", n: "coin", x: 74, y: 84, s: 66, r: 10, o: 0.6 },
  ],
  roadmap: [
    { t: "icon", n: "skull", x: 84, y: 24, s: 210, r: 6, o: 0.5 },
    { t: "icon", n: "chest", x: 16, y: 76, s: 120, r: -8, o: 0.6 },
    { t: "glyph", n: "beast", x: 68, y: 86, s: 74, r: 8, o: 0.55 },
  ],
  optimizer: [
    { t: "icon", n: "skull", x: 85, y: 24, s: 200, r: -6, o: 0.5 },
    { t: "icon", n: "coin", x: 16, y: 74, s: 100, r: 10, o: 0.6 },
    { t: "icon", n: "star", x: 72, y: 84, s: 62, r: 8, o: 0.6 },
  ],
  build: [
    { t: "icon", n: "pedestal", x: 84, y: 26, s: 210, r: 4, o: 0.5 },
    { t: "icon", n: "pill", x: 14, y: 70, s: 96, r: -12, o: 0.6 },
    { t: "icon", n: "card", x: 28, y: 88, s: 74, r: 10, o: 0.55 },
    { t: "icon", n: "battery", x: 74, y: 84, s: 72, r: 8, o: 0.55 },
  ],
  stats: [
    { t: "icon", n: "heart", x: 85, y: 24, s: 200, r: 6, o: 0.5 },
    { t: "icon", n: "tear", x: 16, y: 72, s: 110, r: -8, o: 0.6 },
    { t: "icon", n: "fly", x: 30, y: 88, s: 70, r: 8, o: 0.55 },
    { t: "icon", n: "fire", x: 72, y: 84, s: 68, r: -10, o: 0.55 },
  ],
  card: [
    { t: "icon", n: "star", x: 84, y: 26, s: 200, r: 8, o: 0.5 },
    { t: "emblem", x: 16, y: 76, s: 120, r: -8, o: 0.5 },
    { t: "icon", n: "coin", x: 72, y: 84, s: 64, r: 10, o: 0.6 },
  ],
  diagnostic: [
    { t: "icon", n: "key", x: 84, y: 26, s: 190, r: 10, o: 0.5 },
    { t: "icon", n: "battery", x: 16, y: 76, s: 110, r: -10, o: 0.55 },
    { t: "icon", n: "bomb", x: 72, y: 84, s: 74, r: 8, o: 0.55 },
  ],
  settings: [
    { t: "icon", n: "key", x: 85, y: 24, s: 190, r: -8, o: 0.5 },
    { t: "icon", n: "card", x: 16, y: 76, s: 110, r: 10, o: 0.55 },
    { t: "icon", n: "poop", x: 70, y: 86, s: 72, r: 6, o: 0.5 },
  ],
  about: [
    { t: "emblem", x: 84, y: 26, s: 220, r: 6, o: 0.5 },
    { t: "icon", n: "heart", x: 16, y: 76, s: 110, r: -8, o: 0.6 },
  ],
};

function Node({ el }: { el: El }) {
  if (el.t === "emblem") return <Emblem size={el.s} />;
  if (el.t === "glyph") return <Glyph id={el.n} size={el.s} filter="wob3" />;
  return <Icon name={el.n} size={el.s} filter="wob3" />;
}

export function PageBackdrop() {
  const view = useStore((s) => s.view);
  const els = SCENES[view] ?? [{ t: "emblem", x: 84, y: 26, s: 220, r: 6, o: 0.5 } as El];
  return (
    <div className="absolute inset-0 z-0 overflow-hidden text-isaac-accent" style={{ opacity: 0.05 }} aria-hidden="true">
      {els.map((el, i) => (
        <div
          key={`${view}-${i}`}
          style={{
            position: "absolute",
            left: `${el.x}%`,
            top: `${el.y}%`,
            transform: `translate(-50%, -50%) rotate(${el.r ?? 0}deg)`,
            opacity: el.o ?? 1,
          }}
        >
          <Node el={el} />
        </div>
      ))}
    </div>
  );
}
