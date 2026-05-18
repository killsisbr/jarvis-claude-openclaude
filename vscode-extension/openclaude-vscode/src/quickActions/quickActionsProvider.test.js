const test = require('node:test');
const assert = require('node:assert');
const { QuickActionsProvider } = require('./quickActionsProvider');

test('QuickActionsProvider - fetch approvals count', async () => {
  const provider = new QuickActionsProvider({}, {});

  global.fetch = async (url) => {
    if (url === 'http://localhost:3000/api/approvals/pending') {
      return {
        ok: true,
        json: async () => ({
          pending: [
            { id: '1', type: 'sandbox_exec', priority: 'critical' },
            { id: '2', type: 'budget_increase', priority: 'normal' },
          ],
        }),
      };
    }
    throw new Error('Unknown URL');
  };

  await provider.fetchApprovalsCount();
  assert.strictEqual(provider.approvalsCount, 2);
});

test('QuickActionsProvider - fetch plan mode', async () => {
  const provider = new QuickActionsProvider({}, {});

  global.fetch = async (url) => {
    if (url === 'http://localhost:3000/api/mode') {
      return {
        ok: true,
        json: async () => ({
          current: 'operate',
          available: ['dev', 'audit', 'operate', 'execute'],
        }),
      };
    }
    throw new Error('Unknown URL');
  };

  await provider.fetchPlanMode();
  assert.strictEqual(provider.currentMode, 'operate');
});

test('QuickActionsProvider - handle API errors gracefully', async () => {
  const provider = new QuickActionsProvider({}, {});

  global.fetch = async () => {
    throw new Error('Network error');
  };

  await provider.fetchApprovalsCount();
  assert.strictEqual(provider.approvalsCount, 0);

  await provider.fetchPlanMode();
  assert.strictEqual(provider.currentMode, 'operate');
});

test('QuickActionsProvider - polling lifecycle', () => {
  const provider = new QuickActionsProvider({}, {});

  provider.startPolling();
  assert(provider.pollInterval !== null);

  provider.stopPolling();
  assert.strictEqual(provider.pollInterval, null);

  provider.dispose();
  assert.strictEqual(provider.pollInterval, null);
});

test('QuickActionsProvider - escape HTML', () => {
  const provider = new QuickActionsProvider({}, {});

  const input = '<img src=x onerror="alert(1)">';
  const escaped = provider.escapeHtml(input);

  assert(!escaped.includes('<img'));
  assert(!escaped.includes('onerror'));
  assert(escaped.includes('&lt;img'));
});

test('QuickActionsProvider - generate unique nonce', () => {
  const provider = new QuickActionsProvider({}, {});

  const nonces = new Set();
  for (let i = 0; i < 10; i++) {
    const nonce = provider.getNonce();
    assert.strictEqual(nonce.length, 32);
    assert(!nonces.has(nonce), 'Nonce should be unique');
    nonces.add(nonce);
  }
});

test('QuickActionsProvider - HTML generation includes all buttons', () => {
  const provider = new QuickActionsProvider({}, {});
  provider.approvalsCount = 3;
  provider.currentMode = 'audit';

  const html = provider.getHtml();

  assert(html.includes('Novo Skill'));
  assert(html.includes('Ver Logs'));
  assert(html.includes('Approvals'));
  assert(html.includes('Mudar Modo'));
  assert(html.includes('audit'));
  assert(html.includes('3')); // approval badge count
});

test('QuickActionsProvider - handles zero approvals', () => {
  const provider = new QuickActionsProvider({}, {});
  provider.approvalsCount = 0;
  provider.currentMode = 'operate';

  const html = provider.getHtml();

  assert(html.includes('approval-badge'));
  // Should show 0 or dash, not error
});

test('QuickActionsProvider - all plan modes displayed', () => {
  const provider = new QuickActionsProvider({}, {});
  provider.currentMode = 'dev';

  const html = provider.getHtml();

  assert(html.includes('dev'));
  assert(html.includes('Desenvolvimento'));
});
