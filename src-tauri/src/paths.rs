// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! paths - ROBUST resolution of the real game folder.
//!
//! OneDrive pitfall: `dirs::document_dir()` may return
//! `...\OneDrive\Documents` (Known-Folder redirection) while the game writes to
//! `...\Documents` (or the other way around). So we do NOT trust a single path:
//! we test several candidates and keep the one that ACTUALLY contains the
//! game files. That way the app AND the mod install target the same real folder.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub const MOD_FOLDER: &str = "isaac-tracker-mod";

/// Possible game paths under a "Documents" folder (components joined
/// cleanly so the path displays nicely).
pub fn game_roots_under(base: &Path) -> [PathBuf; 2] {
    let my_games = base.join("My Games");
    [
        my_games.join("Binding of Isaac Repentance+"),
        my_games.join("Binding of Isaac Repentance"),
    ]
}

/// A folder is the game root when it contains a known marker.
pub fn is_game_root(p: &Path) -> bool {
    p.join("options.ini").exists() || p.join("log.txt").exists() || p.join("save_backups").is_dir()
}

/// Candidate "Documents" folders (real, personal OneDrive, and business OneDrive).
pub fn documents_candidates() -> Vec<PathBuf> {
    let mut v: Vec<PathBuf> = Vec::new();
    if let Some(d) = dirs::document_dir() {
        v.push(d);
    }
    if let Some(h) = dirs::home_dir() {
        v.push(h.join("Documents"));
        v.push(h.join("OneDrive").join("Documents"));
        // OneDrive Entreprise : dossiers "OneDrive - <organisation>".
        if let Ok(entries) = std::fs::read_dir(&h) {
            for e in entries.flatten() {
                let name = e.file_name().to_string_lossy().into_owned();
                if name.starts_with("OneDrive -") {
                    v.push(e.path().join("Documents"));
                }
            }
        }
    }
    let mut seen = HashSet::new();
    v.into_iter().filter(|p| seen.insert(p.clone())).collect()
}

/// The real game root: the first existing candidate that contains the game files.
pub fn resolve_game_root() -> Option<PathBuf> {
    for base in documents_candidates() {
        for root in game_roots_under(&base) {
            if is_game_root(&root) {
                return Some(root);
            }
        }
    }
    None
}

// --- Resolving the Steam INSTALL folder ------------------------------------
// Key discovery: Isaac loads mods from the Steam install folder
// (`steamapps/common/The Binding of Isaac Rebirth/mods/`), NOT from
// `Documents/.../mods`. Documents is only used for saves, backups, and data.

const ISAAC_STEAM_SUBDIR: &str = "steamapps/common/The Binding of Isaac Rebirth";

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
    for p in ["C:/Program Files (x86)/Steam", "C:/Program Files/Steam"] {
        roots.push(PathBuf::from(p));
    }
    if let Some(h) = dirs::home_dir() {
        roots.push(h.join(".steam/steam"));
        roots.push(h.join(".local/share/Steam"));
    }
    let mut seen = HashSet::new();
    roots.into_iter().filter(|p| seen.insert(p.clone())).collect()
}

/// Steam libraries (the game may live on another drive): the Steam roots
/// plus the paths listed in `steamapps/libraryfolders.vdf`.
fn steam_libraries() -> Vec<PathBuf> {
    let mut libs: Vec<PathBuf> = Vec::new();
    for root in steam_roots() {
        libs.push(root.clone());
        let vdf = root.join("steamapps").join("libraryfolders.vdf");
        if let Ok(txt) = std::fs::read_to_string(&vdf) {
            for line in txt.lines() {
                let line = line.trim();
                if let Some(rest) = line.strip_prefix("\"path\"") {
                    if let (Some(a), Some(b)) = (rest.find('"'), rest.rfind('"')) {
                        if a < b {
                            libs.push(PathBuf::from(rest[a + 1..b].replace("\\\\", "\\")));
                        }
                    }
                }
            }
        }
    }
    let mut seen = HashSet::new();
    libs.into_iter().filter(|p| seen.insert(p.clone())).collect()
}

/// The game's install folder (Steam) - the one that contains `mods/`.
pub fn steam_game_dir() -> Option<PathBuf> {
    for lib in steam_libraries() {
        let dir = lib.join(ISAAC_STEAM_SUBDIR);
        if dir.is_dir() {
            return Some(dir);
        }
    }
    None
}

/// The mods folder is the Steam INSTALL folder / mods (not Documents).
pub fn mods_dir() -> Option<PathBuf> {
    steam_game_dir().map(|g| g.join("mods"))
}

/// Install folder for the companion mod (deterministic).
pub fn tracker_mod_dir() -> Option<PathBuf> {
    mods_dir().map(|m| m.join(MOD_FOLDER))
}

/// Candidate `data/` folders where the mod writes its JSON (SaveData): depending on
/// the version and install, Documents and/or the Steam install folder.
pub fn data_candidates() -> Vec<PathBuf> {
    let mut v = Vec::new();
    if let Some(r) = resolve_game_root() {
        v.push(r.join("data"));
    }
    if let Some(g) = steam_game_dir() {
        v.push(g.join("data"));
    }
    v
}

pub fn data_dir() -> Option<PathBuf> {
    data_candidates().into_iter().find(|d| d.is_dir()).or_else(|| data_candidates().into_iter().next())
}

/// Looks for the mod's data file (`data/<folder>/save<N>.dat`), scanning
/// both possible locations (Documents and Steam).
pub fn find_mod_data_file() -> Option<PathBuf> {
    for data in data_candidates() {
        for name in [MOD_FOLDER, "IsaacTracker"] {
            if let Some(f) = first_save_file(&data.join(name)) {
                return Some(f);
            }
        }
        if let Ok(entries) = std::fs::read_dir(&data) {
            for e in entries.flatten() {
                if e.path().is_dir() {
                    if let Some(f) = first_save_file(&e.path()) {
                        return Some(f);
                    }
                }
            }
        }
    }
    None
}

fn first_save_file(dir: &Path) -> Option<PathBuf> {
    if !dir.is_dir() {
        return None;
    }
    for n in ['1', '2', '3'] {
        let f = dir.join(format!("save{n}.dat"));
        if f.exists() {
            return Some(f);
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn resolves_real_game_root() {
        eprintln!("Candidats Documents :");
        for c in documents_candidates() {
            eprintln!("  - {}", c.display());
        }
        match resolve_game_root() {
            Some(r) => {
                eprintln!("→ Racine Documents (saves/data) : {}", r.display());
                assert!(is_game_root(&r), "the resolved root must contain a game marker");
            }
            None => eprintln!("-> (no Documents game folder detected)"),
        }
        eprintln!("-> Steam game folder: {:?}", steam_game_dir().map(|p| p.display().to_string()));
        eprintln!("-> Mods folder (Steam): {:?}", mods_dir().map(|p| p.display().to_string()));
        eprintln!("→ data candidates : {:?}", data_candidates());
    }
}
