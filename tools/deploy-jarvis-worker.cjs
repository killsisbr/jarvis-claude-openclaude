const { Client } = require('ssh2');
const fs = require('fs');
const path = require('path');
const dotenv = require('dotenv');
const AdmZip = require('adm-zip');

// Carregar .env.vps para credenciais
dotenv.config({ path: path.join(__dirname, '..', '.env.vps') });

// Validar environment
const target = process.argv[2];
if (!target || (target !== 'staging' && target !== 'production')) {
    console.error('❌ Uso correto: node tools/deploy-jarvis-worker.cjs [staging|production]');
    console.error('');
    console.error('Exemplo:');
    console.error('  npm run deploy-worker staging');
    console.error('  npm run deploy-worker production');
    process.exit(1);
}

// Configuração SSH
const config = {
    host: process.env.VPS_HOST || '82.29.58.126',
    port: parseInt(process.env.VPS_PORT || '22'),
    username: process.env.VPS_USER || 'ubuntu',
    password: process.env.VPS_PASSWORD,
    readyTimeout: 99999
};

// Paths por environment
const paths = {
    staging: {
        dir: '/home/ubuntu/openclaude-staging',
        pm2: 'jarvis-worker-staging',
        url: 'https://worker-staging.seu-dominio.com'
    },
    production: {
        dir: '/home/ubuntu/openclaude',
        pm2: 'jarvis-worker',
        url: 'https://worker.seu-dominio.com'
    }
};

const env = paths[target];

// Validar credenciais
if (!config.password) {
    console.error('❌ Credenciais não configuradas!');
    console.error('');
    console.error('Crie .env.vps com:');
    console.error('  VPS_HOST=seu-vps-ip');
    console.error('  VPS_PORT=22');
    console.error('  VPS_USER=ubuntu');
    console.error('  VPS_PASSWORD=sua-senha');
    process.exit(1);
}

console.log('');
console.log('╔════════════════════════════════════════════════════════════╗');
console.log('║        JARVIS Worker Deploy Script                         ║');
console.log('╚════════════════════════════════════════════════════════════╝');
console.log('');
console.log(`📦 Target: [${target.toUpperCase()}]`);
console.log(`📍 Remote: ${env.dir}`);
console.log(`🔄 PM2: ${env.pm2}`);
console.log(`🌐 URL: ${env.url}`);
console.log('');

// Função recursiva para adicionar arquivos ao ZIP
function addFilesRecursive(localPath, zipPath = '') {
    const stats = fs.statSync(localPath);
    if (stats.isDirectory()) {
        const baseName = path.basename(localPath);
        // Pastas a ignorar completamente
        if ([
            'node_modules',
            '.git',
            '.jarvis',
            '.claude',
            'dist',
            'backups',
            'logs',
            'tmp',
            'coverage',
            '.next',
            'build'
        ].includes(baseName)) {
            return;
        }

        fs.readdirSync(localPath).forEach(file => {
            addFilesRecursive(path.join(localPath, file), path.join(zipPath, file));
        });
    } else {
        const baseName = path.basename(localPath);
        // Arquivos a ignorar
        if (
            baseName === '.env' ||
            baseName === '.env.vps' ||
            baseName === '.env.local' ||
            baseName.endsWith('.sqlite') ||
            baseName.endsWith('.sqlite-journal') ||
            baseName.endsWith('.zip') ||
            baseName.endsWith('.log') ||
            baseName === 'package-lock.json'
        ) {
            return;
        }

        zip.addLocalFile(localPath, path.dirname(zipPath) === '.' ? '' : path.dirname(zipPath));
    }
}

console.log('🔍 Escaneando arquivos locais...');

const zip = new AdmZip();
const localBase = path.join(__dirname, '..');
fs.readdirSync(localBase).forEach(file => {
    addFilesRecursive(path.join(localBase, file), file);
});

const zipBuffer = zip.toBuffer();
const tempZipName = `jarvis-worker-deploy-${target}-${Date.now()}.zip`;
fs.writeFileSync(tempZipName, zipBuffer);

console.log(`✅ ZIP criado com sucesso!`);
console.log(`   📊 Tamanho: ${(zipBuffer.length / 1024 / 1024).toFixed(2)} MB`);
console.log('');

console.log('🔌 Conectando via SSH à VPS...');

const conn = new Client();
conn.on('ready', () => {
    console.log('✅ Conectado à VPS!');
    console.log('');

    conn.sftp((err, sftp) => {
        if (err) {
            console.error('❌ Erro no SFTP:', err);
            fs.unlinkSync(tempZipName);
            conn.end();
            process.exit(1);
        }

        const remoteZipPath = `/tmp/${tempZipName}`;

        console.log('📤 Enviando ZIP via SFTP...');
        console.log(`   Origem: ${tempZipName}`);
        console.log(`   Destino: ${remoteZipPath}`);

        sftp.fastPut(tempZipName, remoteZipPath, (err) => {
            if (err) {
                console.error('❌ Erro no upload:', err);
                fs.unlinkSync(tempZipName);
                conn.end();
                process.exit(1);
            }

            console.log('✅ Upload concluído!');
            console.log('');
            console.log('🧹 Removendo arquivo local...');
            fs.unlinkSync(tempZipName);
            console.log('✅ Limpeza concluída!');
            console.log('');

            console.log('🔧 Executando deploy remoto...');
            console.log('   1. Criar backup da versão anterior');
            console.log('   2. Extrair ZIP');
            console.log('   3. Instalar dependências (bun install)');
            console.log('   4. Build (bun run build)');
            console.log('   5. Reiniciar PM2');
            console.log('');

            const commands = [
                // 1. Backup versão anterior
                `if [ -d "${env.dir}" ]; then cp -r "${env.dir}" "${env.dir}.backup.$(date +%s)"; fi`,

                // 2. Criar diretório se não existir
                `mkdir -p "${env.dir}"`,

                // 3. Extrair ZIP
                `unzip -q -o "${remoteZipPath}" -d "${env.dir}"`,

                // 4. Remover ZIP
                `rm -f "${remoteZipPath}"`,

                // 5. Instalar dependências
                `cd "${env.dir}" && bun install --production`,

                // 6. Build
                `cd "${env.dir}" && bun run build`,

                // 7. Restart PM2
                `pm2 restart "${env.pm2}" || pm2 start "bun run worker" --name "${env.pm2}" --cwd "${env.dir}"`,

                // 8. Show status
                `echo "" && echo "╔════════════════════════════════════════╗" && echo "║   ✅ Deploy Concluído com Sucesso!    ║" && echo "╚════════════════════════════════════════╝" && echo "" && pm2 list`,

                // 9. Show URL
                `echo "🌐 Acesse: ${env.url}" && echo "📊 Logs: pm2 logs ${env.pm2}"`
            ];

            conn.exec(commands.join(' && '), (err, stream) => {
                if (err) {
                    console.error('❌ Erro ao executar comandos remotos:', err);
                    conn.end();
                    process.exit(1);
                }

                stream.on('close', (code, signal) => {
                    console.log('');
                    console.log('✅ Processo concluído!');
                    conn.end();
                    process.exit(code === 0 ? 0 : 1);
                }).on('data', (d) => {
                    process.stdout.write(d);
                }).stderr.on('data', (d) => {
                    process.stderr.write(d);
                });
            });
        });
    });
}).on('error', (err) => {
    console.error('❌ Erro de conexão SSH:', err.message);
    if (fs.existsSync(tempZipName)) {
        fs.unlinkSync(tempZipName);
    }
    process.exit(1);
}).connect(config);

// Tratamento de erro se SSH não conectar
setTimeout(() => {
    console.error('❌ Timeout: Não conseguiu conectar à VPS');
    if (fs.existsSync(tempZipName)) {
        fs.unlinkSync(tempZipName);
    }
    process.exit(1);
}, 30000);
