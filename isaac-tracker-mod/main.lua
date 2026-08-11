-- SPDX-License-Identifier: GPL-3.0-only
-- Isaac Completion Tracker -- (c) 2026 reiassezbeau -- https://github.com/reiassezbeau

--[[
  Isaac Tracker -- mod compagnon "Stats" (ETAPE 1 : minimal)
  Cree par reiassezbeau -- https://github.com/reiassezbeau

  PUREMENT OBSERVATEUR :
    - ne modifie JAMAIS le gameplay (aucun return dans TAKE_DMG => degats intacts) ;
    - n'utilise JAMAIS la console de debug ;
    - se contente d'ecouter les callbacks et d'ecrire un JSON par slot.
    - chaque callback est protege par pcall : une erreur ne peut PAS casser le jeu
      ni desactiver le mod (au pire un hit non compte, loggue dans log.txt).

  Signatures verifiees contre la doc Lua Repentance+ (wofsauge IsaacDocs) :
    - les handlers recoivent le mod en 1er argument -> function(_, <params>)
    - MC_ENTITY_TAKE_DMG(_, entity, amount, damageFlags, source, countdownFrames)
    - MC_POST_GAME_STARTED(_, isContinue) ; MC_POST_GAME_END(_, isGameOver)
]]

local mod = RegisterMod("IsaacTracker", 1)
local json = require("json")

local SCHEMA = 1
local MAX_HISTORY = 200

-- Etat en memoire (persiste via mod:SaveData).
local data = { schema = SCHEMA, current_run = nil, history = {}, next_index = 1 }

-- PlayerType (entier) -> id de perso de characters.json.
-- Les "formes" pointent vers leur perso : Lazarus2->lazarus, BlackJudas->judas,
-- TheSoul->the_forgotten, Esau->jacob_esau ; cote Tainted idem (38/39/40).
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

local function log(msg)
  Isaac.DebugString("[IsaacTracker] " .. msg)
end

-- Enveloppe un handler dans pcall : une erreur ne casse jamais le jeu, et comme
-- on ne renvoie RIEN, TAKE_DMG reste un observateur pur (degats inchanges).
local function safe(name, fn)
  return function(...)
    local ok, err = pcall(fn, ...)
    if not ok then
      log("ERREUR " .. name .. ": " .. tostring(err))
    end
  end
end

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

-- Categorise la source d'un hit : self | environment | enemy | unknown.
local function classifySource(damageFlags, source)
  local DF = DamageFlag
  -- Garde : damageFlags doit etre un entier ; sinon on ne devine pas.
  if type(damageFlags) ~= "number" then
    return "unknown"
  end
  local function has(flag)
    return flag ~= nil and (damageFlags & flag) ~= 0
  end

  -- Auto-inflige (IV Bag, deal Devil sanglant, porte maudite, razor/blood rights).
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
  -- Source = une entite non-joueur -> ennemi (NPC, projectile d'ennemi...).
  if source ~= nil and source.Type ~= nil and source.Type ~= 0 and source.Type ~= EntityType.ENTITY_PLAYER then
    return "enemy"
  end
  if source == nil or source.Entity == nil then
    return "environment"
  end
  return "unknown"
end

-- Deduplication : meme entite touchee deux fois sur la meme frame = 1 hit.
local lastHitFrame = {}

-- ── HIT (degat sur une entite joueur) ─────────────────────────────────────
local function onTakeDmg(_, entity, amount, damageFlags, source, countdownFrames)
  -- Ignore les degats factices.
  if type(damageFlags) == "number" and (damageFlags & DamageFlag.DAMAGE_FAKE) ~= 0 then
    return
  end
  local run = data.current_run
  if run == nil then
    return
  end
  if entity == nil or entity:ToPlayer() == nil then
    return -- securite (le filtre ENTITY_PLAYER devrait deja garantir ca)
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

  log(string.format("hit #%d (source=%s, stage=%d-%d)", run.hits_total, src, st, stt))
end

-- ── DEBUT DE RUN ──────────────────────────────────────────────────────────
-- IMPORTANT : on NE recharge PAS le disque ici. Le jeu ne flush SaveData qu'au
-- retour menu/sortie ; relire le disque a chaque run ecraserait l'historique en
-- memoire (accumule pendant la session). Le chargement se fait UNE fois a l'init.
local function onGameStarted(_, isContinue)
  if isContinue and data.current_run ~= nil then
    lastHitFrame = {}
    log("continue -> reprise du run courant")
    return
  end

  -- Run precedent non cloture (redemarrage / nouvelle partie sans mourir/gagner)
  -- => on l'archive comme "abandoned" pour ne pas perdre ses donnees.
  if data.current_run ~= nil and not data.current_run.ended then
    data.current_run.ended = true
    data.current_run.outcome = "abandoned"
    data.current_run.ended_frame = frame()
    data.history[#data.history + 1] = data.current_run
    data.current_run = nil
  end

  local idx = data.next_index or 1
  data.next_index = idx + 1
  local pt = currentPlayerType()
  -- ID de run unique SANS toucher au RNG global (math.random) pour ne PAS
  -- perturber les autres mods : on combine un compteur persistant + la graine
  -- de run du jeu + la frame de depart.
  local startSeed = 0
  do
    local ok, s = pcall(function() return Game():GetSeeds():GetStartSeed() end)
    if ok and type(s) == "number" then
      startSeed = s
    end
  end

  data.current_run = {
    run_id = string.format("%d-%u-%d", idx, startSeed, frame()),
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
  log(string.format("nouveau run: %s (%s)", data.current_run.run_id, data.current_run.character))
end

-- ── FIN DE RUN ────────────────────────────────────────────────────────────
local function onGameEnd(_, isGameOver)
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
  log(string.format("fin de run: %s, %d hits", run.outcome, run.hits_total))
end

-- ── Etage le plus profond + sauvegardes regulieres (survie aux crashes) ────
local function onNewLevel(_)
  local run = data.current_run
  if run ~= nil then
    local st = Level():GetStage()
    if st > (run.deepest_stage or 0) then
      run.deepest_stage = st
    end
  end
end

local function onNewRoom(_)
  if data.current_run ~= nil then
    save()
  end
end

local function onPreGameExit(_, shouldSave)
  save()
end

-- Chargement UNIQUE des donnees persistees (a l'init du mod, pas a chaque run).
local okLoad = pcall(load)
if not okLoad then
  data = { schema = SCHEMA, current_run = nil, history = {}, next_index = 1 }
end

mod:AddCallback(ModCallbacks.MC_ENTITY_TAKE_DMG, safe("take_dmg", onTakeDmg), EntityType.ENTITY_PLAYER)
mod:AddCallback(ModCallbacks.MC_POST_GAME_STARTED, safe("game_started", onGameStarted))
mod:AddCallback(ModCallbacks.MC_POST_GAME_END, safe("game_end", onGameEnd))
mod:AddCallback(ModCallbacks.MC_POST_NEW_LEVEL, safe("new_level", onNewLevel))
mod:AddCallback(ModCallbacks.MC_POST_NEW_ROOM, safe("new_room", onNewRoom))
mod:AddCallback(ModCallbacks.MC_PRE_GAME_EXIT, safe("pre_game_exit", onPreGameExit))

log("charge (v0.1.0) -- mod observateur pret")
