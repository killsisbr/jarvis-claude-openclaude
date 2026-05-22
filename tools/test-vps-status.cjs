const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

// Carregar .env.vps
dotenv.config({ path: path.join(__dirname, '..', '.env.vps') });

const config = {
    host: process.env.VPS_HOST,
    port: parseInt(process.env.VPS_PORT || '22'),
    username: process.env.VPS_USER,
    password: process.env.VPS_PASSWORD,
    readyTimeout: 99999
};

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║         JARVIS Worker — VPS Status Check                   ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`🔌 Conectando a ${config.host}:${config.port} as ${config.username}...`);
console.log('');

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ Conectado com sucesso!');
    console.log('');

    // Array de comandos para executar
    const checks = [
        {
            name: '🔍 Verificação de Conectividade',
            cmd: 'echo "✓ SSH conectado" && date'
        },
        {
            name: '👤 Informações do Usuário',
            cmd: 'whoami && id && echo "Home: $HOME"'
        },
        {
            name: '💾 Espaço em Disco',
            cmd: 'df -h | grep -E "^/dev|^Filesystem|home|root"'
        },
        {
            name: '⚙️ Recursos Disponíveis (CPU/RAM)',
            cmd: 'echo "CPU Cores: $(nproc)" && echo "RAM Total:" && free -h | head -2'
        },
        {
            name: '🔄 PM2 Status (Todos os processos)',
            cmd: 'pm2 list 2>/dev/null || echo "❌ PM2 não instalado globalmente"'
        },
        {
            name: '🔄 PM2 Processos saas-web (DeliveryHub)',
            cmd: 'pm2 show saas-web 2>/dev/null || echo "❌ Processo saas-web não encontrado"'
        },
        {
            name: '📊 PM2 Monitoramento (últimas linhas)',
            cmd: 'pm2 logs saas-web --lines 5 2>/dev/null || echo "❌ Logs não disponíveis"'
        },
        {
            name: '📁 Diretórios de Deploy',
            cmd: 'echo "=== /root/killsis ===" && ls -la /root/killsis/ 2>/dev/null | head -10 && echo "" && echo "=== /home/ubuntu ===" && ls -la /home/ubuntu/ 2>/dev/null | head -10'
        },
        {
            name: '🛠️ Ferramentas Instaladas',
            cmd: 'echo "Node: $(node --version 2>/dev/null || echo "não instalado")" && echo "Npm: $(npm --version 2>/dev/null || echo "não instalado")" && echo "Bun: $(bun --version 2>/dev/null || echo "não instalado")" && echo "Git: $(git --version 2>/dev/null || echo "não instalado")"'
        },
        {
            name: '🔐 Permissões SSH (chave pública)',
            cmd: 'ls -la ~/.ssh/authorized_keys 2>/dev/null && echo "✓ SSH keys configuradas" || echo "⚠️ Sem SSH keys"'
        },
        {
            name: '📝 Sudoers (permissões elevadas)',
            cmd: 'sudo -l 2>/dev/null | grep -E "NOPASSWD|ALL" | head -3 || echo "⚠️ Sem permissão sudo ou requer senha"'
        },
        {
            name: '🌍 Portas Abertas (3000, 8080, 80, 443)',
            cmd: 'netstat -tuln 2>/dev/null | grep -E "3000|8080|80|443" || echo "✓ Nenhuma aplicação em portas padrão"'
        },
        {
            name: '📦 SAAS-WEB Info',
            cmd: 'ls -lah /root/killsis/SAAS-WEB/ 2>/dev/null | head -15 || echo "❌ Diretório não encontrado"'
        },
        {
            name: '💻 Uptime do Sistema',
            cmd: 'uptime'
        }
    ];

    let completed = 0;

    function executeNextCheck() {
        if (completed === checks.length) {
            console.log('');
            console.log('╔════════════════════════════════════════════════════════════╗');
            console.log('║         ✅ Análise Completa                                 ║');
            console.log('╚════════════════════════════════════════════════════════════╝');
            console.log('');
            console.log('📋 Próximos Passos:');
            console.log('   1. Verificar se bun está instalado (necessário para deploy)');
            console.log('   2. Confirmar espaço em disco em /home/ubuntu (5GB+)');
            console.log('   3. Se não existe /home/ubuntu/openclaude, será criado no deploy');
            console.log('   4. Rodar: npm run deploy-worker:staging');
            console.log('');
            conn.end();
            return;
        }

        const check = checks[completed];
        console.log(`${check.name}`);
        console.log('─'.repeat(60));

        conn.exec(check.cmd, (err, stream) => {
            if (err) {
                console.error(`❌ Erro: ${err.message}`);
                console.log('');
                completed++;
                executeNextCheck();
                return;
            }

            let output = '';
            stream.on('data', (data) => {
                output += data.toString();
            });

            stream.on('close', (code, signal) => {
                // Limpar output
                output = output.trim();
                if (output) {
                    console.log(output);
                } else {
                    console.log('(sem output)');
                }
                console.log('');
                completed++;
                executeNextCheck();
            });

            stream.stderr.on('data', (data) => {
                // Silenciar stderr de comando que podem falhar
            });
        });
    }

    executeNextCheck();
}).on('error', (err) => {
    console.error('');
    console.error('╔════════════════════════════════════════════════════════════╗');
    console.error('║         ❌ Erro de Conexão                                 ║');
    console.error('╚════════════════════════════════════════════════════════════╝');
    console.error('');
    console.error(`❌ ${err.message}`);
    console.error('');
    console.error('🔍 Troubleshooting:');
    console.error('   1. Verificar IP em .env.vps');
    console.error('   2. Verificar porta SSH (padrão: 22)');
    console.error('   3. Verificar user/password');
    console.error('   4. Testar manualmente:');
    console.error(`       ssh ${config.username}@${config.host}`);
    console.error('');
    process.exit(1);
}).connect(config);

// Timeout se não conectar
setTimeout(() => {
    console.error('');
    console.error('❌ Timeout: Não conseguiu conectar em 30 segundos');
    console.error('');
    process.exit(1);
}, 30000);
