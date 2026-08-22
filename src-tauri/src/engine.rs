// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! engine - cross-references the save with the knowledge base: per-achievement status,
//! per-character marks, overall %, distance to Dead God, predictor, and roadmap.
//! Manual overrides are applied ON TOP OF the parsed data.

use serde::Serialize;

use crate::knowledge::Knowledge;
use crate::overrides::Overrides;
use crate::save_parser::{Edition, MarkDifficulty, SaveData, NUM_ACHIEVEMENTS, NUM_CHARACTERS, NUM_MARKS};

pub const DEAD_GOD_TOTAL: usize = NUM_CHARACTERS * NUM_MARKS; // 34 × 12 = 408

/// The effective state after overrides have been applied.
pub struct State {
    /// index = secret_id - 1; is it unlocked?
    pub ach: Vec<bool>,
    pub ach_overridden: Vec<bool>,
    /// [char_save_index][mark_index] -> effective difficulty
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
        (1..=NUM_ACHIEVEMENTS).contains(&i) && self.ach[i - 1]
    }

    pub fn unlocked_count(&self) -> usize {
        self.ach.iter().filter(|&&b| b).count()
    }

    /// Missing Hard marks (34 x 12) = the distance to Dead God.
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
// Command outputs
// --------------------------------------------------------------------------

#[derive(Serialize)]
pub struct CategoryStat {
    pub category: String,
    pub unlocked: usize,
    pub total: usize,
}

/// Hard/Normal counts for one mark (ending) across the 34 characters - feeds the
/// jauge Dead God (12 anneaux).
#[derive(Serialize)]
pub struct EndingMarkCount {
    pub ending_id: String,
    pub ending_name: String,
    pub hard: usize,
    pub normal: usize,
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
    pub dead_god_by_ending: Vec<EndingMarkCount>,
    pub full_characters: usize,
    pub marks_reliable: bool,
    pub checksum_ok: bool,
    pub edition: Edition,
    pub has_overrides: bool,
}

pub fn dashboard(state: &State, kn: &Knowledge, ov: &Overrides) -> Dashboard {
    let total_unlocked = state.unlocked_count();
    let percent = (total_unlocked as f32) / (NUM_ACHIEVEMENTS as f32) * 100.0;

    // Breakdown by category.
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

    // Counts per ending (mark_index) across the 34 characters, for the Dead God gauge.
    let dead_god_by_ending = kn
        .endings
        .iter()
        .map(|e| {
            let mut hard = 0;
            let mut normal = 0;
            for c in &kn.characters {
                match state.mark_for(c.save_index, e.mark_index) {
                    MarkDifficulty::Hard => hard += 1,
                    MarkDifficulty::Normal => normal += 1,
                    _ => {}
                }
            }
            EndingMarkCount { ending_id: e.id.clone(), ending_name: e.name.clone(), hard, normal }
        })
        .collect();

    Dashboard {
        total_unlocked,
        total: NUM_ACHIEVEMENTS,
        percent,
        dead_god_remaining: state.dead_god_remaining(),
        dead_god_total: DEAD_GOD_TOTAL,
        categories,
        next_targets: next_targets(state, kn, 5),
        dead_god_by_ending,
        full_characters: kn
            .characters
            .iter()
            .filter(|c| (0..NUM_MARKS).all(|m| state.mark_for(c.save_index, m) == MarkDifficulty::Hard))
            .count(),
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

/// A character is "unlocked" when the achievement of the same name (character category)
/// is unlocked; otherwise it is assumed unlocked (the base characters).
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

/// LIGHTWEIGHT summary of a character: (unlocked, number of Hard marks).
/// Used by the lists (34 characters): avoids building a full `CharacterDetail`,
/// which scans all 641 achievements for every ending, just to produce two counters.
pub fn character_summary(state: &State, kn: &Knowledge, ch: &crate::knowledge::Character) -> (bool, usize) {
    let hard = kn
        .endings
        .iter()
        .filter(|e| state.mark_for(ch.save_index, e.mark_index) == MarkDifficulty::Hard)
        .count();
    (character_unlocked(state, kn, &ch.name), hard)
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
            // character_completion achievements tied to (this character, this ending) that are still locked.
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

    // Relevant tips: those that apply to an ending this character still has to do
    // (applies_to = ending IDs) OR to the character itself (a character ID).
    let mut relevant: std::collections::HashSet<&str> =
        todo.iter().map(|t| t.ending_id.as_str()).collect();
    relevant.insert(ch.id.as_str());
    let routing_tips: Vec<_> = kn
        .routing_tips
        .iter()
        .filter(|t| t.applies_to.iter().any(|a| relevant.contains(a.as_str())))
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

/// An achievement is triggered by (char, target) when:
/// - it is a character_completion with character==char && target==target, OR
/// - it is a boss_first_kill with target==target (character-independent).
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
        format!("This run would unlock {} achievement(s) and fill the \"{}\" mark.", new_unlocks.len(), ending.name)
    } else if advances_dead_god {
        format!("Nothing new to unlock, but it fills or upgrades the \"{}\" mark (useful for Dead God).", ending.name)
    } else {
        "Nothing new: everything this combo can give is already unlocked, and the mark is already Hard.".to_string()
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

/// Reverse view: (character, target) pairs ranked by how many new unlocks they give,
/// taking missing Hard marks into account.
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
    out.sort_by_key(|s| std::cmp::Reverse((s.new_unlocks, s.fills_hard_mark)));
    out.truncate(limit);
    out
}

// --------------------------------------------------------------------------
// The signature 34 x 12 grid (the completionist's board)
// --------------------------------------------------------------------------

#[derive(Serialize)]
pub struct MatrixChar {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub unlocked: bool,
    pub hard: usize,
}

#[derive(Serialize)]
pub struct MatrixEnding {
    pub id: String,
    pub name: String,
}

#[derive(Serialize)]
pub struct MarksMatrix {
    pub characters: Vec<MatrixChar>,
    pub endings: Vec<MatrixEnding>,
    /// cells[char_index][ending_index] = the mark's status.
    pub cells: Vec<Vec<MarkDifficulty>>,
    /// number of Hard marks per ending (column) - the bottleneck at a glance.
    pub column_hard: Vec<usize>,
}

pub fn marks_matrix(state: &State, kn: &Knowledge) -> MarksMatrix {
    let endings: Vec<MatrixEnding> = kn
        .endings
        .iter()
        .map(|e| MatrixEnding { id: e.id.clone(), name: e.name.clone() })
        .collect();
    let mut column_hard = vec![0usize; kn.endings.len()];
    let mut characters = Vec::new();
    let mut cells = Vec::new();
    for c in &kn.characters {
        let row: Vec<MarkDifficulty> = kn
            .endings
            .iter()
            .enumerate()
            .map(|(j, e)| {
                let d = state.mark_for(c.save_index, e.mark_index);
                if d == MarkDifficulty::Hard {
                    column_hard[j] += 1;
                }
                d
            })
            .collect();
        let hard = row.iter().filter(|&&d| d == MarkDifficulty::Hard).count();
        characters.push(MatrixChar {
            id: c.id.clone(),
            name: c.name.clone(),
            kind: c.kind.clone(),
            unlocked: character_unlocked(state, kn, &c.name),
            hard,
        });
        cells.push(row);
    }
    MarksMatrix { characters, endings, cells, column_hard }
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

    // 1) Mother + Beast on the remaining regular characters.
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
        title: "Finish Mother + The Beast (regular characters, Hard)".into(),
        detail: "Alternate path (Mausoleum, Corpse, Mother, then Home and Beast). On Hard, for the gold mark.".into(),
        done: mb_done,
        total: mb_total,
    });

    // 2) The characters that lag behind the most (missing Hard marks).
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
    late.sort_by_key(|c| std::cmp::Reverse(c.1));
    let late_names: Vec<String> = late.iter().take(3).map(|(n, m)| format!("{n} ({m} marks)")).collect();
    steps.push(RoadmapStep {
        title: "Complete the characters that lag behind".into(),
        detail: if late_names.is_empty() {
            "Every character is fully done on Hard 🎉".into()
        } else {
            format!("Start with: {}.", late_names.join(", "))
        },
        done: DEAD_GOD_TOTAL - state.dead_god_remaining(),
        total: DEAD_GOD_TOTAL,
    });

    // 3) Unlock and complete the remaining Tainted characters.
    let tainted: Vec<_> = kn.characters.iter().filter(|c| c.kind == "tainted").collect();
    let tainted_total = tainted.len() * NUM_MARKS;
    let tainted_done: usize = tainted
        .iter()
        .map(|c| (0..NUM_MARKS).filter(|&m| state.mark_for(c.save_index, m) == MarkDifficulty::Hard).count())
        .sum();
    steps.push(RoadmapStep {
        title: "Complete the Tainted characters".into(),
        detail: "The 17 Tainted characters also count toward Dead God (Hard marks).".into(),
        done: tainted_done,
        total: tainted_total,
    });

    // 4) Clean up Boss Rush / Hush / Greed for the remaining items (predictable achievements).
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
        title: "Clean up Boss Rush / Hush / Greed / Mega Satan / Delirium".into(),
        detail: "Remaining items and familiars locked behind these bosses.".into(),
        done: cleanup_total - cleanup_locked,
        total: cleanup_total,
    });

    Roadmap {
        steps,
        dead_god_remaining: state.dead_god_remaining(),
        dead_god_total: DEAD_GOD_TOTAL,
    }
}

// ===========================================================================
// Deterministic tests (synthetic states mapped to expected outputs).
// ===========================================================================
#[cfg(test)]
mod tests {
    use super::*;
    use crate::knowledge::{Achievement, Character, Ending, Unlock};
    use crate::save_parser::Mark;

    fn mark(d: MarkDifficulty) -> Mark {
        Mark { solo: d, online: MarkDifficulty::None, effective: d }
    }

    /// A 34x12 marks grid with everything empty.
    fn empty_grid() -> Vec<Vec<Mark>> {
        vec![vec![mark(MarkDifficulty::None); NUM_MARKS]; NUM_CHARACTERS]
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

    fn char_completion(id: u32, name: &str, ch: &str, target: &str) -> Achievement {
        Achievement {
            id,
            name: name.into(),
            description: "Unlocked a new item.".into(),
            category: "completion_mark".into(),
            dlc: "repentance".into(),
            hidden: false,
            unlock: Unlock {
                text: format!("Defeat {target} as {ch}"),
                kind: "character_completion".into(),
                character: Some(ch.into()),
                target: Some(target.into()),
                predictable: true,
            },
            reward: format!("{name} (objet)"),
        }
    }

    fn boss_kill(id: u32, name: &str, target: &str) -> Achievement {
        Achievement {
            id,
            name: name.into(),
            description: "Unlocked a new item.".into(),
            category: "boss".into(),
            dlc: "afterbirth_plus".into(),
            hidden: false,
            unlock: Unlock {
                text: format!("Defeat {target}"),
                kind: "boss_first_kill".into(),
                character: None,
                target: Some(target.into()),
                predictable: true,
            },
            reward: format!("{name} (familier)"),
        }
    }

    fn cumulative(id: u32, name: &str) -> Achievement {
        Achievement {
            id,
            name: name.into(),
            description: "misc".into(),
            category: "misc".into(),
            dlc: "afterbirth".into(),
            hidden: false,
            unlock: Unlock {
                text: "Blow up 30 tinted rocks".into(),
                kind: "cumulative".into(),
                character: None,
                target: None,
                predictable: false,
            },
            reward: "—".into(),
        }
    }

    fn knowledge() -> Knowledge {
        Knowledge {
            characters: vec![
                Character { id: "isaac".into(), name: "Isaac".into(), kind: "regular".into(), dlc: "rebirth".into(), save_index: 0 },
                Character { id: "bethany".into(), name: "Bethany".into(), kind: "regular".into(), dlc: "repentance".into(), save_index: 15 },
            ],
            endings: vec![
                Ending { id: "hush".into(), name: "Hush".into(), mark_index: 8, hard_matters: true },
                Ending { id: "mother".into(), name: "Mother".into(), mark_index: 10, hard_matters: true },
                Ending { id: "beast".into(), name: "The Beast".into(), mark_index: 11, hard_matters: true },
            ],
            achievements: vec![
                char_completion(470, "Revelation", "bethany", "mother"),
                char_completion(441, "Options?", "isaac", "beast"),
                boss_kill(502, "Hushy", "hush"),
                cumulative(235, "1001%"),
            ],
            routing_tips: vec![],
        }
    }

    #[test]
    fn predict_unlocks_character_completion() {
        let kn = knowledge();
        let ov = Overrides::default();
        let st = State::build(&save(&[], empty_grid()), &kn, &ov);

        let p = predict(&st, &kn, "bethany", "mother").unwrap();
        assert_eq!(p.new_unlocks.len(), 1);
        assert_eq!(p.new_unlocks[0].id, 470);
        assert!(p.already_unlocked.is_empty());
        assert!(p.fills_mark);
        assert!(p.advances_dead_god);
    }

    #[test]
    fn predict_boss_first_kill_matches_any_character() {
        let kn = knowledge();
        let st = State::build(&save(&[], empty_grid()), &kn, &Overrides::default());
        // Hushy (boss_first_kill hush) must show up regardless of the character.
        let p = predict(&st, &kn, "isaac", "hush").unwrap();
        assert!(p.new_unlocks.iter().any(|a| a.id == 502));
    }

    #[test]
    fn predict_already_unlocked_gives_no_new() {
        let kn = knowledge();
        let st = State::build(&save(&[470], empty_grid()), &kn, &Overrides::default());
        let p = predict(&st, &kn, "bethany", "mother").unwrap();
        assert!(p.new_unlocks.is_empty());
        assert_eq!(p.already_unlocked.len(), 1);
        assert_eq!(p.already_unlocked[0].id, 470);
    }

    #[test]
    fn dead_god_counts_hard_marks_over_full_grid() {
        let kn = knowledge();
        let mut grid = empty_grid();
        grid[15][10] = mark(MarkDifficulty::Hard); // bethany mother
        grid[0][11] = mark(MarkDifficulty::Hard); // isaac beast
        let st = State::build(&save(&[], grid), &kn, &Overrides::default());
        let d = dashboard(&st, &kn, &Overrides::default());
        assert_eq!(d.dead_god_total, DEAD_GOD_TOTAL);
        assert_eq!(d.dead_god_remaining, DEAD_GOD_TOTAL - 2);
    }

    #[test]
    fn hard_mark_removes_dead_god_progress_but_still_predicts_new_unlock() {
        let kn = knowledge();
        let mut grid = empty_grid();
        grid[15][10] = mark(MarkDifficulty::Hard); // bethany mother already Hard
        let st = State::build(&save(&[], grid), &kn, &Overrides::default());
        let p = predict(&st, &kn, "bethany", "mother").unwrap();
        // The mark is already Hard, so no Dead God gain, but Revelation is still to unlock.
        assert!(!p.advances_dead_god);
        assert_eq!(p.new_unlocks.len(), 1);
    }

    #[test]
    fn override_forces_achievement_state() {
        let kn = knowledge();
        let mut ov = Overrides::default();
        ov.achievements.insert(470, true); // force Revelation to unlocked
        let st = State::build(&save(&[], empty_grid()), &kn, &ov);
        assert!(st.is_unlocked(470));
        let p = predict(&st, &kn, "bethany", "mother").unwrap();
        assert!(p.new_unlocks.is_empty());
        assert_eq!(p.already_unlocked.len(), 1);
    }

    #[test]
    fn next_targets_ranks_by_new_unlocks() {
        let kn = knowledge();
        let st = State::build(&save(&[], empty_grid()), &kn, &Overrides::default());
        let t = next_targets(&st, &kn, 10);
        assert!(!t.is_empty());
        // Every top suggestion must bring at least one unlock or one Hard mark.
        assert!(t.iter().all(|s| s.new_unlocks > 0 || s.fills_hard_mark));
        // Bethany + Mother (Revelation) must appear with 1 unlock.
        assert!(t.iter().any(|s| s.character_id == "bethany" && s.target_id == "mother" && s.new_unlocks == 1));
    }

    #[test]
    fn character_detail_lists_missing_mark_and_its_unlock() {
        let kn = knowledge();
        let st = State::build(&save(&[], empty_grid()), &kn, &Overrides::default());
        let d = character_detail(&st, &kn, "bethany").unwrap();
        // The Mother mark is still to do, and its todo entry references Revelation.
        let mother_todo = d.todo.iter().find(|t| t.ending_id == "mother").expect("todo mother");
        assert!(mother_todo.unlocks.iter().any(|u| u.id == 470));
    }
}
