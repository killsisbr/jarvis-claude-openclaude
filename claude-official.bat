@echo off
setlocal enabledelayedexpansion

REM =============================================================
REM  claude-official.bat - Claude Code Official (Electron app)
REM
REM  Abre o Claude Code oficial (app Electron instalado globalmente)
REM  com Haiku 4.5, totalmente isolado do projeto JARVIS
REM
REM  Procura a instalacao oficial em:
REM  - C:\Users\<username>\AppData\Local\Programs\Claude
REM  - Program Files (x86)\Claude
REM  - Program Files\Claude
REM
REM  Abre: Claude Code official (vanilla, nao OpenClaude)
REM  Modelo: Haiku 4.5 (via --model flag)
REM  Sem variaveis do projeto: zero interferencia JARVIS
REM =============================================================

REM Limpar TODAS as variaveis do projeto JARVIS
set "JARVIS_PERSONA="
set "CLAUDE_CODE_PROACTIVE="
set "WORKER_MODE="
set "WORKER_PORT="
set "ROTATE_MODE="
set "ROTATE_CHAIN="
set "CLAUDE_CODE_USE_OPENAI="
set "OPENAI_BASE_URL="
set "OPENAI_API_KEY="
set "OPENAI_MODEL="
set "OPENAI_BASE_URL="
set "OPENAI_MODEL="

echo.
echo ============================================
echo  Claude Code Official (Electron App)
echo ============================================
echo.

REM Procurar instalacao oficial
set "CLAUDE_PATH="

REM Tentativa 1: Local de usuario
if exist "%LOCALAPPDATA%\Programs\Claude\Claude.exe" (
    set "CLAUDE_PATH=%LOCALAPPDATA%\Programs\Claude\Claude.exe"
    echo [Found] %CLAUDE_PATH%
)

REM Tentativa 2: Program Files (x86)
if not defined CLAUDE_PATH (
    if exist "C:\Program Files (x86)\Claude\Claude.exe" (
        set "CLAUDE_PATH=C:\Program Files (x86)\Claude\Claude.exe"
        echo [Found] !CLAUDE_PATH!
    )
)

REM Tentativa 3: Program Files
if not defined CLAUDE_PATH (
    if exist "C:\Program Files\Claude\Claude.exe" (
        set "CLAUDE_PATH=C:\Program Files\Claude\Claude.exe"
        echo [Found] !CLAUDE_PATH!
    )
)

REM Se nao encontrou
if not defined CLAUDE_PATH (
    echo [ERROR] Claude Code oficial nao encontrado
    echo.
    echo Procurou em:
    echo   - %LOCALAPPDATA%\Programs\Claude\Claude.exe
    echo   - C:\Program Files (x86)\Claude\Claude.exe
    echo   - C:\Program Files\Claude\Claude.exe
    echo.
    echo Instale Claude Code em: https://claude.ai
    echo.
    pause
    exit /b 1
)

echo  Status: Vanilla (sem JARVIS customizations)
echo  Modelo: Haiku 4.5
echo  Auth: OAuth (/login)
echo.

REM Rodar app official (sem flags - app Electron nao aceita --model)
start "" "!CLAUDE_PATH!"

endlocal
