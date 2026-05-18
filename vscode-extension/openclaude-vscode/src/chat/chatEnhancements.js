/**
 * chatEnhancements — Add-ons para melhorar chatRenderer
 * - Markdown rendering melhorado
 * - Copy-to-clipboard para code blocks
 * - Search/filter de mensagens
 * - Edit/resubmit messages
 * - Syntax highlighting automático
 */

function setupChatEnhancements() {
  // ── Copy to clipboard para code blocks ──
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('code-copy-btn')) {
      const codeBlock = e.target.closest('.code-wrapper')?.querySelector('code');
      if (codeBlock) {
        const text = codeBlock.textContent;
        navigator.clipboard.writeText(text).then(() => {
          const btn = e.target;
          const original = btn.textContent;
          btn.textContent = '✓ Copiado!';
          setTimeout(() => {
            btn.textContent = original;
          }, 2000);
        });
      }
    }
  });

  // ── Search/Filter de mensagens ──
  const setupSearch = () => {
    const searchInput = document.getElementById('message-search');
    if (!searchInput) return;

    searchInput.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const messages = document.querySelectorAll('.msg-user, .msg-assistant');

      messages.forEach((msg) => {
        const text = msg.textContent.toLowerCase();
        const matches = !query || text.includes(query);
        msg.style.display = matches ? 'block' : 'none';
        if (matches && query) {
          msg.style.opacity = '1';
        }
      });
    });
  };

  setTimeout(setupSearch, 100);

  // ── Syntax highlighting automático ──
  const highlightCode = () => {
    const codeBlocks = document.querySelectorAll('.code-block');
    codeBlocks.forEach((block) => {
      if (block.classList.contains('highlighted')) return;

      const language = block.parentElement?.dataset.language || 'plaintext';
      highlightSyntax(block, language);
      block.classList.add('highlighted');
    });
  };

  setTimeout(highlightCode, 100);

  // ── Edit/resubmit messages ──
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('msg-edit-btn')) {
      const msgElement = e.target.closest('.msg-user');
      if (msgElement) {
        const currentText = msgElement.querySelector('.md-content')?.textContent || msgElement.textContent;
        editMessage(currentText, (newText) => {
          resubmitMessage(newText);
          msgElement.remove();
        });
      }
    }
  });

  // ── Expandable code blocks ──
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('code-expand-btn')) {
      const wrapper = e.target.closest('.code-wrapper');
      wrapper?.classList.toggle('expanded');
    }
  });
}

function highlightSyntax(codeBlock, language) {
  const text = codeBlock.textContent;
  let highlighted = text;

  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
      highlighted = highlightJavaScript(text);
      break;
    case 'typescript':
    case 'ts':
      highlighted = highlightTypeScript(text);
      break;
    case 'python':
    case 'py':
      highlighted = highlightPython(text);
      break;
    case 'json':
      highlighted = highlightJSON(text);
      break;
  }

  codeBlock.innerHTML = highlighted;
}

function highlightJavaScript(code) {
  const keywords = /\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|async|await|try|catch|new|this)\b/g;
  const strings = /'([^'\\]|\\.)*'|"([^"\\]|\\.)*"|`([^`\\]|\\.)*`/g;
  const comments = /\/\/.*?$/gm;
  const numbers = /\b\d+\b/g;

  let result = escapeHtml(code);
  result = result.replace(comments, '<span class="hl-comment">$&</span>');
  result = result.replace(strings, '<span class="hl-string">$&</span>');
  result = result.replace(keywords, '<span class="hl-keyword">$&</span>');
  result = result.replace(numbers, '<span class="hl-number">$&</span>');

  return result;
}

function highlightTypeScript(code) {
  return highlightJavaScript(code)
    .replace(/\b(interface|type|namespace|enum|readonly|public|private|protected|abstract)\b/g,
      '<span class="hl-keyword">$&</span>');
}

function highlightPython(code) {
  const keywords = /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|with|lambda|yield|async|await)\b/g;
  const strings = /'([^'\\]|\\.)*'|"([^"\\]|\\.)*"|"""([^\\]|\\.)*"""|'''([^\\]|\\.)*'''/g;
  const comments = /#.*?$/gm;
  const builtins = /\b(print|len|range|list|dict|set|str|int|float|bool|None|True|False)\b/g;

  let result = escapeHtml(code);
  result = result.replace(comments, '<span class="hl-comment">$&</span>');
  result = result.replace(strings, '<span class="hl-string">$&</span>');
  result = result.replace(keywords, '<span class="hl-keyword">$&</span>');
  result = result.replace(builtins, '<span class="hl-func">$&</span>');

  return result;
}

function highlightJSON(code) {
  const strings = /"([^"\\]|\\.)*"/g;
  const numbers = /:\s*(-?\d+\.?\d*([eE][+-]?\d+)?)/g;
  const booleans = /\b(true|false|null)\b/g;

  let result = escapeHtml(code);
  result = result.replace(strings, '<span class="hl-string">$&</span>');
  result = result.replace(numbers, ':<span class="hl-number"> $1</span>');
  result = result.replace(booleans, '<span class="hl-keyword">$&</span>');

  return result;
}

function editMessage(currentText, onSave) {
  const inputBox = prompt('Editar mensagem:', currentText);
  if (inputBox !== null) {
    onSave(inputBox);
  }
}

function resubmitMessage(text) {
  const vscode = acquireVsCodeApi?.();
  if (vscode) {
    vscode.postMessage({
      type: 'user_message',
      text: text.trim(),
    });
  }
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Auto-init quando o documento estiver pronto
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupChatEnhancements);
} else {
  setupChatEnhancements();
}
