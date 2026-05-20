@echo off
setlocal enabledelayedexpansion

REM ===========================================================================
REM worker.bat - JARVIS Worker v5.0.0 (daemon HTTP headless)
REM
REM Inicia o Worker com Proactive Learning + Smart Cache + Auto-Evolve
REM Worker roda em http://localhost:3000 e serve API REST
REM
REM IMPORTANTE: Worker usa .env para config, NAO usa OAuth /login
REM ===========================================================================

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo ============================================
echo  JARVIS Worker v5.0.0
echo  Features: Learning + Cache + Evolve
echo ============================================
echo.

REM Verificar se bun esta instalado
bun --version >nul 2>&1
if errorlevel 1 (
    echo [worker] ERRO: Bun nao encontrado no PATH
    echo [worker] Instale Bun em: https://bun.sh
    pause
    exit /b 1
)

echo [worker] Bun detectado
echo.

REM Carregar apenas variaveis do Worker do .env (nao carrega ANTHROPIC_API_KEY)
if exist "%ROOT%.env" (
    echo [worker] Arquivo .env encontrado
    for /f "tokens=1,* delims==" %%a in ('findstr /i /b "WORKER_ GROQ_ OPENAI_ DEEPSEEK_" "%ROOT%.env"') do (
        if not "%%a"=="" set "%%a=%%b"
    )
) else (
    echo [worker] AVISO: Arquivo .env nao encontrado
    echo.
    echo Configure em .env:
    echo   WORKER_PORT=3000
    echo   WORKER_MODE=true
    echo.
)

REM Defaults
if not defined WORKER_PORT set "WORKER_PORT=3000"

echo.
echo [worker] Iniciando em http://localhost:!WORKER_PORT!
echo [worker] Features: Learning + Cache + Evolve
echo.

REM Iniciar o worker
bun run src/worker/main.ts

REM Se chegar aqui, o worker foi encerrado
echo.
echo [worker] JARVIS Worker encerrado
pause
