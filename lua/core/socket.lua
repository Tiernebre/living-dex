-- Thin wrapper over mGBA's socket API for connecting to the Deno hub.
-- See https://mgba.io/docs/scripting.html for the socket API.

local M = {}

local HUB_HOST = "127.0.0.1"
local HUB_PORT = 8889

local sock = nil
local connected = false

local function on_error(err)
  console:error("[hub] socket error: " .. tostring(err))
  connected = false
  if sock then sock:close(); sock = nil end
end

function M.connect()
  if sock then return connected end
  sock = socket.tcp()
  sock:add("error", on_error)
  sock:add("received", function() end)
  local ok, err = sock:connect(HUB_HOST, HUB_PORT)
  if not ok then
    on_error(err or "connect failed")
    return false
  end
  connected = true
  console:log(string.format("[hub] connected to %s:%d", HUB_HOST, HUB_PORT))
  return true
end

function M.send(frame)
  if not connected then return false end
  local ok, err = sock:send(frame)
  if not ok then on_error(err or "send failed"); return false end
  return true
end

function M.is_connected() return connected end

function M.close()
  if sock then sock:close(); sock = nil end
  connected = false
end

return M
