// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! paths — résolution ROBUSTE du dossier de jeu réel.
//!
//! ⚠️ Piège OneDrive : `dirs::document_dir()` peut renvoyer
//! `…\OneDrive\Documents` (redirection Known-Folder) alors que le jeu écrit dans
//! `…\Documents` (ou l'inverse). On ne fait donc PAS confiance à un seul chemin :
//! on teste plusieurs candidats et on garde celui qui contient VRAIMENT les
//! fichiers du jeu. L'app ET l'install du mod ciblent ainsi le même dossier réel.

use std::collections::HashSet;
use std::path::{Path, PathBuf};

pub const MOD_FOLDER: &str = "isaac-tracker-mod";

/// Chemins de jeu possibles sous un dossier « Documents » (composants joints
/// proprement pour un affichage lisible du chemin).
pub fn game_roots_under(base: &Path) -> [PathBuf; 2] {
    let my_games = base.join("My Games");
    [
        my_games.join("Binding of Isaac Repentance+"),
        my_games.join("Binding of Isaac Repentance"),
    ]
}

/// Un dossier est la racine du jeu s'il contient un marqueur connu.
pub fn is_game_root(p: &Path) -> bool {
    p.join("options.ini").exists() || p.join("log.txt").exists() || p.join("save_backups").is_dir()
}

/// Dossiers « Documents » candidats (réel + OneDrive perso + OneDrive entreprise).
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

/// Racine de jeu réelle : premier candidat existant contenant les fichiers du jeu.
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

// --- Résolution du dossier d'INSTALLATION Steam ---------------------------
// ⚠️ Découverte clé : Isaac charge les mods depuis le dossier d'installation
// Steam (`steamapps/common/The Binding of Isaac Rebirth/mods/`), PAS depuis
// `Documents/.../mods`. Documents ne sert que pour saves/backups/data.

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

/// Bibliothèques Steam (le jeu peut être sur un autre disque) : les racines Steam
/// + les chemins listés dans `steamapps/libraryfolders.vdf`.
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

/// Dossier d'installation du jeu (Steam) — celui qui contient `mods/`.
pub fn steam_game_dir() -> Option<PathBuf> {
    for lib in steam_libraries() {
        let dir = lib.join(ISAAC_STEAM_SUBDIR);
        if dir.is_dir() {
            return Some(dir);
        }
    }
    None
}

/// Dossier des mods = dossier d'INSTALLATION Steam / mods (pas Documents).
pub fn mods_dir() -> Option<PathBuf> {
    steam_game_dir().map(|g| g.join("mods"))
}

/// Dossier d'install du mod compagnon (déterministe).
pub fn tracker_mod_dir() -> Option<PathBuf> {
    mods_dir().map(|m| m.join(MOD_FOLDER))
}

/// Dossiers `data/` candidats où le mod écrit son JSON (SaveData) : selon les
/// versions/installations, Documents et/ou le dossier d'install Steam.
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

/// Cherche le fichier de données du mod (`data/<dossier>/save<N>.dat`), en
/// scannant les deux emplacements possibles (Documents et Steam).
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
                assert!(is_game_root(&r), "la racine résolue doit contenir un marqueur de jeu");
            }
            None => eprintln!("→ (aucun dossier de jeu Documents détecté)"),
        }
        eprintln!("→ Dossier jeu Steam : {:?}", steam_game_dir().map(|p| p.display().to_string()));
        eprintln!("→ Dossier mods (Steam) : {:?}", mods_dir().map(|p| p.display().to_string()));
        eprintln!("→ data candidates : {:?}", data_candidates());
    }
}
