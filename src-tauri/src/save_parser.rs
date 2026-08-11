// SPDX-License-Identifier: GPL-3.0-only
// Isaac Completion Tracker — © 2026 reiassezbeau — https://github.com/reiassezbeau

//! save_parser — décodage (lecture seule) de `persistentgamedata*.dat`
//! (The Binding of Isaac: Repentance / Repentance+).
//!
//! Format binaire little-endian, non chiffré, rétro-ingénieré par la communauté.
//! Réimplémentation propre validée EMPIRIQUEMENT contre la vraie sauvegarde de
//! l'utilisateur (311/641 + assertions Annexe A + completion marks Mother={Eden},
//! Beast={Isaac,Judas,Samson,Azazel,Eden}). Cf. tests en bas de fichier.
//!
//! Structure : header magic (16o) + version @0x18 + checksum CRC-32 (4 derniers
//! octets, couvre [0x10..len-4]) + 11 sections auto-descriptives à partir de 0x14.
//! Chaque section = en-tête de 12 octets (3× u32, le 3e = nb d'entrées) puis
//! `count * entry_len` octets. On ne lit QUE : succès (section 0) et completion
//! marks (section 1). Le reste est ignoré. On n'écrit JAMAIS dans la save.

use serde::Serialize;

/// Magie d'en-tête : "ISAACNGSAVE09R  " (les 15 premiers octets sont vérifiés).
const HEADER: [u8; 16] = [
    0x49, 0x53, 0x41, 0x41, 0x43, 0x4E, 0x47, 0x53, 0x41, 0x56, 0x45, 0x30, 0x39, 0x52, 0x20, 0x20,
];
const HEADER_CHECK_LEN: usize = 15;
const SECTION_OFFSET: usize = 0x14;
const VERSION_OFFSET: usize = 0x18;
const HEADER_OFFSET: usize = 0x10;
/// Taille d'une entrée pour chacune des 11 sections (secrets, stats+marks, …, bestiaire).
const ENTRY_LENS: [usize; 11] = [1, 4, 4, 1, 1, 1, 1, 4, 4, 1, 546];

pub const NUM_ACHIEVEMENTS: usize = 641;
pub const NUM_CHARACTERS: usize = 34;
pub const NUM_MARKS: usize = 12;

const VERSION_REPENTANCE: u8 = 0x7E;
const VERSION_REPENTANCE_PLUS: u8 = 0x82;

#[derive(Debug, thiserror::Error)]
pub enum ParseError {
    #[error("fichier trop court ({0} octets) pour être une sauvegarde valide")]
    TooShort(usize),
    #[error("en-tête invalide : ce n'est pas une sauvegarde Binding of Isaac (Repentance/Repentance+)")]
    BadHeader,
    #[error("version de sauvegarde inconnue (0x{0:02x}) — format inattendu")]
    UnknownVersion(u8),
    #[error("lecture hors limites à l'offset {0} (fichier tronqué ou format inattendu)")]
    OutOfBounds(usize),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Edition {
    Repentance,
    RepentancePlus,
}

/// Difficulté d'une completion mark. Dead God exige `Hard` sur toutes les marks.
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

/// État d'une completion mark : le byte encode le solo (offline/Repentance, bits
/// 0-1) ET l'online (Rep+, bits 2-3). `effective` = le meilleur des deux.
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

/// Résultat du parsing d'un slot de sauvegarde.
#[derive(Debug, Clone, Serialize)]
pub struct SaveData {
    pub edition: Edition,
    pub version: u8,
    pub checksum_ok: bool,
    /// `achievements[i]` = succès de secret-ID `i+1` débloqué (index 0 => ID 1).
    pub achievements: Vec<bool>,
    /// `false` si le décodage des marks a échoué (format inattendu) → l'UI doit
    /// basculer en dégradation gracieuse (déduction + override manuel, §3.4).
    pub marks_reliable: bool,
    /// `marks[char_index][mark_index]` (34 × 12), ordre binaire.
    pub marks: Vec<Vec<Mark>>,
}

impl SaveData {
    pub fn unlocked_count(&self) -> usize {
        self.achievements.iter().filter(|&&b| b).count()
    }
    /// Succès débloqué par secret-ID in-game (1..=641).
    pub fn is_unlocked(&self, secret_id: usize) -> bool {
        (1..=NUM_ACHIEVEMENTS).contains(&secret_id)
            && self.achievements.get(secret_id - 1).copied().unwrap_or(false)
    }
}

fn u32_le(data: &[u8], off: usize) -> Result<u32, ParseError> {
    let b = data.get(off..off + 4).ok_or(ParseError::OutOfBounds(off))?;
    Ok(u32::from_le_bytes([b[0], b[1], b[2], b[3]]))
}

/// Offsets (début des entrées) des 11 sections, via le walk auto-descriptif.
fn section_offsets(data: &[u8]) -> Result<[usize; 11], ParseError> {
    let mut offset = SECTION_OFFSET;
    let mut res = [0usize; 11];
    for i in 0..ENTRY_LENS.len() {
        // en-tête : 3× u32 (le 3e = nombre d'entrées)
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

/// Table CRC-32 EXACTE du jeu (non-standard, seed 0xFEDCBA76). Embarquée telle
/// quelle : le jeu n'utilise pas la table CRC-32 standard.
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

/// Lit les 12 marks d'un personnage (offsets validés empiriquement).
/// Chaque mark est un octet (le décodage bits solo/online est dans `Mark`).
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
        // Personnages Repentance + tous les Tainted
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
        // Personnages avant The Forgotten (index 0..13)
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

/// Parse un buffer de sauvegarde (lecture seule). Échoue proprement si le format
/// est inattendu — l'appelant doit alors basculer vers l'override manuel.
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

    // Succès : secret-ID i (1..=641) => data[sec[0] + i].
    let mut achievements = Vec::with_capacity(NUM_ACHIEVEMENTS);
    for id in 1..=NUM_ACHIEVEMENTS {
        let off = sec[0] + id;
        let b = data.get(off).copied().ok_or(ParseError::OutOfBounds(off))?;
        achievements.push(b == 1);
    }

    // Completion marks : 34 personnages × 12 marks. Dégradation gracieuse (§3.4) :
    // si un perso n'est pas décodable (offset hors limites / format inattendu), on
    // marque l'ensemble comme non fiable et l'engine bascule sur la déduction +
    // override manuel plutôt que d'afficher des données fausses.
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

    /// Construit une sauvegarde synthétique minimale (header + version + 11
    /// sections dont la section 0 = succès) pour tester le parsing SANS committer
    /// de vraie sauvegarde (respect de la vie privée). Les marks ne sont pas
    /// exercées ici (offsets dépendants d'une vraie section stats) — elles le sont
    /// par le test d'intégration sur la vraie save.
    fn synth_save(unlocked_ids: &[usize]) -> Vec<u8> {
        let mut data = vec![0u8; 0x14];
        data[..16].copy_from_slice(&HEADER);

        // Section 0 (succès) : count = 642 (index 0 inutilisé + 641), entry_len 1.
        // Son en-tête occupe 0x14..0x20 ; l'octet de version (0x18) tombe dedans.
        let ach_count: u32 = (NUM_ACHIEVEMENTS + 1) as u32;
        data.extend_from_slice(&0u32.to_le_bytes()); // idx  (0x14..0x18)
        data.extend_from_slice(&0u32.to_le_bytes()); // size (0x18..0x1C)
        data.extend_from_slice(&ach_count.to_le_bytes()); // count (0x1C..0x20)
        data[VERSION_OFFSET] = VERSION_REPENTANCE_PLUS; // dans le champ « size », inutilisé par le walk
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
        // Checksum sur [0x10..len] puis 4 octets.
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
        assert!(save.checksum_ok, "checksum synthétique doit être valide");
        assert_eq!(save.unlocked_count(), ids.len());
        for id in ids {
            assert!(save.is_unlocked(id), "secret {id} doit être débloqué");
        }
        assert!(!save.is_unlocked(2));
        assert!(!save.is_unlocked(640));
    }

    /// Test d'intégration : si `ISAAC_SAVE_PATH` pointe vers une vraie save (ou si
    /// on la trouve dans Steam/userdata), on valide le total + les assertions
    /// Annexe A + les completion marks connues. Sinon, on skippe proprement.
    #[test]
    fn validates_against_real_save() {
        let path = std::env::var("ISAAC_SAVE_PATH").ok().or_else(find_real_save);
        let Some(path) = path else {
            eprintln!("(skip) aucune vraie save trouvée — définir ISAAC_SAVE_PATH pour ce test");
            return;
        };
        eprintln!("Validation contre : {path}");
        let data = std::fs::read(&path).expect("lecture save");
        let save = parse(&data).expect("parse ok");

        assert_eq!(save.edition, Edition::RepentancePlus);
        assert!(save.checksum_ok, "checksum de la vraie save doit être valide");

        let total = save.unlocked_count();
        eprintln!("Total débloqués : {total}/641");
        assert!((300..=641).contains(&total), "total {total} hors plage attendue (~311)");

        // Annexe A — quelques secret-IDs connus (id du wiki = secret-ID).
        // Débloqués : Magdalene=1, Cain=2, Judas=3, Golden God!=41, Eve=42.
        for id in [1, 2, 3, 41, 42] {
            assert!(save.is_unlocked(id), "secret {id} attendu débloqué");
        }
        // Verrouillés : Dead God=637.
        assert!(!save.is_unlocked(637), "Dead God (637) attendu verrouillé");

        // Completion marks. La save ÉVOLUE quand l'utilisateur joue → on vérifie
        // l'INCLUSION des complétions connues (elles ne peuvent que s'ajouter), pas
        // l'égalité exacte. Connues à l'origine : Mother avec Eden(9) ; Beast avec
        // Isaac(0),Judas(3),Samson(6),Azazel(7),Eden(9).
        let has_mark = |c: usize, m: usize| save.marks[c][m].effective != MarkDifficulty::None;
        let mother: Vec<usize> = (0..NUM_CHARACTERS).filter(|&c| has_mark(c, 10)).collect();
        let beast: Vec<usize> = (0..NUM_CHARACTERS).filter(|&c| has_mark(c, 11)).collect();
        eprintln!("Mother: {mother:?}  Beast: {beast:?}");
        assert!(mother.contains(&9), "Mother doit inclure Eden(9) ; obtenu {mother:?}");
        for c in [0, 3, 6, 7, 9] {
            assert!(beast.contains(&c), "Beast doit inclure {{Isaac,Judas,Samson,Azazel,Eden}} ; obtenu {beast:?}");
        }

        // Cohérence marks<->succès (garde-fous §1) : Revelation (secret-ID 470 =
        // « Defeat Mother as Bethany ») verrouillé <=> la mark Mother de Bethany
        // (char_index 15, mark_index 10) doit être vide. Recoupe les deux décodages.
        if !save.is_unlocked(470) {
            assert_eq!(
                save.marks[15][10].effective,
                MarkDifficulty::None,
                "incohérence : Revelation(470) verrouillé mais la mark Mother de Bethany n'est pas vide"
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
