// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! watcher - watches the save file (notify) and emits a `save-changed` event
//! to the front end on every change (live update, §5.1).

use std::path::Path;
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

/// Starts (or replaces) watching the `save_path` file. The watcher must
/// stay alive: the caller stores it in the app state.
pub fn watch_save(app: AppHandle, save_path: &Path) -> notify::Result<RecommendedWatcher> {
    // We watch the parent folder (save writes often go through
    // a temp file plus a rename, which emits no "modify" event on the target).
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
        // Debounce: ignores bursts shorter than 400 ms.
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
