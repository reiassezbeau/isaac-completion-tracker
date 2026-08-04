//! engine — croise la save × la base de connaissances : statut par succès, marks
//! par personnage, % global, distance à Dead God, prédicteur et roadmap.
//! Les overrides manuels sont appliqués PAR-DESSUS les données parsées.

use serde::Serialize;

use crate::knowledge::Knowledge;
use crate::overrides::Overrides;
use crate::save_parser::{Edition, MarkDifficulty, SaveData, NUM_ACHIEVEMENTS, NUM_CHARACTERS, NUM_MARKS};

pub const DEAD_GOD_TOTAL: usize = NUM_CHARACTERS * NUM_MARKS; // 34 × 12 = 408

/// État effectif après application des overrides.
pub struct State {
    /// index = secret_id - 1 ; débloqué ?
    pub ach: Vec<bool>,
    pub ach_overridden: Vec<bool>,
    /// [char_save_index][mark_index] -> difficulté effective
    pub marks: Vec<Vec<MarkDifficulty>>,
    pub marks_overridden: Vec<Vec<bool>>,
    pub marks_reliable: bool,
    pub edition: Edition,
    pub checksum_ok: bool,
}

impl State {
    pub fn build(save: &SaveData, kn: &Knowledge, ov: &Overrides) -> Self {
        let mut ach = save.achievements.clone();
        let mut ach_overridden = vec![false; NUM_ACHIEVEMENTS];
        for i in 0..NUM_ACHIEVEMENTS {
            if let Some(v) = ov.achievement((i + 1) as u32) {
                ach[i] = v;
                ach_overridden[i] = true;
            }
        }

        let mut marks = vec![vec![MarkDifficulty::None; NUM_MARKS]; NUM_CHARACTERS];
        let mut marks_overridden = vec![vec![false; NUM_MARKS]; NUM_CHARACTERS];
        for c in kn.characters.iter() {
            let idx = c.save_index.min(NUM_CHARACTERS - 1);
            for m in 0..NUM_MARKS {
                let base = save
                    .marks
                    .get(idx)
                    .and_then(|v| v.get(m))
                    .map(|mk| mk.effective)
                    .unwrap_or(MarkDifficulty::None);
                if let Some(o) = ov.mark(&c.id, m) {
                    marks[idx][m] = o;
                    marks_overridden[idx][m] = true;
                } else {
                    marks[idx][m] = base;
                }
            }
        }

        State {
            ach,
            ach_overridden,
            marks,
            marks_overridden,
            marks_reliable: save.marks_reliable,
            edition: save.edition,
            checksum_ok: save.checksum_ok,
        }
    }

    pub fn is_unlocked(&self, secret_id: u32) -> bool {
        let i = secret_id as usize;
        i >= 1 && i <= NUM_ACHIEVEMENTS && self.ach[i - 1]
    }

    pub fn unlocked_count(&self) -> usize {
        self.ach.iter().filter(|&&b| b).count()
    }

    /// Marks Hard manquantes (34 × 12) = distance à Dead God.
    pub fn dead_god_remaining(&self) -> usize {
        self.marks
            .iter()
            .flatten()
            .filter(|&&d| d != MarkDifficulty::Hard)
            .count()
    }

    fn mark_for(&self, save_index: usize, mark_index: usize) -> MarkDifficulty {
        self.marks
            .get(save_index)
            .and_then(|v| v.get(mark_index))
            .copied()
            .unwrap_or(MarkDifficulty::None)
    }
}

// --------------------------------------------------------------------------
// Sorties de commandes
// --------------------------------------------------------------------------

#[derive(Serialize)]
pub struct CategoryStat {
    pub category: String,
    pub unlocked: usize,
    pub total: usize,
}

#[derive(Serialize)]
pub struct TargetSuggestion {
    pub character_id: String,
    pub character_name: String,
    pub target_id: String,
    pub target_name: String,
    pub new_unlocks: usize,
    pub fills_hard_mark: bool,
}

#[derive(Serialize)]
pub struct Dashboard {
    pub total_unlocked: usize,
    pub total: usize,
    pub percent: f32,
    pub dead_god_remaining: usize,
    pub dead_god_total: usize,
    pub categories: Vec<CategoryStat>,
    pub next_targets: Vec<TargetSuggestion>,
    pub marks_reliable: bool,
    pub checksum_ok: bool,
    pub edition: Edition,
    pub has_overrides: bool,
}

pub fn dashboard(state: &State, kn: &Knowledge, ov: &Overrides) -> Dashboard {
    let total_unlocked = state.unlocked_count();
    let percent = (total_unlocked as f32) / (NUM_ACHIEVEMENTS as f32) * 100.0;

    // Répartition par catégorie.
    use std::collections::BTreeMap;
    let mut cats: BTreeMap<String, (usize, usize)> = BTreeMap::new();
    for a in &kn.achievements {
        let e = cats.entry(a.category.clone()).or_insert((0, 0));
        e.1 += 1;
        if state.is_unlocked(a.id) {
            e.0 += 1;
        }
    }
    let categories = cats
        .into_iter()
        .map(|(category, (unlocked, total))| CategoryStat { category, unlocked, total })
        .collect();

    Dashboard {
        total_unlocked,
        total: NUM_ACHIEVEMENTS,
        percent,
        dead_god_remaining: state.dead_god_remaining(),
        dead_god_total: DEAD_GOD_TOTAL,
        categories,
        next_targets: next_targets(state, kn, 5),
        marks_reliable: state.marks_reliable,
        checksum_ok: state.checksum_ok,
        edition: state.edition,
        has_overrides: !ov.is_empty(),
    }
}

#[derive(Serialize)]
pub struct AchievementRef {
    pub id: u32,
    pub name: String,
    pub reward: String,
    pub unlock_text: String,
}

#[derive(Serialize)]
pub struct CharacterMark {
    pub ending_id: String,
    pub ending_name: String,
    pub mark_index: usize,
    pub status: MarkDifficulty,
    pub overridden: bool,
}

#[derive(Serialize)]
pub struct CharacterTodo {
    pub ending_id: String,
    pub ending_name: String,
    pub current: MarkDifficulty,
    pub needs_hard: bool,
    pub unlocks: Vec<AchievementRef>,
}

#[derive(Serialize)]
pub struct CharacterDetail {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub dlc: String,
    pub character_unlocked: bool,
    pub marks: Vec<CharacterMark>,
    pub todo: Vec<CharacterTodo>,
    pub routing_tips: Vec<crate::knowledge::RoutingTip>,
    pub marks_reliable: bool,
}

/// Un personnage est « débloqué » si le succès de même nom (catégorie character)
/// est débloqué ; sinon considéré débloqué par défaut (persos de base).
fn character_unlocked(state: &State, kn: &Knowledge, char_name: &str) -> bool {
    let base = char_name.trim_start_matches("Tainted ").split(" (").next().unwrap_or(char_name);
    match kn
        .achievements
        .iter()
        .find(|a| a.category == "character" && (a.name == char_name || a.name == base))
    {
        Some(a) => state.is_unlocked(a.id),
        None => true,
    }
}

pub fn character_detail(state: &State, kn: &Knowledge, char_id: &str) -> Option<CharacterDetail> {
    let ch = kn.character(char_id)?;

    let mut marks = Vec::new();
    let mut todo = Vec::new();
    for ending in &kn.endings {
        let status = state.mark_for(ch.save_index, ending.mark_index);
        let overridden = state
            .marks_overridden
            .get(ch.save_index)
            .and_then(|v| v.get(ending.mark_index))
            .copied()
            .unwrap_or(false);
        marks.push(CharacterMark {
            ending_id: ending.id.clone(),
            ending_name: ending.name.clone(),
            mark_index: ending.mark_index,
            status,
            overridden,
        });

        if status != MarkDifficulty::Hard {
            // Succès character_completion associés à (ce perso, cet ending), encore verrouillés.
            let unlocks: Vec<AchievementRef> = kn
                .achievements
                .iter()
                .filter(|a| {
                    a.unlock.kind == "character_completion"
                        && a.unlock.character.as_deref() == Some(char_id)
                        && a.unlock.target.as_deref() == Some(ending.id.as_str())
                        && !state.is_unlocked(a.id)
                })
                .map(|a| AchievementRef {
                    id: a.id,
                    name: a.name.clone(),
                    reward: a.reward.clone(),
                    unlock_text: a.unlock.text.clone(),
                })
                .collect();
            todo.push(CharacterTodo {
                ending_id: ending.id.clone(),
                ending_name: ending.name.clone(),
                current: status,
                needs_hard: status == MarkDifficulty::Normal,
                unlocks,
            });
        }
    }

    let routing_tips: Vec<_> = kn
        .routing_tips
        .iter()
        .filter(|t| t.applies_to.iter().any(|a| a == char_id) || matches!(char_id, "bethany" | "jacob_esau") && t.applies_to.iter().any(|a| a == char_id))
        .cloned()
        .collect();

    Some(CharacterDetail {
        id: ch.id.clone(),
        name: ch.name.clone(),
        kind: ch.kind.clone(),
        dlc: ch.dlc.clone(),
        character_unlocked: character_unlocked(state, kn, &ch.name),
        marks,
        todo,
        routing_tips,
        marks_reliable: state.marks_reliable,
    })
}

#[derive(Serialize)]
pub struct Prediction {
    pub character_id: String,
    pub character_name: String,
    pub target_id: String,
    pub target_name: String,
    pub new_unlocks: Vec<AchievementRef>,
    pub already_unlocked: Vec<AchievementRef>,
    pub fills_mark: bool,
    pub current_mark: MarkDifficulty,
    pub advances_dead_god: bool,
    pub note: String,
}

/// Un succès est déclenché par (char, target) si :
/// - character_completion dont character==char && target==target, OU
/// - boss_first_kill dont target==target (indépendant du perso).
fn triggered_by(a: &crate::knowledge::Achievement, char_id: &str, target_id: &str) -> bool {
    if !a.unlock.predictable {
        return false;
    }
    match a.unlock.kind.as_str() {
        "character_completion" => {
            a.unlock.character.as_deref() == Some(char_id) && a.unlock.target.as_deref() == Some(target_id)
        }
        "boss_first_kill" => a.unlock.target.as_deref() == Some(target_id),
        _ => false,
    }
}

pub fn predict(state: &State, kn: &Knowledge, char_id: &str, target_id: &str) -> Option<Prediction> {
    let ch = kn.character(char_id)?;
    let ending = kn.ending(target_id)?;

    let mut new_unlocks = Vec::new();
    let mut already_unlocked = Vec::new();
    for a in &kn.achievements {
        if triggered_by(a, char_id, target_id) {
            let r = AchievementRef {
                id: a.id,
                name: a.name.clone(),
                reward: a.reward.clone(),
                unlock_text: a.unlock.text.clone(),
            };
            if state.is_unlocked(a.id) {
                already_unlocked.push(r);
            } else {
                new_unlocks.push(r);
            }
        }
    }

    let current_mark = state.mark_for(ch.save_index, ending.mark_index);
    let advances_dead_god = current_mark != MarkDifficulty::Hard;

    let note = if !new_unlocks.is_empty() {
        format!("Ce run débloquerait {} succès + coche la marque « {} ».", new_unlocks.len(), ending.name)
    } else if advances_dead_god {
        format!("Rien de nouveau à débloquer, mais coche/renforce la marque « {} » (utile pour Dead God).", ending.name)
    } else {
        "Rien de neuf : tout ce que ce combo peut donner est déjà débloqué, marque déjà en Hard.".to_string()
    };

    Some(Prediction {
        character_id: ch.id.clone(),
        character_name: ch.name.clone(),
        target_id: ending.id.clone(),
        target_name: ending.name.clone(),
        new_unlocks,
        already_unlocked,
        fills_mark: current_mark != MarkDifficulty::Hard,
        current_mark,
        advances_dead_god,
        note,
    })
}

/// Vue inverse : couples (perso, cible) classés par nb de nouveaux déblocages,
/// en tenant compte des marks Hard manquantes.
pub fn next_targets(state: &State, kn: &Knowledge, limit: usize) -> Vec<TargetSuggestion> {
    let mut out: Vec<TargetSuggestion> = Vec::new();
    for ch in &kn.characters {
        for ending in &kn.endings {
            let new_unlocks = kn
                .achievements
                .iter()
                .filter(|a| triggered_by(a, &ch.id, &ending.id) && !state.is_unlocked(a.id))
                .count();
            let fills_hard_mark = state.mark_for(ch.save_index, ending.mark_index) != MarkDifficulty::Hard;
            if new_unlocks > 0 || fills_hard_mark {
                out.push(TargetSuggestion {
                    character_id: ch.id.clone(),
                    character_name: ch.name.clone(),
                    target_id: ending.id.clone(),
                    target_name: ending.name.clone(),
                    new_unlocks,
                    fills_hard_mark,
                });
            }
        }
    }
    out.sort_by(|a, b| {
        b.new_unlocks
            .cmp(&a.new_unlocks)
            .then(b.fills_hard_mark.cmp(&a.fills_hard_mark))
    });
    out.truncate(limit);
    out
}

#[derive(Serialize)]
pub struct RoadmapStep {
    pub title: String,
    pub detail: String,
    pub done: usize,
    pub total: usize,
}

#[derive(Serialize)]
pub struct Roadmap {
    pub steps: Vec<RoadmapStep>,
    pub dead_god_remaining: usize,
    pub dead_god_total: usize,
}

pub fn roadmap(state: &State, kn: &Knowledge) -> Roadmap {
    let mut steps = Vec::new();

    // 1) Mother + Beast sur les persos réguliers restants.
    let mother = kn.ending("mother").map(|e| e.mark_index).unwrap_or(10);
    let beast = kn.ending("beast").map(|e| e.mark_index).unwrap_or(11);
    let regulars: Vec<_> = kn.characters.iter().filter(|c| c.kind == "regular").collect();
    let mb_total = regulars.len() * 2;
    let mb_done = regulars
        .iter()
        .map(|c| {
            (state.mark_for(c.save_index, mother) == MarkDifficulty::Hard) as usize
                + (state.mark_for(c.save_index, beast) == MarkDifficulty::Hard) as usize
        })
        .sum();
    steps.push(RoadmapStep {
        title: "Boucler Mother + The Beast (persos réguliers, Hard)".into(),
        detail: "Chemin alternatif (Mausoleum → Corpse → Mother, puis Home → Beast). En Hard pour la marque dorée.".into(),
        done: mb_done,
        total: mb_total,
    });

    // 2) Personnages les plus en retard (marks Hard manquantes).
    let mut late: Vec<(String, usize)> = kn
        .characters
        .iter()
        .map(|c| {
            let missing = (0..NUM_MARKS)
                .filter(|&m| state.mark_for(c.save_index, m) != MarkDifficulty::Hard)
                .count();
            (c.name.clone(), missing)
        })
        .filter(|(_, m)| *m > 0)
        .collect();
    late.sort_by(|a, b| b.1.cmp(&a.1));
    let late_names: Vec<String> = late.iter().take(3).map(|(n, m)| format!("{n} ({m} marks)")).collect();
    steps.push(RoadmapStep {
        title: "Compléter les personnages les plus en retard".into(),
        detail: if late_names.is_empty() {
            "Tous les persos sont complets en Hard 🎉".into()
        } else {
            format!("En priorité : {}.", late_names.join(", "))
        },
        done: DEAD_GOD_TOTAL - state.dead_god_remaining(),
        total: DEAD_GOD_TOTAL,
    });

    // 3) Débloquer/compléter les Tainted restants.
    let tainted: Vec<_> = kn.characters.iter().filter(|c| c.kind == "tainted").collect();
    let tainted_total = tainted.len() * NUM_MARKS;
    let tainted_done: usize = tainted
        .iter()
        .map(|c| (0..NUM_MARKS).filter(|&m| state.mark_for(c.save_index, m) == MarkDifficulty::Hard).count())
        .sum();
    steps.push(RoadmapStep {
        title: "Compléter les personnages Tainted".into(),
        detail: "Les 17 Tainted comptent aussi pour Dead God (marks Hard).".into(),
        done: tainted_done,
        total: tainted_total,
    });

    // 4) Nettoyer Boss Rush / Hush / Greed pour les items restants (succès predictibles).
    let cleanup_targets = ["boss_rush", "hush", "greed", "mega_satan", "delirium"];
    let cleanup_locked = kn
        .achievements
        .iter()
        .filter(|a| {
            a.unlock.predictable
                && a.unlock.target.as_deref().map(|t| cleanup_targets.contains(&t)).unwrap_or(false)
                && !state.is_unlocked(a.id)
        })
        .count();
    let cleanup_total = kn
        .achievements
        .iter()
        .filter(|a| a.unlock.predictable && a.unlock.target.as_deref().map(|t| cleanup_targets.contains(&t)).unwrap_or(false))
        .count();
    steps.push(RoadmapStep {
        title: "Nettoyer Boss Rush / Hush / Greed / Mega Satan / Delirium".into(),
        detail: "Items et familiers restants derrière ces boss.".into(),
        done: cleanup_total - cleanup_locked,
        total: cleanup_total,
    });

    Roadmap {
        steps,
        dead_god_remaining: state.dead_god_remaining(),
        dead_god_total: DEAD_GOD_TOTAL,
    }
}
