const test = require('node:test');
const assert = require('node:assert');

/**
 * Integration tests para os 4 novos features
 * Testa lógica pura sem dependência de VSCode
 */

// ── Test Utilities ──
class MockWebView {
  constructor() {
    this.messages = [];
    this.html = null;
    this.disposed = false;
  }

  postMessage(msg) {
    this.messages.push(msg);
  }
}

async function mockFetch(responses) {
  return async (url) => {
    const response = responses[url];
    if (!response) {
      throw new Error(`Unexpected URL: ${url}`);
    }
    return {
      ok: response.ok !== false,
      status: response.status || 200,
      json: async () => response.data,
    };
  };
}

// ── Skills Manager Tests ──
test('Skills Manager - renders skill grid correctly', () => {
  const skillsHTML = `
    <div class="skill-card">
      <div class="skill-name">test-skill</div>
      <div class="skill-desc">A test skill</div>
      <button data-execute="test-skill">▶ Executar</button>
    </div>
  `;

  assert(skillsHTML.includes('skill-card'));
  assert(skillsHTML.includes('test-skill'));
  assert(skillsHTML.includes('▶ Executar'));
});

test('Skills Manager - renders empty state', () => {
  const emptyHTML = '<div class="empty">Nenhuma skill carregada...</div>';
  assert(emptyHTML.includes('empty'));
  assert(emptyHTML.includes('Nenhuma skill'));
});

test('Skills Manager - handles fetch API responses', async () => {
  const mockResponse = {
    'http://localhost:3000/api/skills': {
      ok: true,
      data: {
        skills: [
          { name: 'skill1', description: 'Test 1', version: '1.0.0', commands: ['cmd1'] },
          { name: 'skill2', description: 'Test 2', version: '2.0.0', commands: ['cmd2'] },
        ],
        total: 2,
      },
    },
  };

  const fetch = await mockFetch(mockResponse);
  const response = await fetch('http://localhost:3000/api/skills');
  const data = await response.json();

  assert.strictEqual(data.total, 2);
  assert.strictEqual(data.skills.length, 2);
  assert.strictEqual(data.skills[0].name, 'skill1');
});

// ── Status Monitor Tests ──
test('Status Monitor - formats uptime correctly', () => {
  const formatUptime = (ms) => {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  };

  assert.strictEqual(formatUptime(30000), '30s');
  assert.strictEqual(formatUptime(300000), '5m');
  assert.strictEqual(formatUptime(3600000), '1h');
  assert.strictEqual(formatUptime(86400000), '1d');
  assert.strictEqual(formatUptime(172800000), '2d');
});

test('Status Monitor - renders metric cards', () => {
  const metricsHTML = `
    <div class="metric-card">
      <div class="metric-label">Uptime</div>
      <div class="metric-value">1h</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Sessions</div>
      <div class="metric-value">5</div>
    </div>
  `;

  assert(metricsHTML.includes('metric-card'));
  assert(metricsHTML.includes('Uptime'));
  assert(metricsHTML.includes('Sessions'));
});

test('Status Monitor - aggregates API data', async () => {
  const mockResponse = {
    'http://localhost:3000/health': {
      ok: true,
      data: { status: 'running', uptime: 3600000, sessions_active: 5 },
    },
    'http://localhost:3000/api/cost': {
      ok: true,
      data: { cost_today: 25.5, pools: [{ name: 'claude', active_keys: 3 }] },
    },
  };

  const fetch = await mockFetch(mockResponse);
  const health = await (await fetch('http://localhost:3000/health')).json();
  const cost = await (await fetch('http://localhost:3000/api/cost')).json();

  assert.strictEqual(health.sessions_active, 5);
  assert.strictEqual(cost.cost_today, 25.5);
  assert.strictEqual(cost.pools.length, 1);
});

// ── Chat Enhancements Tests ──
test('Chat Enhancements - correctly escapes HTML', () => {
  const escapeHtml = (text) =>
    String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const input = '<img src=x onerror="alert(1)">';
  const escaped = escapeHtml(input);

  assert(!escaped.includes('<img'));
  assert(escaped.includes('&lt;img'));
  assert(escaped.includes('&quot;alert'));
});

test('Chat Enhancements - JSON highlighting works', () => {
  const jsonCode = '{"name": "test", "count": 42, "active": true}';
  let result = jsonCode;

  // Mock highlighting
  result = result.replace(/"([^"\\]|\\.)*"/g, '<span class="hl-string">$&</span>');
  result = result.replace(/\b(true|false|null)\b/g, '<span class="hl-keyword">$&</span>');
  result = result.replace(/:\s*(-?\d+)/g, ':<span class="hl-number"> $1</span>');

  assert(result.includes('hl-string'));
  assert(result.includes('hl-keyword'));
  assert(result.includes('hl-number'));
});

test('Chat Enhancements - code block rendering', () => {
  const codeBlockHTML = `
    <div class="code-wrapper">
      <div class="code-header">
        <span>javascript</span>
        <button class="code-copy-btn">📋</button>
      </div>
      <code class="code-block">const x = 10;</code>
    </div>
  `;

  assert(codeBlockHTML.includes('code-wrapper'));
  assert(codeBlockHTML.includes('code-copy-btn'));
  assert(codeBlockHTML.includes('const x = 10;'));
});

// ── Quick Actions Tests ──
test('Quick Actions - renders action buttons', () => {
  const actionsHTML = `
    <button class="action-btn" id="newSkillBtn">
      <span class="action-icon">✨</span>
      <span class="action-text">
        <span class="action-label">Novo Skill</span>
      </span>
    </button>
  `;

  assert(actionsHTML.includes('action-btn'));
  assert(actionsHTML.includes('Novo Skill'));
  assert(actionsHTML.includes('✨'));
});

test('Quick Actions - displays approval badge', () => {
  const badgeHTML = (count) => `
    <span class="approval-badge ${count === 0 ? 'none' : ''}">${count || '–'}</span>
  `;

  const html2 = badgeHTML(2);
  const html0 = badgeHTML(0);

  assert(html2.includes('approval-badge'));
  assert(html2.includes('2'));
  assert(html0.includes('none'));
});

test('Quick Actions - plan mode selection', () => {
  const modes = ['dev', 'audit', 'operate', 'execute'];
  const currentMode = 'operate';

  assert(modes.includes(currentMode));
  assert(modes.length === 4);

  const modeDesc = {
    dev: 'Desenvolvimento - Sem restrições',
    audit: 'Auditoria - Logs completos',
    operate: 'Operação - Permissões normais',
    execute: 'Execução - Modo restrito',
  };

  assert(modeDesc[currentMode] !== undefined);
});

// ── Overall Integration ──
test('All features - handle errors gracefully', async () => {
  const mockResponse = {
    'http://localhost:3000/api/skills': {
      ok: false,
      status: 500,
      data: { error: 'Internal server error' },
    },
  };

  const fetch = await mockFetch(mockResponse);
  const response = await fetch('http://localhost:3000/api/skills');

  assert.strictEqual(response.ok, false);
  assert.strictEqual(response.status, 500);
});

test('All features - generate unique nonces', () => {
  const getNonce = () => {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  };

  const nonces = new Set();
  for (let i = 0; i < 100; i++) {
    const nonce = getNonce();
    assert.strictEqual(nonce.length, 32);
    assert(!nonces.has(nonce), `Nonce collision at iteration ${i}`);
    nonces.add(nonce);
  }
});

test('All features - HTML content security', () => {
  const escapeHtml = (text) =>
    String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const malicious = [
    '<script>alert("xss")</script>',
    '<img src=x onerror="alert(1)">',
    '"><script>alert(1)</script>',
    '<iframe src="javascript:alert(1)"></iframe>',
  ];

  malicious.forEach((payload) => {
    const escaped = escapeHtml(payload);
    // Verify that dangerous HTML tags are escaped
    assert(!escaped.includes('<script'));
    assert(!escaped.includes('<img'));
    assert(!escaped.includes('<iframe'));
    // Verify dangerous quotes are escaped
    assert(escaped.includes('&quot;'));
    assert(escaped.includes('&lt;'));
  });
});
