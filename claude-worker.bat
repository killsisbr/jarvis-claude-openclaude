@echo off
setlocal enabledelayedexpansion

set WORKER_URL=http://localhost:3000
set USER_ID=cli-user
set MESSAGE=%*

if "!MESSAGE!"=="" (
    echo Uso: claude-worker.bat "sua mensagem aqui"
    exit /b 1
)

echo [+] Conectando ao worker...

curl -s "!WORKER_URL!/health" >nul 2>&1
if errorlevel 1 (
    echo [-] Worker nao esta rodando
    echo.
    echo Inicie com: worker.bat
    exit /b 1
)

echo [+] Worker conectado, processando...
echo.

curl -s -X POST "!WORKER_URL!/api/chat" ^
  -H "Content-Type: application/json" ^
  -d "{"user":"!USER_ID!","message":"!MESSAGE!","model":"llama-3.3-70b-versatile"}"

echo.
