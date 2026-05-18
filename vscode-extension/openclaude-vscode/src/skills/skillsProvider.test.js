const test = require('node:test');
const assert = require('node:assert');
const { SkillsViewProvider } = require('./skillsProvider');

test('SkillsViewProvider - fetch skills', async () => {
  const provider = new SkillsViewProvider({});

  // Mock fetch
  global.fetch = async (url) => {
    if (url === 'http://localhost:3000/api/skills') {
      return {
        ok: true,
        json: async () => ({
          skills: [
            { name: 'skill1', description: 'Test skill', version: '1.0.0', commands: ['cmd1'], enabled: true },
            { name: 'skill2', description: 'Another skill', version: '2.0.0', commands: ['cmd2', 'cmd3'], enabled: true },
          ],
          total: 2,
        }),
      };
    }
    throw new Error('Unknown URL');
  };

  const skills = await provider.fetchSkills();
  assert.strictEqual(skills.length, 2);
  assert.strictEqual(skills[0].name, 'skill1');
  assert.strictEqual(skills[1].name, 'skill2');
});

test('SkillsViewProvider - handle API error', async () => {
  const provider = new SkillsViewProvider({});

  global.fetch = async () => {
    throw new Error('Network error');
  };

  const skills = await provider.fetchSkills();
  assert.strictEqual(skills.length, 0);
});

test('SkillsViewProvider - render skill card HTML', () => {
  const provider = new SkillsViewProvider({});

  const skill = {
    name: 'test-skill',
    description: 'A test skill',
    version: '1.0.0',
    commands: ['test', 'example'],
    enabled: true,
  };

  const html = provider.renderSkillCard(skill);
  assert(html.includes('test-skill'));
  assert(html.includes('A test skill'));
  assert(html.includes('▶ Executar'));
  assert(html.includes('v1.0.0'));
});

test('SkillsViewProvider - escape HTML', () => {
  const provider = new SkillsViewProvider({});

  const input = '<script>alert("xss")</script>';
  const escaped = provider.escapeHtml(input);
  assert(!escaped.includes('<script>'));
  assert(escaped.includes('&lt;script&gt;'));
});

test('SkillsViewProvider - generate nonce', () => {
  const provider = new SkillsViewProvider({});

  const nonce1 = provider.getNonce();
  const nonce2 = provider.getNonce();

  assert.strictEqual(nonce1.length, 32);
  assert.strictEqual(nonce2.length, 32);
  assert.notStrictEqual(nonce1, nonce2);
});

test('SkillsViewProvider - dispose stops polling', () => {
  const provider = new SkillsViewProvider({});
  provider.refreshInterval = setInterval(() => {}, 5000);

  provider.dispose();
  assert.strictEqual(provider.refreshInterval, null);
});
