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
-- Buffer glissant cote mod : petit (l'app garde l'historique permanent complet).
-- Petit => json.encode + ecriture disque legers => aucun hitch en jeu.
local MAX_HISTORY = 40
-- Log par-hit dans log.txt : utile en debug, mais couteux si degats rapides
-- (feu, pics, DoT) -> ecritures disque en rafale. Desactive par defaut (perf).
local DEBUG_LOG = false

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

-- ⚠️ `Level()` global n'est PAS appelable dans cette API (c'est une table/classe).
-- On passe par Game():GetLevel().
local function level()
  return Game():GetLevel()
end

local function currentPlayerType()
  return Isaac.GetPlayer(0):GetPlayerType()
end

local function characterIdFor(playerType)
  return PLAYER_TYPE_TO_ID[playerType] or ("unknown_" .. tostring(playerType))
end

-- Borne haute des ids de collectibles (depuis l'ItemConfig ; repli prudent).
-- Cache : calcule une seule fois (l'ItemConfig ne change pas en cours de partie).
local maxCollectibleId = nil
local function collectibleUpperBound()
  if maxCollectibleId ~= nil then
    return maxCollectibleId
  end
  local n = 800
  local ok, size = pcall(function() return Isaac.GetItemConfig():GetCollectibles().Size end)
  if ok and type(size) == "number" and size > 1 then
    n = size
  end
  maxCollectibleId = n
  return n
end

-- Snapshot du build : liste des ids de collectibles reellement tenus (§7).
-- GetCollectibleNum(id) renvoie 0 pour un id invalide -> boucle sure.
local function snapshotBuild(player)
  local ids = {}
  local bound = collectibleUpperBound()
  for id = 1, bound - 1 do
    local n = 0
    local ok, r = pcall(function() return player:GetCollectibleNum(id) end)
    if ok and type(r) == "number" then
      n = r
    end
    if n > 0 then
      ids[#ids + 1] = id
    end
  end
  return ids
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
-- MC_PRE_SPAWN_CLEAN_AWARD peut se declencher plusieurs fois par salle -> on ne
-- compte la salle nettoyee qu'une fois (flag remis a zero a chaque nouvelle salle).
local roomAwardCounted = false
-- Anti sur-comptage des boss : les boss segmentes (Larry Jr, Pin, Gemini...) tuent
-- plusieurs entites qui renvoient toutes IsBoss()=true. On deduplique par
-- (Type:Variant) DANS la salle courante -> un boss = 1, deux boss distincts = 2.
local bossKilledInRoom = {}

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
  local st = level():GetStage()
  local stt = level():GetStageType()

  run.hits_total = (run.hits_total or 0) + 1
  run.hits[#run.hits + 1] = { frame = f, stage = st, stage_type = stt, source = src }
  run.hits_by_source[src] = (run.hits_by_source[src] or 0) + 1
  local sk = tostring(st) .. "-" .. tostring(stt)
  run.hits_by_stage[sk] = (run.hits_by_stage[sk] or 0) + 1

  -- Dernier degat subi : sert de "cause de mort" si le run se termine par une mort.
  local srcType = nil
  if source ~= nil then
    srcType = source.Type
  end
  run.last_damage = { source = src, entity_type = srcType, stage = st, frame = f }

  if DEBUG_LOG then
    log(string.format("hit #%d (source=%s, stage=%d-%d)", run.hits_total, src, st, stt))
  end
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
    deepest_stage = level():GetStage(),
    hits_total = 0,
    -- champs larges (§4.5) — remplis au fil du run
    shielded_hits = 0,
    rooms_cleared = 0,
    kills = 0,
    boss_kills = 0,
    curses = 0,
    devil_deals = 0,
    final_stage = level():GetStage(),
    final_stage_type = level():GetStageType(),
    final_build = {},
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
  run.duration_frames = run.ended_frame - (run.started_frame or run.ended_frame)

  -- Instantane final : etage atteint, deals du diable, build tenu.
  run.final_stage = level():GetStage()
  run.final_stage_type = level():GetStageType()
  local ok, deals = pcall(function() return Game():GetDevilRoomDeals() end)
  if ok and type(deals) == "number" then
    run.devil_deals = deals
  end
  local okB, build = pcall(function() return snapshotBuild(Isaac.GetPlayer(0)) end)
  if okB and type(build) == "table" then
    run.final_build = build
  end
  -- Cause de mort = derniere source de degat subie.
  if run.outcome == "death" then
    run.death_source = run.last_damage
  end

  data.history[#data.history + 1] = run
  data.current_run = nil
  save()
  log(string.format("fin de run: %s, %d hits, %d kills, %d salles", run.outcome, run.hits_total, run.kills or 0, run.rooms_cleared or 0))
end

-- ── KILLS (ennemis + boss) ────────────────────────────────────────────────
local function onEntityKill(_, entity)
  local run = data.current_run
  if run == nil or entity == nil then
    return
  end
  local npc = entity:ToNPC()
  if npc == nil then
    return -- on ne compte que les NPC (pas les larmes/effets/joueur)
  end
  local isBoss = false
  pcall(function() isBoss = npc:IsBoss() end)
  if isBoss then
    -- 1 boss par (Type:Variant) et par salle : ignore les segments repetes.
    local key = tostring(entity.Type) .. ":" .. tostring(entity.Variant)
    if not bossKilledInRoom[key] then
      bossKilledInRoom[key] = true
      run.boss_kills = (run.boss_kills or 0) + 1
    end
  end
  -- Ennemi actif (ou boss) -> compte comme kill. IsActiveEnemy(true) inclut la
  -- frame de mort. Les PNJ neutres/amis (marchand, familiers) sont exclus.
  local counts = isBoss
  pcall(function() counts = counts or npc:IsActiveEnemy(true) end)
  if counts then
    run.kills = (run.kills or 0) + 1
  end
end

-- ── SALLE NETTOYEE ────────────────────────────────────────────────────────
-- Observateur pur : on ne renvoie RIEN (l'award se genere normalement).
local function onClearAward(_, _rng, _pos)
  local run = data.current_run
  if run == nil or roomAwardCounted then
    return
  end
  roomAwardCounted = true
  run.rooms_cleared = (run.rooms_cleared or 0) + 1
end

-- ── Etage le plus profond + sauvegardes regulieres (survie aux crashes) ────
local function onNewLevel(_)
  local run = data.current_run
  if run ~= nil then
    local st = level():GetStage()
    if st > (run.deepest_stage or 0) then
      run.deepest_stage = st
    end
    -- Union des maledictions rencontrees sur le run (bitmask LevelCurse).
    local ok, c = pcall(function() return level():GetCurses() end)
    if ok and type(c) == "number" then
      run.curses = (run.curses or 0) | c
    end
    -- Instantane du build a chaque etage (au cas ou le run ne se cloture pas).
    local okB, build = pcall(function() return snapshotBuild(Isaac.GetPlayer(0)) end)
    if okB and type(build) == "table" then
      run.final_build = build
    end
  end
end

local function onNewRoom(_)
  -- Les entites de la salle precedente ont disparu -> on borne la table de dedup
  -- (evite qu'elle grossisse sur un long run).
  lastHitFrame = {}
  roomAwardCounted = false
  bossKilledInRoom = {}
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
mod:AddCallback(ModCallbacks.MC_POST_ENTITY_KILL, safe("entity_kill", onEntityKill))
mod:AddCallback(ModCallbacks.MC_PRE_SPAWN_CLEAN_AWARD, safe("clean_award", onClearAward))
mod:AddCallback(ModCallbacks.MC_POST_NEW_LEVEL, safe("new_level", onNewLevel))
mod:AddCallback(ModCallbacks.MC_POST_NEW_ROOM, safe("new_room", onNewRoom))
mod:AddCallback(ModCallbacks.MC_PRE_GAME_EXIT, safe("pre_game_exit", onPreGameExit))

log("charge (v0.2.0) -- observateur + champs larges (kills/salles/build) prets")
