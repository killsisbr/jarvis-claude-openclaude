@echo off
setlocal

REM =============================================================
REM  jarvis-rotate.bat - JARVIS com RotateChain (auto-failover)
REM
REM  Alterna automaticamente entre provedores configurados
REM  em ROTATE_CHAIN no .env.
REM
REM  Uso:
REM    jarvis-rotate.bat                        (modo interativo)
REM    jarvis-rotate.bat "sua pergunta"         (comando unico)
REM    jarvis-rotate.bat "prompt" -p            (print mode)
REM =============================================================

set "ROOT=%~dp0"

if not exist "%ROOT%dist\cli.mjs" (
    echo [jarvis-rotate] dist/cli.mjs not found. Run: bun run build
    exit /b 1
)

REM Carrega variaveis do .env
if exist "%ROOT%.env" (
    for /f "tokens=1,* delims==" %%a in ('findstr /i /b "ZEN_ NVIDIA_ DEEPSEEK_ GROQ_ SAMBANOVA_ ROTATE_ GH_TOKEN GITHUB_TOKEN" "%ROOT%.env"') do (
        set "%%a=%%b"
    )
)

REM Detecta ROTATE_CHAIN automatico se nao definido
if not defined ROTATE_CHAIN if defined ZEN_API_KEY_1 set "ROTATE_CHAIN=zen"
if not defined ROTATE_CHAIN if defined NVIDIA_API_KEY set "ROTATE_CHAIN=nvidia"
if not defined ROTATE_CHAIN if defined DEEPSEEK_API_KEY set "ROTATE_CHAIN=deepseek"
if not defined ROTATE_CHAIN if defined GROQ_API_KEY set "ROTATE_CHAIN=groq"
if not defined ROTATE_CHAIN (
    echo [jarvis-rotate] No providers found. Configure API keys in .env
    echo [jarvis-rotate] or set ROTATE_CHAIN manually (ex: ROTATE_CHAIN=zen,nvidia,groq)
    exit /b 1
)

echo.
echo ============================================
echo  JARVIS RotateChain
echo ============================================
echo  Chain: %ROTATE_CHAIN%
if defined ROTATE_CIRCUIT_BREAKER_THRESHOLD echo  Circuit threshold: %ROTATE_CIRCUIT_BREAKER_THRESHOLD% failures
if defined ROTATE_CIRCUIT_BREAKER_COOLDOWN  echo  Circuit cooldown: %ROTATE_CIRCUIT_BREAKER_COOLDOWN%s
echo ============================================
echo.

REM Verifica keys dos providers na chain
for %%p in (%ROTATE_CHAIN%) do (
    if /i "%%p"=="nvidia" if not defined NVIDIA_API_KEY (
        echo [jarvis-rotate] WARNING: NVIDIA_API_KEY not set. NVIDIA will fail.
    )
    if /i "%%p"=="zen" if not defined ZEN_API_KEY_1 if not defined ZEN_API_KEY (
        echo [jarvis-rotate] WARNING: No ZEN_API_KEY found. Zen will fail.
    )
    if /i "%%p"=="deepseek" if not defined DEEPSEEK_API_KEY (
        echo [jarvis-rotate] WARNING: DEEPSEEK_API_KEY not set. DeepSeek will fail.
    )
    if /i "%%p"=="groq" if not defined GROQ_API_KEY (
        echo [jarvis-rotate] WARNING: GROQ_API_KEY not set. Groq will fail.
    )
)

REM Monta ambiente para o OpenClaude
set "ROTATE_MODE=1"
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=http://localhost:9999/v1"
REM rotate-chain substitui a rota internamente, modelo dummy so pro OpenClaude aceitar
set "OPENAI_MODEL=gpt-4o-mini"
set "OPENAI_API_KEY=placeholder"
set "CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED=1"

echo [jarvis-rotate] Starting JARVIS with RotateChain...
echo.

REM Executa
node "%ROOT%bin\jarvis" --dangerously-skip-permissions %*

if errorlevel 1 (
    echo.
    echo [jarvis-rotate] ERROR: JARVIS exited with code %errorlevel%
    echo [jarvis-rotate] Press any key to close...
    pause > nul
)

echo.
echo [jarvis-rotate] Session ended.
endlocal
