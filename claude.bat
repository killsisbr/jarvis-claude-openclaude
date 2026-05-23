@echo off
setlocal enabledelayedexpansion

REM ===========================================================================
REM claude.bat - OpenClaude CLI with Claude (Anthropic) as default provider
REM
REM This is the standard way to open OpenClaude - uses OAuth /login
REM ===========================================================================

set "ROOT=%~dp0"

REM Verificar se dist/cli.mjs existe
if not exist "%ROOT%dist\cli.mjs" (
    echo [claude] dist/cli.mjs not found. Run: bun run build
    pause
    exit /b 1
)

REM ===========================================================================
REM LIMPAR TODOS OS PROVIDERS CONFLITANTES
REM ===========================================================================

REM Remover chaves Anthropic que conflitam com OAuth /login
set "ANTHROPIC_API_KEY="
set "ANTHROPIC_AUTH_TOKEN="
set "ANTHROPIC_DEFAULT_HAIKU_MODEL="
set "ANTHROPIC_DEFAULT_SONNET_MODEL="
set "ANTHROPIC_DEFAULT_OPUS_MODEL="

REM Remover NVIDIA NIM
set "HAS_NVIDIA="
set "NVIDIA_API_KEY="
set "NVIDIA_BASE_URL="
set "NVIDIA_FALLBACK_MODEL="

REM Remover OpenAI/Groq/custom
set "OPENAI_BASE_URL="
set "OPENAI_API_KEY="
set "OPENAI_MODEL="
set "GROQ_API_KEY="
set "CLAUDE_CODE_USE_OPENAI="

REM Remover Gemini/Mistral/GitHub
set "GEMINI_API_KEY="
set "CLAUDE_CODE_USE_GEMINI="
set "MISTRAL_API_KEY="
set "CLAUDE_CODE_USE_MISTRAL="
set "GITHUB_TOKEN="
set "GH_TOKEN="

REM Ativar persona JARVIS
set "JARVIS_PERSONA=1"

REM ===========================================================================
REM OTIMIZAÇÕES DE TOKENS (habilitadas por default no JARVIS)
REM ===========================================================================

REM Thinking estendido com budget razoável (16K tokens)
if not defined MAX_THINKING_TOKENS set "MAX_THINKING_TOKENS=16000"

REM ===========================================================================
REM ABRIR OPENCLAUDE COM CLAUDE
REM ===========================================================================

echo.
echo ╔════════════════════════════════════════╗
echo ║   OpenClaude - Claude (Anthropic)      ║
echo ║   Auth: /login (OAuth)                  ║
echo ║   Model: claude-sonnet-4-6 (default)   ║
echo ╚════════════════════════════════════════╝
echo.

cd /d "%ROOT%"
node dist/cli.mjs --dangerously-skip-permissions %*

endlocal
