--[[
  Isaac Tracker — mod compagnon « Stats » (ÉTAPE 1 : minimal)
  Créé par reiassezbeau — https://github.com/reiassezbeau

  PUREMENT OBSERVATEUR :
    - ne modifie JAMAIS le gameplay (aucun return dans TAKE_DMG => dégâts intacts) ;
    - n'utilise JAMAIS la console de debug ;
    - se contente d'écouter les callbacks et d'écrire un JSON par slot.

  Étape 1 = compter les hits (agnostique au système de vie : on écoute l'ÉVÉNEMENT
  de dégât, pas le HUD), filtrer DAMAGE_FAKE, catégoriser par source, détecter
  début/fin de run (continue non double-compté, mort vs victoire), SaveData JSON.
  Les champs larges (shielded, kills, timings mappés, endings…) viennent à l'étape 2.

  Signatures vérifiées contre la doc Lua Repentance+ (wofsauge IsaacDocs) :
    - les handlers reçoivent le mod en 1er argument -> function(_, <params>)
    - MC_ENTITY_TAKE_DMG(_, entity, amount, damageFlags, source, countdownFrames)
    - MC_POST_GAME_STARTED(_, isContinue) ; MC_POST_GAME_END(_, isGameOver)
]]

local mod = RegisterMod("IsaacTracker", 1)
local json = require("json")

local SCHEMA = 1
local MAX_HISTORY = 200

-- État en mémoire (persisté via mod:SaveData).
local data = { schema = SCHEMA, current_run = nil, history = {}, next_index = 1 }

-- PlayerType (entier) -> id de perso de characters.json.
-- Les "formes" pointent vers leur perso : Lazarus2->lazarus, BlackJudas->judas,
-- TheSoul->the_forgotten, Esau->jacob_esau ; côté Tainted idem (38/39/40).
local PLAYER_TYPE_TO_ID = {
  [0] = "isaac", [1] = "magdalene", [2] = "cain", [3] = "judas", [4] = "blue_baby",
  [5] = "eve", [6] = "samson", [7] = "azazel", [8] = "lazarus", [9] = "eden",
  [10] = "the_lost", [11] = "lazarus", [12] = "judas", [13] = "lilith", [14] = "keeper",
  [15] = "apollyon", [16] = "the_forgotten", [17] = "the_forgotten", [18] = "bethany",
  [19] = "jacob_esau", [20] = "jacob_esau",
  [21] = "tainted_isaac", [22] = "tainted_magdalene", [23] = "tainted_cain",
  [24] = "tainted_judas", [25] = "tainted_blue_baby", [26] = "tainted_eve",
  [27] = "tainted_samson", [28] = "tainted_azazel", [29] = "tainted_lazarus",
  [30] = "tainted_eden", [31] = "tainted_lost", [32] = "tainted_lilith",
  [33] = "tainted_keeper", [34] = "tainted_apollyon", [35] = "tainted_forgotten",
  [36] = "tainted_bethany", [37] = "tainted_jacob", [38] = "tainted_lazarus",
  [39] = "tainted_jacob", [40] = "tainted_forgotten",
}

local function frame()
  return Game():GetFrameCount()
end

local function currentPlayerType()
  return Isaac.GetPlayer(0):GetPlayerType()
end

local function characterIdFor(playerType)
  return PLAYER_TYPE_TO_ID[playerType] or ("unknown_" .. tostring(playerType))
end

-- Persistance (buffer glissant : on ne garde que les N derniers runs ; l'app
-- tient l'historique permanent complet).
local function save()
  while #data.history > MAX_HISTORY do
    table.remove(data.history, 1)
  end
  mod:SaveData(json.encode(data))
end

local function load()
  if mod:HasData() then
    local ok, decoded = pcall(json.decode, mod:LoadData())
    if ok and type(decoded) == "table" then
      data = decoded
      data.schema = SCHEMA
      data.history = data.history or {}
      data.next_index = data.next_index or (#data.history + 1)
    end
  end
end

-- Catégorise la source d'un hit : self | environment | enemy | unknown.
local function classifySource(damageFlags, source)
  local DF = DamageFlag
  local function has(flag)
    return (damageFlags & flag) ~= 0
  end

  -- Auto-infligé (IV Bag, deal Devil sanglant, porte maudite, razor/blood rights).
  if has(DF.DAMAGE_IV_BAG) or has(DF.DAMAGE_DEVIL) or has(DF.DAMAGE_CURSED_DOOR) or has(DF.DAMAGE_RED_HEARTS) then
    return "self"
  end
  -- Pics : "self" si salle de sacrifice (on a choisi), sinon environnement.
  if has(DF.DAMAGE_SPIKES) then
    local ok, roomType = pcall(function() return Game():GetRoom():GetType() end)
    if ok and roomType == RoomType.ROOM_SACRIFICE then
      return "self"
    end
    return "environment"
  end
  if has(DF.DAMAGE_ACID) or has(DF.DAMAGE_FIRE) then
    return "environment"
  end
  -- Source = une entité non-joueur -> ennemi (NPC, projectile d'ennemi…).
  if source ~= nil and source.Type ~= nil and source.Type ~= 0 and source.Type ~= EntityType.ENTITY_PLAYER then
    return "enemy"
  end
  if source == nil or source.Entity == nil then
    return "environment"
  end
  return "unknown"
end

-- Déduplication : même entité touchée deux fois sur la même frame = 1 hit.
local lastHitFrame = {}

-- ── HIT (dégât sur une entité joueur) ─────────────────────────────────────
mod:AddCallback(ModCallbacks.MC_ENTITY_TAKE_DMG, function(_, entity, amount, damageFlags, source, countdownFrames)
  -- Observateur pur : on ne retourne RIEN (dégâts inchangés).
  if (damageFlags & DamageFlag.DAMAGE_FAKE) ~= 0 then
    return
  end
  local run = data.current_run
  if run == nil then
    return
  end
  if entity:ToPlayer() == nil then
    return -- sécurité (le filtre ENTITY_PLAYER devrait déjà garantir ça)
  end

  local key = tostring(GetPtrHash(entity))
  local f = frame()
  if lastHitFrame[key] == f then
    return
  end
  lastHitFrame[key] = f

  local src = classifySource(damageFlags, source)
  local st = Level():GetStage()
  local stt = Level():GetStageType()

  run.hits_total = (run.hits_total or 0) + 1
  run.hits[#run.hits + 1] = { frame = f, stage = st, stage_type = stt, source = src }
  run.hits_by_source[src] = (run.hits_by_source[src] or 0) + 1
  local sk = tostring(st) .. "-" .. tostring(stt)
  run.hits_by_stage[sk] = (run.hits_by_stage[sk] or 0) + 1

  Isaac.DebugString(string.format("[IsaacTracker] hit #%d (source=%s, stage=%d-%d)", run.hits_total, src, st, stt))
end, EntityType.ENTITY_PLAYER)

-- ── DÉBUT DE RUN ──────────────────────────────────────────────────────────
mod:AddCallback(ModCallbacks.MC_POST_GAME_STARTED, function(_, isContinue)
  load()
  if isContinue and data.current_run ~= nil then
    lastHitFrame = {}
    Isaac.DebugString("[IsaacTracker] continue -> reprise du run courant")
    return
  end

  -- Run précédent non clôturé (redémarrage / nouvelle partie sans mourir/gagner)
  -- => on l'archive comme "abandoned" pour ne pas perdre ses données.
  if data.current_run ~= nil and not data.current_run.ended then
    data.current_run.ended = true
    data.current_run.outcome = "abandoned"
    data.current_run.ended_frame = frame()
    data.history[#data.history + 1] = data.current_run
    data.current_run = nil
  end

  local idx = data.next_index or 1
  data.next_index = idx + 1
  math.randomseed(frame() + idx)
  local pt = currentPlayerType()

  data.current_run = {
    run_id = string.format("%d-%d-%d", idx, frame(), math.random(100000, 999999)),
    character = characterIdFor(pt),
    player_type = pt,
    started_frame = frame(),
    ended = false,
    outcome = nil,
    ending = nil,
    death_source = nil,
    deepest_stage = Level():GetStage(),
    hits_total = 0,
    hits = {},
    hits_by_source = {},
    hits_by_stage = {},
  }
  lastHitFrame = {}
  save()
  Isaac.DebugString(string.format("[IsaacTracker] nouveau run: %s (%s)", data.current_run.run_id, data.current_run.character))
end)

-- ── FIN DE RUN ────────────────────────────────────────────────────────────
mod:AddCallback(ModCallbacks.MC_POST_GAME_END, function(_, isGameOver)
  local run = data.current_run
  if run == nil then
    return
  end
  run.ended = true
  run.outcome = isGameOver and "death" or "win"
  run.ended_frame = frame()
  data.history[#data.history + 1] = run
  data.current_run = nil
  save()
  Isaac.DebugString(string.format("[IsaacTracker] fin de run: %s, %d hits", run.outcome, run.hits_total))
end)

-- ── Étage le plus profond + sauvegardes régulières (survie aux crashes) ────
mod:AddCallback(ModCallbacks.MC_POST_NEW_LEVEL, function(_)
  local run = data.current_run
  if run ~= nil then
    local st = Level():GetStage()
    if st > (run.deepest_stage or 0) then
      run.deepest_stage = st
    end
  end
end)

mod:AddCallback(ModCallbacks.MC_POST_NEW_ROOM, function(_)
  if data.current_run ~= nil then
    save()
  end
end)

mod:AddCallback(ModCallbacks.MC_PRE_GAME_EXIT, function(_, shouldSave)
  save()
end)
