-- Helper for reading contiguous byte ranges out of emulator memory as a Lua string.
-- Adapters use this to produce payloads shipped verbatim to the hub.

local M = {}

function M.read_bytes(addr, length)
  local chars = {}
  for i = 0, length - 1 do
    chars[i + 1] = string.char(emu:read8(addr + i))
  end
  return table.concat(chars)
end

-- Cheap fingerprint so we can diff regions without shipping the whole buffer every frame.
function M.checksum(bytes)
  local sum = 0
  for i = 1, #bytes do
    sum = (sum * 31 + string.byte(bytes, i)) % 0x100000000
  end
  return sum
end

return M
