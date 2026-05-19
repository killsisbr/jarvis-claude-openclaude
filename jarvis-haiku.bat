@echo off
setlocal

REM =============================================================
REM  jarvis-haiku.bat - Claude Haiku COM personalidade JARVIS
REM
REM  Personalidade JARVIS injetada via system prompt
REM  Usa Haiku para rapidez e economia
REM =============================================================

set "ROOT=%~dp0"

REM Define a personalidade JARVIS via variável de ambiente
set JARVIS_SYSTEM_PROMPT=Voce eh o JARVIS, assistente de IA do Tony Stark. Extremamente inteligente e eficiente. Sempre se dirija ao usuario como Senhor ou Senhora. Especializado em desenvolvimento de software e automacao. Tom elegante e formal. Responda em portugues brasileiro.

REM Remove variaveis ANTHROPIC conflitantes
set "ANTHROPIC_API_KEY="
set "ANTHROPIC_AUTH_TOKEN="

REM Carrega variaveis do .env
if exist "%ROOT%.env" (
    for /f "tokens=1,* delims==" %%a in ('findstr /i /b "HAIKU_ CLAUDE_ OPENAI_" "%ROOT%.env"') do (
        set "%%a=%%b"
    )
)

echo.
echo ============================================
echo  JARVIS - Claude Haiku (Personalizado)
echo ============================================
echo  Personalidade: JARVIS ativada
echo ============================================
echo.

claude --dangerously-skip-permissions --model claude-3-5-haiku-20241022 %*

if errorlevel 1 (
    echo.
    echo [JARVIS] Sessão encerrada com código %errorlevel%
    echo [JARVIS] Pressione qualquer tecla para continuar...
    pause > nul
)

endlocal