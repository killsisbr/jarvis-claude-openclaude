const { Client } = require('ssh2');

// Exato padrão do SAAS-WEB
const config = {
    host: '82.29.58.126',
    port: 22,
    username: 'root',
    password: 'Killsis19980910#'
};

console.log(`Testando SSH para ${config.host} como ${config.username}...\n`);

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ SUCESSO! Conectado via SSH.\n');

    // Teste simples: pm2 list
    conn.exec('pm2 list', (err, stream) => {
        if (err) {
            console.error('❌ Erro ao executar comando:', err.message);
            conn.end();
            process.exit(1);
        }

        console.log('📊 PM2 Processes:\n');
        stream.on('data', (data) => {
            process.stdout.write(data);
        }).on('close', () => {
            console.log('\n✅ Teste concluído com sucesso!');
            conn.end();
            process.exit(0);
        });

        stream.stderr.on('data', (data) => {
            process.stderr.write(data);
        });
    });
}).on('error', (err) => {
    console.error('❌ Erro de conexão SSH:', err.message);
    console.error('\nPossíveis causas:');
    console.error('  1. Credentials incorretos');
    console.error('  2. VPS offline ou não acessível');
    console.error('  3. SSH daemon não está rodando na porta 22');
    console.error('  4. Firewall bloqueando a conexão');
    process.exit(1);
}).connect(config);

// Timeout
setTimeout(() => {
    console.error('❌ Timeout: Não conectou em 10 segundos');
    process.exit(1);
}, 10000);
