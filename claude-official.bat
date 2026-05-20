@echo off
setlocal enabledelayedexpansion

REM =============================================================
REM  claude-official.bat - Claude Oficial (isolado do JARVIS)
REM
REM  Roda OpenClaude como cliente vanilla Anthropic,
REM  completamente isolado das customizacoes JARVIS:
REM  - Sem JARVIS_PERSONA
REM  - Sem proactive mode
REM  - Sem worker mode
REM  - Sem rotate chain
REM  - Sem variaveis customizadas
REM
REM  Autentica via OAuth (/login) ou ANTHROPIC_API_KEY se definida
REM  Nao carrega .env do projeto
REM
REM  Uso:
REM    claude-official.bat                  (modo interativo)
REM    claude-official.bat "sua pergunta"   (comando unico)
REM =============================================================

set "ROOT=%~dp0"

REM LIMPAR TODAS AS VARIAVEIS JARVIS
REM ===================================

REM Persona e modo
set "JARVIS_PERSONA="
set "CLAUDE_CODE_PROACTIVE="
set "WORKER_MODE="
set "WORKER_PORT="

REM Proactive
set "CLAUDE_CODE_PROACTIVE="

REM Rotate chain
set "ROTATE_MODE="
set "ROTATE_CHAIN="

REM Providers customizados
set "CLAUDE_CODE_USE_OPENAI="
set "OPENAI_BASE_URL="
set "OPENAI_API_KEY="
set "OPENAI_MODEL="

REM Keys de providers third-party
set "ZEN_API_KEY_1="
set "ZEN_API_KEY_2="
set "ZEN_BASE_URL="
set "NVIDIA_API_KEY="
set "NVIDIA_BASE_URL="
set "DEEPSEEK_API_KEY="
set "GROQ_API_KEY="
set "SAMBANOVA_API_KEY="

REM Modelo override
set "ANTHROPIC_DEFAULT_HAIKU_MODEL="
set "ANTHROPIC_DEFAULT_SONNET_MODEL="
set "ANTHROPIC_DEFAULT_OPUS_MODEL="
set "ANTHROPIC_MODEL="

REM Outras customizacoes JARVIS
set "CLAUDE_CODE_SIMPLE="
set "CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED="

REM =============================================================
REM CARREGAR APENAS ANTHROPIC_API_KEY (se existir em .env)
REM =============================================================

if exist "%ROOT%.env" (
    REM Procurar apenas ANTHROPIC_API_KEY
    for /f "tokens=1,* delims==" %%a in ('findstr /i /b "ANTHROPIC_API_KEY" "%ROOT%.env"') do (
        set "%%a=%%b"
    )
)

REM =============================================================
REM VALIDAR AUTENTICACAO
REM =============================================================

if defined ANTHROPIC_API_KEY (
    if not "!ANTHROPIC_API_KEY!"=="" (
        echo [claude-official] ANTHROPIC_API_KEY definida
        echo [claude-official] Usando API key direto (sem OAuth)
        echo.
    ) else (
        echo [claude-official] ANTHROPIC_API_KEY vazia
        echo [claude-official] Usando OAuth (/login)
        echo [claude-official] Se nao logou, o CLI vai pedir
        echo.
    )
) else (
    echo [claude-official] ANTHROPIC_API_KEY nao definida
    echo [claude-official] Usando OAuth (/login)
    echo.
)

REM =============================================================
REM SHOW INFO
REM =============================================================

echo.
echo ============================================
echo  Claude Official (Vanilla Anthropic)
echo ============================================
echo.
echo  Isolamento: Total
echo  Persona: Desativada
echo  Proactive: Desativado
echo  Worker: Desativado
echo  Rotate: Desativado
echo.
echo  Autenticacao:
if defined ANTHROPIC_API_KEY (
    if not "!ANTHROPIC_API_KEY!"=="" (
        echo    Metodo: API Key (ANTHROPIC_API_KEY)
    ) else (
        echo    Metodo: OAuth (/login)
    )
) else (
    echo    Metodo: OAuth (/login)
)
echo.

REM =============================================================
REM RUN
REM =============================================================

cd /d "%ROOT%"
echo [claude-official] Iniciando OpenClaude official...
echo.

REM --bare desabilita:
REM   - Hooks (Setup, SessionStart, etc)
REM   - LSP/Plugin sync
REM   - Auto-memory
REM   - CLAUDE.md auto-discovery
REM   - Background prefetches
REM   - Attribution
REM   - Keychain reads
REM
REM Resultado: OpenClaude puro, zero customizacao

node dist/cli.mjs --bare %*

if errorlevel 1 (
    echo.
    echo [claude-official] Exited with error: %errorlevel%
    echo [claude-official] Press any key...
    pause > nul
)

endlocal
