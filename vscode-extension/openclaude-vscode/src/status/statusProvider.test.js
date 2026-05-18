const test = require('node:test');
const assert = require('node:assert');
const { StatusMonitorProvider } = require('./statusProvider');

test('StatusMonitorProvider - fetch health', async () => {
  const provider = new StatusMonitorProvider();

  global.fetch = async (url) => {
    if (url === 'http://localhost:3000/health') {
      return {
        ok: true,
        json: async () => ({
          status: 'running',
          uptime: 3600000,
          sessions_active: 5,
          queries_total: 100,
        }),
      };
    }
    throw new Error('Unknown URL');
  };

  await provider.fetchHealth();
  assert.strictEqual(provider.healthData.status, 'running');
  assert.strictEqual(provider.healthData.sessions_active, 5);
});

test('StatusMonitorProvider - fetch cost', async () => {
  const provider = new StatusMonitorProvider();

  global.fetch = async (url) => {
    if (url === 'http://localhost:3000/api/cost') {
      return {
        ok: true,
        json: async () => ({
          cost_today: 25.5,
          queries_today: 100,
          sessions_active: 5,
          pools: [{ name: 'claude', active_keys: 3, cooldown_keys: 1, total_keys: 4 }],
        }),
      };
    }
    throw new Error('Unknown URL');
  };

  await provider.fetchCost();
  assert.strictEqual(provider.costData.cost_today, 25.5);
  assert.strictEqual(provider.costData.pools.length, 1);
});

test('StatusMonitorProvider - format uptime', () => {
  const provider = new StatusMonitorProvider();

  assert.strictEqual(provider.formatUptime(30000), '30s');
  assert.strictEqual(provider.formatUptime(600000), '10m');
  assert.strictEqual(provider.formatUptime(3600000), '1h');
  assert.strictEqual(provider.formatUptime(86400000), '1d');
  assert.strictEqual(provider.formatUptime(172800000), '2d');
});

test('StatusMonitorProvider - escape HTML', () => {
  const provider = new StatusMonitorProvider();

  const input = '<div>Test & "quote"</div>';
  const escaped = provider.escapeHtml(input);
  assert.strictEqual(escaped, '&lt;div&gt;Test &amp; &quot;quote&quot;&lt;/div&gt;');
});

test('StatusMonitorProvider - handle fetch errors', async () => {
  const provider = new StatusMonitorProvider();

  global.fetch = async () => {
    throw new Error('Network error');
  };

  await provider.fetchHealth();
  assert.strictEqual(provider.healthData, null);

  await provider.fetchCost();
  assert.strictEqual(provider.costData, null);
});

test('StatusMonitorProvider - polling lifecycle', () => {
  const provider = new StatusMonitorProvider();

  provider.startPolling();
  assert(provider.pollInterval !== null);

  provider.stopPolling();
  assert.strictEqual(provider.pollInterval, null);

  provider.dispose();
  assert.strictEqual(provider.pollInterval, null);
});
