const https = require('https');
const fs = require('fs');
const path = require('path');

const ITER = parseInt(process.argv[2]) || 3;
const PROMPT = process.argv[3] || 'Explain what a GPU is in 2 sentences.';

const MODELS = [
  { id: 'qwen/qwen3-coder-480b-a35b-instruct', name: 'Qwen Coder 480B' },
  { id: 'qwen/qwen3.5-397b-a17b', name: 'Qwen 3.5 397B' },
  { id: 'qwen/qwen3-next-80b-a3b-instruct', name: 'Qwen Next 80B' },
  { id: 'deepseek-ai/deepseek-v4-flash', name: 'DeepSeek V4 Flash' },
  { id: 'deepseek-ai/deepseek-v4-pro', name: 'DeepSeek V4 Pro' },
  { id: 'minimaxai/minimax-m2.7', name: 'MiniMax M2.7' },
];

const envRaw = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
const match = envRaw.match(/NVIDIA_API_KEY=(\S+)/);
const API_KEY = match[1].trim();

function test(modelId) {
  return new Promise(resolve => {
    const body = JSON.stringify({
      model: modelId,
      messages: [{ role: 'user', content: PROMPT }],
      max_tokens: 50,
      stream: true,
    });
    const t0 = Date.now();
    let ttfb = null, buf = '', timedOut = false;
    const req = https.request({
      hostname: 'integrate.api.nvidia.com',
      path: '/v1/chat/completions',
      method: 'POST',
      headers: { Authorization: 'Bearer ' + API_KEY, 'Content-Type': 'application/json' },
      timeout: 120000,
    }, res => {
      res.on('data', chunk => {
        if (ttfb === null) ttfb = Date.now() - t0;
        buf += chunk.toString();
      });
      res.on('end', () => {
        if (timedOut) return;
        resolve({ ttfb, total: Date.now() - t0, error: null });
      });
      res.on('error', e => resolve({ ttfb, total: Date.now() - t0, error: e.message }));
    });
    req.on('timeout', () => { timedOut = true; req.destroy(); resolve({ ttfb, total: Date.now() - t0, error: 'Timeout' }); });
    req.on('error', e => { if (!timedOut) resolve({ ttfb, total: Date.now() - t0, error: e.message }); });
    req.write(body);
    req.end();
  });
}

(async () => {
  console.log('\n═══ LLM BENCHMARK - NVIDIA NIM ═══\n');
  const all = [];
  for (const m of MODELS) {
    process.stdout.write(`  ${m.name} `.padEnd(30));
    const samples = [];
    for (let i = 0; i < ITER; i++) {
      const r = await test(m.id);
      samples.push(r);
    }
    const ok = samples.filter(s => !s.error);
    const avgTtfb = ok.length ? Math.round(ok.reduce((a, s) => a + s.ttfb, 0) / ok.length) : '-';
    const avgTotal = ok.length ? Math.round(ok.reduce((a, s) => a + s.total, 0) / ok.length) : '-';
    const errCount = samples.filter(s => s.error).length;
    const status = errCount ? `⚠ ${errCount}/${ITER} err` : '✓';
    const bar = avgTotal !== '-' ? '█'.repeat(Math.max(1, Math.min(50, Math.round(avgTotal / 100)))) : '—';
    console.log(`${bar} ${avgTotal}ms | TTFB ${avgTtfb}ms ${status}`);
    all.push({ ...m, avgTotal: avgTotal === '-' ? Infinity : avgTotal, avgTtfb: avgTtfb === '-' ? Infinity : avgTtfb, errCount });
  }
  all.sort((a, b) => a.avgTotal - b.avgTotal);
  console.log('\n═══ RANKING ═══\n');
  all.forEach((m, i) => {
    const s = m.errCount ? '⚠' : '✓';
    const t = m.avgTotal === Infinity ? 'FAIL' : m.avgTotal + 'ms';
    console.log(`  ${i + 1}. ${m.name.padEnd(25)} ${s} ${t}`);
  });
  // Salva
  const lines = all.map((m,i) => `${i+1}. ${m.name} | avg: ${m.avgTotal === Infinity ? 'FAIL' : m.avgTotal+'ms'} | ttfb: ${m.avgTtfb === Infinity ? '-' : m.avgTtfb+'ms'} | errs: ${m.errCount}/${ITER}`);
  fs.writeFileSync(path.join(__dirname, 'bench-results.txt'), lines.join('\n') + '\n');
  console.log('\nSalvo em bench-results.txt');
})();
