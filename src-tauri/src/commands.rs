// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! commands — surface Tauri (#[tauri::command]) + état applicatif partagé.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::RecommendedWatcher;
use serde::Serialize;
use tauri::{AppHandle, Manager, State};

use crate::analytics;
use crate::engine::{self, State as EngineState};
use crate::knowledge::{Achievement, Character, Ending, Knowledge};
use crate::overrides::Overrides;
use crate::paths;
use crate::save_locator::{self, SaveSlot};
use crate::save_parser::{self, Edition, MarkDifficulty, SaveData, NUM_MARKS};
use crate::stats_archive::Archive;
use crate::stats_reader::Run;
use crate::watcher;

pub struct AppState {
    pub knowledge: Knowledge,
    pub app_data_dir: PathBuf,
    pub current: Mutex<Option<(SaveData, String)>>,
    pub overrides: Mutex<Overrides>,
    pub watcher: Mutex<Option<RecommendedWatcher>>,
    pub stats: Mutex<Archive>,
}

impl AppState {
    /// Fusionne les runs du mod dans l'archive et persiste. Retourne le nb de nouveaux.
    fn refresh_stats(&self) -> usize {
        let mut a = self.stats.lock().unwrap();
        let n = a.merge_from_mod();
        let _ = a.save(&self.app_data_dir);
        n
    }
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

// -- Diagnostic / mod / backup ---------------------------------------------

#[derive(Serialize)]
pub struct PathStatus {
    pub path: Option<String>,
    pub exists: bool,
}

fn path_status(p: Option<PathBuf>) -> PathStatus {
    match p {
        Some(p) => PathStatus {
            exists: p.exists(),
            path: Some(p.to_string_lossy().into_owned()),
        },
        None => PathStatus { path: None, exists: false },
    }
}

#[derive(Serialize)]
pub struct HealthReport {
    /// Racine de jeu RÉELLE résolue (gère le piège OneDrive).
    pub game_root: PathStatus,
    pub mods_dir: PathStatus,
    pub data_dir: PathStatus,
    pub steam_save_found: bool,
    pub save_loaded: bool,
    pub save_path: Option<String>,
    pub edition: Option<Edition>,
    pub unlocked: Option<usize>,
    pub total: usize,
    pub checksum_ok: Option<bool>,
    pub marks_reliable: Option<bool>,
    pub mod_installed: bool,
    pub mod_dir: Option<String>,
    pub mod_data_file: Option<String>,
    /// Mom battue sur le slot chargé (proxy : secret 4 « The Womb ») — cf. caveat §2.
    pub mom_beaten: Option<bool>,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub fn get_health(state: State<AppState>) -> HealthReport {
    let game_root = paths::resolve_game_root();
    let mut warnings = Vec::new();

    // Ambiguïté OneDrive : plusieurs "Documents" contiennent-ils un dossier de jeu ?
    let roots_found: Vec<PathBuf> = paths::documents_candidates()
        .into_iter()
        .flat_map(|b| paths::game_roots_under(&b))
        .filter(|p| paths::is_game_root(p))
        .collect();
    if roots_found.len() > 1 {
        warnings.push(format!(
            "Plusieurs dossiers de jeu détectés (OneDrive ?) : {}. L'app utilise le premier réel.",
            roots_found.iter().map(|p| p.display().to_string()).collect::<Vec<_>>().join(" · ")
        ));
    }
    if let Some(r) = &game_root {
        if r.to_string_lossy().contains("OneDrive") {
            warnings.push("Le dossier de jeu est sous OneDrive — la synchro peut déplacer les fichiers.".into());
        }
    } else {
        warnings.push("Dossier de jeu introuvable. Lance le jeu au moins une fois, ou utilise « Localiser ma save… ».".into());
    }

    let mods_dir = paths::mods_dir();
    let data_dir = paths::data_dir();
    let tracker_dir = paths::tracker_mod_dir();
    let mod_installed = tracker_dir.as_ref().map(|d| d.join("main.lua").exists()).unwrap_or(false);
    let mod_data_file = paths::find_mod_data_file();

    let slots = save_locator::list_saves();
    let steam_save_found = slots.iter().any(|s| s.source == "Steam Cloud");

    let cur = state.current.lock().unwrap();
    let (save_loaded, save_path, edition, unlocked, checksum_ok, marks_reliable, mom_beaten) =
        if let Some((save, path)) = cur.as_ref() {
            (
                true,
                Some(path.clone()),
                Some(save.edition),
                Some(save.unlocked_count()),
                Some(save.checksum_ok),
                Some(save.marks_reliable),
                Some(save.is_unlocked(4)), // secret 4 = "The Womb" (Defeat Mom)
            )
        } else {
            (false, None, None, None, None, None, None)
        };

    HealthReport {
        game_root: path_status(game_root),
        mods_dir: path_status(mods_dir),
        data_dir: path_status(data_dir),
        steam_save_found,
        save_loaded,
        save_path,
        edition,
        unlocked,
        total: save_parser::NUM_ACHIEVEMENTS,
        checksum_ok,
        marks_reliable,
        mod_installed,
        mod_dir: tracker_dir.map(|d| d.to_string_lossy().into_owned()),
        mod_data_file: mod_data_file.map(|d| d.to_string_lossy().into_owned()),
        mom_beaten,
        warnings,
    }
}

/// Source des fichiers du mod : bundle (resource_dir/isaac-tracker-mod) ou dev (repo).
fn mod_source_dir(app: &AppHandle) -> Option<PathBuf> {
    if let Ok(res) = app.path().resource_dir() {
        let p = res.join(paths::MOD_FOLDER);
        if p.join("main.lua").exists() {
            return Some(p);
        }
    }
    let dev = PathBuf::from(env!("CARGO_MANIFEST_DIR"))
        .parent()?
        .join(paths::MOD_FOLDER);
    if dev.join("main.lua").exists() {
        return Some(dev);
    }
    None
}

#[tauri::command]
pub fn is_tracker_mod_installed() -> bool {
    paths::tracker_mod_dir().map(|d| d.join("main.lua").exists()).unwrap_or(false)
}

#[tauri::command]
pub fn install_tracker_mod(app: AppHandle) -> Result<String, String> {
    let src = mod_source_dir(&app).ok_or("Fichiers du mod introuvables dans les ressources de l'app.")?;
    let dest = paths::tracker_mod_dir()
        .ok_or("Dossier de jeu introuvable — lance le jeu au moins une fois, puis réessaie.")?;
    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    for f in ["metadata.xml", "main.lua"] {
        std::fs::copy(src.join(f), dest.join(f)).map_err(|e| format!("copie {f} : {e}"))?;
    }
    Ok(dest.to_string_lossy().into_owned())
}

/// Lance Isaac via Steam (le mod ne fonctionne qu'une fois le jeu (re)démarré).
#[tauri::command]
pub fn launch_game(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url("steam://rungameid/250900", None::<&str>)
        .map_err(|e| e.to_string())
}

/// Copie datée de la sauvegarde dans l'appdata (filet de sécurité avant install mod).
#[tauri::command]
pub fn backup_save(state: State<AppState>, slot_path: String) -> Result<String, String> {
    let src = Path::new(&slot_path);
    let bytes = save_locator::read_file_with_retry(src).map_err(|e| e.to_string())?;
    let backups = state.app_data_dir.join("save_backups");
    std::fs::create_dir_all(&backups).map_err(|e| e.to_string())?;
    let ts = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|d| d.as_secs())
        .unwrap_or(0);
    let base = src
        .file_name()
        .map(|s| s.to_string_lossy().into_owned())
        .unwrap_or_else(|| "save.dat".into());
    let dest = backups.join(format!("{base}.{ts}.bak"));
    std::fs::write(&dest, &bytes).map_err(|e| e.to_string())?;
    Ok(dest.to_string_lossy().into_owned())
}

// -- Stats (mod) ------------------------------------------------------------

/// Fusionne les nouveaux runs du mod dans l'archive. Retourne le nb de nouveaux runs.
#[tauri::command]
pub fn refresh_stats(state: State<AppState>) -> usize {
    state.refresh_stats()
}

#[tauri::command]
pub fn get_stats_overview(state: State<AppState>) -> analytics::StatsOverview {
    state.refresh_stats();
    let a = state.stats.lock().unwrap();
    analytics::overview(&a.runs)
}

#[tauri::command]
pub fn get_insights(state: State<AppState>) -> analytics::Insights {
    state.refresh_stats();
    let a = state.stats.lock().unwrap();
    analytics::insights(&a.runs)
}

#[tauri::command]
pub fn get_character_stats(state: State<AppState>, char_id: String) -> analytics::CharacterStats {
    state.refresh_stats();
    let a = state.stats.lock().unwrap();
    analytics::character_stats(&a.runs, &char_id)
}

/// Historique des runs (les plus récents d'abord), limité.
#[tauri::command]
pub fn get_run_history(state: State<AppState>, limit: usize) -> Vec<Run> {
    state.refresh_stats();
    let a = state.stats.lock().unwrap();
    a.runs.iter().rev().take(limit).cloned().collect()
}
