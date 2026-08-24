-- SPDX-License-Identifier: GPL-3.0-only
-- Isaac Completion Tracker -- (c) 2026 reiassezbeau -- https://github.com/reiassezbeau

--[[
  Isaac Tracker -- companion "Stats" mod
  Created by reiassezbeau -- https://github.com/reiassezbeau

  PURELY AN OBSERVER:
    - NEVER changes gameplay (no return in TAKE_DMG => damage untouched);
    - NEVER uses the debug console;
    - only listens to callbacks and writes one JSON file per slot.
    - every callback is wrapped in pcall: an error can NOT break the game
      or disable the mod (at worst one hit goes uncounted, logged in log.txt).

  Signatures verified against the Repentance+ Lua docs (wofsauge IsaacDocs):
    - handlers receive the mod as their 1st argument -> function(_, <params>)
    - MC_ENTITY_TAKE_DMG(_, entity, amount, damageFlags, source, countdownFrames)
    - MC_POST_GAME_STARTED(_, isContinue); MC_POST_GAME_END(_, isGameOver)
]]

local mod = RegisterMod("IsaacTracker", 1)
local json = require("json")

local SCHEMA = 1
-- Mod version. MUST stay in sync with <version> in metadata.xml (the value the
-- game shows in its Mods menu); this one is what ends up in log.txt.
local MOD_VERSION = "0.2.3"
-- Sliding buffer on the mod side: small (the app keeps the full permanent history).
-- Small => cheap json.encode + disk write => no in-game hitch.
local MAX_HISTORY = 40
-- Per-hit logging to log.txt: handy when debugging, but costly with fast damage
-- (fire, spikes, DoT) -> bursts of disk writes. Off by default (perf).
local DEBUG_LOG = false

-- In-memory state (persisted through mod:SaveData).
local data = { schema = SCHEMA, current_run = nil, history = {}, next_index = 1 }

-- PlayerType (integer) -> character id from characters.json.
-- Alternate "forms" point at their base character: Lazarus2->lazarus, BlackJudas->judas,
-- TheSoul->the_forgotten, Esau->jacob_esau; same on the Tainted side (38/39/40).
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

-- Wraps a handler in pcall: an error can never break the game, and since
-- we return NOTHING, TAKE_DMG stays a pure observer (damage untouched).
local function safe(name, fn)
  return function(...)
    local ok, err = pcall(fn, ...)
    if not ok then
      log("ERROR " .. name .. ": " .. tostring(err))
    end
  end
end

local function frame()
  return Game():GetFrameCount()
end

-- ⚠️ the global `Level()` is NOT callable in this API (it is a table/class).
-- Use Game():GetLevel() instead.
local function level()
  return Game():GetLevel()
end

local function currentPlayerType()
  return Isaac.GetPlayer(0):GetPlayerType()
end

local function characterIdFor(playerType)
  return PLAYER_TYPE_TO_ID[playerType] or ("unknown_" .. tostring(playerType))
end

-- Upper bound of collectible ids (from ItemConfig; conservative fallback).
-- Cached: computed once (ItemConfig never changes mid-session).
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

-- Build snapshot: the ids of the collectibles actually held (§7).
-- GetCollectibleNum(id) returns 0 for an invalid id -> the loop is safe.
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

-- Persistence (sliding buffer: only the last N runs are kept; the app
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

-- Classifies the source of a hit: self | environment | enemy | unknown.
local function classifySource(damageFlags, source)
  local DF = DamageFlag
  -- Guard: damageFlags must be an integer; otherwise we do not guess.
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
  -- Spikes: "self" in a sacrifice room (it was a choice), otherwise environment.
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
  -- Source = a non-player entity -> enemy (NPC, enemy projectile...).
  if source ~= nil and source.Type ~= nil and source.Type ~= 0 and source.Type ~= EntityType.ENTITY_PLAYER then
    return "enemy"
  end
  if source == nil or source.Entity == nil then
    return "environment"
  end
  return "unknown"
end

-- Deduplication: the same entity hitting twice on the same frame counts as 1 hit.
local lastHitFrame = {}
-- MC_PRE_SPAWN_CLEAN_AWARD can fire several times per room -> a cleared room
-- is only counted once (the flag resets on every new room).
local roomAwardCounted = false
-- Boss over-counting guard: segmented bosses (Larry Jr, Pin, Gemini...) kill
-- several entities that all report IsBoss()=true. We deduplicate by
-- (Type:Variant) WITHIN the current room -> one boss = 1, two distinct bosses = 2.
local bossKilledInRoom = {}

-- ── HIT (damage on a player entity) ─────────────────────────────────────
local function onTakeDmg(_, entity, amount, damageFlags, source, countdownFrames)
  -- Ignore fake damage.
  if type(damageFlags) == "number" and (damageFlags & DamageFlag.DAMAGE_FAKE) ~= 0 then
    return
  end
  local run = data.current_run
  if run == nil then
    return
  end
  if entity == nil or entity:ToPlayer() == nil then
    return -- safety (the ENTITY_PLAYER filter should already guarantee this)
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

  -- Last damage taken: used as the "cause of death" if the run ends in a death.
  local srcType = nil
  if source ~= nil then
    srcType = source.Type
  end
  run.last_damage = { source = src, entity_type = srcType, stage = st, frame = f }

  if DEBUG_LOG then
    log(string.format("hit #%d (source=%s, stage=%d-%d)", run.hits_total, src, st, stt))
  end
end

-- ── RUN START ──────────────────────────────────────────────────────────
-- IMPORTANT: we do NOT reload from disk here. The game only flushes SaveData when
-- returning to the menu or exiting; re-reading on every run would overwrite the
-- in-memory history (built up during the session). Loading happens ONCE at init.
local function onGameStarted(_, isContinue)
  -- ── Resuming a run (CRITICAL: NEVER lose the run in progress) ─────────
  -- Disabling the mod then relaunching: reaching the Mods menu requires exiting
  -- to the menu -> the game FLUSHES SaveData to disk (MC_PRE_GAME_EXIT has already
  -- called save()). On relaunch, load() (init) restores current_run, and here we
  -- resume. SAFETY NET: if init read an empty or wrong slot (current_run == nil)
  -- AND no session history has accumulated yet (#history == 0, so there is
  -- nothing to overwrite), we RE-READ from disk -- the right slot is active now.
  if isContinue then
    if data.current_run == nil and #data.history == 0 then
      pcall(load)
    end
    if data.current_run ~= nil then
      lastHitFrame = {}
      log("continue -> resuming the current run")
      return
    end
  end

  -- Previous run left open (restart or new game without dying/winning)
  -- => archive it as "abandoned" so its data is not lost.
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
  -- Unique run id WITHOUT touching the global RNG (math.random) so other mods
  -- are NOT disturbed: combine a persistent counter + the game's run seed
  -- + the starting frame.
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
    -- wide fields (§4.5) - filled in as the run goes
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
  log(string.format("new run: %s (%s)", data.current_run.run_id, data.current_run.character))
end

-- ── RUN END ────────────────────────────────────────────────────────────
local function onGameEnd(_, isGameOver)
  local run = data.current_run
  if run == nil then
    return
  end
  run.ended = true
  run.outcome = isGameOver and "death" or "win"
  run.ended_frame = frame()
  run.duration_frames = run.ended_frame - (run.started_frame or run.ended_frame)

  -- Final snapshot: floor reached, devil deals, build held.
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
  -- Cause of death = the last damage source taken.
  if run.outcome == "death" then
    run.death_source = run.last_damage
  end

  data.history[#data.history + 1] = run
  data.current_run = nil
  save()
  log(string.format("run end: %s, %d hits, %d kills, %d rooms", run.outcome, run.hits_total, run.kills or 0, run.rooms_cleared or 0))
end

-- ── KILLS (enemies + bosses) ────────────────────────────────────────────────
local function onEntityKill(_, entity)
  local run = data.current_run
  if run == nil or entity == nil then
    return
  end
  local npc = entity:ToNPC()
  if npc == nil then
    return -- only NPCs are counted (not tears, effects or the player)
  end
  local isBoss = false
  pcall(function() isBoss = npc:IsBoss() end)
  if isBoss then
    -- 1 boss per (Type:Variant) per room: repeated segments are ignored.
    local key = tostring(entity.Type) .. ":" .. tostring(entity.Variant)
    if not bossKilledInRoom[key] then
      bossKilledInRoom[key] = true
      run.boss_kills = (run.boss_kills or 0) + 1
    end
  end
  -- Active enemy (or boss) -> counts as a kill. IsActiveEnemy(true) includes the
  -- death frame. Neutral or friendly NPCs (shopkeeper, familiars) are excluded.
  local counts = isBoss
  pcall(function() counts = counts or npc:IsActiveEnemy(true) end)
  if counts then
    run.kills = (run.kills or 0) + 1
  end
end

-- ── ROOM CLEARED ────────────────────────────────────────────────────────
-- Pure observer: we return NOTHING (the award spawns normally).
local function onClearAward(_, _rng, _pos)
  local run = data.current_run
  if run == nil or roomAwardCounted then
    return
  end
  roomAwardCounted = true
  run.rooms_cleared = (run.rooms_cleared or 0) + 1
end

-- ── Deepest floor + regular saves (crash survival) ────
local function onNewLevel(_)
  local run = data.current_run
  if run ~= nil then
    local st = level():GetStage()
    if st > (run.deepest_stage or 0) then
      run.deepest_stage = st
    end
    -- Union of the curses met during the run (LevelCurse bitmask).
    local ok, c = pcall(function() return level():GetCurses() end)
    if ok and type(c) == "number" then
      run.curses = (run.curses or 0) | c
    end
    -- Build snapshot on every floor (in case the run never closes).
    local okB, build = pcall(function() return snapshotBuild(Isaac.GetPlayer(0)) end)
    if okB and type(build) == "table" then
      run.final_build = build
    end
  end
end

local function onNewRoom(_)
  -- The previous room's entities are gone -> bound the dedup table
  -- (keeps it from growing over a long run).
  lastHitFrame = {}
  roomAwardCounted = false
  bossKilledInRoom = {}
  if data.current_run ~= nil then
    -- DO NOT snapshot the build here. v0.2.2 did, to catch items picked up
    -- mid-floor, and it CRASHED THE GAME on entering the Mineshaft Lobby:
    --
    --   Room 1.10017(Mineshaft Lobby)
    --   Lua stack trace:
    --   [C](-1): GetCollectibleNum
    --   .../isaac-tracker-mod/main.lua(112): ?
    --   Caught exception, writing minidump...
    --
    -- During that transition Isaac.GetPlayer(0) hands back a player that is
    -- being rebuilt, and calling a method on it is an access violation inside
    -- the engine. pcall does NOT catch that: it catches Lua errors, not native
    -- faults, so the guard around it was worthless. The player lost the floor.
    --
    -- The build is still captured per floor and at run end, which has run for
    -- months without incident. If you want mid-floor accuracy back, defer the
    -- snapshot to MC_POST_UPDATE (a normal frame, room fully loaded) - never
    -- touch the player from inside a room-change callback.
    save()
  end
end

local function onPreGameExit(_, shouldSave)
  save()
end

-- ONE-TIME load of the persisted data (at mod init, not on every run).
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

log("loaded (v" .. MOD_VERSION .. ") -- observer + wide fields + hardened run resume")
