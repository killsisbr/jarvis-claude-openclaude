@echo off
REM JARVIS Worker + CLI Bridge
REM Inicia o Worker e abre CLI para usar o Worker

setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════╗
echo ║   JARVIS Worker + CLI Bridge           ║
echo ║   Worker: http://localhost:3000        ║
echo ╚════════════════════════════════════════╝
echo.

REM Verificar se Bun está instalado
bun --version >nul 2>&1
if errorlevel 1 (
    echo [-] Erro: Bun nao encontrado no PATH
    echo.
    echo Instale Bun em: https://bun.sh
    pause
    exit /b 1
)

echo [+] Bun detectado
echo.

REM Iniciar Worker em nova janela
echo [+] Iniciando Worker...
start "JARVIS Worker" cmd /k "bun run src/worker/main.ts"

REM Aguardar worker iniciar
echo [+] Aguardando Worker conectar...
timeout /t 5 /nobreak

REM Verificar se worker está respondendo
:CHECK_WORKER
curl -s http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo [!] Worker ainda nao respondeu...
    timeout /t 2 /nobreak
    goto CHECK_WORKER
)

echo [+] Worker conectado em http://localhost:3000
echo.

REM Abrir CLI em nova janela
echo [+] Abrindo CLI...
echo.
echo ════════════════════════════════════════════════════════════
echo CLAUDE CODE CLI - Conectado ao Worker
echo ════════════════════════════════════════════════════════════
echo.
echo Use os comandos:
echo   .\claude-worker.ps1 "sua mensagem"
echo   .\claude-worker.bat "sua mensagem"
echo   curl -X POST http://localhost:3000/api/chat ...
echo.
echo Ou execute Claude Code normalmente - ele usara o Worker
echo.
echo ════════════════════════════════════════════════════════════
echo.

REM Abrir PowerShell com CLI bridge ativo
start "Claude Code CLI" powershell -NoExit -Command "cd '%cd%'; Write-Host 'Claude CLI pronto para usar o Worker!'; Write-Host 'Use: .\claude-worker.ps1 <mensagem>'; Write-Host ''; Write-Host 'Ou use commands do Claude normalmente'; Write-Host ''"

REM Manter janela aberta
echo.
echo [+] Worker rodando em: http://localhost:3000
echo [+] CLI conectado ao Worker
echo.
echo Feche esta janela quando terminar.
pause
