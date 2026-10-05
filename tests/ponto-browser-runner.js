// Node 20 with --experimental-websocket, or Node 22+, and Chrome with --remote-debugging-port=9228.
// Serve this project on http://127.0.0.1:8765 before running.
const assert = require('node:assert/strict');
const WebSocket = globalThis.WebSocket;
if (!WebSocket) throw new Error('Node 20 requer a flag --experimental-websocket.');
async function main() {
  const targets = await (await fetch('http://127.0.0.1:9228/json')).json();
  const page = targets.find(t => t.type === 'page');
  const ws = new WebSocket(page.webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { ws.onopen = resolve; ws.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  ws.onmessage = event => { const message = JSON.parse(event.data); const callback = pending.get(message.id); if (callback) { pending.delete(message.id); callback(message); } };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    const id = ++serial; pending.set(id, message => message.error ? reject(new Error(message.error.message)) : resolve(message.result)); ws.send(JSON.stringify({ id, method, params }));
  });
  try {
    await command('Page.navigate', { url: 'http://127.0.0.1:8765/tests/' + (process.argv[2] || 'ponto.browser.html') });
    const deadline = Date.now() + 30000;
    let status = '';
    while (Date.now() < deadline) {
      const result = await command('Runtime.evaluate', { expression: 'document.getElementById("testResult")?.textContent', returnByValue: true });
      status = result.result?.value || '';
      if (/^(PASS|FAIL)/.test(status)) break;
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    assert.ok(status.startsWith('PASS'), status || 'Teste não concluiu');
    console.log(status);
  } finally { ws.close(); }
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
