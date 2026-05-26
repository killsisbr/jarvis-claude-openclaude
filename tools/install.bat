@echo off
REM ===========================================================================
REM JARVIS v5 - Install Script (Windows)
REM
REM Steps:
REM   1. Check prerequisites (node, npm, bun)
REM   2. Install npm dependencies
REM   3. Build dist/cli.mjs (may OOM on less than 32GB RAM - offers workaround)
REM   4. Create global `jarvis` command via npm link
REM
REM After running:  jarvis.bat zen    (or nvidia, deepseek, ollama)
REM ===========================================================================

setlocal enableextensions enabledelayedexpansion
set "ROOT=%~dp0"
pushd "%ROOT%"

echo.
echo === JARVIS v5 Installer ===
echo Root: %ROOT%
echo.

REM -- Check prerequisites ------------------------------------------------------
where node >nul 2>nul
if errorlevel 1 (
    echo [ERROR] Node.js not found. Install from https://nodejs.org/ ^(v20+^)
    goto :fail
)

where npm >nul 2>nul
if errorlevel 1 (
    echo [ERROR] npm not found. Install Node.js from https://nodejs.org/
    goto :fail
)

set "HAS_BUN=1"
where bun >nul 2>nul
if errorlevel 1 (
    echo [WARN] bun not found. Install: powershell -c "irm bun.sh/install.ps1 | iex"
    set "HAS_BUN=0"
)

REM -- Install dependencies -----------------------------------------------------
if not exist "node_modules" (
    echo [1/3] Installing dependencies...
    call npm install
    if errorlevel 1 goto :fail
) else (
    echo [1/3] Dependencies present. Skipping npm install.
)

REM -- Build --------------------------------------------------------------------
if "!HAS_BUN!"=="0" (
    echo [2/3] Skipping build ^(bun not installed^).
    goto :check_dist
)

if exist "%ROOT%dist\cli.mjs" (
    echo [2/3] dist/cli.mjs already exists. Skipping build.
    echo       To rebuild: bun run build
) else (
    echo [2/3] Building dist/cli.mjs...
    echo       ^(This may take 1-3 minutes. If it crashes with OOM, see below.^)
    call bun run build
    if errorlevel 1 (
        echo.
        echo [WARN] Build failed ^(likely OOM on Windows with bun 1.x^).
        echo        Known issue: bun build uses ^>16GB RAM on this codebase.
        echo.
        echo        Workarounds:
        echo          1. Close other apps and retry
        echo          2. Use bun dev mode:  bun src/entrypoints/cli.tsx
        echo          3. Wait for bun 1.4+ which fixes the memory spike
        echo.
        echo        You can still run tests:  bun test src/services/api/*.test.ts
        goto :skip_link
    )
)

:check_dist
if not exist "%ROOT%dist\cli.mjs" (
    echo [WARN] dist/cli.mjs not found after build step.
    echo        Run manually: bun run build
    goto :skip_link
)

REM -- npm link -----------------------------------------------------------------
echo [3/3] Linking globally as `jarvis`...
call npm link
if errorlevel 1 (
    echo [WARN] npm link failed. Run as admin or use: jarvis.bat
    goto :skip_link
)

echo.
echo === Install complete ===
echo Run:  jarvis.bat zen       ^(Zen OpenCode^)
echo       jarvis.bat nvidia    ^(NVIDIA NIM^)
echo       jarvis.bat ollama    ^(Ollama local^)
echo       start-jarvis.bat     ^(Interactive selector^)
goto :done

:skip_link
echo.
echo === Partial install ===
echo Dependencies installed but build/link had issues.
echo You can still use: jarvis.bat  ^(if dist/cli.mjs exists^)
echo Or dev mode:       bun src/entrypoints/cli.tsx

:done
popd
endlocal
exit /b 0

:fail
echo.
echo [FAIL] Install failed. See errors above.
popd
endlocal
exit /b 1
