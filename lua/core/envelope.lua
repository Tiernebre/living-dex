-- Binary framing for TCP messages to the Deno hub.
-- Keeping it binary avoids pulling JSON/base64 deps into mGBA Lua — the hub decodes everything.
--
-- Frame format:
--   magic   u8[2]  "LD"
--   version u8     0x01
--   type    u8     see TYPE.*
--   region  u8     see REGION.*
--   index   u8     sub-index (party slot, box number, etc.) — 0 if N/A
--   length  u16 BE length of payload in bytes
--   payload length bytes
--
-- The hub reads the 8-byte header, then `length` bytes of payload.

local M = {}

M.TYPE = {
  HELLO = 0x01, -- payload = game_code(4) .. revision(1)
  REGION = 0x02, -- payload = raw bytes of the RAM region (or a struct within it)
  BYE = 0x03,
}

M.REGION = {
  NONE = 0x00,
  PARTY = 0x01,
  PARTY_SLOT = 0x02,
  BOX = 0x03,
  BOX_SLOT = 0x04,
  ENEMY_PARTY = 0x05,
  DAYCARE = 0x06,
  TRAINER = 0x07,
  DEX = 0x08,
  BATTLE = 0x09, -- 4 bytes, u32 LE = gBattleTypeFlags (nonzero = in battle)
  LOCATION = 0x0A, -- 2 bytes: mapGroup (s8), mapNum (s8)
  LOCAL_TIME = 0x0B, -- 8 bytes: struct Time { s16 days; s8 h; s8 m; s8 s; } + pad
}

local function u16_be(n)
  return string.char(math.floor(n / 0x100) % 0x100, n % 0x100)
end

function M.frame(msg_type, region, index, payload)
  payload = payload or ""
  assert(#payload <= 0xFFFF, "envelope payload exceeds 65535 bytes; split into smaller regions")
  return "LD"
    .. string.char(0x01)
    .. string.char(msg_type)
    .. string.char(region or M.REGION.NONE)
    .. string.char(index or 0)
    .. u16_be(#payload)
    .. payload
end

function M.hello(game_code, revision)
  assert(#game_code == 4, "game_code must be 4 bytes")
  return M.frame(M.TYPE.HELLO, M.REGION.NONE, 0, game_code .. string.char(revision))
end

return M
