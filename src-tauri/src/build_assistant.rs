// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! build_assistant — analyse de build (hors temps-réel, côté app).
//!
//! - Feature A : composition (compteur d'items par rôle).
//! - Feature B : forces / faiblesses (archétypes, trous, redondances) via des
//!   heuristiques configurables (`build_rules.json`).
//! - Feature C : « try synergy » — delta de stats estimé + notes de synergie
//!   (KB factuelle) + verdict + radar avant/après (data-viz ORIGINALE).
//!
//! DÉTERMINISTE, 100 % offline, aucun LLM. Le delta de stats est une ESTIMATION
//! (formule de dégâts d'Isaac non triviale) — marquée comme telle dès qu'un item
//! est multiplicatif / proc / conditionnel. Aucun asset rippé : que des faits.

use std::collections::BTreeMap;
use std::path::Path;

use serde::{Deserialize, Serialize};

// --------------------------------------------------------------------------
// Base de connaissances (miroir de item_kb.json, généré au dev-time)
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

#[derive(Debug, Clone)]
pub struct ItemDb {
    pub items: Vec<ItemKb>,
    pub synergies: Vec<Synergy>,
}

impl ItemDb {
    pub fn load(resources_dir: &Path) -> Self {
        match std::fs::read_to_string(resources_dir.join("item_kb.json"))
            .ok()
            .and_then(|raw| serde_json::from_str::<ItemKbFile>(&raw).ok())
        {
            Some(f) => ItemDb { items: f.items, synergies: f.synergies },
            None => ItemDb { items: vec![], synergies: vec![] },
        }
    }
    pub fn get(&self, id: i64) -> Option<&ItemKb> {
        self.items.iter().find(|i| i.id == id)
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
// Règles configurables (build_rules.json)
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
// Sorties
// --------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
pub struct Composition {
    pub total: usize,
    pub by_role: Vec<(String, usize)>,
    pub familiars: usize,
    pub tears_replacements: usize,
    pub tear_flags: Vec<(String, usize)>,
    pub has_flight: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct BuildAnalysis {
    pub composition: Composition,
    pub archetypes: Vec<String>,
    pub strengths: Vec<String>,
    pub weaknesses: Vec<String>,
    /// items du build inconnus de la KB (ids non couverts).
    pub unknown_ids: Vec<i64>,
}

#[derive(Debug, Clone, Serialize)]
pub struct StatDelta {
    pub dim: String,
    pub before: f32,
    pub after: f32,
    pub direction: i8, // -1 baisse, 0 égal, +1 hausse
}

#[derive(Debug, Clone, Serialize)]
pub struct SynergyNote {
    pub kind: String, // strong | weak | dangerous
    pub text: String,
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
    pub verdict_text: String,
}

// --------------------------------------------------------------------------
// Profil de stats (relatif, approximatif — pour le radar)
// --------------------------------------------------------------------------

const DIMS: [&str; 6] = ["damage", "fire_rate", "range", "shot_speed", "speed", "luck"];

/// Stats de base approximatives d'Isaac (relatives, pour la data-viz).
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

/// Applique les items : d'abord les additifs (flat), puis les multiplicateurs (mult).
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

/// Normalise une valeur brute d'une dimension en 0..1 (cap doux, affichage only).
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

pub fn composition(items: &[&ItemKb]) -> Composition {
    let mut by_role: BTreeMap<String, usize> = BTreeMap::new();
    let mut tear_flags: BTreeMap<String, usize> = BTreeMap::new();
    let mut familiars = 0;
    let mut replacements = 0;
    let mut has_flight = false;
    for it in items {
        for r in &it.roles {
            *by_role.entry(r.clone()).or_default() += 1;
        }
        for f in &it.grants_tear_flags {
            *tear_flags.entry(f.clone()).or_default() += 1;
        }
        if it.is_familiar {
            familiars += 1;
        }
        if it.is_tears_replacement {
            replacements += 1;
        }
        if it.grants_flight {
            has_flight = true;
        }
    }
    let mut by_role: Vec<(String, usize)> = by_role.into_iter().collect();
    by_role.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));
    let mut tear_flags: Vec<(String, usize)> = tear_flags.into_iter().collect();
    tear_flags.sort_by(|a, b| b.1.cmp(&a.1).then(a.0.cmp(&b.0)));

    Composition {
        total: items.len(),
        by_role,
        familiars,
        tears_replacements: replacements,
        tear_flags,
        has_flight,
    }
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

pub fn analyze(db: &ItemDb, ids: &[i64], rules: &BuildRules) -> BuildAnalysis {
    let items = db.resolve(ids);
    let unknown_ids: Vec<i64> = ids.iter().copied().filter(|id| db.get(*id).is_none()).collect();
    let comp = composition(&items);

    let mut archetypes = Vec::new();
    let mut strengths = Vec::new();
    let mut weaknesses = Vec::new();

    // Archétype glass cannon : gros multiplicateur de dégâts + cadence pénalisée.
    let big_dmg = has_big_damage_mult(&items, rules.damage_mult_glass_cannon);
    let fr_penalty = has_fire_rate_penalty(&items);
    if big_dmg && fr_penalty {
        archetypes.push("Glass cannon : gros dégâts mais cadence faible.".into());
    }
    if big_dmg {
        strengths.push("Dégâts par tir très élevés.".into());
    }

    // Tear flags — forces.
    let flags_fr: &[(&str, &str)] = &[
        ("homing", "auto-visée (homing)"),
        ("piercing", "larmes perçantes"),
        ("spectral", "larmes spectrales"),
        ("explosive", "larmes explosives"),
    ];
    for (flag, label) in flags_fr {
        let n = tear_flag_count(&items, flag);
        if n >= 1 {
            strengths.push(format!("Tu as {label}."));
        }
        if n >= rules.tear_flag_redundancy_threshold {
            weaknesses.push(format!("Redondance : {n} sources de {label} (rendement décroissant)."));
        }
    }

    // Conflit de remplacement de larmes (haute valeur, très fiable).
    if comp.tears_replacements >= rules.tears_replacement_conflict_threshold {
        let names: Vec<&str> = items
            .iter()
            .filter(|it| it.is_tears_replacement)
            .map(|it| it.name.as_str())
            .collect();
        weaknesses.push(format!(
            "⚠️ Conflit de remplacement de larmes : {} — un seul prend le dessus.",
            names.join(", ")
        ));
    }

    // Vol.
    if comp.has_flight {
        strengths.push("Tu as le vol.".into());
    } else if rules.warn_no_flight && !items.is_empty() {
        weaknesses.push("Pas de vol (trou de mobilité).".into());
    }

    // Gestion de foule : au moins un flag perçant/homing/explosif OU un familier offensif.
    let crowd = tear_flag_count(&items, "piercing") > 0
        || tear_flag_count(&items, "homing") > 0
        || tear_flag_count(&items, "explosive") > 0
        || items.iter().any(|it| it.is_familiar && it.roles.iter().any(|r| r == "offensive"));
    if !crowd && rules.warn_no_crowd_control && !items.is_empty() {
        weaknesses.push("Aucune gestion de foule (ni perçant/homing/explosif, ni familier offensif).".into());
    }

    if comp.familiars >= 1 {
        strengths.push(format!("{} familier(s) pour du DPS additionnel.", comp.familiars));
    }

    BuildAnalysis { composition: comp, archetypes, strengths, weaknesses, unknown_ids }
}

// --------------------------------------------------------------------------
// Feature C — try synergy
// --------------------------------------------------------------------------

pub fn try_synergy(db: &ItemDb, build_ids: &[i64], candidate_id: i64) -> Option<SynergyResult> {
    let cand = db.get(candidate_id)?.clone();
    let build = db.resolve(build_ids);

    // Profils avant / après.
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

    // Tear flags / vol / cœurs ajoutés.
    let existing_flags: std::collections::HashSet<&str> =
        build.iter().flat_map(|it| it.grants_tear_flags.iter().map(|s| s.as_str())).collect();
    let adds_tear_flags: Vec<String> = cand
        .grants_tear_flags
        .iter()
        .filter(|f| !existing_flags.contains(f.as_str()))
        .cloned()
        .collect();
    let adds_flight = cand.grants_flight && !build.iter().any(|it| it.grants_flight);

    // Notes de synergie : conflit générique de remplacement + paires curées.
    let mut notes = Vec::new();
    let build_has_replacement = build.iter().any(|it| it.is_tears_replacement);
    if cand.is_tears_replacement && build_has_replacement {
        let conflicting: Vec<&str> =
            build.iter().filter(|it| it.is_tears_replacement).map(|it| it.name.as_str()).collect();
        notes.push(SynergyNote {
            kind: "dangerous".into(),
            text: format!(
                "Remplace tes larmes → entre en conflit avec {} (un seul l'emporte).",
                conflicting.join(", ")
            ),
        });
    }
    for it in &build {
        if let Some(s) = db.synergy_between(cand.id, it.id) {
            notes.push(SynergyNote { kind: s.kind.clone(), text: format!("{} : {}", it.name, s.text) });
        }
    }

    // Redondance : le candidat n'apporte que des flags déjà présents en nombre.
    let redundant_flags = !cand.grants_tear_flags.is_empty() && adds_tear_flags.is_empty();

    let estimate_approximate = cand.complexity != "flat"
        || build.iter().any(|it| it.complexity != "flat")
        || has_big_damage_mult(&with_cand, 1.0);

    // Verdict (ordre de priorité).
    let has_dangerous = notes.iter().any(|n| n.kind == "dangerous");
    let has_strong = notes.iter().any(|n| n.kind == "strong");
    let fills_gap = adds_flight
        || (!adds_tear_flags.is_empty()
            && adds_tear_flags.iter().any(|f| f == "homing" || f == "piercing" || f == "explosive"));

    let (verdict, verdict_text) = if has_dangerous {
        (
            "redundant_or_conflict",
            "Conflit avec ton build actuel — à réfléchir avant de prendre.".to_string(),
        )
    } else if has_strong {
        (
            "strong_pickup",
            "Forte synergie avec ce que tu as déjà — bon pick.".to_string(),
        )
    } else if fills_gap {
        let what = if adds_flight { "le vol".to_string() } else { adds_tear_flags.join(", ") };
        ("fills_gap", format!("Comble un trou : ajoute {what}."))
    } else if redundant_flags {
        (
            "redundant_or_conflict",
            "Redondant : tu as déjà ces modificateurs de larmes.".to_string(),
        )
    } else {
        (
            "situational",
            "Pick situationnel : gain de stats, sans synergie nommée forte.".to_string(),
        )
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
// Tests déterministes
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
        }
    }

    #[test]
    fn composition_counts_roles_and_flags() {
        let db = db();
        let items = db.resolve(&[3, 115, 118]);
        let c = composition(&items);
        assert_eq!(c.total, 3);
        assert_eq!(c.tears_replacements, 1);
        // homing + spectral présents.
        assert!(c.tear_flags.iter().any(|(f, n)| f == "homing" && *n == 1));
        assert!(c.tear_flags.iter().any(|(f, n)| f == "spectral" && *n == 1));
    }

    #[test]
    fn analyze_flags_tears_replacement_conflict() {
        let db = db();
        let a = analyze(&db, &[118, 114], &BuildRules::default());
        assert!(a.weaknesses.iter().any(|w| w.contains("Conflit de remplacement")));
    }

    #[test]
    fn analyze_warns_no_flight_and_credits_flight() {
        let db = db();
        let no_fly = analyze(&db, &[1], &BuildRules::default());
        assert!(no_fly.weaknesses.iter().any(|w| w.contains("Pas de vol")));
        let with_fly = analyze(&db, &[179], &BuildRules::default());
        assert!(with_fly.strengths.iter().any(|s| s.contains("vol")));
        assert!(!with_fly.weaknesses.iter().any(|w| w.contains("Pas de vol")));
    }

    #[test]
    fn analyze_detects_homing_redundancy() {
        let db = db();
        // 3 sources de homing (seuil par défaut = 3) : Spoon Bender, Lord of the Pit + on
        // ajoute un 3e via la KB ? Ici on n'a que 2 -> pas de redondance ; testons le seuil.
        let rules = BuildRules { tear_flag_redundancy_threshold: 2, ..Default::default() };
        let a = analyze(&db, &[3, 82], &rules);
        assert!(a.weaknesses.iter().any(|w| w.contains("Redondance") && w.contains("homing")));
    }

    #[test]
    fn glass_cannon_archetype() {
        let db = db();
        // Polyphemus (mult 2.0) + Mom's Knife n'a pas de pénalité de cadence encodée...
        // On fabrique un item pénalité de cadence.
        let mut db2 = db;
        let mut slow = item(999, "Slow", &["offensive"]);
        slow.stat_effects.insert("fire_rate".into(), StatEffect { op: "flat".into(), value: -1.0 });
        db2.items.push(slow);
        let a = analyze(&db2, &[169, 999], &BuildRules::default());
        assert!(a.archetypes.iter().any(|x| x.contains("Glass cannon")));
    }

    #[test]
    fn try_synergy_conflict_verdict() {
        let db = db();
        // build a déjà Brimstone (remplacement), candidat Mom's Knife (remplacement) -> conflit.
        let r = try_synergy(&db, &[118], 114).unwrap();
        assert_eq!(r.verdict, "redundant_or_conflict");
        assert!(r.synergy_notes.iter().any(|n| n.kind == "dangerous"));
    }

    #[test]
    fn try_synergy_fills_gap_flight() {
        let db = db();
        let r = try_synergy(&db, &[1], 179).unwrap(); // build sans vol, candidat = Fate (vol)
        assert!(r.adds_flight);
        assert_eq!(r.verdict, "fills_gap");
    }

    #[test]
    fn try_synergy_redundant_flag() {
        let db = db();
        // build a déjà homing (Spoon Bender), candidat Lord of the Pit ajoute homing (déjà présent)
        // MAIS Lord of the Pit ajoute le vol -> fills_gap prime. Testons un candidat homing pur.
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
        // radar après : dégâts plus haut qu'avant.
        let dmg = r.stat_deltas.iter().find(|d| d.dim == "damage").unwrap();
        assert_eq!(dmg.direction, 1);
    }

    #[test]
    fn try_synergy_named_strong_pair() {
        let db = db();
        // Ajoutons Tiny Planet (233) à la KB pour la paire strong 118+233.
        let mut db2 = db;
        db2.items.push(item(233, "Tiny Planet", &["tear_mod"]));
        let r = try_synergy(&db2, &[118], 233).unwrap();
        assert!(r.synergy_notes.iter().any(|n| n.kind == "strong"));
        assert_eq!(r.verdict, "strong_pickup");
    }
}
