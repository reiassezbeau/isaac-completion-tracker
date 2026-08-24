// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! save_locator - locates save folders and slots.
//!
//! On Repentance+, the *live* save is usually NOT in
//! `Documents/My Games/Binding of Isaac Repentance+/` (which only holds
//! daily backups), but in **Steam Cloud**:
//! `<Steam>/userdata/<id>/250900/remote/rep+persistentgamedata{1,2,3}.dat`.
//! So we scan both, plus the `save_backups` folder.

use serde::Serialize;
use std::collections::HashSet;
use std::path::{Path, PathBuf};

use crate::save_parser::{self, Edition};

const ISAAC_APPID: &str = "250900";

/// Read with small retries: the save can be briefly locked
/// while the game writes it (torn read). We retry briefly instead of failing.
pub fn read_file_with_retry(path: &Path) -> std::io::Result<Vec<u8>> {
    let mut last_err = None;
    for attempt in 0u64..4 {
        match std::fs::read(path) {
            Ok(bytes) => return Ok(bytes),
            Err(e) => {
                last_err = Some(e);
                std::thread::sleep(std::time::Duration::from_millis(60 * (attempt + 1)));
            }
        }
    }
    Err(last_err.unwrap_or_else(|| std::io::Error::other("cannot read file")))
}

#[derive(Debug, Clone, Serialize)]
pub struct SaveSlot {
    pub path: String,
    pub filename: String,
    // i18n-exempt: English fallback for `slot_number`, same deal as `source` below.
    /// "Slot 1/2/3", inferred from the file name.
    pub label: String,
    /// The slot digit on its own, so the UI can say "Slot N" in its own language.
    /// `None` when the file name carries no recognisable slot.
    pub slot_number: Option<u8>,
    // i18n-exempt: English fallback for `source_code`, which the UI translates.
    /// Human-readable provenance, English: "Steam Cloud", "Documents", "Local backup".
    pub source: String,
    /// Stable provenance code the UI translates (`src.<code>`).
    pub source_code: String,
    pub edition: Option<Edition>,
    /// Preview: number of unlocked achievements (None when parsing failed).
    pub unlocked: Option<usize>,
    pub total: usize,
    pub marks_reliable: bool,
    /// English message, kept for logs and the Diagnostic tab.
    pub parse_error: Option<String>,
    /// Stable error code the UI translates (`perr.<code>`), plus its one technical value.
    pub error_code: Option<String>,
    pub error_detail: Option<String>,
    /// Which game edition wrote this file, derived from its name (see `save_family`).
    pub family: String,
    /// True for the files the *currently installed* game actually writes: readable,
    /// newest edition family present, and not a dated backup. Everything else is an
    /// older edition's leftover, a backup, or an unreadable file — the picker folds
    /// those away by default rather than deleting anything (saves are read-only).
    pub live: bool,
    /// Last-modified time (ms since the Unix epoch), for "most recently played" order.
    pub modified_ms: Option<u64>,
}

/// Which edition wrote a save file, from its name. Isaac never removes the files of
/// a previous edition, so a long-time player's folder accumulates one family per DLC.
/// Higher rank = newer edition.
fn save_family(filename: &str) -> (&'static str, u8) {
    let f = filename.to_ascii_lowercase();
    if f.contains("rep_beta_persistentgamedata") {
        ("repentance_beta", 4)
    } else if f.contains("rep+persistentgamedata") {
        ("repentance_plus", 5)
    } else if f.contains("rep_persistentgamedata") {
        ("repentance", 3)
    } else if f.contains("ab+persistentgamedata") {
        ("afterbirth_plus", 2)
    } else if f.contains("abpersistentgamedata") {
        ("afterbirth", 1)
    } else {
        ("rebirth", 0)
    }
}

fn family_rank(family: &str) -> u8 {
    match family {
        "repentance_plus" => 5,
        "repentance_beta" => 4,
        "repentance" => 3,
        "afterbirth_plus" => 2,
        "afterbirth" => 1,
        _ => 0,
    }
}

/// Candidate folders on the "Documents" side: we start from the REAL game root
/// (resolved by checking for the game files, which handles the OneDrive pitfall), not from an
/// assumed path.
fn document_candidate_dirs() -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    if let Some(root) = crate::paths::resolve_game_root() {
        dirs.push(root.clone());
        dirs.push(root.join("save_backups"));
    }
    dirs
}

/// Steam install roots (Windows registry plus default locations).
fn steam_roots() -> Vec<PathBuf> {
    let mut roots: Vec<PathBuf> = Vec::new();

    #[cfg(windows)]
    {
        use winreg::enums::HKEY_CURRENT_USER;
        use winreg::RegKey;
        let hkcu = RegKey::predef(HKEY_CURRENT_USER);
        if let Ok(key) = hkcu.open_subkey("Software\\Valve\\Steam") {
            if let Ok(path) = key.get_value::<String, _>("SteamPath") {
                roots.push(PathBuf::from(path.replace('/', "\\")));
            }
        }
    }

    for p in [
        "C:/Program Files (x86)/Steam",
        "C:/Program Files/Steam",
    ] {
        roots.push(PathBuf::from(p));
    }
    if let Some(home) = dirs::home_dir() {
        roots.push(home.join(".steam/steam"));
        roots.push(home.join(".local/share/Steam"));
    }
    roots
}

/// The `userdata/<id>/250900/remote` folders of every Steam account.
fn steam_remote_dirs() -> Vec<PathBuf> {
    let mut out = Vec::new();
    for root in steam_roots() {
        let userdata = root.join("userdata");
        if let Ok(entries) = std::fs::read_dir(&userdata) {
            for e in entries.flatten() {
                let remote = e.path().join(ISAAC_APPID).join("remote");
                if remote.is_dir() {
                    out.push(remote);
                }
            }
        }
    }
    out
}

fn slot_label(filename: &str) -> String {
    match slot_number(filename) {
        Some(n) => format!("Slot {n}"),
        None => "Slot ?".to_string(),
    }
}

fn slot_number(filename: &str) -> Option<u8> {
    (1u8..=3).find(|n| filename.contains(&format!("persistentgamedata{n}")))
}

fn is_save_file(filename: &str) -> bool {
    let f = filename.to_ascii_lowercase();
    f.ends_with(".dat") && f.contains("persistentgamedata")
}

/// (code, English label) for the folder a save was found in.
fn source_of(dir: &Path) -> (&'static str, &'static str) {
    let s = dir.to_string_lossy().to_ascii_lowercase();
    if s.contains("save_backups") {
        ("backup", "Local backup")
    } else if s.contains("userdata") {
        ("steam_cloud", "Steam Cloud")
    } else {
        ("documents", "Documents")
    }
}

fn modified_ms(path: &Path) -> Option<u64> {
    let m = std::fs::metadata(path).ok()?.modified().ok()?;
    let d = m.duration_since(std::time::UNIX_EPOCH).ok()?;
    Some(d.as_millis() as u64)
}

/// Builds a slot from a file (parsed for the preview).
pub fn slot_from_file(path: &Path, source_code: &str, source: &str) -> SaveSlot {
    let filename = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let (family, _) = save_family(&filename);
    let mut slot = SaveSlot {
        path: path.to_string_lossy().into_owned(),
        label: slot_label(&filename),
        slot_number: slot_number(&filename),
        modified_ms: modified_ms(path),
        filename,
        source: source.to_string(),
        source_code: source_code.to_string(),
        edition: None,
        unlocked: None,
        total: save_parser::NUM_ACHIEVEMENTS,
        marks_reliable: false,
        parse_error: None,
        error_code: None,
        error_detail: None,
        family: family.to_string(),
        // Resolved by `finalize_live` once the whole list is known.
        live: false,
    };
    match read_file_with_retry(path) {
        Ok(bytes) => match save_parser::parse(&bytes) {
            Ok(save) => {
                slot.edition = Some(save.edition);
                slot.unlocked = Some(save.unlocked_count());
                slot.marks_reliable = save.marks_reliable;
            }
            Err(e) => {
                slot.parse_error = Some(e.to_string());
                slot.error_code = Some(e.code().to_string());
                slot.error_detail = e.detail();
            }
        },
        Err(e) => {
            slot.parse_error = Some(format!("cannot read file: {e}"));
            slot.error_code = Some("unreadable".to_string());
            slot.error_detail = None;
        }
    }
    slot
}

/// Marks the slots the installed game actually writes: readable, not a dated backup,
/// and from the newest edition family among the readable ones. When nothing parses we
/// mark nothing live, so the picker shows everything rather than an empty list.
fn finalize_live(slots: &mut [SaveSlot]) {
    let best = slots
        .iter()
        .filter(|s| s.parse_error.is_none() && s.source_code != "backup")
        .map(|s| family_rank(&s.family))
        .max();
    if let Some(best) = best {
        for s in slots.iter_mut() {
            s.live = s.parse_error.is_none()
                && s.source_code != "backup"
                && family_rank(&s.family) == best;
        }
    }
}

/// Scans a specific folder (also used by the manual "Locate my save..." flow).
pub fn scan_dir(dir: &Path) -> Vec<SaveSlot> {
    let mut slots = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let path = e.path();
            let name = e.file_name().to_string_lossy().into_owned();
            if path.is_file() && is_save_file(&name) {
                let (code, label) = source_of(dir);
                slots.push(slot_from_file(&path, code, label));
            }
        }
    }
    finalize_live(&mut slots);
    slots
}

/// Lists every slot found (Steam Cloud first, then Documents, then backups),
/// deduplicated and sorted (Rep+ and Steam Cloud first, best preview first).
pub fn list_saves() -> Vec<SaveSlot> {
    let mut slots: Vec<SaveSlot> = Vec::new();
    let mut seen: HashSet<String> = HashSet::new();

    let mut dirs = steam_remote_dirs();
    dirs.extend(document_candidate_dirs());

    for dir in dirs {
        for slot in scan_dir(&dir) {
            let canon = std::fs::canonicalize(&slot.path)
                .map(|p| p.to_string_lossy().into_owned())
                .unwrap_or_else(|_| slot.path.clone());
            if seen.insert(canon) {
                slots.push(slot);
            }
        }
    }

    finalize_live(&mut slots);

    // Live saves first, then newest edition, then Steam Cloud over Documents over
    // backups, then most recently played. `filename` only breaks remaining ties.
    slots.sort_by(|a, b| {
        let rank = |s: &SaveSlot| {
            let live = if s.live { 0u8 } else { 1 };
            let fam = u8::MAX - family_rank(&s.family);
            let src = match s.source_code.as_str() {
                "steam_cloud" => 0u8,
                "documents" => 1,
                _ => 2,
            };
            let readable = if s.parse_error.is_none() { 0u8 } else { 1 };
            let recent = u64::MAX - s.modified_ms.unwrap_or(0);
            (live, readable, fam, src, recent, s.filename.clone())
        };
        rank(a).cmp(&rank(b))
    });

    slots
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn slot_number_is_the_digit_the_label_shows() {
        // The UI localizes "Slot N" from the digit, so the two must never disagree.
        for (name, want) in [
            ("rep+persistentgamedata1.dat", Some(1)),
            ("rep_persistentgamedata2.dat", Some(2)),
            ("persistentgamedata3.dat", Some(3)),
            ("something_else.dat", None),
        ] {
            assert_eq!(slot_number(name), want, "{name}");
            match want {
                Some(n) => assert_eq!(slot_label(name), format!("Slot {n}")),
                None => assert_eq!(slot_label(name), "Slot ?"),
            }
        }
    }

    fn slot(name: &str, src: &str, ok: bool) -> SaveSlot {
        let (family, _) = save_family(name);
        SaveSlot {
            path: format!("/x/{name}"),
            filename: name.into(),
            label: slot_label(name),
            slot_number: slot_number(name),
            source: src.into(),
            source_code: src.into(),
            edition: None,
            unlocked: if ok { Some(1) } else { None },
            total: 641,
            marks_reliable: ok,
            parse_error: if ok { None } else { Some("boom".into()) },
            error_code: if ok { None } else { Some("bad_header".into()) },
            error_detail: None,
            family: family.into(),
            live: false,
            modified_ms: Some(0),
        }
    }

    #[test]
    fn only_the_newest_readable_family_is_live() {
        let mut v = vec![
            slot("rep+persistentgamedata1.dat", "steam_cloud", true),
            slot("rep_persistentgamedata1.dat", "steam_cloud", true),
            slot("persistentgamedata1.dat", "steam_cloud", false),
            slot("20260104.rep+persistentgamedata1.dat", "backup", true),
        ];
        finalize_live(&mut v);
        assert!(v[0].live, "the Repentance+ cloud save is the live one");
        assert!(!v[1].live, "an older edition's file is not live");
        assert!(!v[2].live, "an unreadable file is never live");
        assert!(!v[3].live, "a dated backup is never live");
    }

    #[test]
    fn nothing_is_live_when_nothing_parses() {
        let mut v = vec![slot("rep+persistentgamedata1.dat", "steam_cloud", false)];
        finalize_live(&mut v);
        assert!(!v[0].live);
    }

    #[test]
    fn families_are_read_from_the_file_name() {
        assert_eq!(save_family("rep+persistentgamedata1.dat").0, "repentance_plus");
        assert_eq!(save_family("rep_beta_persistentgamedata1.dat").0, "repentance_beta");
        assert_eq!(save_family("rep_persistentgamedata2.dat").0, "repentance");
        assert_eq!(save_family("persistentgamedata3.dat").0, "rebirth");
        // The beta prefix must not be mistaken for plain Repentance.
        assert!(family_rank("repentance_plus") > family_rank("repentance_beta"));
        assert!(family_rank("repentance_beta") > family_rank("repentance"));
    }
}
