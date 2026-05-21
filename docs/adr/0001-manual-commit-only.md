# Commit exclusivamente manual via /ov-commit

Auto-commit on shutdown removido porque bloqueia o exit do Pi. `onShutdown()` é síncrono e zero I/O — apenas reseta state. Commit é manual via `/ov-commit` ou `memcommit` tool.
