@echo off
setlocal

REM =============================================================
REM  claude-official.bat - Claude Code Official com Haiku
REM
REM  Roda o Claude Code oficial (instalado globalmente)
REM  com Haiku 4.5, totalmente isolado do projeto JARVIS
REM
REM  Abre: Claude Code official (vanilla)
REM  Modelo: Haiku 4.5
REM  Sem variaveis do projeto: zero interferencia JARVIS
REM
REM  Uso:
REM    claude-official.bat                  (abre vanilla Claude Code)
REM    claude-official.bat "sua pergunta"   (pergunta em Haiku)
REM =============================================================

REM Desabilitar variaveis do projeto JARVIS
setlocal enabledelayedexpansion

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

echo.
echo ============================================
echo  Claude Code Official - Haiku 4.5
echo ============================================
echo.
echo  Modo: Vanilla (sem JARVIS customizations)
echo  Modelo: claude-haiku-4-5-20251001
echo  Auth: OAuth (/login)
echo.

REM Rodar Claude Code official global
claude --model claude-haiku-4-5-20251001 %*

if errorlevel 1 (
    echo.
    echo [claude-official] Exited with error: %errorlevel%
    echo [claude-official] Press any key...
    pause > nul
)

endlocal
