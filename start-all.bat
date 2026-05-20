@echo off
setlocal enabledelayedexpansion

echo.
echo ╔════════════════════════════════════════╗
echo ║   JARVIS Worker + OpenClaude CLI       ║
echo ║   Worker: http://localhost:3000        ║
echo ║   LLM: Claude (via /login)              ║
echo ╚════════════════════════════════════════╝
echo.

REM Verificar se Bun está instalado
bun --version >nul 2>&1
if errorlevel 1 (
    echo [-] Erro: Bun nao encontrado no PATH
    pause
    exit /b 1
)

echo [+] Bun detectado
echo.

REM Iniciar Worker em background
echo [+] Iniciando Worker em background...
start "JARVIS Worker" /min cmd /c "cd /d "%cd%" & bun run src/worker/main.ts"

REM Aguardar worker iniciar
echo [+] Aguardando Worker conectar...
timeout /t 6 /nobreak

REM Verificar se worker está respondendo
:CHECK_WORKER
curl -s http://localhost:3000/health >nul 2>&1
if errorlevel 1 (
    echo [!] Worker ainda nao respondeu, tentando novamente...
    timeout /t 2 /nobreak
    goto CHECK_WORKER
)

echo [+] Worker conectado em http://localhost:3000
echo.

REM Configurar variáveis de ambiente para OpenClaude usar o Worker
echo [+] Configurando provider para OpenClaude...

REM LIMPAR PROVIDERS CONFLITANTES
REM OpenAI/Groq/custom
set "OPENAI_BASE_URL="
set "OPENAI_API_KEY="
set "OPENAI_MODEL="

REM DESABILITAR NVIDIA NIM (estava conflitando - tinha HAS_NVIDIA=1)
set "HAS_NVIDIA="
set "NVIDIA_API_KEY="
set "NVIDIA_BASE_URL="
set "NVIDIA_FALLBACK_MODEL="

REM USAR TOKEN OAUTH SALVO (em ~/.claude/.credentials.json)
REM O OpenClaude CLI vai detectar e usar automaticamente
REM NAO definimos ANTHROPIC_API_KEY aqui - deixamos o CLI usar o token OAuth válido

set "WORKER_URL=http://localhost:3000"
set "WORKER_MODE=true"

echo [+] Provider desabilitado: NVIDIA NIM
echo [+] Provider configurado: Claude (OAuth via ~/.claude/.credentials.json)
echo.

REM Abrir OpenClaude CLI
echo [+] Abrindo OpenClaude CLI...
echo.
echo ════════════════════════════════════════════════════════════
echo OPENCLAUDE CLI + JARVIS WORKER
echo ════════════════════════════════════════════════════════════
echo.
echo Worker rodando em:  http://localhost:3000
echo LLM Provider:       Claude (Anthropic)
echo Autenticacao:       Token /login
echo WhatsApp:           Ativo
echo.
echo Use normalmente o OpenClaude CLI - vai usar o Worker
echo ════════════════════════════════════════════════════════════
echo.

REM Iniciar OpenClaude CLI com as variáveis de ambiente
cd /d "%cd%"
node dist/cli.mjs --bare

pause
