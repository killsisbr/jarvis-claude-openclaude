const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env.vps') });

const config = {
    host: process.env.VPS_HOST || '82.29.58.126',
    port: parseInt(process.env.VPS_PORT || '22'),
    username: process.env.VPS_USER || 'root',
    password: process.env.VPS_PASSWORD,
    readyTimeout: 99999
};

const apiKey = process.argv[2];
const baseUrl = process.argv[3] || 'https://api.anthropic.com';

if (!apiKey) {
    console.error('❌ Uso: node tools/setup-worker-env.cjs <ANTHROPIC_API_KEY> [base_url]');
    process.exit(1);
}

if (!apiKey.startsWith('sk-ant-')) {
    console.error('❌ API key inválida. Deve começar com sk-ant-');
    process.exit(1);
}

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        JARVIS Worker — Setup Environment Variables         ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`📝 Provider: Anthropic`);
console.log(`🔑 API Key: ${apiKey.substring(0, 20)}...${apiKey.substring(apiKey.length - 5)}`);
console.log(`🌐 Base URL: ${baseUrl}`);
console.log('');
console.log('🔌 Conectando à VPS...');

const conn = new Client();

conn.on('ready', () => {
    console.log('✅ Conectado!\n');

    conn.exec('whoami', (err, stream) => {
        if (err) throw err;

        let whoami = '';
        stream.on('data', (data) => {
            whoami += data.toString();
        });

        stream.on('close', () => {
            const user = whoami.trim();
            const envFile = `/home/ubuntu/openclaude/.env`;

            console.log(`👤 Usuario: ${user}`);
            console.log(`📄 Target: ${envFile}\n`);

            // Criar conteúdo do .env
            const envContent = `# JARVIS Worker Configuration
WORKER_PORT=3000
WORKER_MODE=true

# Anthropic API Configuration
ANTHROPIC_API_KEY=${apiKey}
ANTHROPIC_BASE_URL=${baseUrl}
ANTHROPIC_MODEL=claude-3-5-haiku-20241022
`;

            // Escrever arquivo via echo
            const cmd = `cat > ${envFile} << 'ENVEOF'\n${envContent}ENVEOF`;

            console.log('📝 Criando arquivo .env...');

            conn.exec(cmd, (err, stream) => {
                if (err) {
                    console.error('❌ Erro ao criar .env:', err);
                    conn.end();
                    process.exit(1);
                }

                stream.on('close', (code) => {
                    if (code !== 0) {
                        console.error(`❌ Erro ao escrever .env (code ${code})`);
                        conn.end();
                        process.exit(1);
                    }

                    console.log('✅ Arquivo .env criado!\n');

                    // Verificar
                    console.log('🔍 Verificando conteúdo...');
                    conn.exec(`cat ${envFile}`, (err, stream) => {
                        if (err) throw err;

                        let content = '';
                        stream.on('data', (data) => {
                            content += data.toString();
                        });

                        stream.on('close', () => {
                            console.log(content);
                            console.log('✅ Verificado!\n');

                            // Restart PM2
                            console.log('🔄 Restartando PM2 jarvis-worker...');
                            conn.exec('pm2 restart jarvis-worker --wait-ready', (err, stream) => {
                                if (err) {
                                    console.error('⚠️  PM2 restart erro (pode estar desligado):', err.message);
                                    conn.end();
                                    process.exit(0);
                                }

                                let output = '';
                                stream.on('data', (data) => {
                                    output += data.toString();
                                    process.stdout.write(data);
                                });

                                stream.stderr.on('data', (data) => {
                                    process.stderr.write(data);
                                });

                                stream.on('close', (code) => {
                                    console.log('');
                                    if (code === 0) {
                                        console.log('✅ PM2 restarted!\n');

                                        // Esperar processo subir
                                        setTimeout(() => {
                                            console.log('⏳ Aguardando processo subir (3s)...');
                                            setTimeout(() => {
                                                console.log('');
                                                console.log('📊 Status final:');
                                                conn.exec('pm2 status | grep jarvis', (err, stream) => {
                                                    if (err) throw err;
                                                    stream.on('data', (data) => {
                                                        process.stdout.write(data);
                                                    });
                                                    stream.on('close', () => {
                                                        console.log('');
                                                        console.log('✅ Setup Completo!');
                                                        console.log('🌐 Teste: curl -I https://jarvis.killsis.com/health');
                                                        conn.end();
                                                    });
                                                });
                                            }, 3000);
                                        }, 500);
                                    } else {
                                        console.log('⚠️  PM2 restart retornou code ' + code);
                                        conn.end();
                                        process.exit(0);
                                    }
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}).on('error', (err) => {
    console.error('❌ SSH Error:', err.message);
    process.exit(1);
}).connect(config);

setTimeout(() => {
    console.error('❌ Timeout de conexão SSH');
    process.exit(1);
}, 30000);
