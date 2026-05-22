const dotenv = require('dotenv');
const path = require('path');

// Carregar .env.vps
const result = dotenv.config({ path: path.join(__dirname, '..', '.env.vps') });

console.log('Carregado do .env.vps:');
console.log('  VPS_HOST:', JSON.stringify(process.env.VPS_HOST));
console.log('  VPS_PORT:', JSON.stringify(process.env.VPS_PORT));
console.log('  VPS_USER:', JSON.stringify(process.env.VPS_USER));
console.log('  VPS_PASSWORD:', JSON.stringify(process.env.VPS_PASSWORD));
console.log('  VPS_REMOTE_DIR:', JSON.stringify(process.env.VPS_REMOTE_DIR));

console.log('\nComparando com hardcoded:');
console.log('  Host: 82.29.58.126');
console.log('  Port: 22');
console.log('  User: root');
console.log('  Pass: Killsis19980910#');

if (process.env.VPS_PASSWORD === 'Killsis19980910#') {
    console.log('\n✅ Password OK');
} else {
    console.log('\n❌ Password MISMATCH');
    console.log('Expected:', JSON.stringify('Killsis19980910#'));
    console.log('Got:     ', JSON.stringify(process.env.VPS_PASSWORD));
    console.log('Bytes expected:', Buffer.from('Killsis19980910#').toString('hex'));
    console.log('Bytes got:     ', Buffer.from(process.env.VPS_PASSWORD || '').toString('hex'));
}
