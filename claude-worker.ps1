#!/usr/bin/env pwsh
# Claude Code CLI → Worker Bridge (PowerShell)
# Uso: .\claude-worker.ps1 "sua mensagem aqui"

param(
    [Parameter(Position=0, ValueFromRemainingArguments=$true)]
    [string[]]$MessageArgs
)

$WORKER_URL = "http://localhost:3000"
$USER_ID = "cli-user"
$MESSAGE = $MessageArgs -join " "

if (-not $MESSAGE) {
    Write-Host "Uso: .\claude-worker.ps1 `"sua mensagem aqui`""
    exit 1
}

# Verificar se worker está rodando
try {
    $health = Invoke-RestMethod -Uri "$WORKER_URL/health" -Method Get -ErrorAction Stop
    Write-Host "[✓] Worker conectado" -ForegroundColor Green
} catch {
    Write-Host "[✗] Worker não está rodando em $WORKER_URL" -ForegroundColor Red
    Write-Host "   Inicie o worker: bun run src/worker/main.ts" -ForegroundColor Yellow
    exit 1
}

# Enviar mensagem
$body = @{
    user = $USER_ID
    message = $MESSAGE
    model = "llama-3.3-70b-versatile"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$WORKER_URL/api/chat" `
        -Method Post `
        -Headers @{"Content-Type" = "application/json"} `
        -Body $body `
        -ErrorAction Stop

    if ($response.status -eq "success") {
        Write-Host $response.message
        Write-Host "`n[📊] Latência: $($response.latency)ms | Custo: `$$($response.cost) | Tokens: $($response.usage.totalTokens)" -ForegroundColor Gray
    } else {
        Write-Host "[✗] Erro: $($response.error)" -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "[✗] Erro ao chamar worker: $_" -ForegroundColor Red
    exit 1
}
