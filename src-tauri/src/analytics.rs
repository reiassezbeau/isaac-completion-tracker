// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! analytics - derived stats (Tier 2 & 3) computed on the fly from the archive.
//! DETERMINISTIC and 100% offline (no LLM). Tolerant of old or incomplete runs.

use std::collections::BTreeMap;

use serde::Serialize;

use crate::stats_reader::Run;

/// A "complete" run (one that counts toward stats/winrate) is closed by a win or
/// a death (abandoned, restarted, and in-progress runs are excluded).
fn is_counted(r: &Run) -> bool {
    matches!(r.outcome.as_deref(), Some("win") | Some("death"))
}
fn is_win(r: &Run) -> bool {
    r.outcome.as_deref() == Some("win")
}

#[derive(Debug, Clone, Serialize)]
pub struct CharacterStats {
    pub character: String,
    pub runs: usize,
    pub wins: usize,
    pub deaths: usize,
    pub winrate: f32,
    pub avg_hits: f32,
    pub min_hits: Option<u32>,
    pub avg_deepest_stage: f32,
    /// hits per floor (a proxy for cleanliness) - lower is cleaner.
    pub cleanliness: f32,
    /// average floor of the first hit (how long you stayed untouched).
    pub first_hit_stage_avg: Option<f32>,
}

#[derive(Serialize)]
pub struct StatsOverview {
    pub total_runs: usize,
    pub total_wins: usize,
    pub total_deaths: usize,
    pub overall_winrate: f32,
    pub avg_hits_per_run: f32,
    /// (source, total) that dealt the most hits - your "nemesis".
    pub nemesis: Option<(String, u32)>,
    pub hits_by_source: Vec<(String, u32)>,
    /// "stage-type" -> hits (heatmap), trie.
    pub hits_heatmap: Vec<(String, u32)>,
    /// hits_total for the last N counted runs (trend).
    pub hits_trend: Vec<u32>,
    pub per_character: Vec<CharacterStats>,
    /// "Wide field" aggregates (mod v0.2.0+) over the counted runs.
    pub total_kills: u64,
    pub total_boss_kills: u64,
    pub total_rooms_cleared: u64,
    pub total_devil_deals: u64,
}

#[derive(Serialize)]
pub struct CleanRecord {
    pub character: String,
    pub outcome: String,
    pub hits: u32,
    pub deepest_stage: i64,
}

#[derive(Serialize)]
pub struct Insights {
    pub cleanest_characters: Vec<CharacterStats>,
    pub bloodiest_characters: Vec<CharacterStats>,
    pub best_clean_runs: Vec<CleanRecord>,
    /// correlation (hits vs win) - expected to be negative (fewer hits means more wins).
    pub hits_win_correlation: Option<f32>,
    pub current_win_streak: usize,
    pub best_win_streak: usize,
    pub total_runs: usize,
}

fn char_stats(character: &str, runs: &[&Run]) -> CharacterStats {
    let n = runs.len();
    let wins = runs.iter().filter(|r| is_win(r)).count();
    let deaths = n - wins;
    let sum_hits: u32 = runs.iter().map(|r| r.hits_total).sum();
    let avg_hits = if n > 0 { sum_hits as f32 / n as f32 } else { 0.0 };
    let min_hits = runs.iter().map(|r| r.hits_total).min();
    let sum_stage: i64 = runs.iter().map(|r| r.deepest_stage).sum();
    let avg_deepest = if n > 0 { sum_stage as f32 / n as f32 } else { 0.0 };
    let cleanliness = if avg_deepest > 0.0 { avg_hits / avg_deepest } else { avg_hits };

    // Floor of the first hit: hits[0].stage if hit, otherwise deepest (untouched so far).
    let mut fh_sum = 0i64;
    let mut fh_n = 0usize;
    for r in runs {
        let s = r.hits.first().map(|h| h.stage).unwrap_or(r.deepest_stage);
        fh_sum += s;
        fh_n += 1;
    }
    let first_hit_stage_avg = if fh_n > 0 { Some(fh_sum as f32 / fh_n as f32) } else { None };

    CharacterStats {
        character: character.to_string(),
        runs: n,
        wins,
        deaths,
        winrate: if n > 0 { wins as f32 / n as f32 } else { 0.0 },
        avg_hits,
        min_hits,
        avg_deepest_stage: avg_deepest,
        cleanliness,
        first_hit_stage_avg,
    }
}

fn grouped_by_char(runs: &[Run]) -> BTreeMap<String, Vec<&Run>> {
    let mut m: BTreeMap<String, Vec<&Run>> = BTreeMap::new();
    for r in runs.iter().filter(|r| is_counted(r)) {
        m.entry(r.character.clone()).or_default().push(r);
    }
    m
}

pub fn overview(all: &[Run]) -> StatsOverview {
    let counted: Vec<&Run> = all.iter().filter(|r| is_counted(r)).collect();
    let total = counted.len();
    let wins = counted.iter().filter(|r| is_win(r)).count();

    let mut by_source: BTreeMap<String, u32> = BTreeMap::new();
    let mut heatmap: BTreeMap<String, u32> = BTreeMap::new();
    let mut sum_hits = 0u32;
    let (mut total_kills, mut total_boss_kills, mut total_rooms, mut total_deals) = (0u64, 0u64, 0u64, 0u64);
    for r in &counted {
        sum_hits += r.hits_total;
        total_kills += r.kills.unwrap_or(0) as u64;
        total_boss_kills += r.boss_kills.unwrap_or(0) as u64;
        total_rooms += r.rooms_cleared.unwrap_or(0) as u64;
        total_deals += r.devil_deals.unwrap_or(0) as u64;
        for (k, v) in &r.hits_by_source {
            *by_source.entry(k.clone()).or_default() += v;
        }
        for (k, v) in &r.hits_by_stage {
            *heatmap.entry(k.clone()).or_default() += v;
        }
    }
    let mut hits_by_source: Vec<(String, u32)> = by_source.into_iter().collect();
    hits_by_source.sort_by_key(|s| std::cmp::Reverse(s.1));
    let nemesis = hits_by_source.first().cloned();
    let hits_heatmap: Vec<(String, u32)> = heatmap.into_iter().collect();

    let hits_trend: Vec<u32> = counted.iter().rev().take(20).rev().map(|r| r.hits_total).collect();

    let mut per_character: Vec<CharacterStats> =
        grouped_by_char(all).into_iter().map(|(c, rs)| char_stats(&c, &rs)).collect();
    per_character.sort_by_key(|c| std::cmp::Reverse(c.runs));

    StatsOverview {
        total_runs: total,
        total_wins: wins,
        total_deaths: total - wins,
        overall_winrate: if total > 0 { wins as f32 / total as f32 } else { 0.0 },
        avg_hits_per_run: if total > 0 { sum_hits as f32 / total as f32 } else { 0.0 },
        nemesis,
        hits_by_source,
        hits_heatmap,
        hits_trend,
        per_character,
        total_kills,
        total_boss_kills,
        total_rooms_cleared: total_rooms,
        total_devil_deals: total_deals,
    }
}

pub fn character_stats(all: &[Run], char_id: &str) -> CharacterStats {
    let runs: Vec<&Run> = all.iter().filter(|r| is_counted(r) && r.character == char_id).collect();
    char_stats(char_id, &runs)
}

/// Pearson correlation between hits_total and win (1/0). None when there is too little data.
fn hits_win_correlation(runs: &[&Run]) -> Option<f32> {
    let n = runs.len();
    if n < 3 {
        return None;
    }
    let xs: Vec<f32> = runs.iter().map(|r| r.hits_total as f32).collect();
    let ys: Vec<f32> = runs.iter().map(|r| if is_win(r) { 1.0 } else { 0.0 }).collect();
    let mx = xs.iter().sum::<f32>() / n as f32;
    let my = ys.iter().sum::<f32>() / n as f32;
    let mut cov = 0.0;
    let mut vx = 0.0;
    let mut vy = 0.0;
    for i in 0..n {
        let dx = xs[i] - mx;
        let dy = ys[i] - my;
        cov += dx * dy;
        vx += dx * dx;
        vy += dy * dy;
    }
    if vx == 0.0 || vy == 0.0 {
        return None;
    }
    Some(cov / (vx.sqrt() * vy.sqrt()))
}

pub fn insights(all: &[Run]) -> Insights {
    let counted: Vec<&Run> = all.iter().filter(|r| is_counted(r)).collect();

    let mut per_char: Vec<CharacterStats> =
        grouped_by_char(all).into_iter().map(|(c, rs)| char_stats(&c, &rs)).collect();
    per_char.retain(|c| c.runs >= 1);

    let mut cleanest = per_char.clone();
    cleanest.sort_by(|a, b| a.avg_hits.partial_cmp(&b.avg_hits).unwrap_or(std::cmp::Ordering::Equal));
    let mut bloodiest = cleanest.clone();
    bloodiest.reverse();
    cleanest.truncate(8);
    bloodiest.truncate(8);

    // Records: the cleanest runs (fewest hits), completed ones only.
    let mut records: Vec<CleanRecord> = counted
        .iter()
        .map(|r| CleanRecord {
            character: r.character.clone(),
            outcome: r.outcome.clone().unwrap_or_default(),
            hits: r.hits_total,
            deepest_stage: r.deepest_stage,
        })
        .collect();
    records.sort_by(|a, b| a.hits.cmp(&b.hits).then(b.deepest_stage.cmp(&a.deepest_stage)));
    records.truncate(10);

    // Win streaks (archive order is roughly chronological).
    let mut best = 0usize;
    let mut cur = 0usize;
    for r in &counted {
        if is_win(r) {
            cur += 1;
            best = best.max(cur);
        } else {
            cur = 0;
        }
    }
    // current_win_streak = consecutive wins at the end of the list.
    let mut current = 0usize;
    for r in counted.iter().rev() {
        if is_win(r) {
            current += 1;
        } else {
            break;
        }
    }

    Insights {
        cleanest_characters: cleanest,
        bloodiest_characters: bloodiest,
        best_clean_runs: records,
        hits_win_correlation: hits_win_correlation(&counted),
        current_win_streak: current,
        best_win_streak: best,
        total_runs: counted.len(),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::collections::HashMap;

    fn run(id: &str, ch: &str, outcome: &str, hits: u32, deepest: i64) -> Run {
        Run {
            run_id: id.into(),
            slot: 1,
            character: ch.into(),
            player_type: 0,
            started_frame: 0,
            ended_frame: Some(100),
            ended: true,
            outcome: Some(outcome.into()),
            ending: None,
            deepest_stage: deepest,
            hits_total: hits,
            shielded_hits: 0,
            hits_by_source: HashMap::from([("enemy".to_string(), hits)]),
            hits_by_stage: HashMap::new(),
            hits: vec![],
            rooms_cleared: None,
            kills: None,
            boss_kills: None,
            duration_frames: Some(100),
            curses: None,
            devil_deals: None,
            final_stage: None,
            final_stage_type: None,
            final_build: vec![],
            death_source: None,
        }
    }

    #[test]
    fn overview_and_winrate() {
        let runs = vec![
            run("1", "isaac", "win", 2, 8),
            run("2", "isaac", "death", 10, 4),
            run("3", "eve", "win", 0, 10),
            run("4", "eve", "abandoned", 99, 1), // exclu (abandonne)
        ];
        let ov = overview(&runs);
        assert_eq!(ov.total_runs, 3); // abandonne exclu
        assert_eq!(ov.total_wins, 2);
        assert!((ov.overall_winrate - 2.0 / 3.0).abs() < 1e-5);
        // nemesis = enemy (seule source)
        assert_eq!(ov.nemesis.as_ref().unwrap().0, "enemy");
        // isaac : 2 runs, avg hits = 6
        let isaac = ov.per_character.iter().find(|c| c.character == "isaac").unwrap();
        assert_eq!(isaac.runs, 2);
        assert!((isaac.avg_hits - 6.0).abs() < 1e-5);
        assert_eq!(isaac.min_hits, Some(2));
    }

    #[test]
    fn insights_streaks_and_cleanliness() {
        let runs = vec![
            run("1", "isaac", "win", 1, 8),
            run("2", "isaac", "win", 2, 8),
            run("3", "cain", "death", 9, 3),
            run("4", "cain", "win", 0, 11),
        ];
        let ins = insights(&runs);
        assert_eq!(ins.best_win_streak, 2);
        assert_eq!(ins.current_win_streak, 1); // the last one is a win
        // the cleanest run has 0 hits
        assert_eq!(ins.best_clean_runs[0].hits, 0);
        assert_eq!(ins.total_runs, 4);
    }
}
