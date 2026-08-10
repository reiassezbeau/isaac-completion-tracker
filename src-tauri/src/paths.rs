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

pub fn mods_dir() -> Option<PathBuf> {
    resolve_game_root().map(|r| r.join("mods"))
}

pub fn data_dir() -> Option<PathBuf> {
    resolve_game_root().map(|r| r.join("data"))
}

/// Dossier d'install du mod compagnon (déterministe).
pub fn tracker_mod_dir() -> Option<PathBuf> {
    mods_dir().map(|m| m.join(MOD_FOLDER))
}

/// Cherche un fichier de données du mod (`data/<dossier>/save<N>.dat`). Le nom du
/// sous-dossier peut varier (nom de dossier du mod vs nom d'enregistrement) → on
/// scanne. Retourne le premier fichier trouvé.
pub fn find_mod_data_file() -> Option<PathBuf> {
    let data = data_dir()?;
    // Candidats prioritaires connus.
    for name in [MOD_FOLDER, "IsaacTracker"] {
        let dir = data.join(name);
        if let Some(f) = first_save_file(&dir) {
            return Some(f);
        }
    }
    // Sinon, scan de tous les sous-dossiers de data/.
    if let Ok(entries) = std::fs::read_dir(&data) {
        for e in entries.flatten() {
            if e.path().is_dir() {
                if let Some(f) = first_save_file(&e.path()) {
                    return Some(f);
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
                eprintln!("→ Racine de jeu résolue : {}", r.display());
                assert!(is_game_root(&r), "la racine résolue doit contenir un marqueur de jeu");
            }
            None => eprintln!("→ (aucun dossier de jeu détecté sur cette machine)"),
        }
    }
}
