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
echo  [0] Claude Pro/Max       [/login OAuth]
echo  [H] Claude Haiku         [/login OAuth - rapido]
set "N=1"
if "!HAS_ZEN!"=="1"      ( set /a N+=1 & echo  [1] Zen OpenCode        [ONLINE] )
if "!HAS_NVIDIA!"=="1"   ( set /a N+=1 & echo  [2] NVIDIA NIM           [ONLINE] )
if "!HAS_NVIDIA!"=="1"   ( set /a N+=1 & echo  [3] NVIDIA FLASH         [ONLINE] )
if "!HAS_DEEPSEEK!"=="1" ( set /a N+=1 & echo  [4] DeepSeek API         [ONLINE] )
if "!HAS_GROQ!"=="1"     ( set /a N+=1 & echo  [5] Groq LPU             [ONLINE] )
if "!HAS_OLLAMA!"=="1"   ( set /a N+=1 & echo  [6] Ollama Local          [ONLINE] )
if "!HAS_GITHUB!"=="1"   ( set /a N+=1 & echo  [7] GitHub Models         [READY]  )
echo.
echo  [W] Worker HTTP         [daemon headless]
echo  [N] Night Worker         [missoes autonomas]
echo  [Q] Quit
echo  [R] Rotate Mode        [auto-failover chain]
echo.

set /p "choice=Select provider [0-7/W/N/R/Q]: "

if /i "!choice!"=="Q" exit /b 0
if /i "!choice!"=="H"                            call "%ROOT%haiku.bat" %* & goto :done
if /i "!choice!"=="W"                            call "%ROOT%worker.bat" & goto :done
if /i "!choice!"=="N"                            call "%ROOT%night-worker.bat" & goto :done
if /i "!choice!"=="R"                            call "%ROOT%jarvis-rotate.bat" %* & goto :done
if /i "!choice!"=="0"                          call "%ROOT%claude.bat" & goto :done
if /i "!choice!"=="1" if "!HAS_ZEN!"=="1"      call "%ROOT%jarvis.bat" zen      & goto :done
if /i "!choice!"=="2" if "!HAS_NVIDIA!"=="1"   call "%ROOT%jarvis.bat" nvidia       & goto :done
if /i "!choice!"=="3" if "!HAS_NVIDIA!"=="1"   call "%ROOT%jarvis.bat" nvidia-flash  & goto :done
if /i "!choice!"=="4" if "!HAS_DEEPSEEK!"=="1" call "%ROOT%jarvis.bat" deepseek & goto :done
if /i "!choice!"=="5" if "!HAS_GROQ!"=="1"     goto :groq_launch
if /i "!choice!"=="6" if "!HAS_OLLAMA!"=="1"   call "%ROOT%jarvis.bat" ollama   & goto :done
if /i "!choice!"=="7" if "!HAS_GITHUB!"=="1"   call "%ROOT%jarvis.bat" github   & goto :done

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

:done
endlocal
exit /b 0
