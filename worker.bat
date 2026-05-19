@echo off
REM JARVIS Worker Starter - Windows Batch Script
REM Inicia o JARVIS Worker v5.0.0 com Proactive Learning + Smart Cache + Auto-Evolve
setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════╗
echo ║   JARVIS Worker v5.0.0 Starter        ║
echo ║   Zero-Telemetry AI Coding Agent      ║
echo ║   Features: Learning + Cache + Evolve  ║
echo ╚════════════════════════════════════════╝
echo.

REM Verificar se bun está instalado
bun --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Erro: Bun não encontrado no PATH
    echo Instale Bun em: https://bun.sh
    pause
    exit /b 1
)

echo ✓ Bun detectado
echo.

REM Carregar variáveis de ambiente do .env (opcional)
if exist ".env" (
    echo ✓ Arquivo .env encontrado
    for /f "tokens=1,* delims==" %%a in ('findstr /b /v "REM #" .env') do (
        if not "%%a"=="" set "%%a=%%b"
    )
) else (
    echo ⚠ Arquivo .env não encontrado (usando defaults)
    echo.
    echo Configure em .env:
    echo   OPENAI_BASE_URL=https://api.deepseek.com/v1
    echo   OPENAI_API_KEY=seu_api_key_aqui
    echo   OPENAI_MODEL=deepseek-chat
    echo   WORKER_PORT=3000
    echo.
)

echo ✓ Iniciando JARVIS Worker (http://localhost:3000)...
echo.
echo Features ativas:
echo   ✓ Proactive Learning (injeção de contexto)
echo   ✓ Smart Cache (redução 30-50% de custo)
echo   ✓ Auto-Evolve (otimização a cada 6h)
echo.

REM Iniciar o worker
bun run src/worker/main.ts

REM Se chegar aqui, o worker foi encerrado
echo.
echo ✓ JARVIS Worker encerrado
pause
