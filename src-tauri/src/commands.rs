// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! commands - the Tauri surface (#[tauri::command]) plus shared app state.

use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::RecommendedWatcher;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Manager, State};

use crate::analytics;
use crate::build_assistant::{self, BuildRules, ItemDb, ItemKb};
use crate::engine::{self, State as EngineState};
use crate::ev_engine::{self, EvConfig, Route};
use crate::knowledge::{Achievement, Character, Ending, Knowledge};
use crate::overrides::Overrides;
use crate::paths;
use crate::save_locator::{self, SaveSlot};
use crate::save_parser::{self, Edition, SaveData, NUM_MARKS};
use crate::stats_archive::Archive;
use crate::stats_reader::Run;
use crate::watcher;

/// UI preferences persisted by the backend (`ui_prefs.json` in the app data folder).
/// Kept deliberately tiny and fully optional so an older or hand-edited file can
/// never stop the app from starting.
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UiPrefs {
    #[serde(default)]
    pub lang: Option<String>,
    #[serde(default)]
    pub theme: Option<String>,
}

impl UiPrefs {
    fn file(app_data_dir: &Path) -> PathBuf {
        app_data_dir.join("ui_prefs.json")
    }
    pub fn load(app_data_dir: &Path) -> Self {
        std::fs::read_to_string(Self::file(app_data_dir))
            .ok()
            .and_then(|raw| serde_json::from_str(&raw).ok())
            .unwrap_or_default()
    }
    pub fn save(&self, app_data_dir: &Path) -> Result<(), String> {
        std::fs::create_dir_all(app_data_dir).map_err(|e| e.to_string())?;
        let raw = serde_json::to_string_pretty(self).map_err(|e| e.to_string())?;
        // Same atomic write as the stats archive: a crash mid-write must not leave
        // a truncated file that would reset the user's language on next launch.
        let tmp = Self::file(app_data_dir).with_extension("json.tmp");
        std::fs::write(&tmp, raw).map_err(|e| e.to_string())?;
        std::fs::rename(&tmp, Self::file(app_data_dir)).map_err(|e| e.to_string())
    }
}

pub struct AppState {
    pub knowledge: Knowledge,
    pub app_data_dir: PathBuf,
    pub current: Mutex<Option<(SaveData, String)>>,
    pub overrides: Mutex<Overrides>,
    pub watcher: Mutex<Option<RecommendedWatcher>>,
    pub stats: Mutex<Archive>,
    /// Last mod-to-archive merge (guards against I/O amplification).
    pub stats_merged_at: Mutex<Option<std::time::Instant>>,
    pub routes: Vec<Route>,
    pub ev_config: EvConfig,
    pub item_db: ItemDb,
    pub build_rules: BuildRules,
}

/// I/O amplification guard: opening the Stats view fires 3-4 commands in a row;
/// without this, each one would re-scan the disk AND rewrite the whole history.
const STATS_MERGE_TTL: std::time::Duration = std::time::Duration::from_millis(1500);

impl AppState {
    /// Merges the mod's runs into the archive and persists. Returns the number of new runs.
    /// Writes to disk ONLY when something actually changed.
    fn refresh_stats(&self) -> usize {
        {
            // Merged less than TTL ago, so leave the disk alone.
            let last = self.stats_merged_at.lock().unwrap();
            if last.map(|t| t.elapsed() < STATS_MERGE_TTL).unwrap_or(false) {
                return 0;
            }
        }
        let mut a = self.stats.lock().unwrap();
        let report = a.merge_from_mod();
        // We rewrite as soon as anything changed (a new run OR an updated one),
        // not just for new ones; otherwise an in-progress run's progress
        // would stay in memory without ever being persisted.
        if report.changed > 0 {
            let _ = a.save(&self.app_data_dir);
        }
        *self.stats_merged_at.lock().unwrap() = Some(std::time::Instant::now());
        report.new
    }

    /// Forces the merge (explicit button), ignoring the TTL.
    fn refresh_stats_forced(&self) -> usize {
        *self.stats_merged_at.lock().unwrap() = None;
        self.refresh_stats()
    }
}

impl AppState {
    /// Builds the effective (engine) state from the loaded save plus overrides.
    fn engine_state(&self) -> Result<EngineState, String> {
        let cur = self.current.lock().unwrap();
        let (save, _) = cur.as_ref().ok_or("No save loaded.")?;
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
        .map_err(|e| format!("Cannot read file: {e}"))?;
    let save = save_parser::parse(&bytes).map_err(|e| e.to_string())?;

    // Live watcher on this file.
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
        cur.as_ref().map(|(_, p)| p.clone()).ok_or("No save loaded.")?
    };
    let bytes = save_locator::read_file_with_retry(std::path::Path::new(&path))
        .map_err(|e| format!("Cannot read file: {e}"))?;
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
            // Lightweight path: no full CharacterDetail, which would scan
            // 641 achievements x 12 endings x 34 characters just for two counters.
            let (unlocked, marks_hard) = engine::character_summary(&st, &state.knowledge, c);
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
    engine::character_detail(&st, &state.knowledge, &id).ok_or_else(|| format!("Unknown character: {id}"))
}

#[tauri::command]
pub fn predict(
    state: State<AppState>,
    character_id: String,
    target_id: String,
) -> Result<engine::Prediction, String> {
    let st = state.engine_state()?;
    engine::predict(&st, &state.knowledge, &character_id, &target_id)
        .ok_or_else(|| "Unknown character/target combination.".to_string())
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

/// The signature 34 x 12 grid (every character x every mark).
#[tauri::command]
pub fn get_marks_matrix(state: State<AppState>) -> Result<engine::MarksMatrix, String> {
    let st = state.engine_state()?;
    Ok(engine::marks_matrix(&st, &state.knowledge))
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
    /// The REAL resolved game root (handles the OneDrive pitfall).
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
    /// Whether Mom has been beaten on the loaded slot (proxy: secret 4, "The Womb") - see caveat §2.
    pub mom_beaten: Option<bool>,
    pub warnings: Vec<String>,
}

#[tauri::command]
pub fn get_health(state: State<AppState>) -> HealthReport {
    let game_root = paths::resolve_game_root();
    let mut warnings = Vec::new();

    // OneDrive ambiguity: do several "Documents" folders contain a game folder?
    let roots_found: Vec<PathBuf> = paths::documents_candidates()
        .into_iter()
        .flat_map(|b| paths::game_roots_under(&b))
        .filter(|p| paths::is_game_root(p))
        .collect();
    if roots_found.len() > 1 {
        warnings.push(format!(
            "Several game folders detected (OneDrive?): {}. The app uses the first real one.",
            roots_found.iter().map(|p| p.display().to_string()).collect::<Vec<_>>().join(" · ")
        ));
    }
    if let Some(r) = &game_root {
        if r.to_string_lossy().contains("OneDrive") {
            warnings.push("The game folder sits under OneDrive; syncing may move files around.".into());
        }
    } else {
        warnings.push("Game folder not found. Launch the game at least once, or use \"Locate my save…\".".into());
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

/// Where the mod files come from: the bundle (resource_dir/isaac-tracker-mod) or dev (the repo).
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
    let src = mod_source_dir(&app).ok_or("Mod files not found in the app resources.")?;
    let dest = paths::tracker_mod_dir()
        .ok_or("Game folder not found. Launch the game at least once, then try again.")?;
    std::fs::create_dir_all(&dest).map_err(|e| e.to_string())?;
    for f in ["metadata.xml", "main.lua"] {
        std::fs::copy(src.join(f), dest.join(f)).map_err(|e| format!("copie {f} : {e}"))?;
    }
    // The generated item KB ships alongside the mod when present; not a blocker otherwise.
    let kb = src.join("item_kb.lua");
    if kb.exists() {
        let _ = std::fs::copy(kb, dest.join("item_kb.lua"));
    }
    Ok(dest.to_string_lossy().into_owned())
}

/// Launches Isaac through Steam (the mod only works once the game is (re)started).
#[tauri::command]
pub fn launch_game(app: AppHandle) -> Result<(), String> {
    use tauri_plugin_opener::OpenerExt;
    app.opener()
        .open_url("steam://rungameid/250900", None::<&str>)
        .map_err(|e| e.to_string())
}

/// A dated copy of the save in the app data folder (a safety net before installing the mod).
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

/// Merges the mod's new runs into the archive. Returns the number of new runs.
/// An explicit user action, so the TTL is ignored.
#[tauri::command]
pub fn refresh_stats(state: State<AppState>) -> usize {
    state.refresh_stats_forced()
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

/// Run history (most recent first), limited.
#[tauri::command]
pub fn get_run_history(state: State<AppState>, limit: usize) -> Vec<Run> {
    state.refresh_stats();
    let a = state.stats.lock().unwrap();
    a.runs.iter().rev().take(limit).cloned().collect()
}

// -- Optimiseur (moteur EV) -------------------------------------------------

/// The optimizer's report: next actions ranked by expected gain
/// toward Dead God (value x probability), bottlenecks, almost-done characters, and the ETA.
#[tauri::command]
pub fn get_optimizer(state: State<AppState>, limit: usize) -> Result<ev_engine::OptimizerReport, String> {
    state.refresh_stats();
    let st = state.engine_state()?;
    let a = state.stats.lock().unwrap();
    Ok(ev_engine::optimizer(
        &st,
        &state.knowledge,
        &a.runs,
        &state.routes,
        &state.ev_config,
        limit,
    ))
}

// -- Shareable stats card (PNG) ---------------------------------------------

/// Writes the PNG bytes of a stats card (rendered on the front end's canvas)
/// to the path chosen by the user. Fully local, no network.
#[tauri::command]
pub fn save_stat_card(path: String, bytes: Vec<u8>) -> Result<String, String> {
    let p = Path::new(&path);
    if let Some(dir) = p.parent() {
        std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    }
    std::fs::write(p, &bytes).map_err(|e| format!("Cannot write file: {e}"))?;
    Ok(p.to_string_lossy().into_owned())
}

// -- Build Assistant --------------------------------------------------------

/// The item knowledge base (for the simulator's picker).
#[tauri::command]
pub fn get_item_kb(state: State<AppState>) -> Vec<ItemKb> {
    state.item_db.items.clone()
}

/// Every collectible id -> name. The knowledge base only covers the items the
/// assistant reasons about, but a run snapshot holds whatever the player carried,
/// so the UI needs this to show a name instead of a raw id.
#[tauri::command]
pub fn get_item_names(state: State<AppState>) -> std::collections::HashMap<String, String> {
    state
        .item_db
        .names
        .iter()
        .map(|(id, name)| (id.to_string(), name.clone()))
        .collect()
}

// -- Updates ----------------------------------------------------------------

/// Asks GitHub whether a newer release exists. This is the ONLY network call in the
/// app, and it only ever runs on an explicit click - never on a timer or at startup.
#[tauri::command]
pub fn check_for_update() -> Result<crate::updater::UpdateInfo, String> {
    crate::updater::check(env!("CARGO_PKG_VERSION"))
}

/// Downloads the installer for an update and verifies its SHA-256 against the
/// checksum published with the release. Returns the local path; a file whose hash
/// does not match is refused and never written where it could be run.
#[tauri::command]
pub fn download_update(info: crate::updater::UpdateInfo) -> Result<String, String> {
    let path = crate::updater::download_verified(&info)?;
    Ok(path.to_string_lossy().into_owned())
}

/// Runs an installer that `download_update` already verified, then closes the app so
/// the installer can replace files that would otherwise be locked. Refuses any path
/// that is not the one we just wrote into our own temp folder.
#[tauri::command]
pub fn install_update(app: AppHandle, installer_path: String) -> Result<(), String> {
    let path = PathBuf::from(&installer_path);
    let expected_dir = std::env::temp_dir().join("isaac-completion-tracker-update");
    if path.parent() != Some(expected_dir.as_path()) || !path.is_file() {
        return Err("Unexpected installer path - refusing to run it.".into());
    }
    #[cfg(windows)]
    {
        std::process::Command::new(&path)
            .spawn()
            .map_err(|e| format!("Could not start the installer: {e}"))?;
        // Let the installer take over before we release our file locks.
        std::thread::sleep(std::time::Duration::from_millis(400));
        app.exit(0);
        Ok(())
    }
    #[cfg(not(windows))]
    {
        let _ = app;
        Err("The bundled installer is Windows-only.".into())
    }
}

// -- UI preferences ---------------------------------------------------------

/// Language and theme, stored in the app data folder. The web view's localStorage is
/// the fast path, but it lives in the WebView2 profile and can be wiped independently
/// of the app - this file is the authority, so a chosen language really does stay
/// chosen until the user changes it again.
#[tauri::command]
pub fn get_ui_prefs(state: State<AppState>) -> UiPrefs {
    UiPrefs::load(&state.app_data_dir)
}

#[tauri::command]
pub fn set_ui_prefs(state: State<AppState>, prefs: UiPrefs) -> Result<(), String> {
    prefs.save(&state.app_data_dir)
}

/// Features A + B: composition plus strengths/weaknesses for a build (a list of item IDs).
#[tauri::command]
pub fn analyze_build(state: State<AppState>, item_ids: Vec<i64>) -> build_assistant::BuildAnalysis {
    build_assistant::analyze(&state.item_db, &item_ids, &state.build_rules)
}

/// Feature C: "try synergy" - delta, notes, verdict, and the before/after radar.
#[tauri::command]
pub fn try_synergy(
    state: State<AppState>,
    build_ids: Vec<i64>,
    candidate_id: i64,
) -> Result<build_assistant::SynergyResult, String> {
    build_assistant::try_synergy(&state.item_db, &build_ids, candidate_id)
        .ok_or_else(|| format!("Item candidat inconnu : {candidate_id}"))
}
