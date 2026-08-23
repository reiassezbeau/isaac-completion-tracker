// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useState } from "react";
import { Skull } from "lucide-react";
import { api } from "../lib/api";
import { Card, ProgressBar, SectionTitle } from "../components/ui";
import { useT } from "../lib/useT";
import type { Roadmap } from "../lib/types";

export function RoadmapView() {
  const t = useT();
  const [roadmap, setRoadmap] = useState<Roadmap | null>(null);
  useEffect(() => {
    api.getRoadmap().then(setRoadmap);
  }, []);
  if (!roadmap) return null;

  const dgDone = roadmap.dead_god_total - roadmap.dead_god_remaining;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <h1 className="flex items-center gap-2 font-display text-3xl text-isaac-text">
        <Skull className="h-6 w-6 text-isaac-dried" /> {t("nav.roadmap")}
      </h1>
      <Card>
        <div className="flex items-center gap-2 text-isaac-muted">
          <Skull className="h-5 w-5 text-isaac-blood" />
          <span className="text-sm font-medium">{t("road.route")}</span>
        </div>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-3xl font-bold text-isaac-gold">{dgDone}</span>
          <span className="text-isaac-muted">/ {roadmap.dead_god_total} {t("road.goldMarks")}</span>
          <span className="ms-auto text-sm text-isaac-blood">{roadmap.dead_god_remaining} {t("dash.remaining")}</span>
        </div>
        <div className="mt-3">
          <ProgressBar value={dgDone} max={roadmap.dead_god_total} tone="gold" />
        </div>
      </Card>

      <div>
        <SectionTitle hint={t("road.recalc")}>{t("road.plan")}</SectionTitle>
        <ol className="space-y-3">
          {roadmap.steps.map((step, i) => {
            const done = step.total > 0 && step.done >= step.total;
            return (
              <li key={i}>
                <Card className={done ? "opacity-70" : ""}>
                  <div className="flex items-start gap-3">
                    <div
                      className={`flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                        done
                          ? "bg-isaac-done/20 text-isaac-done"
                          : "bg-isaac-blood/20 text-isaac-blood"
                      }`}
                    >
                      {done ? "✓" : i + 1}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold">{step.title}</h3>
                        <span className="flex-shrink-0 text-xs text-isaac-muted">
                          {step.done}/{step.total}
                        </span>
                      </div>
                      <p className="mt-0.5 text-sm text-isaac-muted">{step.detail}</p>
                      <div className="mt-2">
                        <ProgressBar value={step.done} max={step.total} tone={done ? "done" : "blood"} />
                      </div>
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
