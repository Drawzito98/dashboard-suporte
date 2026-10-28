// Local only: serve this repo on 8765 and use an isolated Chrome debugging port 9228.
// Node 20: node --experimental-websocket tests/design-system-browser-runner.js
const assert = require('node:assert/strict');
(async () => {
  const targets = await (await fetch('http://127.0.0.1:9228/json')).json();
  const socket = new WebSocket(targets.find(target => target.type === 'page').webSocketDebuggerUrl);
  await new Promise((resolve, reject) => { socket.onopen = resolve; socket.onerror = reject; });
  let serial = 0;
  const pending = new Map();
  socket.onmessage = event => { const data = JSON.parse(event.data); pending.get(data.id)?.(data); pending.delete(data.id); };
  const command = (method, params = {}) => new Promise((resolve, reject) => {
    pending.set(++serial, data => data.error ? reject(Error(data.error.message)) : resolve(data.result));
    socket.send(JSON.stringify({ id: serial, method, params }));
  });
  const evaluate = async expression => {
    const result = await command('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true, userGesture: true });
    if (result.exceptionDetails) throw Error(result.exceptionDetails.text);
    return result.result?.value;
  };
  const escape = async () => {
    await command('Input.dispatchKeyEvent', { type: 'keyDown', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
    await command('Input.dispatchKeyEvent', { type: 'keyUp', key: 'Escape', code: 'Escape', windowsVirtualKeyCode: 27 });
  };
  try {
    for (const [width, height] of [[1440, 1000], [390, 844], [320, 740]]) {
      await command('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: width < 900 });
      for (const theme of ['light', 'dark']) {
        await command('Page.navigate', { url: 'about:blank' });
        await command('Page.navigate', { url: 'http://127.0.0.1:8765/tests/design-system.browser.html?theme=' + theme });
        let status;
        for (let attempt = 0; attempt < 150; attempt++) {
          status = await evaluate('document.getElementById("testResult")?.textContent');
          if (/^(PASS|FAIL)/.test(status || '')) break;
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.ok(status?.startsWith('PASS'), status);
        await evaluate(`(async()=>{
          document.getElementById('opener').click(); await new Promise(requestAnimationFrame);
          document.getElementById('childOpen').click(); await new Promise(requestAnimationFrame);
          const modal=document.getElementById('native');
          window.cancelGuard=event=>event.preventDefault();modal.addEventListener('cancel',window.cancelGuard);modal.showModal();
        })()`);
        await escape();
        assert.ok(await evaluate("document.getElementById('native').open && !document.getElementById('child').hidden"), 'Guard nativo preservado');
        await evaluate("document.getElementById('native').removeEventListener('cancel',window.cancelGuard)");
        await escape();
        assert.ok(await evaluate("!document.getElementById('native').open && !document.getElementById('child').hidden && !document.getElementById('parent').hidden"), 'Escape fecha somente dialog nativo');
        await escape();
        assert.ok(await evaluate("document.getElementById('child').hidden && !document.getElementById('parent').hidden"), 'Escape fecha somente overlay superior');
        await escape();
        assert.ok(await evaluate("document.getElementById('parent').hidden"), 'Fecha overlay principal');
        console.log(width + 'px / ' + theme + ': ' + status + '; Escape real e cancel guard preservados');
      }
    }
    await command('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] });
    assert.equal(await evaluate("getComputedStyle(document.querySelector('.card')).transitionDuration"), '0s');
    console.log('Movimento reduzido: transições desativadas.');
  } finally {
    await command('Emulation.clearDeviceMetricsOverride');
    await command('Emulation.setEmulatedMedia', { features: [] });
    socket.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
