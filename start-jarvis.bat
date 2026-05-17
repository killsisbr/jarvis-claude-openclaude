@echo off
setlocal enabledelayedexpansion
set "ROOT=%~dp0"

REM ===========================================================================
REM JARVIS v5 - Interactive Provider Selector
REM
REM Pings available APIs, shows which are online, lets user pick.
REM All keys come from .env - nothing hardcoded.
REM ===========================================================================

REM -- Load .env (safe parser - only loads known-safe prefixes) ----------
if exist "%ROOT%.env" (
    for /f "tokens=1,* delims==" %%a in ('findstr /i /b "ZEN_ NVIDIA_ DEEPSEEK_ GROQ_ SAMBANOVA_ ROTATE_ GH_TOKEN GITHUB_TOKEN" "%ROOT%.env"') do (
        set "%%a=%%b"
    )
)

REM -- Check dist -----------------------------------------------------------
if not exist "%ROOT%dist\cli.mjs" (
    echo [jarvis] dist/cli.mjs not found. Run: bun run build
    pause
    exit /b 1
)

REM -- Detect available providers --------------------------------------------
echo.
echo ============================================
echo  JARVIS v5 - Checking Providers...
echo ============================================
echo.

set "HAS_ZEN=0"
set "HAS_NVIDIA=0"
set "HAS_DEEPSEEK=0"
set "HAS_GROQ=0"
set "HAS_OLLAMA=0"
set "HAS_GITHUB=0"

if defined ZEN_API_KEY_1 if not "!ZEN_API_KEY_1!"=="" (
    echo [ping] Zen OpenCode...
    curl -m 3 -s -o NUL -w "%%{http_code}" -H "Authorization: Bearer !ZEN_API_KEY_1!" "!ZEN_BASE_URL!/models" | findstr "200" >nul 2>&1
    if !errorlevel!==0 set "HAS_ZEN=1"
)

if defined NVIDIA_API_KEY if not "!NVIDIA_API_KEY!"=="" (
    echo [ping] NVIDIA NIM...
    curl -m 3 -s -o NUL -w "%%{http_code}" -H "Authorization: Bearer !NVIDIA_API_KEY!" "https://integrate.api.nvidia.com/v1/models" | findstr "200" >nul 2>&1
    if !errorlevel!==0 set "HAS_NVIDIA=1"
)

if defined DEEPSEEK_API_KEY if not "!DEEPSEEK_API_KEY!"=="" if not "!DEEPSEEK_API_KEY!"=="your_deepseek_api_key_here" (
    echo [ping] DeepSeek...
    curl -m 3 -s -o NUL -w "%%{http_code}" -H "Authorization: Bearer !DEEPSEEK_API_KEY!" "https://api.deepseek.com/v1/models" | findstr "200" >nul 2>&1
    if !errorlevel!==0 set "HAS_DEEPSEEK=1"
)

if defined GROQ_API_KEY if not "!GROQ_API_KEY!"=="" (
    echo [ping] Groq...
    curl -m 3 -s -o NUL -w "%%{http_code}" -H "Authorization: Bearer !GROQ_API_KEY!" "https://api.groq.com/openai/v1/models" | findstr "200" >nul 2>&1
    if !errorlevel!==0 set "HAS_GROQ=1"
)

echo [ping] Ollama (localhost:11434)...
curl -m 1 -s -o NUL -w "%%{http_code}" "http://localhost:11434/api/tags" | findstr "200" >nul 2>&1
if !errorlevel!==0 set "HAS_OLLAMA=1"

if defined GITHUB_TOKEN if not "!GITHUB_TOKEN!"=="" set "HAS_GITHUB=1"
if defined GH_TOKEN if not "!GH_TOKEN!"=="" set "HAS_GITHUB=1"

REM -- Show menu ----------------------------------------------------------------
cls
echo.
echo ============================================
echo  JARVIS v5 - Provider Selector
echo ============================================
echo.
echo  [0] Claude Pro/Max       [/login]
set "N=1"
if "!HAS_ZEN!"=="1"      ( set /a N+=1 & echo  [1] Zen OpenCode        [ONLINE] )
if "!HAS_NVIDIA!"=="1"   ( set /a N+=1 & echo  [2] NVIDIA NIM           [ONLINE] )
if "!HAS_DEEPSEEK!"=="1" ( set /a N+=1 & echo  [3] DeepSeek API         [ONLINE] )
if "!HAS_GROQ!"=="1"     ( set /a N+=1 & echo  [4] Groq LPU             [ONLINE] )
if "!HAS_OLLAMA!"=="1"   ( set /a N+=1 & echo  [5] Ollama Local          [ONLINE] )
if "!HAS_GITHUB!"=="1"   ( set /a N+=1 & echo  [6] GitHub Models         [READY]  )
echo.
echo  [Q] Quit
echo  [R] Rotate Mode        [auto-failover chain]
echo.

set /p "choice=Select provider [0-7/R/Q]: "

if /i "!choice!"=="Q" exit /b 0
if /i "!choice!"=="R"                            goto :rotate_launch
if /i "!choice!"=="0"                          call "%ROOT%jarvis.bat" claude   & goto :done
if /i "!choice!"=="1" if "!HAS_ZEN!"=="1"      call "%ROOT%jarvis.bat" zen      & goto :done
if /i "!choice!"=="2" if "!HAS_NVIDIA!"=="1"   call "%ROOT%jarvis.bat" nvidia   & goto :done
if /i "!choice!"=="3" if "!HAS_DEEPSEEK!"=="1" call "%ROOT%jarvis.bat" deepseek & goto :done
if /i "!choice!"=="4" if "!HAS_GROQ!"=="1"     goto :groq_launch
if /i "!choice!"=="5" if "!HAS_OLLAMA!"=="1"   call "%ROOT%jarvis.bat" ollama   & goto :done
if /i "!choice!"=="6" if "!HAS_GITHUB!"=="1"   call "%ROOT%jarvis.bat" github   & goto :done

echo Invalid choice or provider offline.
pause
exit /b 1

:groq_launch
REM Groq uses the same OpenAI shim pattern
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=https://api.groq.com/openai/v1"
set "OPENAI_API_KEY=!GROQ_API_KEY!"
if not defined GROQ_MODEL set "GROQ_MODEL=llama-3.3-70b-versatile"
set "OPENAI_MODEL=!GROQ_MODEL!"
echo [jarvis] Provider: Groq LPU
echo [jarvis] Model:    !OPENAI_MODEL!
echo.
node "%ROOT%bin\jarvis" --dangerously-skip-permissions
goto :done

:rotate_launch
REM ── Rotate Mode: activate RotateChain ──
echo.
echo ============================================
echo  Rotate Mode - Auto-Failover Chain
echo ============================================
echo.

if not defined ROTATE_CHAIN (
    if defined ZEN_API_KEY_1 (
        set "ROTATE_CHAIN=zen"
    ) else if defined NVIDIA_API_KEY (
        set "ROTATE_CHAIN=nvidia"
    ) else (
        echo [rotate] No providers configured. Set ROTATE_CHAIN in .env
        echo [rotate] or configure at least one API key (NVIDIA_API_KEY, ZEN_API_KEY_1, etc).
        pause
        exit /b 1
    )
)

echo [rotate] Chain: %ROTATE_CHAIN%
if defined ROTATE_CIRCUIT_BREAKER_THRESHOLD echo [rotate] Circuit threshold: %ROTATE_CIRCUIT_BREAKER_THRESHOLD% failures
if defined ROTATE_CIRCUIT_BREAKER_COOLDOWN  echo [rotate] Circuit cooldown: %ROTATE_CIRCUIT_BREAKER_COOLDOWN% seconds
echo.

REM Check required keys, warn of missing ones
for %%p in (%ROTATE_CHAIN%) do (
    if /i "%%p"=="nvidia" if not defined NVIDIA_API_KEY (
        echo [rotate] WARNING: NVIDIA_API_KEY not set. NVIDIA will fail.
    )
    if /i "%%p"=="zen" if not defined ZEN_API_KEY_1 if not defined ZEN_API_KEY (
        echo [rotate] WARNING: No ZEN_API_KEY_N found. Zen will fail.
    )
    if /i "%%p"=="groq" if not defined GROQ_API_KEY (
        echo [rotate] WARNING: GROQ_API_KEY not set. Groq will fail.
    )
)

REM Set env vars for RotateChain
set "ROTATE_MODE=1"

REM Ensure all provider env vars are visible to JARVIS
echo [rotate] Starting JARVIS with RotateChain...
echo.
call "%ROOT%jarvis.bat" rotate
goto :done

:done
endlocal
exit /b 0
