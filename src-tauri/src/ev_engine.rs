// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! ev_engine — moteur « valeur × probabilité ».
//!
//! Classe les prochaines actions par ESPÉRANCE de gain vers Dead God :
//!   EV(perso, route) = Valeur × Probabilité.
//! - Valeur = w_mark·(marques Hard gagnées) + w_ach·(succès de complétion) +
//!   w_reward·(objets/familiers débloqués).
//! - Probabilité = difficulté par défaut de la route (ancre « joueur moyen »)
//!   mise à l'échelle par ta MAÎTRISE du perso (winrate lissé / baseline).
//!
//! DÉTERMINISTE et 100 % offline. Sans aucune donnée de stats, la proba retombe
//! exactement sur la difficulté par défaut de la route (démarrage à froid propre).

use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::engine::State;
use crate::knowledge::Knowledge;
use crate::save_parser::MarkDifficulty;
use crate::stats_reader::Run;

// --------------------------------------------------------------------------
// Configuration & routes (ressources bundlées / appdata)
// --------------------------------------------------------------------------

/// Une « route » = un chemin de run qui coche une ou plusieurs marques.
#[derive(Debug, Clone, Deserialize)]
pub struct Route {
    pub id: String,
    /// ids d'endings cochés si la route est réussie.
    pub fills: Vec<String>,
    /// probabilité de réussite d'un « joueur moyen » (ancre, 0..1).
    pub difficulty_default: f32,
    #[serde(default)]
    pub note: String,
}

/// Charge `routes.json` depuis le dossier de ressources résolu. Jamais fatal.
pub fn load_routes(resources_dir: &Path) -> Vec<Route> {
    std::fs::read_to_string(resources_dir.join("routes.json"))
        .ok()
        .and_then(|raw| serde_json::from_str(&raw).ok())
        .unwrap_or_default()
}

/// Poids et priors du modèle EV. Ajustables via `appdata/ev_config.json`.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EvConfig {
    /// poids d'une marque Hard gagnée (l'objectif Dead God).
    pub w_mark: f32,
    /// poids d'un succès de complétion débloqué.
    pub w_ach: f32,
    /// poids d'un objet / familier débloqué.
    pub w_reward: f32,
    /// force du prior (nb de runs « virtuels » avant que tes stats ne pèsent).
    pub prior_k: f32,
    /// winrate « joueur moyen » : ancre du facteur de maîtrise (skill = winrate/baseline).
    pub baseline_winrate: f32,
    /// marques Hard gagnées par run gagnant (pour l'ETA Dead God).
    pub avg_marks_per_win: f32,
}

impl Default for EvConfig {
    fn default() -> Self {
        EvConfig {
            w_mark: 3.0,
            w_ach: 1.0,
            w_reward: 1.5,
            prior_k: 6.0,
            baseline_winrate: 0.5,
            avg_marks_per_win: 1.2,
        }
    }
}

impl EvConfig {
    /// Charge depuis `appdata/ev_config.json` si présent, sinon valeurs par défaut.
    pub fn load(app_data_dir: &Path) -> Self {
        std::fs::read_to_string(app_data_dir.join("ev_config.json"))
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }
}

// --------------------------------------------------------------------------
// Sorties
// --------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct EvAction {
    pub character_id: String,
    pub character_name: String,
    pub route_id: String,
    pub route_note: String,
    /// noms des marques réellement gagnées (pas encore Hard pour ce perso).
    pub fills: Vec<String>,
    pub mark_gain: usize,
    pub ach_gain: usize,
    pub reward_gain: usize,
    pub value: f32,
    pub probability: f32,
    pub ev: f32,
    /// 0..1 : confiance dans la proba (basée sur le nb de runs de ce perso).
    pub confidence: f32,
    pub based_on_runs: usize,
    pub why: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct Bottleneck {
    pub ending_id: String,
    pub ending_name: String,
    /// nb de persos qui n'ont PAS cette marque en Hard.
    pub chars_missing: usize,
    pub difficulty_default: f32,
}

#[derive(Debug, Clone, Serialize)]
pub struct AlmostThere {
    pub character_id: String,
    pub character_name: String,
    pub missing_marks: usize,
    pub missing_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct DeadGodEta {
    pub remaining: usize,
    pub total: usize,
    pub winrate: Option<f32>,
    pub based_on_runs: usize,
    pub estimated_winning_runs: Option<usize>,
    pub estimated_attempts: Option<usize>,
    pub note: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct OptimizerReport {
    pub actions: Vec<EvAction>,
    pub bottlenecks: Vec<Bottleneck>,
    pub almost_there: Vec<AlmostThere>,
    pub eta: DeadGodEta,
    /// total de runs « comptés » dans l'archive (indicateur de démarrage à froid).
    pub based_on_runs: usize,
}

// --------------------------------------------------------------------------
// Helpers déterministes
// --------------------------------------------------------------------------

fn is_counted(r: &Run) -> bool {
    matches!(r.outcome.as_deref(), Some("win") | Some("death"))
}
fn is_win(r: &Run) -> bool {
    r.outcome.as_deref() == Some("win")
}

/// (victoires, runs comptés) pour un perso donné.
fn char_record(runs: &[Run], char_id: &str) -> (usize, usize) {
    let mut wins = 0;
    let mut n = 0;
    for r in runs.iter().filter(|r| is_counted(r) && r.character == char_id) {
        n += 1;
        if is_win(r) {
            wins += 1;
        }
    }
    (wins, n)
}

/// Marque effective d'un perso sur un index de marque.
fn mark_of(state: &State, save_index: usize, mark_index: usize) -> MarkDifficulty {
    state
        .marks
        .get(save_index)
        .and_then(|v| v.get(mark_index))
        .copied()
        .unwrap_or(MarkDifficulty::None)
}

/// Succès (complétion, objets) prédictibles, encore verrouillés, déclenchés par
/// finir `target` avec `char_id`. Retourne (succès de complétion, objets/familiers).
fn locked_unlocks(kn: &Knowledge, state: &State, char_id: &str, target_id: &str) -> (usize, usize) {
    let mut ach = 0;
    let mut reward = 0;
    for a in &kn.achievements {
        if !a.unlock.predictable || state.is_unlocked(a.id) {
            continue;
        }
        let hit = match a.unlock.kind.as_str() {
            "character_completion" => {
                a.unlock.character.as_deref() == Some(char_id)
                    && a.unlock.target.as_deref() == Some(target_id)
            }
            "boss_first_kill" => a.unlock.target.as_deref() == Some(target_id),
            _ => false,
        };
        if hit {
            if a.category == "completion_mark" {
                ach += 1;
            } else {
                reward += 1;
            }
        }
    }
    (ach, reward)
}

/// Probabilité de réussite = difficulté par défaut × facteur de maîtrise.
/// - winrate lissé (Beta) vers baseline ; sans données -> baseline -> skill=1.
/// - skill = winrate_lissé / baseline, borné [0.4, 1.8].
/// - proba finale bornée [0.02, 0.98].
fn probability(difficulty: f32, wins: usize, n: usize, cfg: &EvConfig) -> f32 {
    let base = cfg.baseline_winrate.max(1e-3);
    let smoothed = (wins as f32 + base * cfg.prior_k) / (n as f32 + cfg.prior_k);
    let skill = (smoothed / base).clamp(0.4, 1.8);
    (difficulty * skill).clamp(0.02, 0.98)
}

// --------------------------------------------------------------------------
// Calculs principaux
// --------------------------------------------------------------------------

/// Classement des prochaines actions par espérance de gain (EV décroissante).
pub fn next_best_actions(
    state: &State,
    kn: &Knowledge,
    runs: &[Run],
    routes: &[Route],
    cfg: &EvConfig,
    limit: usize,
) -> Vec<EvAction> {
    let mut out: Vec<EvAction> = Vec::new();

    for ch in &kn.characters {
        let (wins, n) = char_record(runs, &ch.id);
        for route in routes {
            let mut fills = Vec::new();
            let mut mark_gain = 0usize;
            let mut ach_gain = 0usize;
            let mut reward_gain = 0usize;

            for eid in &route.fills {
                let Some(e) = kn.ending(eid) else { continue };
                if mark_of(state, ch.save_index, e.mark_index) != MarkDifficulty::Hard {
                    mark_gain += 1;
                    fills.push(e.name.clone());
                }
                let (a, r) = locked_unlocks(kn, state, &ch.id, eid);
                ach_gain += a;
                reward_gain += r;
            }

            if mark_gain == 0 && ach_gain == 0 && reward_gain == 0 {
                continue; // rien à gagner ici
            }

            let value = cfg.w_mark * mark_gain as f32
                + cfg.w_ach * ach_gain as f32
                + cfg.w_reward * reward_gain as f32;
            let probability = probability(route.difficulty_default, wins, n, cfg);
            let ev = value * probability;
            let confidence = n as f32 / (n as f32 + cfg.prior_k);

            let why = build_why(mark_gain, &fills, ach_gain, reward_gain, probability);

            out.push(EvAction {
                character_id: ch.id.clone(),
                character_name: ch.name.clone(),
                route_id: route.id.clone(),
                route_note: route.note.clone(),
                fills,
                mark_gain,
                ach_gain,
                reward_gain,
                value,
                probability,
                ev,
                confidence,
                based_on_runs: n,
                why,
            });
        }
    }

    out.sort_by(|a, b| {
        b.ev
            .partial_cmp(&a.ev)
            .unwrap_or(std::cmp::Ordering::Equal)
            // départage stable : plus de marques d'abord, puis nom.
            .then(b.mark_gain.cmp(&a.mark_gain))
            .then(a.character_name.cmp(&b.character_name))
    });
    out.truncate(limit);
    out
}

fn build_why(mark_gain: usize, fills: &[String], ach: usize, reward: usize, p: f32) -> String {
    let mut parts = Vec::new();
    if mark_gain > 0 {
        parts.push(format!(
            "coche {mark_gain} marque{} Hard ({})",
            if mark_gain > 1 { "s" } else { "" },
            fills.join(", ")
        ));
    }
    if ach > 0 {
        parts.push(format!("{ach} succès de complétion"));
    }
    if reward > 0 {
        parts.push(format!("{reward} objet{}", if reward > 1 { "s" } else { "" }));
    }
    let gains = if parts.is_empty() { "rien de neuf".to_string() } else { parts.join(" + ") };
    format!("Ce run {gains}. Réussite estimée : {:.0} %.", (p * 100.0).round())
}

/// Marques qui bloquent le plus Dead God : cochées Hard chez le moins de persos.
pub fn bottlenecks(
    state: &State,
    kn: &Knowledge,
    routes: &[Route],
    limit: usize,
) -> Vec<Bottleneck> {
    // difficulté par ending = min des routes qui le cochent (la voie la plus « facile »).
    let difficulty_of = |ending_id: &str| -> f32 {
        routes
            .iter()
            .filter(|r| r.fills.iter().any(|f| f == ending_id))
            .map(|r| r.difficulty_default)
            .fold(f32::INFINITY, f32::min)
            .to_owned()
    };

    let mut out: Vec<Bottleneck> = kn
        .endings
        .iter()
        .map(|e| {
            let chars_missing = kn
                .characters
                .iter()
                .filter(|c| mark_of(state, c.save_index, e.mark_index) != MarkDifficulty::Hard)
                .count();
            let d = difficulty_of(&e.id);
            Bottleneck {
                ending_id: e.id.clone(),
                ending_name: e.name.clone(),
                chars_missing,
                difficulty_default: if d.is_finite() { d } else { 0.5 },
            }
        })
        .filter(|b| b.chars_missing > 0)
        .collect();

    // le plus de persos manquants d'abord ; à égalité, la route la plus dure d'abord.
    out.sort_by(|a, b| {
        b.chars_missing.cmp(&a.chars_missing).then(
            a.difficulty_default
                .partial_cmp(&b.difficulty_default)
                .unwrap_or(std::cmp::Ordering::Equal),
        )
    });
    out.truncate(limit);
    out
}

/// Persos les plus proches de la complétion totale (Hard partout).
pub fn almost_there(state: &State, kn: &Knowledge, limit: usize) -> Vec<AlmostThere> {
    let mut out: Vec<AlmostThere> = kn
        .characters
        .iter()
        .map(|c| {
            let missing: Vec<String> = kn
                .endings
                .iter()
                .filter(|e| mark_of(state, c.save_index, e.mark_index) != MarkDifficulty::Hard)
                .map(|e| e.name.clone())
                .collect();
            AlmostThere {
                character_id: c.id.clone(),
                character_name: c.name.clone(),
                missing_marks: missing.len(),
                missing_names: missing,
            }
        })
        .filter(|a| a.missing_marks > 0)
        .collect();

    // le moins de marques manquantes d'abord (= le plus proche de finir).
    out.sort_by(|a, b| a.missing_marks.cmp(&b.missing_marks).then(a.character_name.cmp(&b.character_name)));
    out.truncate(limit);
    out
}

/// Estimation (volontairement grossière, honnête) du chemin restant vers Dead God.
pub fn dead_god_eta(state: &State, runs: &[Run], cfg: &EvConfig) -> DeadGodEta {
    let remaining = state.dead_god_remaining();
    let counted: Vec<&Run> = runs.iter().filter(|r| is_counted(r)).collect();
    let n = counted.len();
    let wins = counted.iter().filter(|r| is_win(r)).count();
    let winrate = if n > 0 { Some(wins as f32 / n as f32) } else { None };

    let per_win = cfg.avg_marks_per_win.max(0.1);
    let estimated_winning_runs = Some((remaining as f32 / per_win).ceil() as usize);
    let estimated_attempts = match winrate {
        Some(w) if w > 0.0 => {
            estimated_winning_runs.map(|r| (r as f32 / w).ceil() as usize)
        }
        _ => None,
    };

    let note = if n == 0 {
        "Estimation indisponible : joue quelques runs avec le mod de stats pour calibrer ton winrate."
            .to_string()
    } else {
        format!(
            "Projection grossière : ~{:.1} marque(s) par run gagnant, winrate {:.0} %. \
             S'affine au fil de tes runs.",
            per_win,
            winrate.unwrap_or(0.0) * 100.0
        )
    };

    DeadGodEta {
        remaining,
        total: crate::engine::DEAD_GOD_TOTAL,
        winrate,
        based_on_runs: n,
        estimated_winning_runs,
        estimated_attempts,
        note,
    }
}

/// Rapport complet de l'optimiseur (une seule commande pour la vue).
pub fn optimizer(
    state: &State,
    kn: &Knowledge,
    runs: &[Run],
    routes: &[Route],
    cfg: &EvConfig,
    limit: usize,
) -> OptimizerReport {
    let based_on_runs = runs.iter().filter(|r| is_counted(r)).count();
    OptimizerReport {
        actions: next_best_actions(state, kn, runs, routes, cfg, limit),
        bottlenecks: bottlenecks(state, kn, routes, 6),
        almost_there: almost_there(state, kn, 6),
        eta: dead_god_eta(state, runs, cfg),
        based_on_runs,
    }
}

// ===========================================================================
// Tests déterministes
// ===========================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::{Achievement, Character, Ending, Unlock};
    use crate::overrides::Overrides;
    use crate::save_parser::{
        Edition, Mark, SaveData, NUM_ACHIEVEMENTS, NUM_CHARACTERS, NUM_MARKS,
    };
    use std::collections::HashMap;

    fn mk(d: MarkDifficulty) -> Mark {
        Mark { solo: d, online: MarkDifficulty::None, effective: d }
    }
    fn empty_grid() -> Vec<Vec<Mark>> {
        vec![vec![mk(MarkDifficulty::None); NUM_MARKS]; NUM_CHARACTERS]
    }
    fn save(unlocked: &[u32], marks: Vec<Vec<Mark>>) -> SaveData {
        let mut ach = vec![false; NUM_ACHIEVEMENTS];
        for &id in unlocked {
            ach[(id - 1) as usize] = true;
        }
        SaveData {
            edition: Edition::RepentancePlus,
            version: 0x82,
            checksum_ok: true,
            achievements: ach,
            marks_reliable: true,
            marks,
        }
    }
    fn char_completion(id: u32, ch: &str, target: &str) -> Achievement {
        Achievement {
            id,
            name: format!("compl-{id}"),
            description: "d".into(),
            category: "completion_mark".into(),
            dlc: "repentance".into(),
            hidden: false,
            unlock: Unlock {
                text: "t".into(),
                kind: "character_completion".into(),
                character: Some(ch.into()),
                target: Some(target.into()),
                predictable: true,
            },
            reward: "objet".into(),
        }
    }
    fn boss_item(id: u32, target: &str) -> Achievement {
        Achievement {
            id,
            name: format!("item-{id}"),
            description: "d".into(),
            category: "boss".into(),
            dlc: "afterbirth".into(),
            hidden: false,
            unlock: Unlock {
                text: "t".into(),
                kind: "boss_first_kill".into(),
                character: None,
                target: Some(target.into()),
                predictable: true,
            },
            reward: "familier".into(),
        }
    }
    fn kn() -> Knowledge {
        Knowledge {
            characters: vec![
                Character { id: "isaac".into(), name: "Isaac".into(), kind: "regular".into(), dlc: "rebirth".into(), save_index: 0 },
                Character { id: "cain".into(), name: "Cain".into(), kind: "regular".into(), dlc: "rebirth".into(), save_index: 2 },
            ],
            endings: vec![
                Ending { id: "mother".into(), name: "Mother".into(), mark_index: 10, hard_matters: true },
                Ending { id: "beast".into(), name: "The Beast".into(), mark_index: 11, hard_matters: true },
                Ending { id: "hush".into(), name: "Hush".into(), mark_index: 8, hard_matters: true },
            ],
            achievements: vec![
                char_completion(470, "isaac", "beast"),
                boss_item(502, "hush"),
            ],
            routing_tips: vec![],
        }
    }
    fn routes() -> Vec<Route> {
        vec![
            Route { id: "beast_via_mother".into(), fills: vec!["mother".into(), "beast".into()], difficulty_default: 0.4, note: "combo".into() },
            Route { id: "hush".into(), fills: vec!["hush".into()], difficulty_default: 0.45, note: "hush".into() },
        ]
    }
    fn run(ch: &str, outcome: &str) -> Run {
        Run {
            run_id: format!("{ch}-{outcome}-{}", rand_id()),
            slot: 1,
            character: ch.into(),
            player_type: 0,
            started_frame: 0,
            ended_frame: Some(1),
            ended: true,
            outcome: Some(outcome.into()),
            ending: None,
            deepest_stage: 8,
            hits_total: 1,
            shielded_hits: 0,
            hits_by_source: HashMap::new(),
            hits_by_stage: HashMap::new(),
            hits: vec![],
            rooms_cleared: None,
            kills: None,
            boss_kills: None,
            duration_frames: Some(1),
        }
    }
    fn rand_id() -> u64 {
        use std::sync::atomic::{AtomicU64, Ordering};
        static C: AtomicU64 = AtomicU64::new(0);
        C.fetch_add(1, Ordering::Relaxed)
    }

    #[test]
    fn cold_start_probability_equals_route_difficulty() {
        let cfg = EvConfig::default();
        // aucune donnée -> skill=1 -> proba = difficulté (bornée).
        let p = probability(0.4, 0, 0, &cfg);
        assert!((p - 0.4).abs() < 1e-4, "p={p}");
    }

    #[test]
    fn skill_scales_probability_up_with_wins() {
        let cfg = EvConfig::default();
        let low = probability(0.4, 0, 0, &cfg);
        let high = probability(0.4, 10, 10, &cfg); // 100% winrate -> skill haut
        assert!(high > low, "high={high} low={low}");
        assert!(high <= 0.98);
    }

    #[test]
    fn action_value_counts_marks_ach_and_rewards() {
        let cfg = EvConfig::default();
        let st = State::build(&save(&[], empty_grid()), &kn(), &Overrides::default());
        let acts = next_best_actions(&st, &kn(), &[], &routes(), &cfg, 20);
        // isaac + beast_via_mother : 2 marques, +1 succès complétion (470), +1 objet (502 via hush? non).
        let a = acts
            .iter()
            .find(|a| a.character_id == "isaac" && a.route_id == "beast_via_mother")
            .expect("action isaac/beast_via_mother");
        assert_eq!(a.mark_gain, 2); // mother + beast pas Hard
        assert_eq!(a.ach_gain, 1); // 470 = compl isaac/beast
        assert_eq!(a.reward_gain, 0); // 502 cible hush, pas dans cette route
        // valeur = 3*2 + 1*1 + 1.5*0 = 7
        assert!((a.value - 7.0).abs() < 1e-4, "value={}", a.value);
    }

    #[test]
    fn best_action_is_highest_ev_first() {
        let cfg = EvConfig::default();
        let st = State::build(&save(&[], empty_grid()), &kn(), &Overrides::default());
        let acts = next_best_actions(&st, &kn(), &[], &routes(), &cfg, 20);
        assert!(!acts.is_empty());
        // Trié par EV décroissante.
        for w in acts.windows(2) {
            assert!(w[0].ev >= w[1].ev - 1e-6);
        }
    }

    #[test]
    fn already_hard_marks_are_not_recounted() {
        let cfg = EvConfig::default();
        let mut grid = empty_grid();
        grid[0][10] = mk(MarkDifficulty::Hard); // isaac mother déjà Hard
        grid[0][11] = mk(MarkDifficulty::Hard); // isaac beast déjà Hard
        let st = State::build(&save(&[470], grid), &kn(), &Overrides::default());
        let acts = next_best_actions(&st, &kn(), &[], &routes(), &cfg, 20);
        // isaac/beast_via_mother : marques déjà Hard + 470 débloqué -> action supprimée.
        assert!(acts.iter().all(|a| !(a.character_id == "isaac" && a.route_id == "beast_via_mother")));
    }

    #[test]
    fn bottleneck_flags_most_missing_ending() {
        let mut grid = empty_grid();
        // isaac a mother+beast Hard ; cain n'a rien -> beast & mother manquent chez 1 (cain).
        grid[0][10] = mk(MarkDifficulty::Hard);
        grid[0][11] = mk(MarkDifficulty::Hard);
        let st = State::build(&save(&[], grid), &kn(), &Overrides::default());
        let b = bottlenecks(&st, &kn(), &routes(), 6);
        // hush manque chez les 2 persos -> en tête.
        assert_eq!(b[0].ending_id, "hush");
        assert_eq!(b[0].chars_missing, 2);
    }

    #[test]
    fn almost_there_orders_closest_first() {
        let mut grid = empty_grid();
        // cain : 2 des 3 marques en Hard -> il ne lui manque qu'1 (le plus proche).
        grid[2][10] = mk(MarkDifficulty::Hard);
        grid[2][11] = mk(MarkDifficulty::Hard);
        let st = State::build(&save(&[], grid), &kn(), &Overrides::default());
        let a = almost_there(&st, &kn(), 6);
        assert_eq!(a[0].character_id, "cain");
        assert_eq!(a[0].missing_marks, 1);
    }

    #[test]
    fn eta_uses_winrate_when_runs_exist() {
        let cfg = EvConfig::default();
        let st = State::build(&save(&[], empty_grid()), &kn(), &Overrides::default());
        let runs = vec![run("isaac", "win"), run("isaac", "death")]; // winrate 0.5
        let eta = dead_god_eta(&st, &runs, &cfg);
        assert_eq!(eta.based_on_runs, 2);
        assert!((eta.winrate.unwrap() - 0.5).abs() < 1e-4);
        assert!(eta.estimated_attempts.is_some());
    }

    #[test]
    fn eta_no_runs_is_honest() {
        let cfg = EvConfig::default();
        let st = State::build(&save(&[], empty_grid()), &kn(), &Overrides::default());
        let eta = dead_god_eta(&st, &[], &cfg);
        assert_eq!(eta.based_on_runs, 0);
        assert!(eta.winrate.is_none());
        assert!(eta.estimated_attempts.is_none());
    }
}
