# JARVIS v5

**Zero-telemetry autonomous coding agent** — forked from [OpenClaude](https://github.com/gitlawb/openclaude) v0.11.0.

JARVIS v5 keeps all of OpenClaude's provider flexibility (OpenAI, Gemini, DeepSeek, Ollama, 200+ models) while **completely removing** the telemetry infrastructure (Datadog, OpenTelemetry, GrowthBook, FirstParty event logger).

## Status

- **Base**: OpenClaude 0.11.0 (clean fork)
- **Version**: 5.0.0
- **Branch**: `main`
- **Privacy goal**: Zero external data collection

## Roadmap

| Phase | Goal | Status |
|-------|------|--------|
| 0 | Fork OpenClaude → init JARVIS v5 repo | DONE |
| 1 | Surgical telemetry purge (Datadog/OTel/GrowthBook) | TODO |
| 2 | Validation (`verify-zero-telemetry.sh`) | TODO |
| 3 | Remove telemetry npm dependencies | TODO |
| 4 | CI guard against telemetry regressions | TODO |
| 5 | Port DS4 patterns + specialized agents from JARVIS-001 | TODO |

## Quick Start

```bash
npm install
npm run build
./bin/jarvis
```

## Telemetry Removal Plan

See `.claude/PLAN.md` for the full purge plan. Scripts:

- `.claude/scripts/purge-telemetry.sh` — removes analytics infra
- `.claude/scripts/verify-zero-telemetry.sh` — validates 10 checks

## License

See `LICENSE`.
