# Script para iniciar desenvolvimento com VS Code Extension

Write-Host "🚀 Iniciando JARVIS Worker + VS Code Extension..." -ForegroundColor Green
Write-Host ""

# 1. Iniciar servidor em nova janela
Write-Host "1️⃣ Iniciando servidor JARVIS Worker..." -ForegroundColor Cyan
Start-Process powershell -ArgumentList "-NoExit -Command `"cd 'D:\jarvis-claude\openclaude'; npm run dev`"" -WindowStyle Normal

# Aguardar servidor ficar pronto
Write-Host "⏳ Aguardando servidor inicializar (5 segundos)..." -ForegroundColor Yellow
Start-Sleep -Seconds 5

# 2. Verificar se servidor está rodando
Write-Host ""
Write-Host "2️⃣ Verificando conexão com servidor..." -ForegroundColor Cyan
try {
    $response = Invoke-WebRequest -Uri "http://localhost:3000/health" -ErrorAction Stop -TimeoutSec 2
    if ($response.StatusCode -eq 200) {
        Write-Host "✅ Servidor está rodando em http://localhost:3000" -ForegroundColor Green
    }
} catch {
    Write-Host "⚠️  Servidor pode não estar completamente pronto. Continuando..." -ForegroundColor Yellow
}

# 3. Abrir VS Code com extensão
Write-Host ""
Write-Host "3️⃣ Abrindo VS Code Extension..." -ForegroundColor Cyan
Start-Process code -ArgumentList "D:\jarvis-claude\openclaude\vscode-extension\openclaude-vscode"

Write-Host ""
Write-Host "✅ Desenvolvimento iniciado!" -ForegroundColor Green
Write-Host ""
Write-Host "📝 Próximos passos:" -ForegroundColor Yellow
Write-Host "1. Aguarde VS Code abrir (pode levar 10-15 segundos)"
Write-Host "2. Instale a extensão pressionando F5 (Run Extension)"
Write-Host "3. Abra a aba OpenClaude na sidebar esquerda"
Write-Host "4. Teste os 4 painéis: Quick Actions, Skills, Status, Chat"
Write-Host ""
Write-Host "📖 Consulte TEST_GUIDE.md para detalhes dos testes" -ForegroundColor Cyan
Write-Host ""
