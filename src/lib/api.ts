// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

// Couche d'appel des commands Tauri (invoke). Aucune requête réseau : tout passe
// par le backend Rust local.
import { invoke } from "@tauri-apps/api/core";
import type {
  AchievementView,
  Character,
  CharacterDetail,
  CharacterListItem,
  Dashboard,
  Ending,
  HealthReport,
  Overrides,
  Prediction,
  Roadmap,
  SaveSlot,
  TargetSuggestion,
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
  getAchievements: () => invoke<AchievementView[]>("get_achievements"),

  getHealth: () => invoke<HealthReport>("get_health"),
  isTrackerModInstalled: () => invoke<boolean>("is_tracker_mod_installed"),
  installTrackerMod: () => invoke<string>("install_tracker_mod"),
  backupSave: (slotPath: string) => invoke<string>("backup_save", { slotPath }),

  getOverrides: () => invoke<Overrides>("get_overrides"),
  setOverrideAchievement: (secretId: number, value: boolean | null) =>
    invoke<void>("set_override_achievement", { secretId, value }),
  setOverrideMark: (charId: string, markIndex: number, value: string | null) =>
    invoke<void>("set_override_mark", { charId, markIndex, value }),
  resetOverrides: () => invoke<void>("reset_overrides"),
};
