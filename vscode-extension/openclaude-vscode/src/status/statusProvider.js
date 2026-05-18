const vscode = require('vscode');

class StatusMonitorProvider {
  constructor() {
    this.webviewView = null;
    this.healthData = null;
    this.costData = null;
    this.cronData = null;
    this.sentinelData = null;
    this.pollInterval = null;
  }

  async resolveWebviewView(webviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.onDidDispose(() => {
      if (this.webviewView === webviewView) {
        this.webviewView = null;
      }
      this.stopPolling();
    });

    webviewView.webview.onDidReceiveMessage((message) => {
      switch (message?.type) {
        case 'refresh':
          this.refresh();
          break;
        case 'toggle_polling':
          message.enabled ? this.startPolling() : this.stopPolling();
          break;
        default:
          break;
      }
    });

    await this.refresh();
    this.startPolling();
  }

  startPolling() {
    if (this.pollInterval) return;
    this.pollInterval = setInterval(() => this.refresh(), 3000);
  }

  stopPolling() {
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  async refresh() {
    if (!this.webviewView) return;

    try {
      await Promise.all([
        this.fetchHealth(),
        this.fetchCost(),
        this.fetchCron(),
        this.fetchSentinels(),
      ]);

      this.webviewView.webview.html = this.getHtml();
    } catch (error) {
      console.error('[status] Error:', error);
    }
  }

  async fetchHealth() {
    try {
      const response = await fetch('http://localhost:3000/health');
      this.healthData = response.ok ? await response.json() : null;
    } catch (error) {
      this.healthData = null;
    }
  }

  async fetchCost() {
    try {
      const response = await fetch('http://localhost:3000/api/cost');
      this.costData = response.ok ? await response.json() : null;
    } catch (error) {
      this.costData = null;
    }
  }

  async fetchCron() {
    try {
      const response = await fetch('http://localhost:3000/api/cron');
      this.cronData = response.ok ? await response.json() : null;
    } catch (error) {
      this.cronData = null;
    }
  }

  async fetchSentinels() {
    try {
      const response = await fetch('http://localhost:3000/api/sentinels');
      this.sentinelData = response.ok ? await response.json() : null;
    } catch (error) {
      this.sentinelData = null;
    }
  }

  getHtml() {
    const nonce = this.getNonce();
    const health = this.healthData || {};
    const cost = this.costData || {};
    const cron = this.cronData || {};
    const sentinels = this.sentinelData || {};

    const healthStatus = health.status === 'running' ? '🟢' : '🔴';
    const uptime = this.formatUptime(health.uptime || 0);

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      --accent: #d77757;
      --positive: #e8b86b;
      --warning: #f3c969;
      --critical: #ff8a6c;
      --bg: #1d1512;
      --text: #f7efe5;
      --text-dim: #dcc3aa;
      --border: rgba(220, 195, 170, 0.14);
    }

    body {
      margin: 0;
      padding: 12px;
      background: var(--bg);
      color: var(--text);
      font-family: var(--vscode-font-family);
      font-size: 11px;
      line-height: 1.5;
    }

    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
    }

    .title {
      font-size: 13px;
      font-weight: 600;
    }

    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: 3px;
      background: rgba(232, 184, 107, 0.1);
      color: var(--positive);
    }

    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 12px;
    }

    .metric-card {
      border: 1px solid var(--border);
      border-radius: 6px;
      padding: 10px;
      background: rgba(255, 255, 255, 0.02);
    }

    .metric-label {
      font-size: 10px;
      color: var(--text-dim);
      text-transform: uppercase;
      margin-bottom: 4px;
    }

    .metric-value {
      font-size: 16px;
      font-weight: 700;
      color: var(--accent);
    }

    .metric-unit {
      font-size: 11px;
      color: var(--text-dim);
    }

    .section {
      margin-bottom: 12px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }

    .section-title {
      font-size: 11px;
      font-weight: 600;
      color: var(--text-dim);
      text-transform: uppercase;
      margin-bottom: 8px;
    }

    .item-list {
      display: grid;
      gap: 6px;
    }

    .item-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 6px;
      background: rgba(255, 255, 255, 0.01);
      border-radius: 4px;
      font-size: 10px;
    }

    .item-name {
      font-weight: 500;
    }

    .item-status {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 4px;
      border-radius: 3px;
    }

    .status-active {
      background: rgba(232, 184, 107, 0.1);
      color: var(--positive);
    }

    .status-error {
      background: rgba(255, 138, 108, 0.1);
      color: var(--critical);
    }

    .button-group {
      display: flex;
      gap: 6px;
      margin-top: 10px;
    }

    button {
      flex: 1;
      padding: 6px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: rgba(240, 148, 100, 0.1);
      color: var(--text);
      cursor: pointer;
      font-size: 10px;
      transition: all 140ms ease;
    }

    button:hover {
      background: rgba(240, 148, 100, 0.18);
      border-color: rgba(240, 148, 100, 0.28);
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <div class="title">📊 Status Monitor</div>
    </div>
    <div class="status-badge">${healthStatus} ${health.status || 'Desconectado'}</div>
  </div>

  <div class="metrics-grid">
    <div class="metric-card">
      <div class="metric-label">Uptime</div>
      <div class="metric-value">${uptime}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Sessions</div>
      <div class="metric-value">${health.sessions_active || 0}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Custo Hoje</div>
      <div class="metric-value">$${(cost.cost_today || 0).toFixed(2)}</div>
    </div>
    <div class="metric-card">
      <div class="metric-label">Queries</div>
      <div class="metric-value">${health.queries_total || 0}</div>
    </div>
  </div>

  <div class="section">
    <div class="section-title">🔗 Key Pools (${(cost.pools || []).length})</div>
    <div class="item-list">
      ${(cost.pools || []).map((p) => `
        <div class="item-row">
          <div class="item-name">${this.escapeHtml(p.name)}</div>
          <div class="item-status status-active">
            🔑 ${p.active_keys || 0} / ${p.total_keys || 0}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">⏱️ Cron Jobs (${(cron.jobs || []).length})</div>
    <div class="item-list">
      ${(cron.jobs || []).slice(0, 5).map((j) => `
        <div class="item-row">
          <div class="item-name">${this.escapeHtml(j.name)}</div>
          <div class="item-status ${j.status === 'active' ? 'status-active' : 'status-error'}">
            ${j.status === 'active' ? '✓' : '✗'} ${j.status}
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="section">
    <div class="section-title">🛡️ Sentinels (${(sentinels.sentinels || []).length})</div>
    <div class="item-list">
      ${(sentinels.sentinels || []).map((s) => `
        <div class="item-row">
          <div class="item-name">${this.escapeHtml(s.name)}</div>
          <div class="item-status ${s.status === 'active' ? 'status-active' : 'status-error'}">
            ${s.status === 'active' ? '✓' : '✗'} ${s.errorCount || 0} erros
          </div>
        </div>
      `).join('')}
    </div>
  </div>

  <div class="button-group">
    <button id="refresh">⟳ Atualizar</button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();
    document.getElementById('refresh')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });
  </script>
</body>
</html>`;
  }

  formatUptime(ms) {
    const seconds = Math.floor(ms / 1000);
    if (seconds < 60) return `${seconds}s`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h`;
    const days = Math.floor(hours / 24);
    return `${days}d`;
  }

  escapeHtml(text) {
    return String(text)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
      text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
  }

  dispose() {
    this.stopPolling();
  }
}

module.exports = { StatusMonitorProvider };
