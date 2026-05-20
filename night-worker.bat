@echo off
setlocal enabledelayedexpansion

REM ===========================================================================
REM night-worker.bat - JARVIS Night Worker v5.0.0
REM
REM Executor autonomo de missoes longas. Deixe rodando a noite e
REM acorde com o trabalho feito + relatorio detalhado.
REM
REM Uso:
REM   night-worker.bat                     (inicia worker + API de missoes)
REM   curl -X POST localhost:3000/api/mission -H "Content-Type: application/json" ^
REM        -d "{\"title\":\"...\",\"description\":\"...\",\"workingDir\":\"C:\\...\"}"
REM
REM IMPORTANTE: Worker usa .env para config, NAO usa OAuth /login
REM ===========================================================================

set "ROOT=%~dp0"
cd /d "%ROOT%"

echo.
echo ============================================
echo  JARVIS Night Worker v5.0.0
echo  "Vai dormir, JARVIS trabalha a noite toda"
echo ============================================
echo.

REM Verificar se bun esta instalado
bun --version >nul 2>&1
if errorlevel 1 (
    echo [night-worker] ERRO: Bun nao encontrado no PATH
    echo [night-worker] Instale Bun em: https://bun.sh
    pause
    exit /b 1
)

echo [night-worker] Bun detectado
echo.

REM Carregar variaveis do .env
if exist "%ROOT%.env" (
    echo [night-worker] Arquivo .env encontrado
    for /f "tokens=1,* delims==" %%a in ('findstr /i /b "WORKER_ GROQ_ OPENAI_ DEEPSEEK_" "%ROOT%.env"') do (
        if not "%%a"=="" set "%%a=%%b"
    )
) else (
    echo [night-worker] AVISO: Arquivo .env nao encontrado
    echo.
    echo Configure em .env:
    echo   WORKER_PORT=3000
    echo   WORKER_MODE=true
    echo.
)

REM Defaults
if not defined WORKER_PORT set "WORKER_PORT=3000"

echo.
echo [night-worker] Iniciando em http://localhost:!WORKER_PORT!
echo [night-worker] Endpoints:
echo   POST /api/mission              - Criar missao
echo   GET  /api/mission              - Listar missoes
echo   GET  /api/mission/:id          - Detalhes
echo   GET  /api/mission/:id/report   - Relatorio
echo   POST /api/mission/:id/cancel   - Cancelar
echo.
echo [night-worker] Exemplo de uso:
echo   curl -X POST localhost:!WORKER_PORT!/api/mission ^
echo     -H "Content-Type: application/json" ^
echo     -d "{\"title\":\"Refactor auth\",\"description\":\"...\",\"workingDir\":\"C:\\project\"}"
echo.

REM Iniciar o worker (mesma entry point, Night Worker e ativado via API)
bun run src/worker/main.ts

echo.
echo [night-worker] JARVIS Night Worker encerrado
pause
