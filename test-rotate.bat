@echo off
setlocal
set "ROOT=%~dp0"
echo === Loading .env variables ===
for /f "tokens=1,* delims==" %%a in ('findstr /i /b "ZEN_ NVIDIA_ DEEPSEEK_ GROQ_ SAMBANOVA_ ROTATE_ GH_TOKEN GITHUB_TOKEN" "%ROOT%.env" 2^>nul') do (
    set "%%a=%%b"
)

echo === ROTATE_CHAIN ===
if defined ROTATE_CHAIN (echo %ROTATE_CHAIN%) else (echo [NOT SET])
echo === ZEN_API_KEY_1 defined ===
if defined ZEN_API_KEY_1 (echo YES) else (echo NO)
echo === NVIDIA_API_KEY defined ===
if defined NVIDIA_API_KEY (echo YES) else (echo NO)

echo.
echo === Starting JARVIS debug ===
set "ROTATE_MODE=1"
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=http://localhost:9999/v1"
set "OPENAI_MODEL=rotate-chain"
set "OPENAI_API_KEY=placeholder"
set "CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED=1"

echo ROTATE_MODE=%ROTATE_MODE%
echo CLAUDE_CODE_USE_OPENAI=%CLAUDE_CODE_USE_OPENAI%
echo OPENAI_BASE_URL=%OPENAI_BASE_URL%
echo OPENAI_MODEL=%OPENAI_MODEL%
echo ROTATE_CHAIN=%ROTATE_CHAIN%
echo.

echo === node bin/jarvis --version ===
node "%ROOT%bin\jarvis" --dangerously-skip-permissions --version 2>&1
echo EXIT CODE: %errorlevel%
echo.

echo === node bin/jarvis --help (first 5 lines) ===
node "%ROOT%bin\jarvis" --dangerously-skip-permissions --help 2>&1 | head -5
echo EXIT CODE: %errorlevel%

endlocal
