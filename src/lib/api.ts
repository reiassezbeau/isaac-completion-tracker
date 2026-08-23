// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

// Call layer for the Tauri commands (invoke). The web view itself never touches the
// network: everything goes through the local Rust backend. The single exception is
// the update check below, which the backend performs only when the user clicks it.
import { invoke } from "@tauri-apps/api/core";
import type {
  AchievementView,
  Character,
  CharacterDetail,
  CharacterListItem,
  CharacterStats,
  Dashboard,
  Ending,
  HealthReport,
  BuildAnalysis,
  Insights,
  ItemKb,
  MarksMatrix,
  OptimizerReport,
  Overrides,
  SynergyResult,
  Prediction,
  Roadmap,
  Run,
  SaveSlot,
  StatsOverview,
  TargetSuggestion,
  UiPrefs,
  UpdateInfo,
} from "./types";

export const api = {
  listSaves: () => invoke<SaveSlot[]>("list_saves"),
  scanFolder: (path: string) => invoke<SaveSlot[]>("scan_folder", { path }),
  loadSlot: (path: string) => invoke<Dashboard>("load_slot", { path }),
  refresh: () => invoke<Dashboard>("refresh"),
  dashboard: () => invoke<Dashboard>("dashboard"),

  getCharacters: () => invoke<CharacterListItem[]>("get_characters"),
  getCharacter: (id: string) => invoke<CharacterDetail>("get_character", { id }),
  getCharactersStatic: () => invoke<Character[]>("get_characters_static"),
  getEndings: () => invoke<Ending[]>("get_endings"),

  predict: (characterId: string, targetId: string) =>
    invoke<Prediction>("predict", { characterId, targetId }),
  nextTargets: (limit: number) => invoke<TargetSuggestion[]>("next_targets", { limit }),
  getRoadmap: () => invoke<Roadmap>("get_roadmap"),
  getMarksMatrix: () => invoke<MarksMatrix>("get_marks_matrix"),
  getAchievements: () => invoke<AchievementView[]>("get_achievements"),

  refreshStats: () => invoke<number>("refresh_stats"),
  getStatsOverview: () => invoke<StatsOverview>("get_stats_overview"),
  getInsights: () => invoke<Insights>("get_insights"),
  getCharacterStats: (charId: string) => invoke<CharacterStats>("get_character_stats", { charId }),
  getRunHistory: (limit: number) => invoke<Run[]>("get_run_history", { limit }),

  getOptimizer: (limit: number) => invoke<OptimizerReport>("get_optimizer", { limit }),

  getItemKb: () => invoke<ItemKb[]>("get_item_kb"),
  analyzeBuild: (itemIds: number[]) => invoke<BuildAnalysis>("analyze_build", { itemIds }),
  trySynergy: (buildIds: number[], candidateId: number) =>
    invoke<SynergyResult>("try_synergy", { buildIds, candidateId }),

  saveStatCard: (path: string, bytes: number[]) =>
    invoke<string>("save_stat_card", { path, bytes }),

  getHealth: () => invoke<HealthReport>("get_health"),
  isTrackerModInstalled: () => invoke<boolean>("is_tracker_mod_installed"),
  installTrackerMod: () => invoke<string>("install_tracker_mod"),
  launchGame: () => invoke<void>("launch_game"),
  backupSave: (slotPath: string) => invoke<string>("backup_save", { slotPath }),

  getOverrides: () => invoke<Overrides>("get_overrides"),
  setOverrideAchievement: (secretId: number, value: boolean | null) =>
    invoke<void>("set_override_achievement", { secretId, value }),
  setOverrideMark: (charId: string, markIndex: number, value: string | null) =>
    invoke<void>("set_override_mark", { charId, markIndex, value }),
  resetOverrides: () => invoke<void>("reset_overrides"),

  /** Every collectible id -> name, so a run snapshot never shows a raw "#317". */
  getItemNames: () => invoke<Record<string, string>>("get_item_names"),

  // -- Updates: the only calls that leave this machine, and only on a click. ----
  checkForUpdate: () => invoke<UpdateInfo>("check_for_update"),
  /** Downloads the installer and verifies its SHA-256; returns the local path. */
  downloadUpdate: (info: UpdateInfo) => invoke<string>("download_update", { info }),
  /** Runs a verified installer and closes the app so files can be replaced. */
  installUpdate: (installerPath: string) => invoke<void>("install_update", { installerPath }),

  // -- UI preferences (authoritative copy, outside the web view's storage) ------
  getUiPrefs: () => invoke<UiPrefs>("get_ui_prefs"),
  setUiPrefs: (prefs: UiPrefs) => invoke<void>("set_ui_prefs", { prefs }),
};
