@echo off
chcp 65001 > nul
cls

echo.
echo ╔════════════════════════════════════════════════╗
echo ║   🚀 OPENCLAUDE EXTENSION - DEV MODE          ║
echo ╚════════════════════════════════════════════════╝
echo.

REM Inicia servidor mock em nova janela
echo [1/2] Iniciando servidor mock na porta 3000...
start "OpenClaude Mock Server" cmd /k "cd /d D:\jarvis-claude\openclaude && node test-server.js"

REM Aguarda servidor iniciar
timeout /t 2 /nobreak

REM Abre extensão em modo debug
echo [2/2] Abrindo extensão VS Code em modo debug...
cd /d D:\jarvis-claude\openclaude\vscode-extension\openclaude-vscode
code .

REM Instrução para o usuário
echo.
echo ✅ Extensão aberta! Pressione F5 para iniciar Debug Host...
echo.
pause
