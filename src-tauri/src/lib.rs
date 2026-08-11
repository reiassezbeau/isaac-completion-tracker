// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

mod commands;
mod engine;
mod knowledge;
mod overrides;
mod paths;
mod save_locator;
pub mod save_parser;
mod watcher;

use std::path::PathBuf;
use std::sync::Mutex;

use tauri::Manager;

use commands::AppState;
use knowledge::Knowledge;
use overrides::Overrides;

/// Attribution gravée dans le binaire (couche indépendante, cf. garde-fous §5).
pub const AUTHOR: &str = "reiassezbeau";
pub const REPO_URL: &str = "https://github.com/reiassezbeau/isaac-completion-tracker";
pub const COPYRIGHT: &str = "© 2026 reiassezbeau — https://github.com/reiassezbeau";

/// Résout le dossier `resources` (bundle en prod, `src-tauri/resources` en dev).
fn resources_dir(app: &tauri::App) -> PathBuf {
    if let Ok(res) = app.path().resource_dir() {
        let nested = res.join("resources");
        if nested.join("achievements.json").exists() {
            return nested;
        }
        if res.join("achievements.json").exists() {
            return res;
        }
    }
    // Dev : chemin figé à la compilation.
    PathBuf::from(env!("CARGO_MANIFEST_DIR")).join("resources")
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            println!("Isaac Completion Tracker — {COPYRIGHT}");
            let res_dir = resources_dir(app);
            let knowledge = Knowledge::load(&res_dir)?;
            let app_data_dir = app
                .path()
                .app_data_dir()
                .unwrap_or_else(|_| std::env::temp_dir());
            let overrides = Overrides::load(&app_data_dir);

            app.manage(AppState {
                knowledge,
                app_data_dir,
                current: Mutex::new(None),
                overrides: Mutex::new(overrides),
                watcher: Mutex::new(None),
            });
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::list_saves,
            commands::scan_folder,
            commands::load_slot,
            commands::refresh,
            commands::dashboard,
            commands::get_characters,
            commands::get_character,
            commands::predict,
            commands::next_targets,
            commands::get_roadmap,
            commands::get_achievements,
            commands::get_endings,
            commands::get_characters_static,
            commands::get_overrides,
            commands::set_override_achievement,
            commands::set_override_mark,
            commands::reset_overrides,
            commands::get_health,
            commands::is_tracker_mod_installed,
            commands::install_tracker_mod,
            commands::launch_game,
            commands::backup_save,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
