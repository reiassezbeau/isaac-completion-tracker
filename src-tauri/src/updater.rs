// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! updater - the ONLY place in this app that touches the network, and only when the
//! user clicks "Check for updates".
//!
//! The app is offline by design: nothing here runs on a timer, at startup, or in the
//! background. One click asks GitHub for the latest release, a second click downloads
//! the installer. Nothing about the player's save, progress, or machine is ever sent -
//! the requests are plain public GETs with no query string and no identifying header
//! beyond a User-Agent (GitHub's API requires one).
//!
//! The download is verified against the SHA256SUMS.txt published alongside the
//! installer BEFORE it is allowed to run. A file that does not match is deleted and
//! the update is refused, so a corrupted or tampered download can never be executed.

use std::io::Read;
use std::path::PathBuf;

use serde::{Deserialize, Serialize};

const RELEASES_API: &str =
    "https://api.github.com/repos/reiassezbeau/isaac-completion-tracker/releases/latest";
const RELEASES_PAGE: &str = "https://github.com/reiassezbeau/isaac-completion-tracker/releases/latest";
const UA: &str = "IsaacCompletionTracker (+https://github.com/reiassezbeau/isaac-completion-tracker)";

/// Everything the UI needs to describe an update, without a second round trip.
/// `Deserialize` too: the front end hands the same object back to `download_update`
/// so the download step never re-queries GitHub.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct UpdateInfo {
    /// True only when the published release is strictly newer than what is running.
    pub available: bool,
    pub current_version: String,
    pub latest_version: String,
    /// Release notes (markdown), trimmed to something a dialog can show.
    pub notes: String,
    pub release_url: String,
    /// Direct link to the .exe installer, when the release publishes one.
    pub installer_url: Option<String>,
    pub installer_name: Option<String>,
    pub installer_size: Option<u64>,
    /// Expected SHA-256 read from the release's SHA256SUMS.txt. Without it we refuse
    /// to run the installer, so an unsigned release cannot be auto-installed.
    pub sha256: Option<String>,
}

#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
    size: u64,
}

#[derive(Debug, Deserialize)]
struct GhRelease {
    tag_name: String,
    #[serde(default)]
    body: String,
    html_url: String,
    #[serde(default)]
    assets: Vec<GhAsset>,
}

fn agent() -> ureq::Agent {
    ureq::AgentBuilder::new()
        .timeout_connect(std::time::Duration::from_secs(10))
        .timeout_read(std::time::Duration::from_secs(60))
        .user_agent(UA)
        .build()
}

/// Compares two dotted versions numerically ("0.10.0" > "0.9.9"), ignoring a leading
/// "v" and any pre-release suffix. Returns true when `latest` is strictly newer.
fn is_newer(latest: &str, current: &str) -> bool {
    fn parts(v: &str) -> Vec<u64> {
        v.trim()
            .trim_start_matches(['v', 'V'])
            .split('-')
            .next()
            .unwrap_or("")
            .split('.')
            .map(|p| p.parse::<u64>().unwrap_or(0))
            .collect()
    }
    let (a, b) = (parts(latest), parts(current));
    for i in 0..a.len().max(b.len()) {
        let (x, y) = (a.get(i).copied().unwrap_or(0), b.get(i).copied().unwrap_or(0));
        if x != y {
            return x > y;
        }
    }
    false
}

/// Finds the expected SHA-256 for `filename` inside a `SHA256SUMS.txt` body
/// ("<64 hex>  <filename>" per line, the format `sha256sum` writes).
fn sha_for(sums: &str, filename: &str) -> Option<String> {
    for line in sums.lines() {
        let mut it = line.split_whitespace();
        let hash = it.next()?;
        let name = it.next().unwrap_or("").trim_start_matches('*');
        if name.eq_ignore_ascii_case(filename) && hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit())
        {
            return Some(hash.to_ascii_lowercase());
        }
    }
    None
}

fn sha256_hex(bytes: &[u8]) -> String {
    use sha2::{Digest, Sha256};
    let mut h = Sha256::new();
    h.update(bytes);
    h.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

/// Asks GitHub for the latest release. Network errors are returned as messages so the
/// UI can say "could not reach GitHub" instead of looking broken.
pub fn check(current_version: &str) -> Result<UpdateInfo, String> {
    let body = agent()
        .get(RELEASES_API)
        .set("Accept", "application/vnd.github+json")
        .call()
        .map_err(|e| format!("{e}"))?
        .into_string()
        .map_err(|e| format!("{e}"))?;
    let rel: GhRelease = serde_json::from_str(&body).map_err(|e| format!("{e}"))?;

    let installer = rel
        .assets
        .iter()
        .find(|a| a.name.to_ascii_lowercase().ends_with("-setup.exe"));

    // The checksum file is small; fetching it here means the install step has nothing
    // left to decide and can refuse immediately when it is missing.
    let sha256 = match (
        installer,
        rel.assets.iter().find(|a| a.name.eq_ignore_ascii_case("SHA256SUMS.txt")),
    ) {
        (Some(exe), Some(sums)) => agent()
            .get(&sums.browser_download_url)
            .call()
            .ok()
            .and_then(|r| r.into_string().ok())
            .and_then(|txt| sha_for(&txt, &exe.name)),
        _ => None,
    };

    let notes = rel.body.chars().take(4000).collect::<String>();
    Ok(UpdateInfo {
        available: is_newer(&rel.tag_name, current_version),
        current_version: current_version.to_string(),
        latest_version: rel.tag_name.trim_start_matches('v').to_string(),
        notes,
        release_url: if rel.html_url.is_empty() { RELEASES_PAGE.into() } else { rel.html_url },
        installer_url: installer.map(|a| a.browser_download_url.clone()),
        installer_name: installer.map(|a| a.name.clone()),
        installer_size: installer.map(|a| a.size),
        sha256,
    })
}

/// Downloads the installer to a temp folder and verifies its SHA-256. Returns the
/// path only when the hash matches; otherwise the file is removed and an error is
/// returned. Nothing is executed here - launching is a separate, explicit step.
pub fn download_verified(info: &UpdateInfo) -> Result<PathBuf, String> {
    let url = info.installer_url.as_deref().ok_or("This release has no .exe installer.")?;
    let name = info.installer_name.as_deref().unwrap_or("isaac-tracker-setup.exe");
    let expected = info
        .sha256
        .as_deref()
        .ok_or("This release publishes no SHA256SUMS.txt, so the download cannot be verified. Install it manually from the release page.")?;

    let resp = agent().get(url).call().map_err(|e| format!("{e}"))?;
    let len: usize = resp
        .header("Content-Length")
        .and_then(|v| v.parse().ok())
        .unwrap_or(8 * 1024 * 1024);
    // Hard ceiling: the installer is ~2 MB, so anything past 128 MB is not our asset.
    let mut bytes = Vec::with_capacity(len.min(128 * 1024 * 1024));
    resp.into_reader()
        .take(128 * 1024 * 1024)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("{e}"))?;

    let got = sha256_hex(&bytes);
    if got != expected {
        return Err(format!(
            "Checksum mismatch - the download was NOT installed.\nexpected {expected}\ngot      {got}"
        ));
    }

    let dir = std::env::temp_dir().join("isaac-completion-tracker-update");
    std::fs::create_dir_all(&dir).map_err(|e| format!("{e}"))?;
    let path = dir.join(name);
    std::fs::write(&path, &bytes).map_err(|e| format!("{e}"))?;
    Ok(path)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// The only test here that leaves the machine, so it is `#[ignore]`d and never
    /// runs in a normal `cargo test`. Run it deliberately after publishing a release:
    ///
    ///   cargo test --lib updater::tests::live -- --ignored --nocapture
    ///
    /// It exercises the real shipped code path against the real published release -
    /// fetch the release, find the installer, read SHA256SUMS.txt, download, verify -
    /// which is otherwise the one part of the update feature that only ever gets
    /// tried for the first time on a user's machine.
    #[test]
    #[ignore = "hits the network; run explicitly after publishing a release"]
    fn live_release_is_downloadable_and_matches_its_checksum() {
        // Pretend to be an old version so `available` must come back true.
        let info = check("0.0.1").expect("could not reach GitHub");
        assert!(info.available, "a published release must look newer than 0.0.1");
        assert!(!info.latest_version.is_empty());
        let name = info.installer_name.clone().expect("the release publishes no .exe installer");
        assert!(name.ends_with("-setup.exe"), "unexpected installer name: {name}");
        let sha = info.sha256.clone().expect("the release publishes no SHA256SUMS.txt entry");
        assert_eq!(sha.len(), 64, "malformed checksum: {sha}");
        println!("  latest    : {} ({name})", info.latest_version);
        println!("  expected  : {sha}");

        // download_verified() only returns Ok when the hash matches, so reaching
        // this line at all is the assertion that matters.
        let path = download_verified(&info).expect("download or checksum verification failed");
        let bytes = std::fs::metadata(&path).expect("installer missing after download").len();
        println!("  downloaded: {} ({bytes} bytes)", path.display());
        assert!(bytes > 1_000_000, "installer suspiciously small: {bytes} bytes");
        let _ = std::fs::remove_file(&path);
    }

    #[test]
    fn version_comparison_is_numeric_not_lexicographic() {
        assert!(is_newer("0.10.0", "0.9.9"), "10 > 9 even though '1' < '9' as text");
        assert!(is_newer("v0.2.0", "0.1.0"), "a leading v is ignored");
        assert!(is_newer("1.0.0", "0.99.99"));
        assert!(!is_newer("0.2.0", "0.2.0"), "the same version is not an update");
        assert!(!is_newer("0.1.0", "0.2.0"), "older is never offered");
        assert!(!is_newer("0.2.0-rc1", "0.2.0"), "a pre-release of the same version is not newer");
    }

    #[test]
    fn checksum_lookup_matches_the_sha256sum_format() {
        let sums = "\
f551838fd18dd6537873c15749479333700b27487faebc9f1b8f68759697f412  Isaac-Completion-Tracker_0.2.0_x64-setup.exe
f4b6de8f332a94e8b2c197b614328a67f000beef69870b3d7a0fcff0d0bca07c  Isaac-Completion-Tracker_0.2.0_x64.msi
";
        assert_eq!(
            sha_for(sums, "Isaac-Completion-Tracker_0.2.0_x64-setup.exe").unwrap(),
            "f551838fd18dd6537873c15749479333700b27487faebc9f1b8f68759697f412"
        );
        assert!(sha_for(sums, "not-in-the-list.exe").is_none());
    }

    #[test]
    fn sha256_matches_a_known_vector() {
        // SHA-256 of the empty input, the standard test vector.
        assert_eq!(
            sha256_hex(b""),
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );
    }
}
