@echo off
setlocal

REM =============================================================
REM  haiku.bat - JARVIS com Claude Haiku (rapido e barato)
REM
REM  Ideal para tarefas simples, implementacao de planos,
REM  revisoes rapidas e prototipagem.
REM
REM  Uso:
REM    haiku.bat                        (modo interativo)
REM    haiku.bat "sua pergunta"         (comando unico)
REM    haiku.bat "prompt" -p            (print mode)
REM =============================================================

set "ROOT=%~dp0"

REM Remove variaveis ANTHROPIC do sistema que redirecionam modelos (z-ai)
REM e conflitam com o /login OAuth
set "ANTHROPIC_API_KEY="
set "ANTHROPIC_AUTH_TOKEN="
set "ANTHROPIC_DEFAULT_HAIKU_MODEL="
set "ANTHROPIC_DEFAULT_SONNET_MODEL="
set "ANTHROPIC_DEFAULT_OPUS_MODEL="

REM Carrega variaveis do .env (exceto ANTHROPIC_API_KEY)
if exist "%ROOT%.env" (
    for /f "tokens=1,* delims==" %%a in ('findstr /i /b "HAIKU_ CLAUDE_ OPENAI_" "%ROOT%.env"') do (
        set "%%a=%%b"
    )
)

REM Se nao tem CLAUDE_CODE_USE_OPENAI, usa /login OAuth
if not defined CLAUDE_CODE_USE_OPENAI (
    echo [haiku] Usando autenticacao OAuth (/login)
    echo [haiku] Se ainda nao logou, rode: claude --login
    echo.
)

echo.
echo ============================================
echo  Haiku Mode - Claude Haiku (OpenClaude Local)
echo ============================================
echo.

REM Ativar persona JARVIS
set "JARVIS_PERSONA=1"

REM Limpar NVIDIA vars conflitantes (local)
set "HAS_NVIDIA="
set "NVIDIA_API_KEY="
set "NVIDIA_BASE_URL="
set "OPENAI_BASE_URL="
set "OPENAI_API_KEY="
set "OPENAI_MODEL="

REM Usar OpenClaude local com Claude/Anthropic como provider
REM --bare desabilita worktrees, hooks, etc
cd /d "%ROOT%"
echo [haiku] Abrindo OpenClaude com Haiku 4.5 (Claude/Anthropic)...
echo.
node dist/cli.mjs --dangerously-skip-permissions --model claude-haiku-4-5-20251001 %*

if errorlevel 1 (
    echo.
    echo [haiku] JARVIS exited with code %errorlevel%
    echo [haiku] Press any key...
    pause > nul
)

endlocal
