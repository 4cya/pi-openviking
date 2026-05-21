# Logging file-based

Logging via `appendFileSync` para `~/.pi/agent/pi-openviking.log` (ou `OV_LOG_FILE` env). Nenhum `console.*` em `src/` — tests enforce isso. File-based evita poluir stdout/stderr do Pi e permite debug post-mortem.
