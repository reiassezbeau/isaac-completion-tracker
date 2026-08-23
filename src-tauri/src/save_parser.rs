// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! save_parser - read-only decoding of `persistentgamedata*.dat`
//! (The Binding of Isaac: Repentance / Repentance+).
//!
//! A little-endian binary format, unencrypted, reverse-engineered by the community.
//! A clean reimplementation, validated EMPIRICALLY against the real save of
//! l'utilisateur (311/641 + assertions Annexe A + completion marks Mother={Eden},
//! Beast={Isaac,Judas,Samson,Azazel,Eden}). See the tests at the bottom of this file.
//!
//! Structure : header magic (16o) + version @0x18 + checksum CRC-32 (4 derniers
//! bytes, covering [0x10..len-4]) plus 11 self-describing sections starting at 0x14.
//! Each section is a 12-byte header (3x u32, the 3rd being the entry count) followed by
//! `count * entry_len` bytes. We read ONLY achievements (section 0) and completion
//! marks (section 1). Everything else is ignored. We NEVER write to the save.

use serde::Serialize;

/// Header magic: "ISAACNGSAVE09R  " (the first 15 bytes are checked).
const HEADER: [u8; 16] = [
    0x49, 0x53, 0x41, 0x41, 0x43, 0x4E, 0x47, 0x53, 0x41, 0x56, 0x45, 0x30, 0x39, 0x52, 0x20, 0x20,
];
const HEADER_CHECK_LEN: usize = 15;
const SECTION_OFFSET: usize = 0x14;
const VERSION_OFFSET: usize = 0x18;
const HEADER_OFFSET: usize = 0x10;
/// Entry size for each of the 11 sections (secrets, stats+marks, ..., bestiary).
const ENTRY_LENS: [usize; 11] = [1, 4, 4, 1, 1, 1, 1, 4, 4, 1, 546];

pub const NUM_ACHIEVEMENTS: usize = 641;
pub const NUM_CHARACTERS: usize = 34;
pub const NUM_MARKS: usize = 12;

const VERSION_REPENTANCE: u8 = 0x7E;
const VERSION_REPENTANCE_PLUS: u8 = 0x82;

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("file too short ({0} bytes) to be a valid save")]
    TooShort(usize),
    #[error("invalid header: this is not a Binding of Isaac save (Repentance/Repentance+)")]
    BadHeader,
    #[error("unknown save version (0x{0:02x}) - unexpected format")]
    UnknownVersion(u8),
    #[error("out-of-bounds read at offset {0} (truncated file or unexpected format)")]
    OutOfBounds(usize),
}

impl ParseError {
    /// Stable code the UI turns into a translated sentence (`perr.<code>`).
    /// The English `Display` text stays available for logs and the Diagnostic tab.
    pub fn code(&self) -> &'static str {
        match self {
            ParseError::TooShort(_) => "too_short",
            ParseError::BadHeader => "bad_header",
            ParseError::UnknownVersion(_) => "unknown_version",
            ParseError::OutOfBounds(_) => "out_of_bounds",
        }
    }

    /// The one technical value worth showing next to the translated sentence.
    pub fn detail(&self) -> Option<String> {
        match self {
            ParseError::TooShort(n) => Some(format!("{n} bytes")),
            ParseError::BadHeader => None,
            ParseError::UnknownVersion(v) => Some(format!("0x{v:02x}")),
            ParseError::OutOfBounds(off) => Some(format!("offset {off}")),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Edition {
    Repentance,
    RepentancePlus,
}

/// Difficulty of a completion mark. Dead God requires `Hard` on every mark.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MarkDifficulty {
    None,
    Normal,
    Hard,
}

impl MarkDifficulty {
    fn from_bits(bits: u8) -> Self {
        // 0 = none, 1 = normal, 2 = hard, 3 = normal|hard -> hard.
        match bits & 0b11 {
            0 => MarkDifficulty::None,
            1 => MarkDifficulty::Normal,
            _ => MarkDifficulty::Hard,
        }
    }
}

/// State of a completion mark: the byte encodes solo (offline/Repentance, bits
/// 0-1) AND online (Rep+, bits 2-3). `effective` is the better of the two.
#[derive(Debug, Clone, Copy, Serialize)]
pub struct Mark {
    pub solo: MarkDifficulty,
    pub online: MarkDifficulty,
    pub effective: MarkDifficulty,
}

impl Mark {
    const NONE: Mark = Mark {
        solo: MarkDifficulty::None,
        online: MarkDifficulty::None,
        effective: MarkDifficulty::None,
    };
    fn from_byte(b: u8) -> Self {
        let solo = MarkDifficulty::from_bits(b);
        let online = MarkDifficulty::from_bits(b >> 2);
        let effective = match (solo, online) {
            (MarkDifficulty::Hard, _) | (_, MarkDifficulty::Hard) => MarkDifficulty::Hard,
            (MarkDifficulty::Normal, _) | (_, MarkDifficulty::Normal) => MarkDifficulty::Normal,
            _ => MarkDifficulty::None,
        };
        Mark { solo, online, effective }
    }
}

/// The result of parsing one save slot.
#[derive(Debug, Clone, Serialize)]
pub struct SaveData {
    pub edition: Edition,
    pub version: u8,
    pub checksum_ok: bool,
    /// `achievements[i]` is whether the achievement with secret ID `i+1` is unlocked (index 0 means ID 1).
    pub achievements: Vec<bool>,
    /// `false` when mark decoding failed (unexpected format), in which case the UI must
    /// fall back to graceful degradation (inference plus manual override, §3.4).
    pub marks_reliable: bool,
    /// `marks[char_index][mark_index]` (34 × 12), ordre binaire.
    pub marks: Vec<Vec<Mark>>,
}

impl SaveData {
    pub fn unlocked_count(&self) -> usize {
        self.achievements.iter().filter(|&&b| b).count()
    }
    /// Whether the achievement with the given in-game secret ID (1..=641) is unlocked.
    pub fn is_unlocked(&self, secret_id: usize) -> bool {
        (1..=NUM_ACHIEVEMENTS).contains(&secret_id)
            && self.achievements.get(secret_id - 1).copied().unwrap_or(false)
    }
}

fn u32_le(data: &[u8], off: usize) -> Result<u32, ParseError> {
    let b = data.get(off..off + 4).ok_or(ParseError::OutOfBounds(off))?;
    Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

/// Offsets (start of the entries) of the 11 sections, via the self-describing walk.
fn section_offsets(data: &[u8]) -> Result<[usize; 11], ParseError> {
    let mut offset = SECTION_OFFSET;
    let mut res = [0usize; 11];
    for i in 0..ENTRY_LENS.len() {
        // header: 3x u32 (the 3rd is the entry count)
        let mut count = 0u32;
        for j in 0..3 {
            let v = u32_le(data, offset)?;
            offset = offset.checked_add(4).ok_or(ParseError::OutOfBounds(offset))?;
            if j == 2 {
                count = v;
            }
        }
        res[i] = offset;
        let skip = (count as usize)
            .checked_mul(ENTRY_LENS[i])
            .ok_or(ParseError::OutOfBounds(offset))?;
        offset = offset.checked_add(skip).ok_or(ParseError::OutOfBounds(offset))?;
        if offset > data.len() {
            return Err(ParseError::OutOfBounds(offset));
        }
    }
    Ok(res)
}

/// The game's EXACT CRC-32 table (non-standard, seed 0xFEDCBA76). Embedded as-is
/// because the game does not use the standard CRC-32 table.
#[rustfmt::skip]
const CRC_TABLE: [u32; 256] = [
    0x00000000, 0x09073096, 0x120E612C, 0x1B0951BA, 0xFF6DC419, 0xF66AF48F, 0xED63A535, 0xE46495A3,
    0xFEDB8832, 0xF7DCB8A4, 0xECD5E91E, 0xE5D2D988, 0x01B64C2B, 0x08B17CBD, 0x13B82D07, 0x1ABF1D91,
    0xFDB71064, 0xF4B020F2, 0xEFB97148, 0xE6BE41DE, 0x02DAD47D, 0x0BDDE4EB, 0x10D4B551, 0x19D385C7,
    0x036C9856, 0x0A6BA8C0, 0x1162F97A, 0x1865C9EC, 0xFC015C4F, 0xF5066CD9, 0xEE0F3D63, 0xE7080DF5,
    0xFB6E20C8, 0xF269105E, 0xE96041E4, 0xE0677172, 0x0403E4D1, 0x0D04D447, 0x160D85FD, 0x1F0AB56B,
    0x05B5A8FA, 0x0CB2986C, 0x17BBC9D6, 0x1EBCF940, 0xFAD86CE3, 0xF3DF5C75, 0xE8D60DCF, 0xE1D13D59,
    0x06D930AC, 0x0FDE003A, 0x14D75180, 0x1DD06116, 0xF9B4F4B5, 0xF0B3C423, 0xEBBA9599, 0xE2BDA50F,
    0xF802B89E, 0xF1058808, 0xEA0CD9B2, 0xE30BE924, 0x076F7C87, 0x0E684C11, 0x15611DAB, 0x1C662D3D,
    0xF6DC4190, 0xFFDB7106, 0xE4D220BC, 0xEDD5102A, 0x09B18589, 0x00B6B51F, 0x1BBFE4A5, 0x12B8D433,
    0x0807C9A2, 0x0100F934, 0x1A09A88E, 0x130E9818, 0xF76A0DBB, 0xFE6D3D2D, 0xE5646C97, 0xEC635C01,
    0x0B6B51F4, 0x026C6162, 0x196530D8, 0x1062004E, 0xF40695ED, 0xFD01A57B, 0xE608F4C1, 0xEF0FC457,
    0xF5B0D9C6, 0xFCB7E950, 0xE7BEB8EA, 0xEEB9887C, 0x0ADD1DDF, 0x03DA2D49, 0x18D37CF3, 0x11D44C65,
    0x0DB26158, 0x04B551CE, 0x1FBC0074, 0x16BB30E2, 0xF2DFA541, 0xFBD895D7, 0xE0D1C46D, 0xE9D6F4FB,
    0xF369E96A, 0xFA6ED9FC, 0xE1678846, 0xE860B8D0, 0x0C042D73, 0x05031DE5, 0x1E0A4C5F, 0x170D7CC9,
    0xF005713C, 0xF90241AA, 0xE20B1010, 0xEB0C2086, 0x0F68B525, 0x066F85B3, 0x1D66D409, 0x1461E49F,
    0x0EDEF90E, 0x07D9C998, 0x1CD09822, 0x15D7A8B4, 0xF1B33D17, 0xF8B40D81, 0xE3BD5C3B, 0xEABA6CAD,
    0xEDB88320, 0xE4BFB3B6, 0xFFB6E20C, 0xF6B1D29A, 0x12D54739, 0x1BD277AF, 0x00DB2615, 0x09DC1683,
    0x13630B12, 0x1A643B84, 0x016D6A3E, 0x086A5AA8, 0xEC0ECF0B, 0xE509FF9D, 0xFE00AE27, 0xF7079EB1,
    0x100F9344, 0x1908A3D2, 0x0201F268, 0x0B06C2FE, 0xEF62575D, 0xE66567CB, 0xFD6C3671, 0xF46B06E7,
    0xEED41B76, 0xE7D32BE0, 0xFCDA7A5A, 0xF5DD4ACC, 0x11B9DF6F, 0x18BEEFF9, 0x03B7BE43, 0x0AB08ED5,
    0x16D6A3E8, 0x1FD1937E, 0x04D8C2C4, 0x0DDFF252, 0xE9BB67F1, 0xE0BC5767, 0xFBB506DD, 0xF2B2364B,
    0xE80D2BDA, 0xE10A1B4C, 0xFA034AF6, 0xF3047A60, 0x1760EFC3, 0x1E67DF55, 0x056E8EEF, 0x0C69BE79,
    0xEB61B38C, 0xE266831A, 0xF96FD2A0, 0xF068E236, 0x140C7795, 0x1D0B4703, 0x060216B9, 0x0F05262F,
    0x15BA3BBE, 0x1CBD0B28, 0x07B45A92, 0x0EB36A04, 0xEAD7FFA7, 0xE3D0CF31, 0xF8D99E8B, 0xF1DEAE1D,
    0x1B64C2B0, 0x1263F226, 0x096AA39C, 0x006D930A, 0xE40906A9, 0xED0E363F, 0xF6076785, 0xFF005713,
    0xE5BF4A82, 0xECB87A14, 0xF7B12BAE, 0xFEB61B38, 0x1AD28E9B, 0x13D5BE0D, 0x08DCEFB7, 0x01DBDF21,
    0xE6D3D2D4, 0xEFD4E242, 0xF4DDB3F8, 0xFDDA836E, 0x19BE16CD, 0x10B9265B, 0x0BB077E1, 0x02B74777,
    0x18085AE6, 0x110F6A70, 0x0A063BCA, 0x03010B5C, 0xE7659EFF, 0xEE62AE69, 0xF56BFFD3, 0xFC6CCF45,
    0xE00AE278, 0xE90DD2EE, 0xF2048354, 0xFB03B3C2, 0x1F672661, 0x166016F7, 0x0D69474D, 0x046E77DB,
    0x1ED16A4A, 0x17D65ADC, 0x0CDF0B66, 0x05D83BF0, 0xE1BCAE53, 0xE8BB9EC5, 0xF3B2CF7F, 0xFAB5FFE9,
    0x1DBDF21C, 0x14BAC28A, 0x0FB39330, 0x06B4A3A6, 0xE2D03605, 0xEBD70693, 0xF0DE5729, 0xF9D967BF,
    0xE3667A2E, 0xEA614AB8, 0xF1681B02, 0xF86F2B94, 0x1C0BBE37, 0x150C8EA1, 0x0E05DF1B, 0x0702EF8D,
];

fn calc_checksum(data: &[u8], offset: usize, length: usize) -> u32 {
    let mut checksum: u32 = !0xFEDC_BA76u32;
    for i in offset..offset + length {
        checksum = CRC_TABLE[((checksum & 0xFF) ^ data[i] as u32) as usize] ^ (checksum >> 8);
    }
    !checksum
}

fn verify_checksum(data: &[u8]) -> bool {
    if data.len() < HEADER_OFFSET + 4 {
        return false;
    }
    let length = data.len() - HEADER_OFFSET - 4;
    let expected = calc_checksum(data, HEADER_OFFSET, length);
    let stored = match u32_le(data, HEADER_OFFSET + length) {
        Ok(v) => v,
        Err(_) => return false,
    };
    expected == stored
}

/// Reads a character's 12 marks (offsets validated empirically).
/// Each mark is one byte (the solo/online bit decoding lives in `Mark`).
fn read_marks(data: &[u8], sec1: usize, char_index: usize) -> Result<Vec<Mark>, ParseError> {
    let mut out = Vec::with_capacity(NUM_MARKS);
    let byte = |o: usize| -> Result<u8, ParseError> {
        data.get(o).copied().ok_or(ParseError::OutOfBounds(o))
    };
    if char_index == 14 {
        // The Forgotten
        let mut off = sec1 + 0x32C;
        for i in 0..NUM_MARKS {
            out.push(Mark::from_byte(byte(off + i * 4)?));
            if i == 8 {
                off += 0x4;
            }
            if i == 9 {
                off += 0x37C;
            }
            if i == 10 {
                off += 0x84;
            }
        }
    } else if char_index > 14 {
        // Repentance characters plus all the Tainted ones
        let mut off = sec1 + 0x31C;
        for i in 0..NUM_MARKS {
            out.push(Mark::from_byte(byte(off + char_index * 4 + i * 19 * 4)?));
            if i == 8 {
                off += 0x4C;
            }
            if i == 9 || i == 10 {
                off += 0x3C;
            }
        }
    } else {
        // Characters before The Forgotten (index 0..13)
        let mut off = sec1 + 0x6C;
        for i in 0..NUM_MARKS {
            out.push(Mark::from_byte(byte(off + char_index * 4 + i * 14 * 4)?));
            if i == 5 {
                off += 0x14;
            }
            if i == 8 {
                off += 0x3C;
            }
            if i == 9 {
                off += 0x3B0;
            }
            if i == 10 {
                off += 0x50;
            }
        }
    }
    Ok(out)
}

/// Parses a save buffer (read-only). Fails cleanly when the format
/// is unexpected, in which case the caller should fall back to manual overrides.
pub fn parse(data: &[u8]) -> Result<SaveData, ParseError> {
    if data.len() < 0x40 {
        return Err(ParseError::TooShort(data.len()));
    }
    if data[..HEADER_CHECK_LEN] != HEADER[..HEADER_CHECK_LEN] {
        return Err(ParseError::BadHeader);
    }
    let version = data[VERSION_OFFSET];
    let edition = match version {
        VERSION_REPENTANCE => Edition::Repentance,
        VERSION_REPENTANCE_PLUS => Edition::RepentancePlus,
        v => return Err(ParseError::UnknownVersion(v)),
    };

    let sec = section_offsets(data)?;
    let checksum_ok = verify_checksum(data);

    // Achievements: secret ID i (1..=641) maps to data[sec[0] + i].
    let mut achievements = Vec::with_capacity(NUM_ACHIEVEMENTS);
    for id in 1..=NUM_ACHIEVEMENTS {
        let off = sec[0] + id;
        let b = data.get(off).copied().ok_or(ParseError::OutOfBounds(off))?;
        achievements.push(b == 1);
    }

    // Completion marks: 34 characters x 12 marks. Graceful degradation (§3.4):
    // if a character cannot be decoded (out-of-bounds offset or unexpected format), we
    // mark the whole set as unreliable and the engine falls back to inference plus
    // manual overrides rather than showing wrong data.
    let mut marks_reliable = true;
    let mut marks = Vec::with_capacity(NUM_CHARACTERS);
    for c in 0..NUM_CHARACTERS {
        match read_marks(data, sec[1], c) {
            Ok(m) => marks.push(m),
            Err(_) => {
                marks_reliable = false;
                marks.push(vec![Mark::NONE; NUM_MARKS]);
            }
        }
    }

    Ok(SaveData { edition, version, checksum_ok, achievements, marks_reliable, marks })
}

// ===========================================================================
// Tests
// ===========================================================================
#[cfg(test)]
mod tests {
    use super::*;

    /// Builds a minimal synthetic save (header + version + 11
    /// sections, with section 0 being achievements) to test parsing WITHOUT committing
    /// a real save (for privacy). The marks are not
    /// exercised here (their offsets depend on a real stats section); they are covered
    /// by the integration test against a real save.
    fn synth_save(unlocked_ids: &[usize]) -> Vec<u8> {
        let mut data = vec![0u8; 0x14];
        data[..16].copy_from_slice(&HEADER);

        // Section 0 (achievements): count = 642 (unused index 0 plus 641), entry_len 1.
        // Its header spans 0x14..0x20, and the version byte (0x18) falls inside it.
        let ach_count: u32 = (NUM_ACHIEVEMENTS + 1) as u32;
        data.extend_from_slice(&0u32.to_le_bytes()); // idx  (0x14..0x18)
        data.extend_from_slice(&0u32.to_le_bytes()); // size (0x18..0x1C)
        data.extend_from_slice(&ach_count.to_le_bytes()); // count (0x1C..0x20)
        data[VERSION_OFFSET] = VERSION_REPENTANCE_PLUS; // inside the "size" field, unused by the walk
        let ach_start = data.len();
        data.resize(ach_start + ach_count as usize, 0);
        for &id in unlocked_ids {
            data[ach_start + id] = 1;
        }
        // Sections 1..=10 vides (count = 0).
        for _ in 1..ENTRY_LENS.len() {
            data.extend_from_slice(&0u32.to_le_bytes());
            data.extend_from_slice(&0u32.to_le_bytes());
            data.extend_from_slice(&0u32.to_le_bytes());
        }
        // Checksum over [0x10..len], then 4 bytes.
        let length = data.len() - HEADER_OFFSET;
        let cs = calc_checksum(&data, HEADER_OFFSET, length);
        data.extend_from_slice(&cs.to_le_bytes());
        data
    }

    #[test]
    fn rejects_garbage() {
        assert!(matches!(parse(&[0u8; 8]), Err(ParseError::TooShort(_))));
        let mut bad = vec![0u8; 0x80];
        bad[0] = 0xFF;
        assert!(matches!(parse(&bad), Err(ParseError::BadHeader)));
    }

    #[test]
    fn parses_synthetic_achievements() {
        let ids = [1usize, 3, 42, 200, 637, 641];
        let data = synth_save(&ids);
        let save = parse(&data).expect("parse ok");
        assert_eq!(save.edition, Edition::RepentancePlus);
        assert!(save.checksum_ok, "synthetic checksum must be valid");
        assert_eq!(save.unlocked_count(), ids.len());
        for id in ids {
            assert!(save.is_unlocked(id), "secret {id} must be unlocked");
        }
        assert!(!save.is_unlocked(2));
        assert!(!save.is_unlocked(640));
    }

    /// Integration test: if `ISAAC_SAVE_PATH` points to a real save (or if
    /// we find one under Steam/userdata), we validate the total plus the Appendix A
    /// assertions and the known completion marks. Otherwise we skip cleanly.
    #[test]
    fn validates_against_real_save() {
        let path = std::env::var("ISAAC_SAVE_PATH").ok().or_else(find_real_save);
        let Some(path) = path else {
            eprintln!("(skip) no real save found - set ISAAC_SAVE_PATH to run this test");
            return;
        };
        eprintln!("Validating against: {path}");
        let data = std::fs::read(&path).expect("reading save");
        let save = parse(&data).expect("parse ok");

        assert_eq!(save.edition, Edition::RepentancePlus);
        assert!(save.checksum_ok, "checksum of the real save must be valid");

        let total = save.unlocked_count();
        eprintln!("Total unlocked: {total}/641");
        assert!((300..=641).contains(&total), "total {total} hors plage attendue (~311)");

        // Appendix A - a few known secret IDs (the wiki ID is the secret ID).
        // Unlocked: Magdalene=1, Cain=2, Judas=3, Golden God!=41, Eve=42.
        for id in [1, 2, 3, 41, 42] {
            assert!(save.is_unlocked(id), "secret {id} expected unlocked");
        }
        // Locked: Dead God=637.
        assert!(!save.is_unlocked(637), "Dead God (637) expected locked");

        // Completion marks. The save EVOLVES as the user plays, so we check
        // the INCLUSION of known completions (they can only be added to), not
        // exact equality. Known at the time: Mother with Eden(9); Beast with
        // Isaac(0),Judas(3),Samson(6),Azazel(7),Eden(9).
        let has_mark = |c: usize, m: usize| save.marks[c][m].effective != MarkDifficulty::None;
        let mother: Vec<usize> = (0..NUM_CHARACTERS).filter(|&c| has_mark(c, 10)).collect();
        let beast: Vec<usize> = (0..NUM_CHARACTERS).filter(|&c| has_mark(c, 11)).collect();
        eprintln!("Mother: {mother:?}  Beast: {beast:?}");
        assert!(mother.contains(&9), "Mother doit inclure Eden(9) ; obtenu {mother:?}");
        for c in [0, 3, 6, 7, 9] {
            assert!(beast.contains(&c), "Beast doit inclure {{Isaac,Judas,Samson,Azazel,Eden}} ; obtenu {beast:?}");
        }

        // Marks/achievements consistency (guardrails §1): Revelation (secret ID 470 =
        // "Defeat Mother as Bethany") locked means Bethany's Mother mark
        // (char_index 15, mark_index 10) must be empty. This cross-checks both decoders.
        if !save.is_unlocked(470) {
            assert_eq!(
                save.marks[15][10].effective,
                MarkDifficulty::None,
                "inconsistency: Revelation(470) locked but Bethany's Mother mark is not empty"
            );
        }
    }

    fn find_real_save() -> Option<String> {
        // Scan Steam/userdata/*/250900/remote/rep+persistentgamedata1.dat
        let bases = [
            "C:/Program Files (x86)/Steam/userdata",
            "C:/Program Files/Steam/userdata",
        ];
        for base in bases {
            if let Ok(entries) = std::fs::read_dir(base) {
                for e in entries.flatten() {
                    let p = e.path().join("250900/remote/rep+persistentgamedata1.dat");
                    if p.exists() {
                        return Some(p.to_string_lossy().into_owned());
                    }
                }
            }
        }
        None
    }
}
