-- Reads the GBA ROM header to identify the game + revision.
-- GBA header: game code at 0x080000AC (4 bytes ASCII), revision at 0x080000BC (1 byte).

local M = {}

function M.read()
  local code = ""
  for i = 0, 3 do
    code = code .. string.char(emu:read8(0x080000AC + i))
  end
  local revision = emu:read8(0x080000BC)
  return code, revision
end

return M
