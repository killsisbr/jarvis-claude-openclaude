@echo off
setlocal enableextensions

REM JARVIS v5 launcher. Usage: jarvis.bat [provider] [extra-args]
REM Providers: claude (default), zen, nvidia, nvidia-flash, deepseek, ollama, github, groq
REM
REM "claude" mode uses your Claude Pro/Max subscription via OAuth.
REM Run /login inside JARVIS to authenticate on first use.

set "ROOT=%~dp0"

REM Clear any stale provider env vars from the parent shell
set "OPENAI_BASE_URL="
set "OPENAI_API_KEY="
set "OPENAI_MODEL="
set "CLAUDE_CODE_USE_OPENAI="
set "CLAUDE_CODE_USE_GITHUB="
set "CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED="
set "ANTHROPIC_MODEL="
set "CLAUDE_MODEL="
set "GEMINI_MODEL="
set "MISTRAL_MODEL="

REM Load safe API keys from .env (pre-filter to avoid lines with | or special chars)
if exist "%ROOT%.env" (
    for /f "tokens=1,* delims==" %%a in ('findstr /i /b "ZEN_ NVIDIA_ DEEPSEEK_ GROQ_ SAMBANOVA_ ROTATE_ GH_TOKEN GITHUB_TOKEN" "%ROOT%.env"') do (
        set "%%a=%%b"
    )
)

if not exist "%ROOT%dist\cli.mjs" (
    echo [jarvis] dist/cli.mjs not found. Run: bun run build
    exit /b 1
)

if /i "%~1"=="claude"   goto :p_claude
if /i "%~1"=="zen"      goto :p_zen
if /i "%~1"=="nvidia-flash" goto :p_nvidia_flash
if /i "%~1"=="nvidia"   goto :p_nvidia
if /i "%~1"=="deepseek" goto :p_deepseek
if /i "%~1"=="ollama"   goto :p_ollama
if /i "%~1"=="github"   goto :p_github
if /i "%~1"=="groq"     goto :p_groq
if /i "%~1"=="rotate"   goto :p_rotate

REM No explicit provider -- auto-detect from .env keys, fallback to Claude
set "PASS_ARGS=%*"
if defined ZEN_API_KEY_1    goto :a_zen
if defined NVIDIA_API_KEY   goto :a_nvidia
if defined DEEPSEEK_API_KEY goto :a_deepseek
goto :a_claude

:a_claude
set "CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED=1"
echo [jarvis] Claude Pro (use /login to authenticate)
goto :launch

:a_zen
set "CLAUDE_CODE_USE_OPENAI=1"
if not defined ZEN_BASE_URL set "ZEN_BASE_URL=https://opencode.ai/zen/v1"
set "OPENAI_BASE_URL=%ZEN_BASE_URL%"
if not defined ZEN_MODEL set "ZEN_MODEL=big-pickle"
set "OPENAI_MODEL=%ZEN_MODEL%"
set "OPENAI_API_KEY=%ZEN_API_KEY_1%"
echo [jarvis] Zen / %OPENAI_MODEL%
goto :launch

:a_nvidia
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1"
set "OPENAI_API_KEY=%NVIDIA_API_KEY%"
set "OPENAI_MODEL=qwen/qwen3-coder-480b-a35b-instruct"
echo [jarvis] NVIDIA / %OPENAI_MODEL%
goto :launch

:a_deepseek
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=https://api.deepseek.com/v1"
set "OPENAI_API_KEY=%DEEPSEEK_API_KEY%"
if not defined DEEPSEEK_MODEL set "DEEPSEEK_MODEL=deepseek-chat"
set "OPENAI_MODEL=%DEEPSEEK_MODEL%"
echo [jarvis] DeepSeek / %OPENAI_MODEL%
goto :launch

:p_claude
set "PASS_ARGS=%~2 %~3 %~4 %~5 %~6 %~7 %~8 %~9"
set "CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED=1"
echo [jarvis] Claude Pro (use /login to authenticate)
goto :launch

:p_zen
set "PASS_ARGS=%~2 %~3 %~4 %~5 %~6 %~7 %~8 %~9"
set "CLAUDE_CODE_USE_OPENAI=1"
if not defined ZEN_BASE_URL set "ZEN_BASE_URL=https://opencode.ai/zen/v1"
set "OPENAI_BASE_URL=%ZEN_BASE_URL%"
if not defined ZEN_MODEL set "ZEN_MODEL=big-pickle"
set "OPENAI_MODEL=%ZEN_MODEL%"
if defined ZEN_API_KEY_1 set "OPENAI_API_KEY=%ZEN_API_KEY_1%"
echo [jarvis] Zen / %OPENAI_MODEL%
goto :launch

:p_nvidia
set "PASS_ARGS=%~2 %~3 %~4 %~5 %~6 %~7 %~8 %~9"
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1"
if defined NVIDIA_API_KEY set "OPENAI_API_KEY=%NVIDIA_API_KEY%"
set "OPENAI_MODEL=qwen/qwen3-coder-480b-a35b-instruct"
echo [jarvis] NVIDIA / %OPENAI_MODEL%
goto :launch

:p_deepseek
set "PASS_ARGS=%~2 %~3 %~4 %~5 %~6 %~7 %~8 %~9"
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=https://api.deepseek.com/v1"
if defined DEEPSEEK_API_KEY set "OPENAI_API_KEY=%DEEPSEEK_API_KEY%"
if not defined DEEPSEEK_MODEL set "DEEPSEEK_MODEL=deepseek-chat"
set "OPENAI_MODEL=%DEEPSEEK_MODEL%"
echo [jarvis] DeepSeek / %OPENAI_MODEL%
goto :launch

:p_nvidia_flash
set "PASS_ARGS=%~2 %~3 %~4 %~5 %~6 %~7 %~8 %~9"
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=https://integrate.api.nvidia.com/v1"
if defined NVIDIA_API_KEY set "OPENAI_API_KEY=%NVIDIA_API_KEY%"
set "OPENAI_MODEL=deepseek-ai/deepseek-v4-flash"
echo [jarvis] NVIDIA Flash / %OPENAI_MODEL%
goto :launch

:p_ollama
set "PASS_ARGS=%~2 %~3 %~4 %~5 %~6 %~7 %~8 %~9"
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=http://localhost:11434/v1"
set "OPENAI_API_KEY=ollama"
set "OPENAI_MODEL=llama3.3"
echo [jarvis] Ollama / %OPENAI_MODEL%
goto :launch

:p_github
set "PASS_ARGS=%~2 %~3 %~4 %~5 %~6 %~7 %~8 %~9"
set "CLAUDE_CODE_USE_GITHUB=1"
set "OPENAI_MODEL=gpt-4o"
echo [jarvis] GitHub / %OPENAI_MODEL%
goto :launch

:p_groq
set "PASS_ARGS=%~2 %~3 %~4 %~5 %~6 %~7 %~8 %~9"
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=https://api.groq.com/openai/v1"
if defined GROQ_API_KEY set "OPENAI_API_KEY=%GROQ_API_KEY%"
if not defined GROQ_MODEL set "GROQ_MODEL=llama-3.3-70b-versatile"
set "OPENAI_MODEL=%GROQ_MODEL%"
echo [jarvis] Groq / %OPENAI_MODEL%
goto :launch

:p_rotate
set "PASS_ARGS=%~2 %~3 %~4 %~5 %~6 %~7 %~8 %~9"
set "ROTATE_MODE=1"
set "CLAUDE_CODE_USE_OPENAI=1"
set "OPENAI_BASE_URL=http://localhost:9999/v1"
set "OPENAI_MODEL=gpt-4o-mini"
set "OPENAI_API_KEY=placeholder"
set "CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED=1"
echo [jarvis] Rotate Mode (chain: %ROTATE_CHAIN%)
goto :launch

:launch
REM Suppress Codex profile auto-detection (JARVIS manages its own provider)
if not defined CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED set "CLAUDE_CODE_PROVIDER_PROFILE_ENV_APPLIED=1"

REM ===========================================================================
REM OTIMIZAÇÕES DE TOKENS (JARVIS defaults)
REM ===========================================================================
REM Thinking estendido com budget razoável (16K tokens de raciocínio)
if not defined MAX_THINKING_TOKENS set "MAX_THINKING_TOKENS=16000"

node "%ROOT%bin\jarvis" --dangerously-skip-permissions %PASS_ARGS%
exit /b %errorlevel%
