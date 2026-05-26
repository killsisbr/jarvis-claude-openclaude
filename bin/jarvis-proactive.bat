@echo off
setlocal

REM =============================================================
REM  jarvis-proactive.bat - JARVIS em modo proativo com Haiku
REM
REM  Roda JARVIS de forma autonoma (ticks a cada 30s)
REM  usando Claude Haiku (rapido e barato).
REM
REM  Ideal para:
REM    - Monitoramento continuo
REM    - Bug hunting autonomo
REM    - Automacao overnight
REM    - Explorar codigo em background
REM
REM  Uso:
REM    jarvis-proactive.bat                  (modo interativo + proactive)
REM    jarvis-proactive.bat "sua pergunta"   (input inicial + proactive)
REM =============================================================

set "ROOT=%~dp0"

REM Remove variaveis ANTHROPIC do sistema (conflitos com OAuth)
set "ANTHROPIC_API_KEY="
set "ANTHROPIC_AUTH_TOKEN="
set "ANTHROPIC_DEFAULT_HAIKU_MODEL="
set "ANTHROPIC_DEFAULT_SONNET_MODEL="
set "ANTHROPIC_DEFAULT_OPUS_MODEL="

REM Carrega variaveis do .env
if exist "%ROOT%.env" (
    for /f "tokens=1,* delims==" %%a in ('findstr /i /b "HAIKU_ CLAUDE_ OPENAI_" "%ROOT%.env"') do (
        set "%%a=%%b"
    )
)

REM Se nao tem CLAUDE_CODE_USE_OPENAI, usa /login OAuth
if not defined CLAUDE_CODE_USE_OPENAI (
    echo [jarvis-proactive] Usando autenticacao OAuth (/login)
    echo [jarvis-proactive] Se ainda nao logou, rode: claude --login
    echo.
)

echo.
echo ============================================
echo  JARVIS Proactive Mode - Haiku 4.5
echo ============================================
echo.
echo  Status: Autonomo (ticks a cada ~30s)
echo  Modelo: Claude Haiku (rapido)
echo  Pausa: Quando voce digita
echo.

REM Ativar persona JARVIS
set "JARVIS_PERSONA=1"

REM ATIVAR MODO PROATIVO
set "CLAUDE_CODE_PROACTIVE=1"

REM Limpar NVIDIA vars conflitantes
set "HAS_NVIDIA="
set "NVIDIA_API_KEY="
set "NVIDIA_BASE_URL="
set "OPENAI_BASE_URL="
set "OPENAI_API_KEY="
set "OPENAI_MODEL="

REM Rodar OpenClaude com proactive mode + Haiku
cd /d "%ROOT%"
echo [jarvis-proactive] Abrindo JARVIS em modo proativo...
echo [jarvis-proactive] Procure por ^<tick^> nos logs (a cada ~30s)
echo.

node dist/cli.mjs ^
  --dangerously-skip-permissions ^
  --model claude-haiku-4-5-20251001 ^
  %*

if errorlevel 1 (
    echo.
    echo [jarvis-proactive] JARVIS saiu com erro: %errorlevel%
    echo [jarvis-proactive] Pressione qualquer tecla...
    pause > nul
)

endlocal
