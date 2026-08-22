// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! stats_reader - reads and parses the JSON written by the companion mod
//! (`data/isaac-tracker-mod/save<slot>.dat`), per slot.
//!
//! TOLERANT parsing: the game's Lua runtime encodes EMPTY tables as `[]`
//! (an array), including for maps (an empty `hits_by_source` becomes `[]`). So we go
//! through `serde_json::Value` and extract defensively (an `[]` means an empty map),
//! plus tolerance for missing fields (old runs, evolving schema - guardrail §3.3).

use std::collections::HashMap;
use std::path::Path;

use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::paths;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HitEvent {
    pub frame: i64,
    pub stage: i64,
    pub stage_type: i64,
    pub source: String,
}

/// The last damage source taken (the cause of death if the run ends in a death).
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct DeathSource {
    #[serde(default)]
    pub source: String,
    #[serde(default)]
    pub entity_type: Option<i64>,
    #[serde(default)]
    pub stage: Option<i64>,
    #[serde(default)]
    pub frame: Option<i64>,
}

/// A run as rebuilt from the mod's JSON (missing fields are tolerated).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Run {
    pub run_id: String,
    #[serde(default)]
    pub slot: u8,
    #[serde(default)]
    pub character: String,
    #[serde(default)]
    pub player_type: i64,
    #[serde(default)]
    pub started_frame: i64,
    #[serde(default)]
    pub ended_frame: Option<i64>,
    #[serde(default)]
    pub ended: bool,
    /// "win" | "death" | "abandoned" | null (in progress)
    #[serde(default)]
    pub outcome: Option<String>,
    #[serde(default)]
    pub ending: Option<String>,
    #[serde(default)]
    pub deepest_stage: i64,
    #[serde(default)]
    pub hits_total: u32,
    #[serde(default)]
    pub shielded_hits: u32,
    #[serde(default)]
    pub hits_by_source: HashMap<String, u32>,
    #[serde(default)]
    pub hits_by_stage: HashMap<String, u32>,
    #[serde(default)]
    pub hits: Vec<HitEvent>,
    /// Wide fields (may be missing on older runs).
    #[serde(default)]
    pub rooms_cleared: Option<u32>,
    #[serde(default)]
    pub kills: Option<u32>,
    #[serde(default)]
    pub boss_kills: Option<u32>,
    #[serde(default)]
    pub duration_frames: Option<i64>,
    #[serde(default)]
    pub curses: Option<u32>,
    #[serde(default)]
    pub devil_deals: Option<u32>,
    #[serde(default)]
    pub final_stage: Option<i64>,
    #[serde(default)]
    pub final_stage_type: Option<i64>,
    /// Build snapshot (§7): the collectible IDs held at the end of the run.
    #[serde(default)]
    pub final_build: Vec<i64>,
    #[serde(default)]
    pub death_source: Option<DeathSource>,
}

// --- defensive extraction from serde_json::Value -------------------------

fn as_i64(v: &Value, k: &str) -> Option<i64> {
    v.get(k).and_then(|x| x.as_i64())
}
fn as_u32(v: &Value, k: &str) -> u32 {
    v.get(k).and_then(|x| x.as_u64()).unwrap_or(0) as u32
}
fn as_str(v: &Value, k: &str) -> Option<String> {
    v.get(k).and_then(|x| x.as_str()).map(|s| s.to_string())
}
fn as_bool(v: &Value, k: &str) -> bool {
    v.get(k).and_then(|x| x.as_bool()).unwrap_or(false)
}

/// A string->u32 map, tolerating `[]` (an empty table encoded as an array) as an empty map.
fn as_u32_map(v: &Value, k: &str) -> HashMap<String, u32> {
    match v.get(k) {
        Some(Value::Object(m)) => m
            .iter()
            .filter_map(|(k, val)| val.as_u64().map(|n| (k.clone(), n as u32)))
            .collect(),
        _ => HashMap::new(),
    }
}

fn parse_id_list(v: &Value, k: &str) -> Vec<i64> {
    match v.get(k) {
        Some(Value::Array(arr)) => arr.iter().filter_map(|x| x.as_i64()).collect(),
        _ => Vec::new(),
    }
}

fn parse_death_source(v: &Value) -> Option<DeathSource> {
    let d = v.get("death_source")?;
    if !d.is_object() {
        return None;
    }
    Some(DeathSource {
        source: d.get("source").and_then(|x| x.as_str()).unwrap_or("").to_string(),
        entity_type: d.get("entity_type").and_then(|x| x.as_i64()),
        stage: d.get("stage").and_then(|x| x.as_i64()),
        frame: d.get("frame").and_then(|x| x.as_i64()),
    })
}

fn parse_hits(v: &Value) -> Vec<HitEvent> {
    match v.get("hits") {
        Some(Value::Array(arr)) => arr
            .iter()
            .map(|h| HitEvent {
                frame: h.get("frame").and_then(|x| x.as_i64()).unwrap_or(0),
                stage: h.get("stage").and_then(|x| x.as_i64()).unwrap_or(0),
                stage_type: h.get("stage_type").and_then(|x| x.as_i64()).unwrap_or(0),
                source: h.get("source").and_then(|x| x.as_str()).unwrap_or("unknown").to_string(),
            })
            .collect(),
        _ => Vec::new(),
    }
}

fn parse_run(v: &Value, slot: u8) -> Option<Run> {
    let run_id = as_str(v, "run_id")?;
    let started_frame = as_i64(v, "started_frame").unwrap_or(0);
    let ended_frame = as_i64(v, "ended_frame");
    let duration_frames = ended_frame.map(|e| (e - started_frame).max(0));
    Some(Run {
        run_id,
        slot,
        character: as_str(v, "character").unwrap_or_else(|| "unknown".into()),
        player_type: as_i64(v, "player_type").unwrap_or(-1),
        started_frame,
        ended_frame,
        ended: as_bool(v, "ended"),
        outcome: as_str(v, "outcome"),
        ending: as_str(v, "ending"),
        deepest_stage: as_i64(v, "deepest_stage").unwrap_or(0),
        hits_total: as_u32(v, "hits_total"),
        shielded_hits: as_u32(v, "shielded_hits"),
        hits_by_source: as_u32_map(v, "hits_by_source"),
        hits_by_stage: as_u32_map(v, "hits_by_stage"),
        hits: parse_hits(v),
        rooms_cleared: v.get("rooms_cleared").and_then(|x| x.as_u64()).map(|n| n as u32),
        kills: v.get("kills").and_then(|x| x.as_u64()).map(|n| n as u32),
        boss_kills: v.get("boss_kills").and_then(|x| x.as_u64()).map(|n| n as u32),
        duration_frames,
        curses: v.get("curses").and_then(|x| x.as_u64()).map(|n| n as u32),
        devil_deals: v.get("devil_deals").and_then(|x| x.as_u64()).map(|n| n as u32),
        final_stage: as_i64(v, "final_stage"),
        final_stage_type: as_i64(v, "final_stage_type"),
        final_build: parse_id_list(v, "final_build"),
        death_source: parse_death_source(v),
    })
}

/// The contents of one mod save file (a slot). The slot is carried by each `Run`.
pub struct ModSlotData {
    pub current_run: Option<Run>,
    pub history: Vec<Run>,
}

fn slot_of_filename(path: &Path) -> u8 {
    path.file_name()
        .and_then(|s| s.to_str())
        .and_then(|s| s.chars().find(|c| c.is_ascii_digit()))
        .and_then(|c| c.to_digit(10))
        .map(|d| d as u8)
        .unwrap_or(0)
}

/// Parses one of the mod's `save<N>.dat` files.
pub fn read_mod_file(path: &Path) -> Option<ModSlotData> {
    let raw = std::fs::read_to_string(path).ok()?;
    let v: Value = serde_json::from_str(&raw).ok()?;
    let slot = slot_of_filename(path);
    let current_run = v.get("current_run").and_then(|cr| {
        if cr.is_object() {
            parse_run(cr, slot)
        } else {
            None
        }
    });
    let history = match v.get("history") {
        Some(Value::Array(arr)) => arr.iter().filter_map(|r| parse_run(r, slot)).collect(),
        _ => Vec::new(),
    };
    Some(ModSlotData { current_run, history })
}

/// Every run from the mod, across all slots (history + current_run), from the
/// possible data locations (Steam and/or Documents). Deduplicated by run_id.
pub fn read_all_runs() -> Vec<Run> {
    use std::collections::HashSet;
    let mut seen: HashSet<String> = HashSet::new();
    let mut out: Vec<Run> = Vec::new();

    for data in paths::data_candidates() {
        for name in [paths::MOD_FOLDER, "IsaacTracker"] {
            let dir = data.join(name);
            if !dir.is_dir() {
                continue;
            }
            for n in ['1', '2', '3'] {
                let f = dir.join(format!("save{n}.dat"));
                if let Some(slotdata) = read_mod_file(&f) {
                    for run in slotdata.history.into_iter().chain(slotdata.current_run) {
                        if seen.insert(run.run_id.clone()) {
                            out.push(run);
                        }
                    }
                }
            }
        }
    }
    out
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parses_tolerant_json_with_empty_maps_as_arrays() {
        // Reproduces the quirk: an empty hits_by_source encoded as `[]`.
        let raw = r#"{"schema":1,"next_index":2,"history":[
          {"run_id":"1-2-3","character":"blue_baby","player_type":4,"started_frame":10,
           "ended":true,"outcome":"death","deepest_stage":3,"hits_total":0,
           "hits":[],"hits_by_source":[],"hits_by_stage":[]}
        ]}"#;
        let v: Value = serde_json::from_str(raw).unwrap();
        let runs: Vec<Run> = match v.get("history") {
            Some(Value::Array(arr)) => arr.iter().filter_map(|r| parse_run(r, 1)).collect(),
            _ => vec![],
        };
        assert_eq!(runs.len(), 1);
        assert_eq!(runs[0].character, "blue_baby");
        assert_eq!(runs[0].hits_total, 0);
        assert!(runs[0].hits_by_source.is_empty());
        assert_eq!(runs[0].outcome.as_deref(), Some("death"));
    }

    #[test]
    fn parses_populated_maps() {
        let raw = r#"{"run_id":"9","character":"judas","player_type":3,"started_frame":0,
          "ended":false,"deepest_stage":2,"hits_total":2,
          "hits":[{"frame":100,"stage":2,"stage_type":2,"source":"enemy"}],
          "hits_by_source":{"enemy":1,"environment":1},"hits_by_stage":{"2-2":2}}"#;
        let v: Value = serde_json::from_str(raw).unwrap();
        let run = parse_run(&v, 2).unwrap();
        assert_eq!(run.hits_total, 2);
        assert_eq!(run.hits_by_source.get("enemy"), Some(&1));
        assert_eq!(run.hits.len(), 1);
        assert_eq!(run.slot, 2);
    }
}
