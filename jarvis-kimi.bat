@echo off
setlocal enabledelayedexpansion

REM ==========================================
REM   JARVIS + KimiProxy Launcher
REM ==========================================
REM Inicia KimiProxy em background e conecta JARVIS

set "KIMI_DIR=D:\jarvis-claude\kimiproxy"
set "JARVIS_DIR=%~dp0"
set "KIMI_PORT=3000"

REM --- Verificar KimiProxy ---
if not exist "%KIMI_DIR%\package.json" (
    echo [ERRO] KimiProxy nao encontrado em %KIMI_DIR%
    echo        Clone: git clone https://github.com/pedrofariasx/kimiproxy %KIMI_DIR%
    pause
    exit /b 1
)

if not exist "%KIMI_DIR%\node_modules" (
    echo [INFO] Instalando dependencias do KimiProxy...
    cd /d "%KIMI_DIR%"
    call npm install
    if errorlevel 1 (
        echo [ERRO] Falha ao instalar KimiProxy
        pause
        exit /b 1
    )
)

if not exist "%KIMI_DIR%\.env" (
    echo [INFO] Criando .env do KimiProxy...
    (
        echo PORT=%KIMI_PORT%
        echo API_KEY=jarvis-kimi-2025
        echo BROWSER=chromium
    ) > "%KIMI_DIR%\.env"
)

REM --- Iniciar KimiProxy em background ---
echo.
echo [1/2] Iniciando KimiProxy em background...
cd /d "%KIMI_DIR%"
start "KimiProxy" /min cmd /c "npx tsx src/index.ts"

REM --- Aguardar proxy subir ---
echo [INFO] Aguardando KimiProxy na porta %KIMI_PORT%...
set /a attempts=0
:wait_loop
timeout /t 1 /nobreak >nul 2>&1
set /a attempts+=1

powershell -Command "try { $r = Invoke-WebRequest -Uri 'http://localhost:%KIMI_PORT%/health' -TimeoutSec 2 -UseBasicParsing; exit 0 } catch { exit 1 }" >nul 2>&1
if %errorlevel% == 0 goto :proxy_ready

if %attempts% lss 15 goto :wait_loop

echo [AVISO] KimiProxy nao respondeu em 15s. Tentando iniciar mesmo assim...

:proxy_ready
echo [OK] KimiProxy ativo em http://localhost:%KIMI_PORT%
echo.

REM --- Iniciar JARVIS com provider Kimi ---
echo [2/2] Iniciando JARVIS com provider Kimi...
cd /d "%JARVIS_DIR%"
call jarvis.bat kimi

pause
