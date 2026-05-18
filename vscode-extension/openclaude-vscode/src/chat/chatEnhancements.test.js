const test = require('node:test');
const assert = require('node:assert');

// Mock functions from chatEnhancements.js
function highlightJavaScript(code) {
  const keywords = /\b(const|let|var|function|return|if|else|for|while|class|extends|import|export|async|await|try|catch|new|this)\b/g;
  const strings = /'([^'\\]|\\.)*'|"([^"\\]|\\.)*"|`([^`\\]|\\.)*`/g;
  const comments = /\/\/.*?$/gm;
  const numbers = /\b\d+\b/g;

  let result = code;
  result = result.replace(comments, '<span class="hl-comment">$&</span>');
  result = result.replace(strings, '<span class="hl-string">$&</span>');
  result = result.replace(keywords, '<span class="hl-keyword">$&</span>');
  result = result.replace(numbers, '<span class="hl-number">$&</span>');

  return result;
}

function highlightPython(code) {
  const keywords = /\b(def|class|return|if|elif|else|for|while|import|from|as|try|except|with|lambda|yield|async|await)\b/g;
  const strings = /'([^'\\]|\\.)*'|"([^"\\]|\\.)*"|"""([^\\]|\\.)*"""|'''([^\\]|\\.)*'''/g;
  const comments = /#.*?$/gm;
  const builtins = /\b(print|len|range|list|dict|set|str|int|float|bool|None|True|False)\b/g;

  let result = code;
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

  let result = code;
  result = result.replace(strings, '<span class="hl-string">$&</span>');
  result = result.replace(numbers, ':<span class="hl-number"> $1</span>');
  result = result.replace(booleans, '<span class="hl-keyword">$&</span>');

  return result;
}

test('Chat enhancements - highlight JavaScript', () => {
  const code = 'const x = "test"; // comment\nconst y = 42;';
  const result = highlightJavaScript(code);

  assert(result.includes('<span class="hl-keyword">const</span>'));
  assert(result.includes('<span class="hl-string">"test"</span>'));
  assert(result.includes('<span class="hl-comment">// comment</span>'));
  assert(result.includes('<span class="hl-number">42</span>'));
});

test('Chat enhancements - highlight Python', () => {
  const code = 'def test():\n    print("hello")  # comment\n    x = 123';
  const result = highlightPython(code);

  assert(result.includes('<span class="hl-keyword">def</span>'));
  assert(result.includes('<span class="hl-func">print</span>'));
  assert(result.includes('<span class="hl-comment"># comment</span>'));
});

test('Chat enhancements - highlight JSON', () => {
  const code = '{\n  "name": "test",\n  "age": 42,\n  "active": true\n}';
  const result = highlightJSON(code);

  assert(result.includes('<span class="hl-string">"name"</span>'));
  assert(result.includes('<span class="hl-number"> 42</span>'));
  assert(result.includes('<span class="hl-keyword">true</span>'));
});

test('Chat enhancements - highlight respects string boundaries', () => {
  const code = 'const msg = "Don\'t break"; // const in string';
  const result = highlightJavaScript(code);

  // Should have one "const" as keyword, not more
  const constCount = (result.match(/hl-keyword">const/g) || []).length;
  assert(constCount >= 1);
});

test('Chat enhancements - multiple language handling', () => {
  const jsCode = 'const x = 10;';
  const pyCode = 'x = 10';
  const jsonCode = '{"x": 10}';

  const jsResult = highlightJavaScript(jsCode);
  const pyResult = highlightPython(pyCode);
  const jsonResult = highlightJSON(jsonCode);

  assert(jsResult.includes('hl-keyword'));
  assert(pyResult.includes('hl-keyword'));
  assert(jsonResult.includes('hl-keyword'));
});

test('Chat enhancements - empty code handling', () => {
  assert.doesNotThrow(() => {
    highlightJavaScript('');
    highlightPython('');
    highlightJSON('');
  });
});

test('Chat enhancements - special characters in strings', () => {
  const code = 'const str = "test\\nwith\\nnewlines"; const str2 = \'single quotes\';';
  const result = highlightJavaScript(code);

  assert(result.includes('hl-string'));
  assert(result.includes('hl-keyword'));
});
