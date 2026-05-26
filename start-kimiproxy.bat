@echo off
setlocal enabledelayedexpansion

echo ==========================================
echo   KimiProxy Launcher
echo ==========================================
echo.

set "KIMI_DIR=D:\jarvis-claude\kimiproxy"
set "PORT=3000"

if not exist "%KIMI_DIR%\node_modules" (
    echo [INFO] node_modules nao encontrado. Rodando npm install...
    cd /d "%KIMI_DIR%"
    call npm install
    if errorlevel 1 (
        echo [ERRO] npm install falhou
        pause
        exit /b 1
    )
)

if not exist "%KIMI_DIR%\.env" (
    echo [INFO] Criando .env padrao...
    (
        echo PORT=3000
        echo API_KEY=jarvis-kimi-2025
        echo BROWSER=chromium
    ) > "%KIMI_DIR%\.env"
)

cd /d "%KIMI_DIR%"

echo [OK] Iniciando KimiProxy...
echo [INFO] URL local:   http://localhost:%PORT%/v1/chat/completions
echo [INFO] Models:      http://localhost:%PORT%/v1/models
echo [INFO] Health:      http://localhost:%PORT%/health
echo.
echo Para parar: feche esta janela ou pressione Ctrl+C
echo.

call npm start

pause
