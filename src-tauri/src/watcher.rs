// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! watcher — surveille le fichier de save (notify) et émet un event `save-changed`
//! au front à chaque modification (live update, §5.1).

use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

/// Démarre (ou remplace) la surveillance du fichier `save_path`. Le watcher doit
/// rester vivant : l'appelant le stocke dans l'état de l'app.
pub fn watch_save(app: AppHandle, save_path: &Path) -> notify::Result<RecommendedWatcher> {
    // On surveille le dossier parent (les écritures de save passent souvent par
    // un fichier temporaire + rename, qui n'émet pas d'event « modify » sur la cible).
    let dir = save_path.parent().unwrap_or(save_path).to_path_buf();
    let target = save_path.to_path_buf();
    let last = Arc::new(Mutex::new(Instant::now() - Duration::from_secs(5)));

    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        let Ok(event) = res else { return };
        let touches_target = event.paths.iter().any(|p| {
            p == &target
                || p.file_name() == target.file_name()
        });
        if !touches_target {
            return;
        }
        // Debounce : ignore les rafales < 400 ms.
        {
            let mut guard = last.lock().unwrap();
            if guard.elapsed() < Duration::from_millis(400) {
                return;
            }
            *guard = Instant::now();
        }
        let _ = app.emit("save-changed", ());
    })?;

    watcher.watch(&dir, RecursiveMode::NonRecursive)?;
    Ok(watcher)
}
