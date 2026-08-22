// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { useEffect, useMemo, useState } from "react";
import { Eye, EyeOff, ListChecks, Lock, Search, Unlock } from "lucide-react";
import { api } from "../lib/api";
import { categoryLabel, dlcLabel } from "../lib/format";
import { useT } from "../lib/useT";
import { Card, Pill } from "../components/ui";
import type { AchievementView } from "../lib/types";

type StatusFilter = "all" | "unlocked" | "locked";

export function AchievementsView() {
  const t = useT();
  const [all, setAll] = useState<AchievementView[] | null>(null);
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("all");
  const [dlc, setDlc] = useState("all");
  const [status, setStatus] = useState<StatusFilter>("all");
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    api.getAchievements().then(setAll);
  }, []);

  const categories = useMemo(
    () => Array.from(new Set(all?.map((a) => a.category) ?? [])).sort(),
    [all],
  );
  const dlcs = useMemo(() => Array.from(new Set(all?.map((a) => a.dlc) ?? [])), [all]);

  const filtered = useMemo(() => {
    if (!all) return [];
    const needle = q.trim().toLowerCase();
    return all.filter((a) => {
      if (cat !== "all" && a.category !== cat) return false;
      if (dlc !== "all" && a.dlc !== dlc) return false;
      if (status === "unlocked" && !a.unlocked) return false;
      if (status === "locked" && a.unlocked) return false;
      if (needle) {
        const hay = `${a.name} ${a.description} ${a.unlock.text}`.toLowerCase();
        if (!hay.includes(needle)) return false;
      }
      return true;
    });
  }, [all, q, cat, dlc, status]);

  if (!all) return null;
  const unlockedCount = filtered.filter((a) => a.unlocked).length;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <h1 className="flex items-center gap-2 font-display text-3xl text-isaac-text">
        <ListChecks className="h-6 w-6 text-isaac-gold" /> {t("ach.title")}
      </h1>
      <Card className="!p-4">
        <div className="flex flex-wrap items-center gap-2">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-isaac-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder={t("ach.searchPh")}
              className="w-full rounded-lg border border-isaac-border bg-isaac-surface2 py-2 pl-9 pr-3 text-sm outline-none focus:border-isaac-blood/60"
            />
          </div>
          <select value={cat} onChange={(e) => setCat(e.target.value)} className="rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-2 text-sm">
            <option value="all">{t("ach.allCats")}</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {categoryLabel(c)}
              </option>
            ))}
          </select>
          <select value={dlc} onChange={(e) => setDlc(e.target.value)} className="rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-2 text-sm">
            <option value="all">{t("ach.allDlc")}</option>
            {dlcs.map((d) => (
              <option key={d} value={d}>
                {dlcLabel(d)}
              </option>
            ))}
          </select>
          <select value={status} onChange={(e) => setStatus(e.target.value as StatusFilter)} className="rounded-lg border border-isaac-border bg-isaac-surface2 px-3 py-2 text-sm">
            <option value="all">{t("ach.allStatus")}</option>
            <option value="unlocked">{t("ach.unlockedPl")}</option>
            <option value="locked">{t("ach.lockedPl")}</option>
          </select>
          <button
            onClick={() => setReveal((r) => !r)}
            className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm transition-colors ${
              reveal
                ? "border-isaac-gold/50 bg-isaac-gold/10 text-isaac-gold"
                : "border-isaac-border bg-isaac-surface2 text-isaac-muted"
            }`}
            title="Show the conditions of locked achievements (spoilers)"
          >
            {reveal ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            {reveal ? "Spoilers shown" : "Reveal conditions"}
          </button>
        </div>
        <div className="mt-2 text-xs text-isaac-muted">
          {filtered.length} achievements · {unlockedCount} unlocked
        </div>
      </Card>

      <div className="space-y-1.5">
        {filtered.map((a) => {
          const showText = a.unlocked || reveal;
          return (
            <div
              key={a.id}
              className={`flex items-start gap-3 rounded-lg border px-4 py-2.5 text-sm ${
                a.unlocked
                  ? "border-isaac-border bg-isaac-surface"
                  : "border-isaac-border/60 bg-isaac-surface/40"
              }`}
            >
              <div className="mt-0.5">
                {a.unlocked ? (
                  <Unlock className="h-4 w-4 text-isaac-done" />
                ) : (
                  <Lock className="h-4 w-4 text-isaac-blood/70" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className={`font-medium ${a.unlocked ? "" : "text-isaac-muted"}`}>{a.name}</span>
                  {a.overridden && (
                    <Pill className="border-isaac-gold/40 bg-isaac-gold/10 text-isaac-gold">{t("set.fixed")}</Pill>
                  )}
                </div>
                <div className="text-xs text-isaac-muted">
                  {showText ? a.unlock.text : <span className="italic">{t("ach.hiddenCond")}</span>}
                </div>
              </div>
              <div className="flex flex-shrink-0 flex-col items-end gap-1 text-right text-xs">
                <span className="text-isaac-muted">{a.reward}</span>
                <div className="flex gap-1">
                  <Pill className="border-isaac-border bg-isaac-surface2 text-isaac-muted">
                    {categoryLabel(a.category)}
                  </Pill>
                  <Pill className="border-isaac-border bg-isaac-surface2 text-isaac-muted">
                    {dlcLabel(a.dlc)}
                  </Pill>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
