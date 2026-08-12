// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! stats_archive — historique PERMANENT des runs, stocke dans l'appdata de l'app
//! (`stats_history.json`). Le mod ne garde qu'un buffer glissant ; l'app conserve
//! TOUT, dedup par `run_id`. A chaque lecture, on fusionne les nouveaux runs du mod.

use std::collections::HashMap;
use std::path::{Path, PathBuf};

use serde::{Deserialize, Serialize};

use crate::stats_reader::{self, Run};

#[derive(Debug, Default, Serialize, Deserialize)]
pub struct Archive {
    #[serde(default = "one")]
    pub schema: u32,
    /// Ordre d'insertion (~chronologique) — utile pour les tendances "N derniers runs".
    #[serde(default)]
    pub runs: Vec<Run>,
}

fn one() -> u32 {
    1
}

impl Archive {
    fn file_path(app_data_dir: &Path) -> PathBuf {
        app_data_dir.join("stats_history.json")
    }

    pub fn load(app_data_dir: &Path) -> Self {
        std::fs::read_to_string(Self::file_path(app_data_dir))
            .ok()
            .and_then(|s| serde_json::from_str::<Archive>(&s).ok())
            .unwrap_or_else(|| Archive { schema: 1, runs: Vec::new() })
    }

    pub fn save(&self, app_data_dir: &Path) -> std::io::Result<()> {
        std::fs::create_dir_all(app_data_dir)?;
        let json = serde_json::to_string(self).unwrap_or_else(|_| "{}".into());
        std::fs::write(Self::file_path(app_data_dir), json)
    }

    /// Un run "remplace" l'existant s'il est plus complet : cloture prioritaire,
    /// sinon plus de hits (run en cours qui a avance).
    fn supersedes(new: &Run, old: &Run) -> bool {
        if new.ended && !old.ended {
            return true;
        }
        if !new.ended && old.ended {
            return false;
        }
        new.hits_total >= old.hits_total
    }

    /// Fusionne les runs actuels du mod dans l'archive. Retourne le nombre de runs
    /// nouveaux (jamais vus). Met a jour les runs existants qui ont progresse/cloture.
    pub fn merge_from_mod(&mut self) -> usize {
        let incoming = stats_reader::read_all_runs();
        let mut index: HashMap<String, usize> = self
            .runs
            .iter()
            .enumerate()
            .map(|(i, r)| (r.run_id.clone(), i))
            .collect();

        let mut new_count = 0;
        for run in incoming {
            match index.get(&run.run_id) {
                Some(&i) => {
                    if Self::supersedes(&run, &self.runs[i]) {
                        self.runs[i] = run;
                    }
                }
                None => {
                    index.insert(run.run_id.clone(), self.runs.len());
                    self.runs.push(run);
                    new_count += 1;
                }
            }
        }
        new_count
    }
}
