# JARVIS v5 (OpenClaude)

Zero-telemetry coding agent fork of Claude Code. Multi-provider (Anthropic, OpenAI, Gemini, DeepSeek, Ollama, 200+ models).

## Build & Run

```bash
bun run build          # Build → dist/cli.mjs (~21MB bundle)
bun run smoke          # Build + version check (quick sanity)
node dist/cli.mjs      # Run CLI directly
claude.bat             # Windows launcher (auto-injects --dangerously-skip-permissions)
```

## Test

```bash
bun test                    # Run all tests
bun test src/path/file.test.ts  # Run specific test
bun run typecheck           # TypeScript type checking
```

## Project Structure

- `src/entrypoints/cli.tsx` — Bootstrap entry point. Renders startup screen, then loads main.tsx
- `src/main.tsx` — Commander setup, action handler, REPL/headless branching (~4700 lines)
- `src/setup.ts` — CWD detection, git root, session init
- `src/skills/bundled/` — Built-in slash commands (/debug, /loop, /batch, etc.)
- `src/components/StartupScreen.ts` — ASCII art gradient logo
- `src/worker/` — KAIROS WhatsApp worker (separate system, runs via `npm run worker`)
- `dist/cli.mjs` — Single-file ESM bundle (do NOT edit directly — rebuild from source)
- `bin/jarvis`, `bin/claude` — Shell wrappers that auto-inject `--dangerously-skip-permissions`

## Key Conventions

- **Language**: All code comments in English. User-facing docs in Portuguese (pt-BR)
- **Gates**: `if (false) { ... }` blocks are feature gates from upstream Claude Code. They disable features at build time. Do NOT remove gates without verifying the gated module actually exists (see dream.js crash — commit ca0d649)
- **Missing-module-stubs**: The bundler creates stubs for modules referenced but not found in source. These export only `{ default: () => null }`. Calling any named export from a stub crashes the CLI
- **Build system**: esbuild via `bun run build`. Produces single-file ESM bundle with lazy `__esm` initialization
- **No telemetry**: All analytics/telemetry modules are stubbed at build time (10 modules)

## Common Gotchas

1. **Never edit dist/cli.mjs directly** — always edit source in `src/` and rebuild
2. **Gate removal requires stub audit** — before removing an `if (false)` guard, verify the gated module's exports actually exist. Check `dist/cli.mjs` for `missing-module-stub` comments
3. **OAuth tokens expire** — if CLI hangs silently, check `~/.claude/.credentials.json` expiry
4. **Windows TTY** — `process.stdout.isTTY` determines interactive vs headless mode. Piped/redirected stdout = headless
5. **Provider env vars** — `claude.bat` clears all provider env vars before running to ensure clean Anthropic default
