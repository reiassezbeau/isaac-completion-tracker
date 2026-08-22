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

/// Résultat d'une fusion : `new` = runs jamais vus (affiché à l'utilisateur),
/// `changed` = nouveaux + mis à jour → indique s'il faut réécrire le disque.
#[derive(Debug, Default, Clone, Copy)]
pub struct MergeReport {
    pub new: usize,
    pub changed: usize,
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
        // ⚠️ NE JAMAIS écrire un contenu de repli en cas d'échec de sérialisation :
        // cela écraserait tout l'historique par `{}`. On échoue proprement.
        let json = serde_json::to_string(self)
            .map_err(|e| std::io::Error::new(std::io::ErrorKind::InvalidData, e))?;
        // Écriture atomique : fichier temporaire puis renommage, pour qu'une
        // coupure en plein write ne laisse pas un JSON tronqué (= historique perdu).
        let path = Self::file_path(app_data_dir);
        let tmp = path.with_extension("json.tmp");
        std::fs::write(&tmp, json)?;
        std::fs::rename(&tmp, &path)
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

    /// Fusionne les runs actuels du mod dans l'archive. Retourne `MergeReport`
    /// (`new` = jamais vus, `changed` = nouveaux + mis à jour → faut-il réécrire).
    pub fn merge_from_mod(&mut self) -> MergeReport {
        let incoming = stats_reader::read_all_runs();
        let mut index: HashMap<String, usize> = self
            .runs
            .iter()
            .enumerate()
            .map(|(i, r)| (r.run_id.clone(), i))
            .collect();

        let mut report = MergeReport::default();
        for run in incoming {
            match index.get(&run.run_id) {
                Some(&i) => {
                    if Self::supersedes(&run, &self.runs[i]) {
                        self.runs[i] = run;
                        report.changed += 1;
                    }
                }
                None => {
                    index.insert(run.run_id.clone(), self.runs.len());
                    self.runs.push(run);
                    report.new += 1;
                    report.changed += 1;
                }
            }
        }
        report
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn run(id: &str, ended: bool, hits: u32) -> Run {
        let mut r = Run {
            run_id: id.into(),
            slot: 1,
            character: "isaac".into(),
            player_type: 0,
            started_frame: 0,
            ended_frame: if ended { Some(10) } else { None },
            ended,
            outcome: if ended { Some("death".into()) } else { None },
            ending: None,
            deepest_stage: 1,
            hits_total: hits,
            shielded_hits: 0,
            hits_by_source: Default::default(),
            hits_by_stage: Default::default(),
            hits: vec![],
            rooms_cleared: None,
            kills: None,
            boss_kills: None,
            duration_frames: None,
            curses: None,
            devil_deals: None,
            final_stage: None,
            final_stage_type: None,
            final_build: vec![],
            death_source: None,
        };
        r.deepest_stage = 1;
        r
    }

    /// Un run EN COURS qui progresse doit être vu comme « changé » (sinon la
    /// progression resterait en mémoire sans jamais être persistée sur disque).
    #[test]
    fn progressing_run_counts_as_changed_not_new() {
        assert!(Archive::supersedes(&run("a", false, 5), &run("a", false, 2)));
        // une cloture remplace toujours un run en cours
        assert!(Archive::supersedes(&run("a", true, 0), &run("a", false, 9)));
        // ...et jamais l'inverse (on ne "dé-cloture" pas un run)
        assert!(!Archive::supersedes(&run("a", false, 99), &run("a", true, 1)));
    }

    /// L'écriture ne doit jamais produire un contenu de repli qui écraserait tout.
    #[test]
    fn save_then_load_roundtrip_preserves_runs() {
        let dir = std::env::temp_dir().join(format!("isaac_arch_test_{}", std::process::id()));
        let _ = std::fs::remove_dir_all(&dir);
        let a = Archive { schema: 1, runs: vec![run("x", true, 3), run("y", false, 1)] };
        a.save(&dir).expect("save");
        let b = Archive::load(&dir);
        assert_eq!(b.runs.len(), 2);
        assert_eq!(b.runs[0].run_id, "x");
        assert_eq!(b.runs[1].hits_total, 1);
        let _ = std::fs::remove_dir_all(&dir);
    }
}
