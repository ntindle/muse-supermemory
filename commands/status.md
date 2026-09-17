---
description: Show Supermemory authentication and connection status
---

Report the user's Supermemory status for this Muse Code session.

1. Read `~/.supermemory-muse/credentials.json` (may not exist). Never print the full API key — show at most the first 6 and last 4 characters. Also check `~/.supermemory-claude/credentials.json` as a fallback. The key source is env `SUPERMEMORY_API_KEY` / `SUPERMEMORY_MUSE_API_KEY` when set, otherwise those files.
2. Probe real connectivity with the resolved key:

```
curl -sS -o /dev/null -w '%{http_code}' -m 8 -X POST "${SUPERMEMORY_API_URL:-https://api.supermemory.ai}/v4/profile" \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" -H "x-sm-source: muse-code" \
  -d '{"containerTag":"<this project's container tag>","q":"connectivity probe"}'
```

Interpret loudly: `200` → reachable and the key works; `401`/`403` → reachable but the key is invalid or revoked; timeout / connection error / `5xx` → API unreachable.

3. Call the `whoAmI` MCP tool if the supermemory MCP server is connected.
4. Report: authenticated or not, key source, the active project container tag, API reachability, and MCP reachability.

If not authenticated, tell the user a new session will open the browser login automatically, or they can write `{"apiKey":"sm_..."}` to `~/.supermemory-muse/credentials.json`.
