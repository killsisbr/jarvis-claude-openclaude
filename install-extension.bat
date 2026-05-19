@echo off
cls

echo.
echo ======================================================
echo   OPENCLAUDE EXTENSION - INSTALLER
echo   Empacotar + Instalar
echo ======================================================
echo.

set EXTENSION_DIR=D:\jarvis-claude\openclaude\vscode-extension\openclaude-vscode

if not exist "%EXTENSION_DIR%" (
    echo ERRO: Pasta da extensao nao encontrada!
    echo %EXTENSION_DIR%
    pause
    exit /b 1
)

cd /d "%EXTENSION_DIR%"

echo [1/4] Instalando dependencias...
call npm install
if errorlevel 1 (
    echo ERRO ao instalar dependencias
    pause
    exit /b 1
)
echo OK - Dependencias instaladas

echo.
echo [2/4] Verificando vsce...
call npm list -g @vscode/vsce >nul 2>&1
if errorlevel 1 (
    echo   Instalando @vscode/vsce globalmente...
    call npm install -g @vscode/vsce
)
echo OK - vsce pronto

echo.
echo [3/4] Empacotando extensao...
call vsce package --out openclaude.vsix
if errorlevel 1 (
    echo ERRO ao empacotar
    pause
    exit /b 1
)
echo OK - Extensao empacotada: openclaude.vsix

echo.
echo [4/4] Instalando no VS Code...
if exist "openclaude.vsix" (
    code --install-extension "%EXTENSION_DIR%\openclaude.vsix" --force
    echo OK - Extensao instalada!
) else (
    echo ERRO: Arquivo .vsix nao encontrado
    pause
    exit /b 1
)

echo.
echo ======================================================
echo   INSTALACAO CONCLUIDA!
echo.
echo   Extensao: OpenClaude v0.3.0
echo   Recurso: 4 Paineis + Mock Server
echo.
echo   Proximos passos:
echo   1. Reinicie VS Code
echo   2. Clique no icone OpenClaude (sidebar)
echo   3. Execute start-extension.bat para mock server
echo ======================================================
echo.

if exist "openclaude.vsix" (
    del "openclaude.vsix"
    echo Arquivo .vsix removido (ja instalado)
)

pause
