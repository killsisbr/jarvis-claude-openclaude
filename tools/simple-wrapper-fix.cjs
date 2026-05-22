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

const scriptContent = `#!/bin/bash
export PATH="/root/.bun/bin:$PATH"
cd /home/ubuntu/openclaude
if [ -f .env ]; then
  set -a
  source .env
  set +a
fi
exec bun run worker`;

const scriptPath = '/home/ubuntu/start-jarvis-worker.sh';

// Build the command to write the script using base64 encoding (avoids shell special chars)
const encodedContent = Buffer.from(scriptContent).toString('base64');
const writeCmd = `echo ${encodedContent} | base64 -d > ${scriptPath} && chmod +x ${scriptPath}`;

console.log('[INIT] Deploying wrapper script\n');

const conn = new Client();

conn.on('ready', () => {
    console.log('[OK] SSH Connected\n');

    // Execute the write command
    conn.exec(writeCmd, (err, stream) => {
        if (err) {
            console.error('[ERROR]', err);
            conn.end();
            process.exit(1);
        }

        stream.on('close', (code) => {
            if (code !== 0) {
                console.error('[ERROR] Failed to write script');
                conn.end();
                process.exit(1);
            }

            console.log('[OK] Script written\n');

            // Verify content
            conn.exec(`cat ${scriptPath}`, (e2, s2) => {
                if (e2) throw e2;
                let output = '';
                s2.on('data', d => output += d.toString());
                s2.on('close', () => {
                    console.log('[SCRIPT CONTENT]');
                    console.log(output);
                    console.log('[OK] Verified\n');

                    // Restart PM2
                    console.log('[ACTION] Restarting PM2...\n');
                    conn.exec('pm2 restart jarvis-worker --force', (e3, s3) => {
                        if (e3) throw e3;
                        s3.on('data', d => process.stdout.write(d));
                        s3.on('close', () => {
                            // Wait and check logs
                            setTimeout(() => {
                                console.log('\n\n[ACTION] Checking logs...\n');
                                conn.exec('pm2 logs jarvis-worker --lines 40 --nostream 2>&1 | tail -60', (e4, s4) => {
                                    if (e4) throw e4;
                                    s4.on('data', d => process.stdout.write(d));
                                    s4.on('close', () => {
                                        console.log('\n[OK] Done');
                                        conn.end();
                                    });
                                });
                            }, 2000);
                        });
                    });
                });
            });
        });
    });
}).on('error', (err) => {
    console.error('[ERROR SSH]', err.message);
    process.exit(1);
}).connect(config);

setTimeout(() => {
    console.error('[TIMEOUT]');
    process.exit(1);
}, 60000);
