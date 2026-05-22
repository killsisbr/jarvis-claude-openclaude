const { Client } = require('ssh2');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env.vps') });

const config = {
    host: process.env.VPS_HOST || '82.29.58.126',
    port: parseInt(process.env.VPS_PORT || '22'),
    username: process.env.VPS_USER || 'ubuntu',
    password: process.env.VPS_PASSWORD,
};

const apiKey = process.argv[2];
if (!apiKey) {
    console.error('Uso: node tools/deploy-api-key.cjs <API_KEY>');
    process.exit(1);
}

const envPath = '/home/ubuntu/openclaude/.env';
const commands = [
    `echo 'ANTHROPIC_API_KEY=${apiKey}' > ${envPath}`,
    `echo 'ANTHROPIC_BASE_URL=https://api.anthropic.com' >> ${envPath}`,
    `echo 'ANTHROPIC_MODEL=claude-3-5-haiku-20241022' >> ${envPath}`,
    `echo 'WORKER_PORT=3000' >> ${envPath}`,
    `echo 'WORKER_MODE=true' >> ${envPath}`,
    `cat ${envPath}`,
    `pm2 restart jarvis-worker`,
    `pm2 status | grep jarvis`,
];

let completed = 0;
const conn = new Client();

conn.on('ready', () => {
    console.log('[INIT] Conectado à VPS\n');
    
    commands.forEach((cmd, idx) => {
        conn.exec(cmd, (err, stream) => {
            if (err) {
                console.error(`[ERRO] Comando ${idx + 1}: ${err.message}`);
                return;
            }
            
            let output = '';
            stream.on('data', data => output += data.toString());
            stream.on('close', code => {
                completed++;
                console.log(`[${idx + 1}/${commands.length}] ${cmd.substring(0, 60)}...`);
                if (output.trim()) console.log(output.trim());
                if (output.includes('error')) console.error('[WARN] Possível erro na saída');
                
                if (completed === commands.length) {
                    console.log('\n[OK] Setup completo!');
                    conn.end();
                }
            });
        });
    });
}).on('error', (err) => {
    console.error('[ERRO SSH]', err.message);
    process.exit(1);
}).connect(config);

setTimeout(() => {
    console.error('[TIMEOUT] SSH não respondeu');
    conn.end();
    process.exit(1);
}, 30000);
