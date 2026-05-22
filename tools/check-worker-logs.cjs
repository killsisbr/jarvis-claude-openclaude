const { Client } = require('ssh2');
const path = require('path');
const dotenv = require('dotenv');

dotenv.config({ path: path.join(__dirname, '..', '.env.vps') });

const config = {
    host: process.env.VPS_HOST || '82.29.58.126',
    port: parseInt(process.env.VPS_PORT || '22'),
    username: process.env.VPS_USER || 'ubuntu',
    password: process.env.VPS_PASSWORD,
    readyTimeout: 99999
};

const conn = new Client();

conn.on('ready', () => {
    console.log('[INIT] Verificando PM2 logs...\n');

    const commands = [
        { name: 'PM2 logs (últimas 50 linhas)', cmd: 'pm2 logs jarvis-worker --lines 50 --nostream 2>&1' },
        { name: 'PS aux para verificar processo', cmd: 'ps aux | grep "jarvis-worker" | grep -v grep' },
        { name: 'Verificar porta 3000', cmd: 'netstat -tuln | grep 3000 || ss -tuln | grep 3000 || echo "Porta 3000 não escutando"' }
    ];

    let i = 0;

    function runNext() {
        if (i === commands.length) {
            conn.end();
            return;
        }

        const cmd = commands[i];
        console.log(`\n[${i+1}/${commands.length}] ${cmd.name}:`);
        console.log('─'.repeat(60));

        conn.exec(cmd.cmd, (err, stream) => {
            if (err) {
                console.error('Error:', err.message);
                i++;
                runNext();
                return;
            }

            let output = '';
            stream.on('data', (data) => {
                output += data.toString();
            });

            stream.on('close', () => {
                if (output.trim()) {
                    console.log(output.trim());
                } else {
                    console.log('(no output)');
                }
                i++;
                runNext();
            });
        });
    }

    runNext();
}).on('error', (err) => {
    console.error('SSH Error:', err.message);
    process.exit(1);
}).connect(config);

setTimeout(() => {
    console.error('Timeout');
    process.exit(1);
}, 60000);
