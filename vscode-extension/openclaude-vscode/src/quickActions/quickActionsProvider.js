const vscode = require('vscode');

class QuickActionsProvider {
  constructor(sessionManager, statusMonitor) {
    this.sessionManager = sessionManager;
    this.statusMonitor = statusMonitor;
    this.webviewView = null;
    this.approvalsCount = 0;
    this.currentMode = 'operate';
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

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message?.type) {
        case 'create_skill':
          await this.createSkill();
          break;
        case 'view_logs':
          await this.viewLogs();
          break;
        case 'toggle_plan_mode':
          await this.togglePlanMode(message.mode);
          break;
        case 'view_approvals':
          await this.viewApprovals();
          break;
        case 'refresh':
          await this.refresh();
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
    this.pollInterval = setInterval(() => this.refresh(), 5000);
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
        this.fetchApprovalsCount(),
        this.fetchPlanMode(),
      ]);

      this.webviewView.webview.html = this.getHtml();
    } catch (error) {
      console.error('[quickActions] Error:', error);
    }
  }

  async fetchApprovalsCount() {
    try {
      const response = await fetch('http://localhost:3000/api/approvals/pending');
      if (response.ok) {
        const data = await response.json();
        this.approvalsCount = data.pending?.length || 0;
      }
    } catch (error) {
      this.approvalsCount = 0;
    }
  }

  async fetchPlanMode() {
    try {
      const response = await fetch('http://localhost:3000/api/mode');
      if (response.ok) {
        const data = await response.json();
        this.currentMode = data.current || 'operate';
      }
    } catch (error) {
      this.currentMode = 'operate';
    }
  }

  async createSkill() {
    const name = await vscode.window.showInputBox({
      prompt: 'Nome da nova skill',
      placeHolder: 'minha-skill',
      validateInput: (v) => (!v ? 'Nome obrigatório' : null),
    });

    if (!name) return;

    try {
      const terminal = vscode.window.createTerminal('OpenClaude Skill');
      terminal.show();
      terminal.sendText(`jarvis skill create ${name}`, true);
      await vscode.window.showInformationMessage(`Criando skill: ${name}...`);
    } catch (error) {
      await vscode.window.showErrorMessage(`Erro: ${error.message}`);
    }
  }

  async viewLogs() {
    try {
      await vscode.commands.executeCommand('workbench.action.togglePanel');
      await vscode.window.showInformationMessage('Panel de Output aberto');
    } catch (error) {
      await vscode.window.showErrorMessage(`Erro: ${error.message}`);
    }
  }

  async togglePlanMode(mode) {
    const modes = ['dev', 'audit', 'operate', 'execute'];

    const selected = await vscode.window.showQuickPick(modes, {
      placeHolder: `Modo atual: ${this.currentMode}`,
      title: 'Selecione o modo de operação',
    });

    if (!selected) return;

    try {
      const response = await fetch('http://localhost:3000/api/mode', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: selected }),
      });

      if (response.ok) {
        this.currentMode = selected;
        await this.refresh();
        await vscode.window.showInformationMessage(`✅ Modo alterado para: ${selected}`);
      } else {
        throw new Error('Falha ao alterar modo');
      }
    } catch (error) {
      await vscode.window.showErrorMessage(`Erro: ${error.message}`);
    }
  }

  async viewApprovals() {
    try {
      const response = await fetch('http://localhost:3000/api/approvals/pending');
      if (!response.ok) throw new Error('Falha ao buscar approvals');

      const data = await response.json();
      const pending = data.pending || [];

      if (pending.length === 0) {
        await vscode.window.showInformationMessage('Nenhuma aprovação pendente');
        return;
      }

      const items = pending.map((req) => ({
        label: `${req.type || 'unknown'} - ${req.description || ''}`,
        description: req.priority || 'normal',
        id: req.id,
      }));

      const selected = await vscode.window.showQuickPick(items, {
        placeHolder: `${pending.length} solicitações pendentes`,
        title: 'Approvals Pendentes',
      });

      if (selected) {
        const action = await vscode.window.showQuickPick(['✓ Aprovar', '✗ Rejeitar'], {
          placeHolder: `${selected.label}`,
        });

        if (action === '✓ Aprovar') {
          const approveResponse = await fetch(`http://localhost:3000/api/approve/${selected.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ approver: 'vscode' }),
          });

          if (approveResponse.ok) {
            await vscode.window.showInformationMessage('✅ Aprovado!');
          }
        } else if (action === '✗ Rejeitar') {
          const denyResponse = await fetch(`http://localhost:3000/api/deny/${selected.id}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'Rejected via VS Code' }),
          });

          if (denyResponse.ok) {
            await vscode.window.showInformationMessage('❌ Rejeitado!');
          }
        }

        await this.refresh();
      }
    } catch (error) {
      await vscode.window.showErrorMessage(`Erro: ${error.message}`);
    }
  }

  getHtml() {
    const nonce = this.getNonce();
    const modes = ['dev', 'audit', 'operate', 'execute'];
    const modeDescriptions = {
      dev: 'Desenvolvimento - Sem restrições',
      audit: 'Auditoria - Logs completos',
      operate: 'Operação - Permissões normais',
      execute: 'Execução - Modo restrito',
    };

    return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; script-src 'nonce-${nonce}';" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <style>
    :root {
      --accent: #d77757;
      --accent-bright: #f09464;
      --positive: #e8b86b;
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
      font-size: 12px;
      line-height: 1.5;
    }

    .header {
      font-size: 13px;
      font-weight: 600;
      margin-bottom: 12px;
      padding-bottom: 8px;
      border-bottom: 1px solid var(--border);
      color: var(--accent-bright);
    }

    .actions-grid {
      display: grid;
      gap: 8px;
      margin-bottom: 12px;
    }

    .action-btn {
      padding: 10px 12px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: rgba(240, 148, 100, 0.08);
      color: var(--text);
      cursor: pointer;
      font-size: 12px;
      font-weight: 500;
      transition: all 140ms ease;
      text-align: left;
      display: flex;
      align-items: center;
      gap: 8px;
    }

    .action-btn:hover {
      background: rgba(240, 148, 100, 0.16);
      border-color: rgba(240, 148, 100, 0.28);
      transform: translateY(-1px);
    }

    .action-icon {
      font-size: 16px;
      flex-shrink: 0;
    }

    .action-text {
      flex: 1;
    }

    .action-label {
      display: block;
      font-weight: 600;
      color: var(--text);
    }

    .action-desc {
      display: block;
      font-size: 11px;
      color: var(--text-dim);
      margin-top: 2px;
    }

    .mode-section {
      margin-bottom: 12px;
      padding: 10px;
      border: 1px solid var(--border);
      border-radius: 6px;
      background: rgba(255, 255, 255, 0.02);
    }

    .mode-title {
      font-size: 10px;
      font-weight: 600;
      text-transform: uppercase;
      color: var(--text-dim);
      margin-bottom: 8px;
    }

    .mode-current {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 6px 8px;
      background: rgba(232, 184, 107, 0.1);
      border-radius: 4px;
      margin-bottom: 8px;
    }

    .mode-badge {
      padding: 2px 6px;
      border-radius: 3px;
      background: rgba(240, 148, 100, 0.2);
      color: var(--accent);
      font-size: 11px;
      font-weight: 600;
    }

    .approval-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 20px;
      height: 20px;
      padding: 0 6px;
      border-radius: 10px;
      background: var(--critical);
      color: white;
      font-size: 10px;
      font-weight: 700;
      margin-left: auto;
    }

    .approval-badge.none {
      background: transparent;
      color: var(--text-dim);
    }
  </style>
</head>
<body>
  <div class="header">⚡ Quick Actions</div>

  <div class="actions-grid">
    <button class="action-btn" id="newSkillBtn">
      <span class="action-icon">✨</span>
      <span class="action-text">
        <span class="action-label">Novo Skill</span>
        <span class="action-desc">Criar nova skill interativa</span>
      </span>
    </button>

    <button class="action-btn" id="viewLogsBtn">
      <span class="action-icon">📋</span>
      <span class="action-text">
        <span class="action-label">Ver Logs</span>
        <span class="action-desc">Abrir output panel</span>
      </span>
    </button>

    <button class="action-btn" id="approvalsBtn">
      <span class="action-icon">✓</span>
      <span class="action-text">
        <span class="action-label">Approvals</span>
        <span class="action-desc">Gerenciar solicitações</span>
      </span>
      <span class="approval-badge ${this.approvalsCount === 0 ? 'none' : ''}">${this.approvalsCount || '–'}</span>
    </button>
  </div>

  <div class="mode-section">
    <div class="mode-title">Plan Mode</div>
    <div class="mode-current">
      <span>Modo atual:</span>
      <span class="mode-badge">${this.currentMode.toUpperCase()}</span>
    </div>
    <button class="action-btn" id="toggleModeBtn" style="width: 100%; margin-top: 8px;">
      <span class="action-icon">🎯</span>
      <span class="action-text">
        <span class="action-label">Mudar Modo</span>
        <span class="action-desc">${modeDescriptions[this.currentMode] || 'Selecione um modo'}</span>
      </span>
    </button>
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('newSkillBtn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'create_skill' });
    });

    document.getElementById('viewLogsBtn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'view_logs' });
    });

    document.getElementById('approvalsBtn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'view_approvals' });
    });

    document.getElementById('toggleModeBtn')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'toggle_plan_mode' });
    });
  </script>
</body>
</html>`;
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

module.exports = { QuickActionsProvider };
