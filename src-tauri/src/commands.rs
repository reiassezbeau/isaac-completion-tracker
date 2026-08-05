// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! commands — surface Tauri (#[tauri::command]) + état applicatif partagé.

use std::path::PathBuf;
use std::sync::Mutex;

use notify::RecommendedWatcher;
use serde::Serialize;
use tauri::{AppHandle, State};

use crate::engine::{self, State as EngineState};
use crate::knowledge::{Achievement, Character, Ending, Knowledge};
use crate::overrides::Overrides;
use crate::save_locator::{self, SaveSlot};
use crate::save_parser::{self, MarkDifficulty, SaveData, NUM_MARKS};
use crate::watcher;

pub struct AppState {
    pub knowledge: Knowledge,
    pub app_data_dir: PathBuf,
    pub current: Mutex<Option<(SaveData, String)>>,
    pub overrides: Mutex<Overrides>,
    pub watcher: Mutex<Option<RecommendedWatcher>>,
}

impl AppState {
    /// Construit l'état effectif (engine) à partir de la save chargée + overrides.
    fn engine_state(&self) -> Result<EngineState, String> {
        let cur = self.current.lock().unwrap();
        let (save, _) = cur.as_ref().ok_or("Aucune sauvegarde chargée.")?;
        let ov = self.overrides.lock().unwrap();
        Ok(EngineState::build(save, &self.knowledge, &ov))
    }
}

// -- Localisation / chargement ---------------------------------------------

#[tauri::command]
pub fn list_saves() -> Vec<SaveSlot> {
    save_locator::list_saves()
}

#[tauri::command]
pub fn scan_folder(path: String) -> Vec<SaveSlot> {
    save_locator::scan_dir(std::path::Path::new(&path))
}

#[tauri::command]
pub fn load_slot(
    app: AppHandle,
    state: State<AppState>,
    path: String,
) -> Result<engine::Dashboard, String> {
    let bytes = save_locator::read_file_with_retry(std::path::Path::new(&path))
        .map_err(|e| format!("Lecture impossible : {e}"))?;
    let save = save_parser::parse(&bytes).map_err(|e| e.to_string())?;

    // Watcher live sur ce fichier.
    if let Ok(w) = watcher::watch_save(app.clone(), std::path::Path::new(&path)) {
        *state.watcher.lock().unwrap() = Some(w);
    }

    *state.current.lock().unwrap() = Some((save, path));
    dashboard(state)
}

#[tauri::command]
pub fn refresh(state: State<AppState>) -> Result<engine::Dashboard, String> {
    let path = {
        let cur = state.current.lock().unwrap();
        cur.as_ref().map(|(_, p)| p.clone()).ok_or("Aucune sauvegarde chargée.")?
    };
    let bytes = save_locator::read_file_with_retry(std::path::Path::new(&path))
        .map_err(|e| format!("Lecture impossible : {e}"))?;
    let save = save_parser::parse(&bytes).map_err(|e| e.to_string())?;
    *state.current.lock().unwrap() = Some((save, path));
    dashboard(state)
}

// -- Vues -------------------------------------------------------------------

#[tauri::command]
pub fn dashboard(state: State<AppState>) -> Result<engine::Dashboard, String> {
    let st = state.engine_state()?;
    let ov = state.overrides.lock().unwrap();
    Ok(engine::dashboard(&st, &state.knowledge, &ov))
}

#[derive(Serialize)]
pub struct CharacterListItem {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub dlc: String,
    pub unlocked: bool,
    pub marks_hard: usize,
    pub marks_total: usize,
}

#[tauri::command]
pub fn get_characters(state: State<AppState>) -> Result<Vec<CharacterListItem>, String> {
    let st = state.engine_state()?;
    let items = state
        .knowledge
        .characters
        .iter()
        .map(|c| {
            let detail = engine::character_detail(&st, &state.knowledge, &c.id);
            let (unlocked, marks_hard) = match &detail {
                Some(d) => (
                    d.character_unlocked,
                    d.marks.iter().filter(|m| m.status == MarkDifficulty::Hard).count(),
                ),
                None => (true, 0),
            };
            CharacterListItem {
                id: c.id.clone(),
                name: c.name.clone(),
                kind: c.kind.clone(),
                dlc: c.dlc.clone(),
                unlocked,
                marks_hard,
                marks_total: NUM_MARKS,
            }
        })
        .collect();
    Ok(items)
}

#[tauri::command]
pub fn get_character(state: State<AppState>, id: String) -> Result<engine::CharacterDetail, String> {
    let st = state.engine_state()?;
    engine::character_detail(&st, &state.knowledge, &id).ok_or_else(|| format!("Personnage inconnu : {id}"))
}

#[tauri::command]
pub fn predict(
    state: State<AppState>,
    character_id: String,
    target_id: String,
) -> Result<engine::Prediction, String> {
    let st = state.engine_state()?;
    engine::predict(&st, &state.knowledge, &character_id, &target_id)
        .ok_or_else(|| "Combinaison perso/cible inconnue.".to_string())
}

#[tauri::command]
pub fn next_targets(state: State<AppState>, limit: usize) -> Result<Vec<engine::TargetSuggestion>, String> {
    let st = state.engine_state()?;
    Ok(engine::next_targets(&st, &state.knowledge, limit))
}

#[tauri::command]
pub fn get_roadmap(state: State<AppState>) -> Result<engine::Roadmap, String> {
    let st = state.engine_state()?;
    Ok(engine::roadmap(&st, &state.knowledge))
}

#[derive(Serialize)]
pub struct AchievementView {
    #[serde(flatten)]
    pub achievement: Achievement,
    pub unlocked: bool,
    pub overridden: bool,
}

#[tauri::command]
pub fn get_achievements(state: State<AppState>) -> Result<Vec<AchievementView>, String> {
    let st = state.engine_state()?;
    let views = state
        .knowledge
        .achievements
        .iter()
        .map(|a| {
            let idx = (a.id as usize).saturating_sub(1);
            AchievementView {
                unlocked: st.is_unlocked(a.id),
                overridden: st.ach_overridden.get(idx).copied().unwrap_or(false),
                achievement: a.clone(),
            }
        })
        .collect();
    Ok(views)
}

#[tauri::command]
pub fn get_endings(state: State<AppState>) -> Vec<Ending> {
    state.knowledge.endings.clone()
}

#[tauri::command]
pub fn get_characters_static(state: State<AppState>) -> Vec<Character> {
    state.knowledge.characters.clone()
}

// -- Overrides --------------------------------------------------------------

#[tauri::command]
pub fn get_overrides(state: State<AppState>) -> Overrides {
    state.overrides.lock().unwrap().clone()
}

#[tauri::command]
pub fn set_override_achievement(
    state: State<AppState>,
    secret_id: u32,
    value: Option<bool>,
) -> Result<(), String> {
    {
        let mut ov = state.overrides.lock().unwrap();
        match value {
            Some(v) => {
                ov.achievements.insert(secret_id, v);
            }
            None => {
                ov.achievements.remove(&secret_id);
            }
        }
        ov.save(&state.app_data_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn set_override_mark(
    state: State<AppState>,
    char_id: String,
    mark_index: usize,
    value: Option<String>,
) -> Result<(), String> {
    {
        let mut ov = state.overrides.lock().unwrap();
        let key = Overrides::mark_key(&char_id, mark_index);
        match value {
            Some(v) => {
                ov.marks.insert(key, v);
            }
            None => {
                ov.marks.remove(&key);
            }
        }
        ov.save(&state.app_data_dir).map_err(|e| e.to_string())?;
    }
    Ok(())
}

#[tauri::command]
pub fn reset_overrides(state: State<AppState>) -> Result<(), String> {
    let mut ov = state.overrides.lock().unwrap();
    *ov = Overrides::default();
    ov.save(&state.app_data_dir).map_err(|e| e.to_string())?;
    Ok(())
}
