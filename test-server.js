/**
 * Mock Server para testes da extensão VS Code
 * Implementa os endpoints necessários para testar os 4 features
 */

import http from 'http';

const PORT = 1000;

// Mock data
const mockSkills = [
  { name: 'example', description: 'A test skill', version: '1.0.0', commands: ['test'], enabled: true },
  { name: 'cost-monitor', description: 'Monitor skill costs', version: '1.0.0', commands: ['monitor', 'stats'], enabled: true },
  { name: 'auto-checkpoint', description: 'Create checkpoints automatically', version: '1.0.0', commands: ['checkpoint'], enabled: true },
];

const mockHealth = {
  status: 'running',
  uptime: 7200000, // 2 horas
  version: 'v5.0.0-worker',
  sessions_active: 5,
  cost_today: 25.5,
  queries_total: 142,
  queue_size: 0,
};

const mockCost = {
  cost_today: 25.5,
  queries_today: 142,
  sessions_active: 5,
  pools: [
    { name: 'Claude', active_keys: 3, cooldown_keys: 1, total_keys: 4 },
    { name: 'OpenAI', active_keys: 2, cooldown_keys: 0, total_keys: 3 },
  ],
};

const mockCron = {
  jobs: [
    { name: 'cost-check', interval: 60000, lastRun: new Date().toISOString(), nextRun: new Date(Date.now() + 60000).toISOString(), status: 'active', errorCount: 0 },
    { name: 'checkpoint', interval: 300000, lastRun: new Date().toISOString(), nextRun: new Date(Date.now() + 300000).toISOString(), status: 'active', errorCount: 0 },
    { name: 'sentinel-monitor', interval: 30000, lastRun: new Date().toISOString(), nextRun: new Date(Date.now() + 30000).toISOString(), status: 'active', errorCount: 0 },
  ],
  stats: {
    totalJobs: 3,
    activeJobs: 3,
    totalErrors: 0,
    uptime: 7200000,
    lastErrors: [],
  },
  timestamp: new Date().toISOString(),
};

const mockSentinels = {
  sentinels: [
    { name: 'CostSentinel', status: 'active', lastCheck: new Date().toISOString(), errorCount: 0 },
    { name: 'KeyPoolSentinel', status: 'active', lastCheck: new Date().toISOString(), errorCount: 0 },
    { name: 'SessionSentinel', status: 'active', lastCheck: new Date().toISOString(), errorCount: 0 },
    { name: 'DatabaseSentinel', status: 'active', lastCheck: new Date().toISOString(), errorCount: 0 },
    { name: 'ErrorSentinel', status: 'active', lastCheck: new Date().toISOString(), errorCount: 0 },
  ],
  timestamp: new Date().toISOString(),
};

const mockApprovals = {
  pending: [],
  stats: {
    total: 0,
    pending: 0,
    approved: 0,
    denied: 0,
  },
};

const mockMode = {
  current: 'operate',
  available: ['dev', 'audit', 'operate', 'execute'],
  permissions: {
    dev: { bash: true, file_edit: true, file_read: true },
    audit: { bash: false, file_edit: false, file_read: true },
    operate: { bash: true, file_edit: true, file_read: true },
    execute: { bash: false, file_edit: false, file_read: false },
  },
};

// Request handler
const requestHandler = (req, res) => {
  const { method, url } = req;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json');

  if (method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Routes
  if (url === '/health' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(mockHealth));
  } else if (url === '/api/skills' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify({
      skills: mockSkills,
      total: mockSkills.length,
      timestamp: new Date().toISOString(),
    }));
  } else if (url.match(/^\/api\/skills\/(.+)\/execute$/) && method === 'POST') {
    const skillName = url.match(/^\/api\/skills\/(.+)\/execute$/)[1];
    res.writeHead(200);
    res.end(JSON.stringify({
      success: true,
      skill: skillName,
      message: 'Skill execution triggered',
      timestamp: new Date().toISOString(),
    }));
  } else if (url === '/api/cost' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(mockCost));
  } else if (url === '/api/cron' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(mockCron));
  } else if (url === '/api/sentinels' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(mockSentinels));
  } else if (url === '/api/approvals/pending' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(mockApprovals));
  } else if (url === '/api/mode' && method === 'GET') {
    res.writeHead(200);
    res.end(JSON.stringify(mockMode));
  } else if (url === '/api/mode' && method === 'PUT') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        mockMode.current = data.mode || 'operate';
        res.writeHead(200);
        res.end(JSON.stringify({
          status: 'success',
          current: mockMode.current,
          message: `Mode changed to ${mockMode.current}`,
        }));
      } catch (e) {
        res.writeHead(400);
        res.end(JSON.stringify({ error: 'Invalid request' }));
      }
    });
  } else {
    res.writeHead(404);
    res.end(JSON.stringify({ error: 'Not found' }));
  }
};

// Create server
const server = http.createServer(requestHandler);

server.listen(PORT, () => {
  console.log('');
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║   🧪 MOCK SERVER - VS Code Extension Test     ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log(`║  Server running on http://localhost:${PORT}         ║`);
  console.log('║  Features:                                     ║');
  console.log('║  ✓ GET  /health                               ║');
  console.log('║  ✓ GET  /api/skills                            ║');
  console.log('║  ✓ POST /api/skills/:name/execute              ║');
  console.log('║  ✓ GET  /api/cost                              ║');
  console.log('║  ✓ GET  /api/cron                              ║');
  console.log('║  ✓ GET  /api/sentinels                         ║');
  console.log('║  ✓ GET  /api/approvals/pending                 ║');
  console.log('║  ✓ GET  /api/mode                              ║');
  console.log('║  ✓ PUT  /api/mode                              ║');
  console.log('╠════════════════════════════════════════════════╣');
  console.log('║  Ready for VS Code Extension testing!          ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log('');
});
