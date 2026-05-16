@echo off
REM ===========================================================================
REM JARVIS v5 - Local launcher (NVIDIA NIM)
REM ===========================================================================

setlocal enabledelayedexpansion
set "ROOT=%~dp0"

REM ── Load .env if present ──────────────────────────────────────────────
if exist "%ROOT%.env" (
    for /f "usebackq tokens=1,* delims==" %%a in ("%ROOT%.env") do (
        set "_key=%%a"
        set "_val=%%b"
        if not "!_key!"=="" if not "!_key:~0,1!"=="#" (
            set "!_key!=!_val!"
        )
    )
)

REM ── Ensure NVIDIA variables are set ───────────────────────────────────
if not defined NVIDIA_API_KEY (
    echo [jarvis] NVIDIA_API_KEY not found. Check your .env file.
    exit /b 1
)
if not defined OPENAI_BASE_URL set "OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1"
if not defined OPENAI_MODEL set "OPENAI_MODEL=nvidia/llama-3.1-nemotron-70b-instruct"
set CLAUDE_CODE_USE_OPENAI=1

if not exist "%ROOT%dist\cli.mjs" (
    echo [jarvis] dist/cli.mjs not found.
    echo Run install.bat first ^(or `bun run build`^).
    exit /b 1
)

echo [jarvis] Iniciando com NVIDIA NIM
echo [jarvis] Modelo: %OPENAI_MODEL%
echo.

node "%ROOT%bin\jarvis" --dangerously-skip-permissions %*
exit /b %errorlevel%
