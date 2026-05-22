const { Client } = require('ssh2');
const fs = require('fs');
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
    console.log('Diagnosticando SSL/Certbot...\n');

    const commands = [
        { name: 'Certificados instalados', cmd: 'ls -la /etc/letsencrypt/live/' },
        { name: 'Certificado killsis.com', cmd: 'ls -la /etc/letsencrypt/live/killsis.com/' },
        { name: 'Domínios no certificado', cmd: 'openssl x509 -in /etc/letsencrypt/live/killsis.com/fullchain.pem -text -noout | grep -A5 "Subject Alternative Name" || echo "DNS entries não encontradas"' },
        { name: 'Renovação automática status', cmd: 'systemctl status certbot.timer 2>&1 || echo "certbot.timer não configurado"' },
        { name: 'Nginx status', cmd: 'systemctl status nginx' },
        { name: 'Nginx test', cmd: 'nginx -t' },
        { name: 'SSL verification', cmd: 'echo | openssl s_client -connect localhost:443 -servername killsis.com 2>/dev/null | grep -A10 "subject=" || echo "Certificado não acessível localmente"' }
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
