// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

// Types partagés avec le backend Rust (miroir des structs `Serialize`).
// UI en français, mais noms de succès / persos / bosses en anglais (comme en jeu).

export type MarkDifficulty = "none" | "normal" | "hard";
export type Edition = "repentance" | "repentanceplus";

export interface SaveSlot {
  path: string;
  filename: string;
  label: string;
  source: string;
  edition: Edition | null;
  unlocked: number | null;
  total: number;
  marks_reliable: boolean;
  parse_error: string | null;
}

export interface CategoryStat {
  category: string;
  unlocked: number;
  total: number;
}

export interface TargetSuggestion {
  character_id: string;
  character_name: string;
  target_id: string;
  target_name: string;
  new_unlocks: number;
  fills_hard_mark: boolean;
}

export interface Dashboard {
  total_unlocked: number;
  total: number;
  percent: number;
  dead_god_remaining: number;
  dead_god_total: number;
  categories: CategoryStat[];
  next_targets: TargetSuggestion[];
  marks_reliable: boolean;
  checksum_ok: boolean;
  edition: Edition;
  has_overrides: boolean;
}

export interface AchievementRef {
  id: number;
  name: string;
  reward: string;
  unlock_text: string;
}

export interface CharacterMark {
  ending_id: string;
  ending_name: string;
  mark_index: number;
  status: MarkDifficulty;
  overridden: boolean;
}

export interface CharacterTodo {
  ending_id: string;
  ending_name: string;
  current: MarkDifficulty;
  needs_hard: boolean;
  unlocks: AchievementRef[];
}

export interface RoutingTip {
  id: string;
  applies_to: string[];
  title: string;
  text: string;
}

export interface CharacterDetail {
  id: string;
  name: string;
  kind: "regular" | "tainted";
  dlc: string;
  character_unlocked: boolean;
  marks: CharacterMark[];
  todo: CharacterTodo[];
  routing_tips: RoutingTip[];
  marks_reliable: boolean;
}

export interface CharacterListItem {
  id: string;
  name: string;
  kind: "regular" | "tainted";
  dlc: string;
  unlocked: boolean;
  marks_hard: number;
  marks_total: number;
}

export interface Prediction {
  character_id: string;
  character_name: string;
  target_id: string;
  target_name: string;
  new_unlocks: AchievementRef[];
  already_unlocked: AchievementRef[];
  fills_mark: boolean;
  current_mark: MarkDifficulty;
  advances_dead_god: boolean;
  note: string;
}

export interface RoadmapStep {
  title: string;
  detail: string;
  done: number;
  total: number;
}

export interface Roadmap {
  steps: RoadmapStep[];
  dead_god_remaining: number;
  dead_god_total: number;
}

export interface Unlock {
  text: string;
  type: string;
  character: string | null;
  target: string | null;
  predictable: boolean;
}

export interface AchievementView {
  id: number;
  name: string;
  description: string;
  category: string;
  dlc: string;
  hidden: boolean;
  unlock: Unlock;
  reward: string;
  unlocked: boolean;
  overridden: boolean;
}

export interface Ending {
  id: string;
  name: string;
  mark_index: number;
  hard_matters: boolean;
}

export interface Character {
  id: string;
  name: string;
  type: "regular" | "tainted";
  dlc: string;
  save_index: number;
}

export interface Overrides {
  achievements: Record<number, boolean>;
  marks: Record<string, string>;
}
