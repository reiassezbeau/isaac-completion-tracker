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

export interface EndingMarkCount {
  ending_id: string;
  ending_name: string;
  hard: number;
  normal: number;
}

export interface Dashboard {
  total_unlocked: number;
  total: number;
  percent: number;
  dead_god_remaining: number;
  dead_god_total: number;
  categories: CategoryStat[];
  next_targets: TargetSuggestion[];
  dead_god_by_ending: EndingMarkCount[];
  full_characters: number;
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

export interface PathStatus {
  path: string | null;
  exists: boolean;
}

export interface HitEvent {
  frame: number;
  stage: number;
  stage_type: number;
  source: string;
}

export interface DeathSource {
  source: string;
  entity_type: number | null;
  stage: number | null;
  frame: number | null;
}

export interface Run {
  run_id: string;
  slot: number;
  character: string;
  player_type: number;
  started_frame: number;
  ended_frame: number | null;
  ended: boolean;
  outcome: string | null;
  ending: string | null;
  deepest_stage: number;
  hits_total: number;
  shielded_hits: number;
  hits_by_source: Record<string, number>;
  hits_by_stage: Record<string, number>;
  hits: HitEvent[];
  rooms_cleared: number | null;
  kills: number | null;
  boss_kills: number | null;
  duration_frames: number | null;
  curses: number | null;
  devil_deals: number | null;
  final_stage: number | null;
  final_stage_type: number | null;
  final_build: number[];
  death_source: DeathSource | null;
}

export interface CharacterStats {
  character: string;
  runs: number;
  wins: number;
  deaths: number;
  winrate: number;
  avg_hits: number;
  min_hits: number | null;
  avg_deepest_stage: number;
  cleanliness: number;
  first_hit_stage_avg: number | null;
}

export interface StatsOverview {
  total_runs: number;
  total_wins: number;
  total_deaths: number;
  overall_winrate: number;
  avg_hits_per_run: number;
  nemesis: [string, number] | null;
  hits_by_source: [string, number][];
  hits_heatmap: [string, number][];
  hits_trend: number[];
  per_character: CharacterStats[];
  total_kills: number;
  total_boss_kills: number;
  total_rooms_cleared: number;
  total_devil_deals: number;
}

export interface CleanRecord {
  character: string;
  outcome: string;
  hits: number;
  deepest_stage: number;
}

export interface Insights {
  cleanest_characters: CharacterStats[];
  bloodiest_characters: CharacterStats[];
  best_clean_runs: CleanRecord[];
  hits_win_correlation: number | null;
  current_win_streak: number;
  best_win_streak: number;
  total_runs: number;
}

export interface EvAction {
  character_id: string;
  character_name: string;
  route_id: string;
  route_note: string;
  fills: string[];
  mark_gain: number;
  ach_gain: number;
  reward_gain: number;
  value: number;
  probability: number;
  ev: number;
  confidence: number;
  based_on_runs: number;
  why: string;
}

export interface Bottleneck {
  ending_id: string;
  ending_name: string;
  chars_missing: number;
  difficulty_default: number;
}

export interface AlmostThere {
  character_id: string;
  character_name: string;
  missing_marks: number;
  missing_names: string[];
}

export interface DeadGodEta {
  remaining: number;
  total: number;
  winrate: number | null;
  based_on_runs: number;
  estimated_winning_runs: number | null;
  estimated_attempts: number | null;
  note: string;
}

export interface OptimizerReport {
  actions: EvAction[];
  bottlenecks: Bottleneck[];
  almost_there: AlmostThere[];
  eta: DeadGodEta;
  based_on_runs: number;
}

export interface StatEffect {
  op: "flat" | "mult";
  value: number;
}

export interface ItemKb {
  id: number;
  name: string;
  roles: string[];
  stat_effects: Record<string, StatEffect>;
  grants_tear_flags: string[];
  grants_flight: boolean;
  is_tears_replacement: boolean;
  is_familiar: boolean;
  hearts: number;
  complexity: "flat" | "proc" | "conditional";
  note: string;
}

export interface Composition {
  total: number;
  by_role: [string, number][];
  familiars: number;
  tears_replacements: number;
  tear_flags: [string, number][];
  has_flight: boolean;
}

export interface BuildAnalysis {
  composition: Composition;
  archetypes: string[];
  strengths: string[];
  weaknesses: string[];
  unknown_ids: number[];
}

export interface StatDelta {
  dim: string;
  before: number;
  after: number;
  direction: number;
}

export interface SynergyNote {
  kind: "strong" | "weak" | "dangerous";
  text: string;
}

export interface SynergyResult {
  candidate_id: number;
  candidate_name: string;
  adds_tear_flags: string[];
  adds_flight: boolean;
  hearts_delta: number;
  stat_deltas: StatDelta[];
  radar_before: [string, number][];
  radar_after: [string, number][];
  estimate_approximate: boolean;
  synergy_notes: SynergyNote[];
  verdict: "fills_gap" | "redundant_or_conflict" | "strong_pickup" | "situational";
  verdict_text: string;
}

export interface HealthReport {
  game_root: PathStatus;
  mods_dir: PathStatus;
  data_dir: PathStatus;
  steam_save_found: boolean;
  save_loaded: boolean;
  save_path: string | null;
  edition: Edition | null;
  unlocked: number | null;
  total: number;
  checksum_ok: boolean | null;
  marks_reliable: boolean | null;
  mod_installed: boolean;
  mod_dir: string | null;
  mod_data_file: string | null;
  mom_beaten: boolean | null;
  warnings: string[];
}
