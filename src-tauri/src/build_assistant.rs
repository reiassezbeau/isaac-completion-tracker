// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! build_assistant - build analysis (non-real-time, app side).
//!
//! - Feature A: composition (item counts per role).
//! - Feature B: strengths and weaknesses (archetypes, gaps, redundancies) through
//!   configurable heuristics (`build_rules.json`).
//! - Feature C: "try synergy" - an estimated stat delta plus synergy notes
//!   (from the factual KB), a verdict, and a before/after radar (ORIGINAL data viz).
//!
//! DETERMINISTIC, 100% offline, no LLM. The stat delta is an ESTIMATE
//! (Isaac's damage formula is non-trivial) and is flagged as such whenever an item
//! is multiplicative, proc-based, or conditional. No ripped assets: facts only.

use std::collections::{BTreeMap, HashMap};
use std::path::Path;

use serde::{Deserialize, Serialize};

use crate::knowledge::Innate;

// --------------------------------------------------------------------------
// Knowledge base (mirrors item_kb.json, generated at dev time)
// --------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct StatEffect {
    pub op: String, // "flat" | "mult"
    pub value: f32,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct ItemKb {
    pub id: i64,
    pub name: String,
    pub roles: Vec<String>,
    #[serde(default)]
    pub stat_effects: BTreeMap<String, StatEffect>,
    #[serde(default)]
    pub grants_tear_flags: Vec<String>,
    #[serde(default)]
    pub grants_flight: bool,
    #[serde(default)]
    pub is_tears_replacement: bool,
    #[serde(default)]
    pub is_familiar: bool,
    #[serde(default)]
    pub hearts: i32,
    pub complexity: String, // "flat" | "proc" | "conditional"
    #[serde(default)]
    pub note: String,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
// i18n-exempt: compiled from the knowledge JSON - a fact, like an item name.
pub struct Synergy {
    pub a: i64,
    pub b: i64,
    #[serde(rename = "type")]
    pub kind: String, // "strong" | "weak" | "dangerous"
    pub text: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ItemKbFile {
    #[allow(dead_code)]
    pub schema: u32,
    pub items: Vec<ItemKb>,
    #[serde(default)]
    pub synergies: Vec<Synergy>,
}

#[derive(Debug, Deserialize)]
struct ItemNamesFile {
    names: HashMap<String, String>,
}

#[derive(Debug, Clone)]
pub struct ItemDb {
    pub items: Vec<ItemKb>,
    pub synergies: Vec<Synergy>,
    /// Every collectible id -> name (item_names.json, ~719 entries). The knowledge
    /// base itself only covers the items the assistant can reason about, but a run
    /// snapshot carries whatever the player was holding, so this index is what stops
    /// the UI from falling back to a raw "#317".
    pub names: HashMap<i64, String>,
}

impl ItemDb {
    pub fn load(resources_dir: &Path) -> Self {
        let (items, synergies) = match std::fs::read_to_string(resources_dir.join("item_kb.json"))
            .ok()
            .and_then(|raw| serde_json::from_str::<ItemKbFile>(&raw).ok())
        {
            Some(f) => (f.items, f.synergies),
            None => (vec![], vec![]),
        };
        let names = std::fs::read_to_string(resources_dir.join("item_names.json"))
            .ok()
            .and_then(|raw| serde_json::from_str::<ItemNamesFile>(&raw).ok())
            .map(|f| {
                f.names
                    .into_iter()
                    .filter_map(|(k, v)| k.parse::<i64>().ok().map(|id| (id, v)))
                    .collect()
            })
            .unwrap_or_default();
        ItemDb { items, synergies, names }
    }
    pub fn get(&self, id: i64) -> Option<&ItemKb> {
        self.items.iter().find(|i| i.id == id)
    }
    /// Best name available for an id: the knowledge base first, then the full name
    /// index, and only then the raw id.
    pub fn display_name(&self, id: i64) -> String {
        self.get(id)
            .map(|i| i.name.clone())
            .or_else(|| self.names.get(&id).cloned())
            .unwrap_or_else(|| format!("#{id}"))
    }
    fn resolve<'a>(&'a self, ids: &[i64]) -> Vec<&'a ItemKb> {
        ids.iter().filter_map(|&id| self.get(id)).collect()
    }
    fn synergy_between(&self, x: i64, y: i64) -> Option<&Synergy> {
        self.synergies
            .iter()
            .find(|s| (s.a == x && s.b == y) || (s.a == y && s.b == x))
    }
}

// --------------------------------------------------------------------------
// Configurable rules (build_rules.json)
// --------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
pub struct BuildRules {
    pub tear_flag_redundancy_threshold: usize,
    pub tears_replacement_conflict_threshold: usize,
    pub damage_mult_glass_cannon: f32,
    pub warn_no_flight: bool,
    pub warn_no_crowd_control: bool,
}

impl Default for BuildRules {
    fn default() -> Self {
        BuildRules {
            tear_flag_redundancy_threshold: 3,
            tears_replacement_conflict_threshold: 2,
            damage_mult_glass_cannon: 1.8,
            warn_no_flight: true,
            warn_no_crowd_control: true,
        }
    }
}

impl BuildRules {
    pub fn load(resources_dir: &Path) -> Self {
        std::fs::read_to_string(resources_dir.join("build_rules.json"))
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }
}

// --------------------------------------------------------------------------
// Outputs
// --------------------------------------------------------------------------

/// One line of analysis, as a code plus its values rather than a finished sentence.
///
/// The UI owns the wording. Building English prose here made the whole
/// strengths/weaknesses panel untranslatable: it stayed English in all 13
/// languages because the front end rendered the string as-is. Same contract as
/// `ParseError::code()`.
#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
pub struct Note {
    pub code: String,
    #[serde(default)]
    pub params: BTreeMap<String, String>,
}

impl Note {
    fn new(code: &str) -> Self {
        Note { code: code.into(), params: BTreeMap::new() }
    }
    fn with(code: &str, kv: &[(&str, String)]) -> Self {
        Note {
            code: code.into(),
            params: kv.iter().map(|(k, v)| ((*k).to_string(), v.clone())).collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct Composition {
    pub total: usize,
    pub by_role: Vec<(String, usize)>,
    pub familiars: usize,
    pub tears_replacements: usize,
    /// Modifiers that apply to YOUR tears. A familiar that fires homing tears
    /// homes on the familiar's behalf, not yours, so it is counted separately
    /// below - claiming "you have homing" for Little Steven is simply wrong.
    pub tear_flags: Vec<(String, usize)>,
    /// Modifiers carried by familiars only.
    pub familiar_tear_flags: Vec<(String, usize)>,
    pub has_flight: bool,
    /// Flight comes from the character rather than from an item.
    pub flight_from_character: bool,
    /// Nothing in the build grants flight AND the character is unknown or
    /// randomised (Eden), so the analysis must not claim there is none.
    pub flight_unknown: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct BuildAnalysis {
    pub composition: Composition,
    pub archetypes: Vec<Note>,
    pub strengths: Vec<Note>,
    pub weaknesses: Vec<Note>,
    /// build items unknown to the KB (uncovered IDs).
    pub unknown_ids: Vec<i64>,
    /// Names for `unknown_ids` when the collectible index knows them, so the UI can
    /// say WHICH items it could not reason about instead of only how many.
    pub unknown_names: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatDelta {
    pub dim: String,
    pub before: f32,
    pub after: f32,
    pub direction: i8, // -1 down, 0 unchanged, +1 up
}

#[derive(Debug, Clone, Serialize)]
pub struct SynergyNote {
    pub kind: String, // strong | weak | dangerous
    // i18n-exempt: curated knowledge-base wording, see below.
    /// Curated wording from the knowledge base - a fact, left in English like the
    /// item names it quotes.
    pub text: String,
    /// Set when this note was generated rather than curated, so the UI can
    /// translate it instead of showing `text`.
    #[serde(default)]
    pub code: Option<Note>,
}

#[derive(Debug, Clone, Serialize)]
pub struct SynergyResult {
    pub candidate_id: i64,
    pub candidate_name: String,
    pub adds_tear_flags: Vec<String>,
    pub adds_flight: bool,
    pub hearts_delta: i32,
    pub stat_deltas: Vec<StatDelta>,
    pub radar_before: Vec<(String, f32)>,
    pub radar_after: Vec<(String, f32)>,
    pub estimate_approximate: bool,
    pub synergy_notes: Vec<SynergyNote>,
    pub verdict: String, // fills_gap | redundant_or_conflict | strong_pickup | situational
    pub verdict_text: Note,
}

// --------------------------------------------------------------------------
// Stat profile (relative and approximate - for the radar)
// --------------------------------------------------------------------------

const DIMS: [&str; 6] = ["damage", "fire_rate", "range", "shot_speed", "speed", "luck"];

/// Approximate base stats for Isaac (relative, for the data viz).
fn base_profile() -> BTreeMap<String, f32> {
    BTreeMap::from([
        ("damage".into(), 3.5),
        ("fire_rate".into(), 2.0),
        ("range".into(), 6.5),
        ("shot_speed".into(), 1.0),
        ("speed".into(), 1.0),
        ("luck".into(), 0.0),
    ])
}

/// Applies the items: additive effects (flat) first, then multipliers (mult).
fn profile_of(items: &[&ItemKb]) -> BTreeMap<String, f32> {
    let mut p = base_profile();
    for it in items {
        for (dim, se) in &it.stat_effects {
            if se.op == "flat" {
                *p.entry(dim.clone()).or_insert(0.0) += se.value;
            }
        }
    }
    for it in items {
        for (dim, se) in &it.stat_effects {
            if se.op == "mult" {
                *p.entry(dim.clone()).or_insert(0.0) *= se.value;
            }
        }
    }
    p
}

/// Normalizes a raw value for one dimension into 0..1 (soft cap, display only).
fn normalize(dim: &str, v: f32) -> f32 {
    let soft = |x: f32, k: f32| (x.max(0.0)) / (x.max(0.0) + k);
    let n = match dim {
        "damage" => soft(v, 8.0),
        "fire_rate" => soft(v, 4.0),
        "range" => soft(v, 10.0),
        "shot_speed" => soft(v, 2.0),
        "speed" => soft(v, 2.0),
        "luck" => ((v + 5.0) / 15.0).clamp(0.0, 1.0),
        _ => soft(v, 5.0),
    };
    (n * 100.0).round() / 100.0
}

fn radar(profile: &BTreeMap<String, f32>) -> Vec<(String, f32)> {
    DIMS.iter()
        .map(|d| (d.to_string(), normalize(d, *profile.get(*d).unwrap_or(&0.0))))
        .collect()
}

// --------------------------------------------------------------------------
// Feature A — composition
// --------------------------------------------------------------------------

pub fn composition(items: &[&ItemKb], innate: Option<&Innate>) -> Composition {
    let mut by_role: BTreeMap<String, usize> = BTreeMap::new();
    let mut tear_flags: BTreeMap<String, usize> = BTreeMap::new();
    let mut familiar_flags: BTreeMap<String, usize> = BTreeMap::new();
    let mut familiars = 0;
    let mut replacements = 0;
    let mut item_flight = false;
    for it in items {
        for r in &it.roles {
            *by_role.entry(r.clone()).or_default() += 1;
        }
        // A familiar's tear modifiers belong to the familiar, not to the player.
        let bucket = if it.is_familiar { &mut familiar_flags } else { &mut tear_flags };
        for f in &it.grants_tear_flags {
            *bucket.entry(f.clone()).or_default() += 1;
        }
        if it.is_familiar {
            familiars += 1;
        }
        if it.is_tears_replacement {
            replacements += 1;
        }
        if it.grants_flight {
            item_flight = true;
        }
    }
    // The character brings its own tears and its own wings.
    for f in innate.map(|i| i.tear_flags.as_slice()).unwrap_or(&[]) {
        *tear_flags.entry(f.clone()).or_default() += 1;
    }
    let innate_flight = innate.is_some_and(|i| i.flight);

    let mut by_role: Vec<(String, usize)> = by_role.into_iter().collect();
    by_role.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    let sorted = |m: BTreeMap<String, usize>| {
        let mut v: Vec<(String, usize)> = m.into_iter().collect();
        v.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
        v
    };

    Composition {
        total: items.len(),
        by_role,
        familiars,
        tears_replacements: replacements,
        tear_flags: sorted(tear_flags),
        familiar_tear_flags: sorted(familiar_flags),
        has_flight: item_flight || innate_flight,
        flight_from_character: innate_flight && !item_flight,
        // Eden's kit is randomised and an unselected character tells us nothing:
        // in both cases silence beats a false "no flight".
        flight_unknown: !item_flight
            && !innate_flight
            && innate.map(|i| i.random).unwrap_or(true),
    }
}

/// Player-facing tear modifiers: items you carry plus your character, never familiars.
fn player_tear_flag_count(items: &[&ItemKb], innate: Option<&Innate>, flag: &str) -> usize {
    let from_items = items
        .iter()
        .filter(|it| !it.is_familiar && it.grants_tear_flags.iter().any(|f| f == flag))
        .count();
    let from_char = innate
        .map(|i| i.tear_flags.iter().filter(|f| *f == flag).count())
        .unwrap_or(0);
    from_items + from_char
}

// --------------------------------------------------------------------------
// Feature B — forces & faiblesses
// --------------------------------------------------------------------------

fn tear_flag_count(items: &[&ItemKb], flag: &str) -> usize {
    items.iter().filter(|it| it.grants_tear_flags.iter().any(|f| f == flag)).count()
}

fn has_big_damage_mult(items: &[&ItemKb], threshold: f32) -> bool {
    items.iter().any(|it| {
        it.stat_effects
            .get("damage")
            .map(|se| se.op == "mult" && se.value >= threshold)
            .unwrap_or(false)
    })
}

fn has_fire_rate_penalty(items: &[&ItemKb]) -> bool {
    items.iter().any(|it| {
        it.stat_effects.get("fire_rate").map(|se| {
            (se.op == "flat" && se.value < 0.0) || (se.op == "mult" && se.value < 0.9)
        }).unwrap_or(false)
    })
}

pub fn analyze(
    db: &ItemDb,
    ids: &[i64],
    rules: &BuildRules,
    innate: Option<&Innate>,
) -> BuildAnalysis {
    let items = db.resolve(ids);
    let unknown_ids: Vec<i64> = ids.iter().copied().filter(|id| db.get(*id).is_none()).collect();
    let comp = composition(&items, innate);

    let mut archetypes = Vec::new();
    let mut strengths = Vec::new();
    let mut weaknesses = Vec::new();

    // Glass cannon archetype: a big damage multiplier plus a fire-rate penalty.
    let big_dmg = has_big_damage_mult(&items, rules.damage_mult_glass_cannon);
    let fr_penalty = has_fire_rate_penalty(&items);
    if big_dmg && fr_penalty {
        archetypes.push(Note::new("glass_cannon"));
    }
    if big_dmg {
        strengths.push(Note::new("big_damage"));
    }

    // Tear modifiers - yours, then your familiars'.
    const FLAGS: [&str; 4] = ["homing", "piercing", "spectral", "explosive"];
    for flag in FLAGS {
        let n = player_tear_flag_count(&items, innate, flag);
        if n >= 1 {
            strengths.push(Note::with("have_flag", &[("flag", flag.to_string())]));
        }
        if n >= rules.tear_flag_redundancy_threshold {
            weaknesses.push(Note::with(
                "redundant_flag",
                &[("flag", flag.to_string()), ("n", n.to_string())],
            ));
        }
        // Kept as its own line so the information is not lost, but never merged
        // into the player's own tears.
        let f = comp.familiar_tear_flags.iter().find(|(x, _)| x == flag).map(|(_, c)| *c);
        if let Some(c) = f {
            strengths.push(Note::with(
                "familiar_flag",
                &[("flag", flag.to_string()), ("n", c.to_string())],
            ));
        }
    }

    // Several tear replacements at once. Deliberately NOT phrased as "only one wins":
    // in Isaac some of these pairs merge (Brimstone + Mom's Knife) while others really
    // do override (Brimstone + Trisagion), so the blanket claim would be wrong. The
    // per-pair outcome comes from the curated synergies, surfaced by `try_synergy`.
    if comp.tears_replacements >= rules.tears_replacement_conflict_threshold {
        let names: Vec<&str> = items
            .iter()
            .filter(|it| it.is_tears_replacement)
            .map(|it| it.name.as_str())
            .collect();
        weaknesses.push(Note::with("tears_replacement", &[("items", names.join(", "))]));
    }

    // Flight. The character can bring it, and Eden may or may not - say nothing
    // rather than something false.
    if comp.has_flight {
        strengths.push(Note::new(if comp.flight_from_character {
            "have_flight_character"
        } else {
            "have_flight"
        }));
    } else if rules.warn_no_flight && !items.is_empty() {
        weaknesses.push(Note::new(if comp.flight_unknown {
            "no_flight_items"
        } else {
            "no_flight"
        }));
    }

    // Crowd control: a homing familiar genuinely helps here even though its tears
    // are not yours, so familiars count for this one.
    let crowd = FLAGS
        .iter()
        .filter(|f| **f != "spectral")
        .any(|f| tear_flag_count(&items, f) > 0 || player_tear_flag_count(&items, innate, f) > 0)
        || items.iter().any(|it| it.is_familiar && it.roles.iter().any(|r| r == "offensive"));
    if !crowd && rules.warn_no_crowd_control && !items.is_empty() {
        weaknesses.push(Note::new("no_crowd_control"));
    }

    if comp.familiars >= 1 {
        strengths.push(Note::with("familiars_dps", &[("n", comp.familiars.to_string())]));
    }

    let unknown_names = unknown_ids.iter().map(|&id| db.display_name(id)).collect();
    BuildAnalysis { composition: comp, archetypes, strengths, weaknesses, unknown_ids, unknown_names }
}

// --------------------------------------------------------------------------
// Feature C — try synergy
// --------------------------------------------------------------------------

pub fn try_synergy(db: &ItemDb, build_ids: &[i64], candidate_id: i64) -> Option<SynergyResult> {
    let cand = db.get(candidate_id)?.clone();
    let build = db.resolve(build_ids);

    // Before and after profiles.
    let before = profile_of(&build);
    let mut with_cand = build.clone();
    with_cand.push(&cand);
    let after = profile_of(&with_cand);

    let stat_deltas: Vec<StatDelta> = DIMS
        .iter()
        .map(|d| {
            let b = *before.get(*d).unwrap_or(&0.0);
            let a = *after.get(*d).unwrap_or(&0.0);
            let dir = if (a - b).abs() < 1e-3 {
                0
            } else if a > b {
                1
            } else {
                -1
            };
            StatDelta { dim: d.to_string(), before: b, after: a, direction: dir }
        })
        .collect();

    // Tear flags, flight, and hearts added.
    let existing_flags: std::collections::HashSet<&str> =
        build.iter().flat_map(|it| it.grants_tear_flags.iter().map(|s| s.as_str())).collect();
    let adds_tear_flags: Vec<String> = cand
        .grants_tear_flags
        .iter()
        .filter(|f| !existing_flags.contains(f.as_str()))
        .cloned()
        .collect();
    let adds_flight = cand.grants_flight && !build.iter().any(|it| it.grants_flight);

    // Synergy notes. The curated pairs come first because they say what ACTUALLY
    // happens for that exact combination; the generic replacement note is only a
    // fallback for pairs the knowledge base does not document, and it says so
    // instead of asserting a winner we have not verified.
    let mut notes = Vec::new();
    for it in &build {
        if let Some(s) = db.synergy_between(cand.id, it.id) {
            notes.push(SynergyNote {
                kind: s.kind.clone(),
                text: format!("{}: {}", it.name, s.text),
                code: None,
            });
        }
    }
    if cand.is_tears_replacement {
        let undocumented: Vec<&str> = build
            .iter()
            .filter(|it| it.is_tears_replacement && db.synergy_between(cand.id, it.id).is_none())
            .map(|it| it.name.as_str())
            .collect();
        if !undocumented.is_empty() {
            notes.push(SynergyNote {
                kind: "dangerous".into(),
                text: format!(
                    "Also replaces your tears, like {}. Isaac resolves this pair itself - \
                     some combinations merge, others let one item take over - and this one \
                     is not documented in the knowledge base.",
                    undocumented.join(", ")
                ),
                code: Some(Note::with(
                    "undocumented_replacement",
                    &[("items", undocumented.join(", "))],
                )),
            });
        }
    }

    // Redundancy: the candidate only brings flags that are already present in numbers.
    let redundant_flags = !cand.grants_tear_flags.is_empty() && adds_tear_flags.is_empty();

    let estimate_approximate = cand.complexity != "flat"
        || build.iter().any(|it| it.complexity != "flat")
        || has_big_damage_mult(&with_cand, 1.0);

    // Verdict (in priority order).
    let has_dangerous = notes.iter().any(|n| n.kind == "dangerous");
    let has_strong = notes.iter().any(|n| n.kind == "strong");
    let fills_gap = adds_flight
        || (!adds_tear_flags.is_empty()
            && adds_tear_flags.iter().any(|f| f == "homing" || f == "piercing" || f == "explosive"));

    let (verdict, verdict_text) = if has_dangerous {
        ("redundant_or_conflict", Note::new("v_conflict"))
    } else if has_strong {
        ("strong_pickup", Note::new("v_strong"))
    } else if fills_gap {
        let note = if adds_flight {
            Note::new("v_fills_gap_flight")
        } else {
            Note::with("v_fills_gap", &[("flags", adds_tear_flags.join(", "))])
        };
        ("fills_gap", note)
    } else if redundant_flags {
        ("redundant_or_conflict", Note::new("v_redundant"))
    } else {
        ("situational", Note::new("v_situational"))
    };

    Some(SynergyResult {
        candidate_id: cand.id,
        candidate_name: cand.name.clone(),
        adds_tear_flags,
        adds_flight,
        hearts_delta: cand.hearts,
        stat_deltas,
        radar_before: radar(&before),
        radar_after: radar(&after),
        estimate_approximate,
        synergy_notes: notes,
        verdict: verdict.to_string(),
        verdict_text,
    })
}

// ===========================================================================
// Deterministic tests
// ===========================================================================
#[cfg(test)]
mod tests {
    use super::*;

    fn item(id: i64, name: &str, roles: &[&str]) -> ItemKb {
        ItemKb {
            id,
            name: name.into(),
            roles: roles.iter().map(|s| s.to_string()).collect(),
            stat_effects: BTreeMap::new(),
            grants_tear_flags: vec![],
            grants_flight: false,
            is_tears_replacement: false,
            is_familiar: false,
            hearts: 0,
            complexity: "flat".into(),
            note: String::new(),
        }
    }
    fn flag(mut it: ItemKb, f: &str) -> ItemKb {
        it.grants_tear_flags.push(f.into());
        it
    }
    fn repl(mut it: ItemKb) -> ItemKb {
        it.is_tears_replacement = true;
        it
    }
    fn fly(mut it: ItemKb) -> ItemKb {
        it.grants_flight = true;
        it
    }
    fn fam(mut it: ItemKb) -> ItemKb {
        it.is_familiar = true;
        it
    }
    /// Tests assert on codes now: the wording lives in the UI catalogue.
    fn codes(notes: &[Note]) -> Vec<&str> {
        notes.iter().map(|n| n.code.as_str()).collect()
    }
    fn lost() -> Innate {
        Innate { flight: true, tear_flags: vec!["spectral".into()], random: false }
    }
    fn dmg_mult(mut it: ItemKb, v: f32) -> ItemKb {
        it.stat_effects.insert("damage".into(), StatEffect { op: "mult".into(), value: v });
        it.complexity = "conditional".into();
        it
    }

    fn db() -> ItemDb {
        ItemDb {
            items: vec![
                flag(item(3, "Spoon Bender", &["tear_mod"]), "homing"),
                flag(item(82, "Lord of the Pit", &["mobility", "tear_mod"]), "homing"),
                flag(item(115, "Ouija Board", &["tear_mod"]), "spectral"),
                repl(item(118, "Brimstone", &["offensive", "tear_mod"])),
                repl(item(114, "Mom's Knife", &["offensive", "tear_mod"])),
                fly(item(179, "Fate", &["mobility"])),
                dmg_mult(item(169, "Polyphemus", &["offensive"]), 2.0),
                item(1, "Sad Onion", &["offensive"]),
            ],
            synergies: vec![Synergy {
                a: 118,
                b: 233,
                kind: "strong".into(),
                text: "combo".into(),
            }],
            names: HashMap::from([(999, "An Item Outside The KB".to_string())]),
        }
    }

    #[test]
    fn display_name_falls_back_kb_then_index_then_id() {
        let db = db();
        assert_eq!(db.display_name(118), "Brimstone", "the KB wins when it knows the item");
        assert_eq!(db.display_name(999), "An Item Outside The KB", "then the full name index");
        assert_eq!(db.display_name(4242), "#4242", "and only then the raw id");
    }

    #[test]
    fn undocumented_replacement_pair_does_not_claim_a_winner() {
        let db = db();
        // 118/114 have no curated entry in this test db, so the note must stay honest.
        let r = try_synergy(&db, &[118], 114).unwrap();
        let text = r.synergy_notes.iter().map(|n| n.text.as_str()).collect::<Vec<_>>().join(" ");
        assert!(text.contains("not documented"), "got: {text}");
        assert!(!text.contains("wins out"), "must not assert a winner: {text}");
    }

    #[test]
    fn composition_counts_roles_and_flags() {
        let db = db();
        let items = db.resolve(&[3, 115, 118]);
        let c = composition(&items, None);
        assert_eq!(c.total, 3);
        assert_eq!(c.tears_replacements, 1);
        // homing and spectral are both present.
        assert!(c.tear_flags.iter().any(|(f, n)| f == "homing" && *n == 1));
        assert!(c.tear_flags.iter().any(|(f, n)| f == "spectral" && *n == 1));
    }

    #[test]
    fn analyze_flags_tears_replacement_conflict() {
        let db = db();
        let a = analyze(&db, &[118, 114], &BuildRules::default(), None);
        let n = a.weaknesses.iter().find(|n| n.code == "tears_replacement").expect("flagged");
        let items = &n.params["items"];
        assert!(items.contains("Brimstone") && items.contains("Mom's Knife"), "both named: {items}");
    }

    #[test]
    fn analyze_warns_no_flight_and_credits_flight() {
        let db = db();
        // A known character with no innate flight and no flight item: a real gap.
        let none = Innate::default();
        let no_fly = analyze(&db, &[1], &BuildRules::default(), Some(&none));
        assert!(codes(&no_fly.weaknesses).contains(&"no_flight"));
        let with_fly = analyze(&db, &[179], &BuildRules::default(), Some(&none));
        assert!(codes(&with_fly.strengths).contains(&"have_flight"));
        assert!(!codes(&with_fly.weaknesses).contains(&"no_flight"));
    }

    #[test]
    fn analyze_detects_homing_redundancy() {
        let db = db();
        // 3 homing sources (default threshold is 3): Spoon Bender, Lord of the Pit, and
        // a third from the KB? Here we only have 2, so no redundancy; let us test the threshold.
        let rules = BuildRules { tear_flag_redundancy_threshold: 2, ..Default::default() };
        let a = analyze(&db, &[3, 82], &rules, None);
        assert!(a
            .weaknesses
            .iter()
            .any(|w| w.code == "redundant_flag" && w.params["flag"] == "homing"));
    }

    #[test]
    fn glass_cannon_archetype() {
        let db = db();
        // Polyphemus (mult 2.0) plus Mom's Knife has no encoded fire-rate penalty...
        // so we build a fire-rate-penalty item.
        let mut db2 = db;
        let mut slow = item(999, "Slow", &["offensive"]);
        slow.stat_effects.insert("fire_rate".into(), StatEffect { op: "flat".into(), value: -1.0 });
        db2.items.push(slow);
        let a = analyze(&db2, &[169, 999], &BuildRules::default(), None);
        assert!(codes(&a.archetypes).contains(&"glass_cannon"));
    }

    #[test]
    fn a_familiars_homing_tears_are_not_your_homing_tears() {
        // Little Steven fires homing tears; YOU do not. Reported from the UI, which
        // said "You have homing." for a build whose only homing was the familiar.
        let mut db2 = db();
        db2.items.push(fam(flag(item(100, "Little Steven", &["familiar", "offensive"]), "homing")));
        let a = analyze(&db2, &[100], &BuildRules::default(), None);
        assert!(
            !codes(&a.strengths).contains(&"have_flag"),
            "the player has no tear modifier: {:?}",
            codes(&a.strengths)
        );
        // The information is kept, on its own line.
        let n = a.strengths.iter().find(|n| n.code == "familiar_flag").expect("kept");
        assert_eq!(n.params["flag"], "homing");
        // ...and it still counts as crowd control, which it genuinely provides.
        assert!(!codes(&a.weaknesses).contains(&"no_crowd_control"));
    }

    #[test]
    fn the_lost_flies_with_no_item_at_all() {
        let db = db();
        let a = analyze(&db, &[1], &BuildRules::default(), Some(&lost()));
        assert!(codes(&a.strengths).contains(&"have_flight_character"));
        assert!(!codes(&a.weaknesses).contains(&"no_flight"));
        // Spectral is innate too, so it is a real strength of the build.
        assert!(a
            .strengths
            .iter()
            .any(|n| n.code == "have_flag" && n.params["flag"] == "spectral"));
    }

    #[test]
    fn an_unknown_character_never_claims_the_build_has_no_flight() {
        let db = db();
        let a = analyze(&db, &[1], &BuildRules::default(), None);
        let w = codes(&a.weaknesses);
        assert!(!w.contains(&"no_flight"), "cannot know: {w:?}");
        assert!(w.contains(&"no_flight_items"), "but may speak about the items: {w:?}");
    }

    #[test]
    fn eden_is_never_told_it_has_no_flight() {
        let db = db();
        let eden = Innate { random: true, ..Default::default() };
        let a = analyze(&db, &[1], &BuildRules::default(), Some(&eden));
        assert!(!codes(&a.weaknesses).contains(&"no_flight"), "Eden's kit is randomised");
    }

    #[test]
    fn try_synergy_conflict_verdict() {
        let db = db();
        // the build already has Brimstone (a replacement) and the candidate Mom's Knife is one too, so: conflict.
        let r = try_synergy(&db, &[118], 114).unwrap();
        assert_eq!(r.verdict, "redundant_or_conflict");
        assert!(r.synergy_notes.iter().any(|n| n.kind == "dangerous"));
    }

    #[test]
    fn try_synergy_fills_gap_flight() {
        let db = db();
        let r = try_synergy(&db, &[1], 179).unwrap(); // build with no flight, candidate = Fate (flight)
        assert!(r.adds_flight);
        assert_eq!(r.verdict, "fills_gap");
    }

    #[test]
    fn try_synergy_redundant_flag() {
        let db = db();
        // the build already has homing (Spoon Bender), and Lord of the Pit adds homing (already present)
        // BUT Lord of the Pit also adds flight, so fills_gap wins. Let us test a pure homing candidate.
        let mut db2 = db;
        db2.items.push(flag(item(500, "Homing2", &["tear_mod"]), "homing"));
        let r = try_synergy(&db2, &[3], 500).unwrap();
        assert!(r.adds_tear_flags.is_empty());
        assert_eq!(r.verdict, "redundant_or_conflict");
    }

    #[test]
    fn try_synergy_marks_estimate_approximate_for_mult() {
        let db = db();
        let r = try_synergy(&db, &[], 169).unwrap(); // Polyphemus = mult damage
        assert!(r.estimate_approximate);
        // radar after: damage is higher than before.
        let dmg = r.stat_deltas.iter().find(|d| d.dim == "damage").unwrap();
        assert_eq!(dmg.direction, 1);
    }

    #[test]
    fn try_synergy_named_strong_pair() {
        let db = db();
        // Add Tiny Planet (233) to the KB for the strong 118+233 pair.
        let mut db2 = db;
        db2.items.push(item(233, "Tiny Planet", &["tear_mod"]));
        let r = try_synergy(&db2, &[118], 233).unwrap();
        assert!(r.synergy_notes.iter().any(|n| n.kind == "strong"));
        assert_eq!(r.verdict, "strong_pickup");
    }
}
