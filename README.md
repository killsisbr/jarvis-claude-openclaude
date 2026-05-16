# JARVIS v5

**Zero-telemetry autonomous coding agent** — forked from [OpenClaude](https://github.com/gitlawb/openclaude) v0.11.0.

JARVIS v5 keeps all of OpenClaude's provider flexibility (OpenAI, Gemini, DeepSeek, Ollama, 200+ models). The upstream OpenClaude base is already zero-telemetry — JARVIS v5 adds CI guards to prevent regression and ports the JARVIS-001 enhancements (DS4 patterns, specialized agents) on top.

## Telemetry Status (Audited)

| Layer | Status |
|-------|--------|
| `src/services/analytics/*` | All stubs (NO-OP) |
| `isAnalyticsDisabled()` | Hard-coded `return true` |
| Datadog client | Removed, only `shutdownDatadog()` NO-OP remains |
| 1P event logger | Stubs, no `@opentelemetry` imports |
| GrowthBook | Local-only flags from `~/.claude/feature-flags.json` |
| npm dependencies | 0 telemetry packages (no `@opentelemetry/*`, no `@growthbook/*`) |
| Network endpoints | 0 calls to `datadoghq.com`, `cdn.growthbook`, `otlp-*` |
| CI guard | `.github/workflows/verify-zero-telemetry.yml` blocks regressions |

This is the baseline OpenClaude reached itself — JARVIS-001 (the previous fork) only neutralized `logEvent()` but left Datadog and OpenTelemetry intact. JARVIS v5 starts from a clean base.

## Roadmap

| Phase | Goal | Status |
|-------|------|--------|
| 0 | Fork OpenClaude → init JARVIS v5 repo | DONE |
| 1 | Audit telemetry surface (already clean upstream) | DONE |
| 2 | Add CI guard against telemetry regressions | DONE |
| 3 | Port DS4 patterns from JARVIS-001 (context cache, speculative router, lazy KG) | TODO |
| 4 | Port specialized agents (cost-sentinel, deploy, self-evolve, security-audit) | TODO |
| 5 | Port Zen Key rotation with per-agent tracking | TODO |
| 6 | WhatsApp bridge integration | TODO |

## Quick Start

```bash
npm install
npm run build
./bin/jarvis
```

## License

See `LICENSE`.
