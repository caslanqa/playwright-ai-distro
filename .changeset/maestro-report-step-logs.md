---
'@pwtap/plugin-maestro': minor
---

Every replayed step now attaches Maestro's real, unedited data for that exact command as `maestro-step-log` — not a synthesized summary. Imperative commands attach the YAML sent over MCP plus Maestro's raw response text; batch YAML steps attach the exact JSON entry Maestro recorded (command + metadata) from `debug/commands-*.json`. A failing step always attaches its log; on a passing step it's opt-in via the new `MOBILE_STEP_LOGS=1` env key, so passing runs stay quiet by default. Also exports `resolveVerboseStepLogs` alongside `resolveScreenshotMode` for bespoke wiring.
