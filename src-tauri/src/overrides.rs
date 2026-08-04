//! overrides — corrections manuelles (filet de sécurité, §5.7).
//! Stockées dans l'appdata de l'app (`overrides.json`), JAMAIS dans la save du jeu.
//! Appliquées PAR-DESSUS les données parsées.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::path::{Path, PathBuf};

use crate::save_parser::MarkDifficulty;

/// Clé d'une mark : "<character_id>:<mark_index>".
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct Overrides {
    /// secret-ID (1..=641) -> débloqué/verrouillé forcé.
    #[serde(default)]
    pub achievements: HashMap<u32, bool>,
    /// "charId:markIndex" -> "none" | "normal" | "hard".
    #[serde(default)]
    pub marks: HashMap<String, String>,
}

impl Overrides {
    fn file_path(app_data_dir: &Path) -> PathBuf {
        app_data_dir.join("overrides.json")
    }

    pub fn load(app_data_dir: &Path) -> Self {
        let path = Self::file_path(app_data_dir);
        std::fs::read_to_string(path)
            .ok()
            .and_then(|s| serde_json::from_str(&s).ok())
            .unwrap_or_default()
    }

    pub fn save(&self, app_data_dir: &Path) -> std::io::Result<()> {
        std::fs::create_dir_all(app_data_dir)?;
        let json = serde_json::to_string_pretty(self).unwrap_or_else(|_| "{}".into());
        std::fs::write(Self::file_path(app_data_dir), json)
    }

    pub fn is_empty(&self) -> bool {
        self.achievements.is_empty() && self.marks.is_empty()
    }

    pub fn mark_key(char_id: &str, mark_index: usize) -> String {
        format!("{char_id}:{mark_index}")
    }

    /// Override d'une mark, décodé en difficulté (None si absent).
    pub fn mark(&self, char_id: &str, mark_index: usize) -> Option<MarkDifficulty> {
        self.marks.get(&Self::mark_key(char_id, mark_index)).map(|s| match s.as_str() {
            "hard" => MarkDifficulty::Hard,
            "normal" => MarkDifficulty::Normal,
            _ => MarkDifficulty::None,
        })
    }

    /// Override d'un succès (None si absent).
    pub fn achievement(&self, secret_id: u32) -> Option<bool> {
        self.achievements.get(&secret_id).copied()
    }
}
