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

const wrapperScript = `/home/ubuntu/start-jarvis-worker.sh`;
const newScript = `#!/bin/bash
export PATH="/root/.bun/bin:$PATH"
cd /home/ubuntu/openclaude
# Load .env file
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
exec bun run worker
`;

console.log('[INIT] Atualizando wrapper script para carregar .env\n');

const conn = new Client();

conn.on('ready', () => {
    console.log('[OK] SSH conectado\n');

    // Write new script
    const writeCmd = `cat > ${wrapperScript} << 'SCRIPTEOF'\n${newScript}SCRIPTEOF`;

    conn.exec(writeCmd, (err, stream) => {
        if (err) {
            console.error('[ERRO]', err);
            conn.end();
            process.exit(1);
        }

        stream.on('close', () => {
            console.log('[OK] Script atualizado\n');

            // Make executable
            conn.exec(`chmod +x ${wrapperScript}`, (e2, s2) => {
                if (e2) throw e2;
                s2.on('close', () => {
                    console.log('[OK] Permissões definidas\n');
                    
                    // Verify content
                    conn.exec(`cat ${wrapperScript}`, (e3, s3) => {
                        if (e3) throw e3;
                        let content = '';
                        s3.on('data', data => content += data.toString());
                        s3.on('close', () => {
                            console.log('[CONTENT]');
                            console.log(content);
                            console.log('\n[OK] Agora restarting PM2...');
                            
                            // Restart PM2
                            conn.exec('pm2 restart jarvis-worker --force', (e4, s4) => {
                                if (e4) throw e4;
                                s4.on('data', data => process.stdout.write(data));
                                s4.on('close', () => {
                                    console.log('\n[OK] PM2 restarted');
                                    console.log('\n[INFO] Aguardando 3s para worker iniciar...');
                                    setTimeout(() => {
                                        conn.exec('pm2 logs jarvis-worker --lines 20 --nostream', (e5, s5) => {
                                            if (e5) throw e5;
                                            s5.on('data', data => process.stdout.write(data));
                                            s5.on('close', () => {
                                                conn.end();
                                                process.exit(0);
                                            });
                                        });
                                    }, 3000);
                                });
                            });
                        });
                    });
                });
            });
        });
    });
}).on('error', (err) => {
    console.error('[ERRO SSH]', err.message);
    process.exit(1);
}).connect(config);

setTimeout(() => {
    console.error('[TIMEOUT]');
    process.exit(1);
}, 60000);
