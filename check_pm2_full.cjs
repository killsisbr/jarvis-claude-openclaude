const { Client } = require('ssh2');

const sshConfig = {
    host: '82.29.58.126',
    port: 22,
    username: 'root',
    password: 'Killsis19980910#'
};

const conn = new Client();
let output = '';

const commands = [
    { label: '1️⃣  PM2 STATUS', cmd: 'pm2 status 2>&1' },
    { label: '2️⃣  PM2 LIST (detalhado)', cmd: 'pm2 list 2>&1' },
    { label: '3️⃣  PM2 MONIT (snapshot)', cmd: 'pm2 monit --nostream --delete 2>&1 | head -50' },
    { label: '4️⃣  PM2 LOGS (últimas linhas)', cmd: 'pm2 logs --lines 5 --nostream 2>&1' },
    { label: '5️⃣  PM2 INFO (cada processo)', cmd: 'pm2 info all 2>&1 | head -100' },
    { label: '6️⃣  NODE VERSION', cmd: 'node --version && npm --version' },
    { label: '7️⃣  PM2 VERSION', cmd: 'pm2 --version' },
    { label: '8️⃣  PM2 CONFIG', cmd: 'pm2 config 2>&1' },
    { label: '9️⃣  PM2 SAVE STATUS', cmd: 'pm2 save 2>&1' },
    { label: '🔟  PROCESSOS DO SISTEMA', cmd: 'ps aux | grep -E "node|pm2|bun" | grep -v grep | head -20' },
    { label: '1️⃣1️⃣   PORTAS LISTENING', cmd: 'ss -tlnp | grep -E "3000|3001|5000|8000|8001" || netstat -tlnp | grep -E "3000|3001|5000|8000|8001"' },
    { label: '1️⃣2️⃣   LOGS PATH', cmd: 'ls -la ~/.pm2/logs/ 2>/dev/null | tail -20' },
];

let commandIndex = 0;

function runNextCommand() {
    if (commandIndex >= commands.length) {
        displayResults();
        conn.end();
        return;
    }

    const { label, cmd } = commands[commandIndex];
    output += `\n${label}\n`;
    output += `════════════════════════════════════════════════════════════\n`;

    conn.exec(cmd, (err, stream) => {
        if (err) {
            output += `❌ Erro: ${err.message}\n`;
            commandIndex++;
            runNextCommand();
            return;
        }

        let cmdOutput = '';
        stream.on('close', () => {
            output += cmdOutput + '\n';
            commandIndex++;
            runNextCommand();
        }).on('data', (data) => {
            cmdOutput += data.toString();
        }).stderr.on('data', (data) => {
            cmdOutput += `[ERR] ${data.toString()}`;
        });
    });
}

conn.on('ready', () => {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║      ANÁLISE PM2 - CONECTADO À VPS ✅                      ║');
    console.log('║            82.29.58.126 (Delivery System)                  ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log('Rodando 12 análises PM2...');
    console.log('');

    runNextCommand();
}).on('error', (err) => {
    console.error('');
    console.error('❌ ERRO DE CONEXÃO SSH');
    console.error('────────────────────────────────────────────────────────────');
    console.error(`Erro: ${err.message}`);
    console.error('');
    console.error('Possíveis causas:');
    console.error('  1. Credenciais incorretas (senha com # ou sem)');
    console.error('  2. VPS não acessível');
    console.error('  3. Firewall bloqueando SSH');
    console.error('');
    process.exit(1);
}).connect(sshConfig);

// Timeout após 60 segundos
setTimeout(() => {
    console.error('');
    console.error('❌ TIMEOUT - VPS não respondeu em 60 segundos');
    process.exit(1);
}, 60000);

function displayResults() {
    console.log('');
    console.log('╔════════════════════════════════════════════════════════════╗');
    console.log('║            ANÁLISE PM2 COMPLETA                           ║');
    console.log('╚════════════════════════════════════════════════════════════╝');
    console.log('');
    console.log(output);
    console.log('');
    console.log('════════════════════════════════════════════════════════════');
    console.log('✅ ANÁLISE PM2 CONCLUÍDA');
    console.log('════════════════════════════════════════════════════════════');
    console.log('');
    console.log('RESUMO EXECUTIVO:');
    console.log('');
    console.log('Use o output acima para:');
    console.log('  1. Verificar status de cada processo (online/stopped/errored)');
    console.log('  2. Ver memória usada por cada um');
    console.log('  3. Contar restarts (indicador de estabilidade)');
    console.log('  4. Verificar uptime de cada processo');
    console.log('  5. Identificar portas já em uso');
    console.log('');
    console.log('Para deploy JARVIS:');
    console.log('  - Escolha porta livre (3001 recomendado)');
    console.log('  - Ou use: pm2 start bun --name jarvis-worker -- src/worker/main.ts');
    console.log('');
}
