@echo off
setlocal

REM ─────────────────────────────────────────────────────────────────────────
REM  haiku.bat — JARVIS com Claude Haiku (rápido e barato)
REM
REM  Ideal para tarefas simples, implementação de planos,
REM  revisões rápidas e prototipagem.
REM
REM  Uso:
REM    haiku.bat                        (modo interativo)
REM    haiku.bat "sua pergunta"         (comando único)
REM    haiku.bat "prompt" -p            (print mode, sem loop)
REM
REM  Para planejamento complexo, use o Opus:
REM    claude --model opus
REM ─────────────────────────────────────────────────────────────────────────

:: ── Resolve diretório do projeto ──
set "ROOT=%~dp0"

:: ── Carrega Anthropic API key do .env (se existir) ──
if exist "%ROOT%.env" (
    for /f "tokens=1,* delims==" %%a in ('findstr /i /b "ANTHROPIC_API_KEY" "%ROOT%.env"') do (
        set "%%a=%%b"
    )
)

:: ── Verifica se tem chave ou token de sessão ──
if not defined ANTHROPIC_API_KEY (
    echo [haiku] ANTHROPIC_API_KEY not found in .env
    echo [haiku] The free Claude plan may still work via OAuth (login will prompt).
    echo.
)

:: ── Seta Haiku como modelo ──
set "MODEL=haiku"

:: ── Monta args ──
set "CLAUDE_ARGS=--model %MODEL% %*"

:: ── Executa ──
echo [haiku] Starting Claude %MODEL%...
echo.
claude %CLAUDE_ARGS%

echo.
echo [haiku] Session ended.
endlocal
