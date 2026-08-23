// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

import { Github, Heart, MessageCircle } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { Card } from "../components/ui";
import { UpdateCard } from "../components/UpdateCard";
import { useT } from "../lib/useT";
import { Emblem } from "../lib/art";
import { APP_VERSION, DISCORD_URL, GITHUB_URL } from "../lib/format";


export function AboutView() {
  const t = useT();
  return (
    <div className="mx-auto max-w-2xl space-y-6 py-4">
      <div className="text-center">
        <div className="mb-3 flex justify-center text-isaac-dried">
          <Emblem size={48} />
        </div>
        <p className="mb-1 text-xs font-semibold uppercase tracking-[0.35em] text-isaac-gold">
          The Binding of Isaac · Repentance+
        </p>
        <h1 className="font-display text-4xl text-isaac-text">Isaac Completion Tracker</h1>
        <p className="mt-2 text-sm text-isaac-muted">{t("about.version")} {APP_VERSION}</p>
      </div>

      <Card className="text-center">
        <p className="text-sm text-isaac-muted">{t("about.createdBy")}</p>
        <button
          onClick={() => openUrl(GITHUB_URL)}
          className="mt-1 inline-flex items-center gap-2 text-xl font-bold text-isaac-text transition-colors hover:text-isaac-gold"
        >
          <Github className="h-5 w-5" />
          reiassezbeau
        </button>
        <div className="mt-2">
          <button onClick={() => openUrl(GITHUB_URL)} className="text-sm text-isaac-gold hover:underline">
            {GITHUB_URL}
          </button>
        </div>
      </Card>

      <Card className="text-center">
        <h2 className="mb-1 text-sm font-semibold uppercase tracking-widest text-isaac-muted">
          {t("about.community")}
        </h2>
        <p className="mb-3 text-sm text-isaac-muted">{t("about.discordBody")}</p>
        <button
          onClick={() => openUrl(DISCORD_URL)}
          className="press-in inline-flex items-center gap-2 rounded-lg border border-[#5865F2]/50 bg-[#5865F2]/10 px-4 py-2 text-sm font-medium text-isaac-text transition-all duration-150 hover:-translate-y-0.5 hover:border-[#5865F2] hover:bg-[#5865F2]/20"
        >
          <MessageCircle className="h-4 w-4 text-[#7f88ff]" />
          {t("about.joinDiscord")}
        </button>
      </Card>

      <UpdateCard />

      <Card>
        <h2 className="mb-2 text-sm font-semibold uppercase tracking-widest text-isaac-muted">
          {t("nav.about")}
        </h2>
        <div className="space-y-2 text-sm text-isaac-muted">
          <p>{t("about.body1")}</p>
          <p>{t("about.body2")}</p>
          <p className="flex items-center gap-1.5 text-xs">
            <Heart className="h-3 w-3 text-isaac-blood" />
            {t("about.notAffiliated")}
          </p>
          <p className="text-xs text-isaac-faint">{t("about.assets")}</p>
        </div>
      </Card>
    </div>
  );
}
