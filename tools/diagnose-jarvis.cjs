const { Client } = require('ssh2');

const config = {
    host: '82.29.58.126',
    port: 22,
    username: 'root',
    password: 'Killsis19980910#'
};

const conn = new Client();

conn.on('ready', () => {
    console.log('Diagnosticando jarvis-worker...\n');

    const commands = [
        { name: 'PM2 Status', cmd: 'pm2 status | grep jarvis' },
        { name: 'PM2 Logs (últimas 30)', cmd: 'pm2 logs jarvis-worker --lines 30 --nostream 2>&1 | tail -30' },
        { name: 'Processo rodando?', cmd: 'ps aux | grep "start-jarvis" | grep -v grep' },
        { name: 'Wrapper script exists?', cmd: 'ls -la /home/ubuntu/start-jarvis-worker.sh && cat /home/ubuntu/start-jarvis-worker.sh' },
        { name: 'Bun works?', cmd: '/root/.bun/bin/bun --version' },
        { name: 'Localhost:3000?', cmd: 'curl -I http://localhost:3000/health 2>&1' }
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
