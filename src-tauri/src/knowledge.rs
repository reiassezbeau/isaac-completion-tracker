// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! knowledge - loads the bundled knowledge base (offline).
//! The JSON files are generated at dev time by `tools/build-knowledge` and embedded
//! via `tauri.conf.json > bundle > resources`.

use serde::{Deserialize, Serialize};
use std::path::Path;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Unlock {
    pub text: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub character: Option<String>,
    pub target: Option<String>,
    pub predictable: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Achievement {
    pub id: u32,
    pub name: String,
    pub description: String,
    pub category: String,
    pub dlc: String,
    pub hidden: bool,
    pub unlock: Unlock,
    pub reward: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Character {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub kind: String,
    pub dlc: String,
    pub save_index: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Ending {
    pub id: String,
    pub name: String,
    pub mark_index: usize,
    pub hard_matters: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RoutingTip {
    pub id: String,
    pub applies_to: Vec<String>,
    pub title: String,
    pub text: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AchievementsFile {
    achievements: Vec<Achievement>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct RoutingTipsFile {
    tips: Vec<RoutingTip>,
}

#[derive(Debug, Clone)]
pub struct Knowledge {
    pub achievements: Vec<Achievement>,
    pub characters: Vec<Character>,
    pub endings: Vec<Ending>,
    pub routing_tips: Vec<RoutingTip>,
}

#[derive(Debug, thiserror::Error)]
pub enum KnowledgeError {
    #[error("ressource introuvable : {0}")]
    Missing(String),
    #[error("reading {0}: {1}")]
    Io(String, std::io::Error),
    #[error("JSON {0} : {1}")]
    Json(String, serde_json::Error),
}

fn read_json<T: for<'de> Deserialize<'de>>(dir: &Path, name: &str) -> Result<T, KnowledgeError> {
    let path = dir.join(name);
    if !path.exists() {
        return Err(KnowledgeError::Missing(path.display().to_string()));
    }
    let raw = std::fs::read_to_string(&path).map_err(|e| KnowledgeError::Io(name.into(), e))?;
    serde_json::from_str(&raw).map_err(|e| KnowledgeError::Json(name.into(), e))
}

impl Knowledge {
    /// Loads the 4 JSON files from the resolved `resources` folder (dev or bundle).
    pub fn load(resources_dir: &Path) -> Result<Self, KnowledgeError> {
        let ach: AchievementsFile = read_json(resources_dir, "achievements.json")?;
        let characters: Vec<Character> = read_json(resources_dir, "characters.json")?;
        let endings: Vec<Ending> = read_json(resources_dir, "endings.json")?;
        let tips: RoutingTipsFile =
            read_json(resources_dir, "routing_tips.json").unwrap_or(RoutingTipsFile { tips: vec![] });
        Ok(Knowledge {
            achievements: ach.achievements,
            characters,
            endings,
            routing_tips: tips.tips,
        })
    }

    pub fn character(&self, id: &str) -> Option<&Character> {
        self.characters.iter().find(|c| c.id == id)
    }

    pub fn ending(&self, id: &str) -> Option<&Ending> {
        self.endings.iter().find(|e| e.id == id)
    }
}
