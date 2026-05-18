const vscode = require('vscode');

class SkillsViewProvider {
  constructor(sessionManager) {
    this.sessionManager = sessionManager;
    this.webviewView = null;
    this.skills = [];
    this.refreshInterval = null;
  }

  async resolveWebviewView(webviewView) {
    this.webviewView = webviewView;
    webviewView.webview.options = { enableScripts: true };

    webviewView.onDidDispose(() => {
      if (this.webviewView === webviewView) {
        this.webviewView = null;
      }
      if (this.refreshInterval) {
        clearInterval(this.refreshInterval);
      }
    });

    webviewView.webview.onDidReceiveMessage(async (message) => {
      switch (message?.type) {
        case 'execute_skill':
          await this.executeSkill(message.skillName);
          break;
        case 'refresh':
          await this.refresh();
          break;
        case 'create_skill':
          await this.createNewSkill();
          break;
        default:
          break;
      }
    });

    await this.refresh();
    this.startPolling();
  }

  startPolling() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
    this.refreshInterval = setInterval(() => this.refresh(), 5000);
  }

  async refresh() {
    if (!this.webviewView) return;

    try {
      const skills = await this.fetchSkills();
      this.skills = skills;
      this.webviewView.webview.html = this.getHtml(skills);
    } catch (error) {
      this.webviewView.webview.html = this.getErrorHtml(error);
    }
  }

  async fetchSkills() {
    try {
      const response = await fetch('http://localhost:3000/api/skills', {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }

      const data = await response.json();
      return data.skills || [];
    } catch (error) {
      console.error('[skills] Fetch error:', error);
      return [];
    }
  }

  async executeSkill(skillName) {
    try {
      const response = await fetch(`http://localhost:3000/api/skills/${skillName}/execute`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ payload: {} }),
      });

      if (!response.ok) {
        throw new Error(`Execution failed: ${response.status}`);
      }

      await vscode.window.showInformationMessage(`✅ Skill '${skillName}' executada com sucesso!`);
      await this.refresh();
    } catch (error) {
      await vscode.window.showErrorMessage(`❌ Erro ao executar skill: ${error.message}`);
    }
  }

  async createNewSkill() {
    const name = await vscode.window.showInputBox({
      prompt: 'Nome da nova skill',
      placeHolder: 'meu-skill',
      validateInput: (v) => (!v ? 'Nome obrigatório' : null),
    });

    if (!name) return;

    try {
      await vscode.commands.executeCommand('openclaude.terminal', `jarvis skill create ${name}`);
      await vscode.window.showInformationMessage(`Skill '${name}' criada! Atualizando...`);
      await new Promise((r) => setTimeout(r, 2000));
      await this.refresh();
    } catch (error) {
      await vscode.window.showErrorMessage(`Erro ao criar skill: ${error.message}`);
    }
  }

  getHtml(skills) {
    const nonce = this.getNonce();
    const skillsHtml = skills
      .map((skill) => this.renderSkillCard(skill))
      .join('');

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
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      padding-bottom: 12px;
      border-bottom: 1px solid var(--border);
    }

    .title {
      font-size: 14px;
      font-weight: 600;
      color: var(--accent-bright);
    }

    .controls {
      display: flex;
      gap: 6px;
    }

    button {
      padding: 6px 10px;
      border: 1px solid var(--border);
      border-radius: 4px;
      background: rgba(240, 148, 100, 0.1);
      color: var(--text);
      cursor: pointer;
      font-size: 11px;
      transition: all 140ms ease;
    }

    button:hover {
      background: rgba(240, 148, 100, 0.18);
      border-color: rgba(240, 148, 100, 0.28);
      transform: translateY(-1px);
    }

    .skills-grid {
      display: grid;
      gap: 10px;
    }

    .skill-card {
      border: 1px solid var(--border);
      border-radius: 8px;
      padding: 12px;
      background: rgba(255, 255, 255, 0.02);
      transition: all 140ms ease;
    }

    .skill-card:hover {
      background: rgba(240, 148, 100, 0.06);
      border-color: rgba(240, 148, 100, 0.2);
    }

    .skill-name {
      font-weight: 600;
      color: var(--accent-bright);
      margin-bottom: 4px;
    }

    .skill-desc {
      font-size: 11px;
      color: var(--text-dim);
      margin-bottom: 8px;
    }

    .skill-commands {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
      margin-bottom: 8px;
    }

    .command-tag {
      background: rgba(215, 119, 87, 0.2);
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 10px;
      color: var(--accent);
    }

    .skill-actions {
      display: flex;
      gap: 6px;
      margin-top: 8px;
    }

    .skill-actions button {
      flex: 1;
      padding: 6px;
      font-size: 10px;
    }

    .empty {
      text-align: center;
      padding: 20px;
      color: var(--text-dim);
    }

    .status {
      font-size: 10px;
      margin-top: 4px;
      padding: 4px 6px;
      border-radius: 3px;
      background: rgba(232, 184, 107, 0.1);
      color: #e8b86b;
    }
  </style>
</head>
<body>
  <div class="header">
    <div class="title">🎯 Skills Manager</div>
    <div class="controls">
      <button id="newSkill">+ Novo</button>
      <button id="refresh">⟳</button>
    </div>
  </div>

  <div class="skills-grid" id="skillsList">
    ${skillsHtml || '<div class="empty">Nenhuma skill carregada...</div>'}
  </div>

  <script nonce="${nonce}">
    const vscode = acquireVsCodeApi();

    document.getElementById('newSkill')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'create_skill' });
    });

    document.getElementById('refresh')?.addEventListener('click', () => {
      vscode.postMessage({ type: 'refresh' });
    });

    document.querySelectorAll('[data-execute]').forEach((btn) => {
      btn.addEventListener('click', () => {
        vscode.postMessage({ type: 'execute_skill', skillName: btn.dataset.execute });
      });
    });
  </script>
</body>
</html>`;
  }

  renderSkillCard(skill) {
    const commandsHtml = (skill.commands || [])
      .slice(0, 3)
      .map((cmd) => `<span class="command-tag">${this.escapeHtml(cmd)}</span>`)
      .join('');

    return `
      <div class="skill-card">
        <div class="skill-name">${this.escapeHtml(skill.name)}</div>
        <div class="skill-desc">${this.escapeHtml(skill.description || 'Sem descrição')}</div>
        ${commandsHtml ? `<div class="skill-commands">${commandsHtml}</div>` : ''}
        <div class="skill-actions">
          <button data-execute="${this.escapeHtml(skill.name)}">▶ Executar</button>
        </div>
        <div class="status">v${this.escapeHtml(skill.version || '1.0.0')} • ${skill.enabled ? '✓ Ativa' : '✗ Desativada'}</div>
      </div>
    `;
  }

  getErrorHtml(error) {
    const message = error instanceof Error ? error.message : String(error);
    return `<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: var(--vscode-font-family); padding: 12px; background: var(--vscode-sideBar-background); }
    .error { border: 1px solid var(--vscode-errorForeground); padding: 10px; border-radius: 4px; color: var(--vscode-errorForeground); }
  </style>
</head>
<body>
  <div class="error">⚠️ Erro ao carregar skills: ${this.escapeHtml(message)}</div>
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
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
}

module.exports = { SkillsViewProvider };
