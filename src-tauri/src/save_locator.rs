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
    /// "Slot 1/2/3", inferred from the file name.
    pub label: String,
    /// Provenance lisible : "Steam Cloud", "Documents", "Sauvegarde locale".
    pub source: String,
    pub edition: Option<Edition>,
    /// Preview: number of unlocked achievements (None when parsing failed).
    pub unlocked: Option<usize>,
    pub total: usize,
    pub marks_reliable: bool,
    pub parse_error: Option<String>,
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
    for n in ['1', '2', '3'] {
        if filename.contains(&format!("persistentgamedata{n}")) {
            return format!("Slot {n}");
        }
    }
    "Slot ?".to_string()
}

fn is_save_file(filename: &str) -> bool {
    let f = filename.to_ascii_lowercase();
    f.ends_with(".dat") && f.contains("persistentgamedata")
}

fn source_label(dir: &Path) -> String {
    let s = dir.to_string_lossy().to_ascii_lowercase();
    if s.contains("userdata") {
        "Steam Cloud".to_string()
    } else if s.contains("save_backups") {
        "Backup local".to_string()
    } else {
        "Documents".to_string()
    }
}

/// Builds a slot from a file (parsed for the preview).
pub fn slot_from_file(path: &Path, source: String) -> SaveSlot {
    let filename = path
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_default();
    let mut slot = SaveSlot {
        path: path.to_string_lossy().into_owned(),
        label: slot_label(&filename),
        filename,
        source,
        edition: None,
        unlocked: None,
        total: save_parser::NUM_ACHIEVEMENTS,
        marks_reliable: false,
        parse_error: None,
    };
    match read_file_with_retry(path) {
        Ok(bytes) => match save_parser::parse(&bytes) {
            Ok(save) => {
                slot.edition = Some(save.edition);
                slot.unlocked = Some(save.unlocked_count());
                slot.marks_reliable = save.marks_reliable;
            }
            Err(e) => slot.parse_error = Some(e.to_string()),
        },
        Err(e) => slot.parse_error = Some(format!("cannot read file: {e}")),
    }
    slot
}

/// Scans a specific folder (also used by the manual "Locate my save..." flow).
pub fn scan_dir(dir: &Path) -> Vec<SaveSlot> {
    let mut slots = Vec::new();
    if let Ok(entries) = std::fs::read_dir(dir) {
        for e in entries.flatten() {
            let path = e.path();
            let name = e.file_name().to_string_lossy().into_owned();
            if path.is_file() && is_save_file(&name) {
                slots.push(slot_from_file(&path, source_label(dir)));
            }
        }
    }
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

    slots.sort_by(|a, b| {
        let rank = |s: &SaveSlot| {
            let cloud = if s.source == "Steam Cloud" { 0 } else if s.source == "Documents" { 1 } else { 2 };
            let plus = if s.edition == Some(Edition::RepentancePlus) { 0 } else { 1 };
            (cloud, plus, s.filename.clone())
        };
        rank(a).cmp(&rank(b))
    });

    slots
}
