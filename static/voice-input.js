// voice-input.js — Digitação por Voz (Web Speech API)

function getSpeechRecognition() {
  const C = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!C) return null;
  return new C();
}

function addVoiceInput(fieldId) {
  const field = document.getElementById(fieldId);
  if (!field) return;

  const rec = getSpeechRecognition();
  if (!rec) return;

  rec.lang = 'pt-BR';
  rec.interimResults = true;
  rec.continuous = false;

  let listening = false;
  let finalTranscript = '';

  const wrapper = document.createElement('div');
  wrapper.style.cssText = 'display:flex;align-items:center;gap:6px';

  const btn = document.createElement('button');
  btn.type = 'button';
  btn.title = 'Clique para falar';
  btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="1em" height="1em" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="23"/><line x1="8" y1="23" x2="16" y2="23"/></svg>';
  btn.style.cssText = 'flex-shrink:0;width:32px;height:32px;border:1px solid var(--border);border-radius:var(--r-md);background:var(--bg-surface);cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--text-secondary);transition:.15s';

  field.parentNode.insertBefore(wrapper, field);
  wrapper.appendChild(field);
  wrapper.appendChild(btn);

  const indicator = document.createElement('span');
  indicator.style.cssText = 'display:none;font-size:12px;color:var(--text-muted);flex-shrink:0';

  const stopListening = () => {
    try { rec.abort(); } catch(e) {}
    listening = false;
    btn.style.background = 'var(--bg-surface)';
    btn.style.color = 'var(--text-secondary)';
    indicator.style.display = 'none';
    finalTranscript = '';
  };

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const r = e.results[i];
      if (r.isFinal) finalTranscript += r[0].transcript;
      else interim += r[0].transcript;
    }
    field.value = finalTranscript + interim;
    field.dispatchEvent(new Event('input', { bubbles: true }));
  };

  rec.onend = () => {
    if (listening) {
      try { rec.start(); } catch(e) { stopListening(); }
    }
  };

  rec.onerror = () => { stopListening(); };

  btn.addEventListener('click', () => {
    if (listening) { stopListening(); return; }
    if (!requireAdmin()) return;
    listening = true;
    finalTranscript = field.value ? field.value + ' ' : '';
    btn.style.background = 'var(--danger)';
    btn.style.color = '#fff';
    btn.title = 'Clique para parar';
    try { rec.start(); } catch(e) { listening = false; }
  });
}

function initVoiceFields(fieldIds) {
  for (const id of fieldIds) {
    const field = document.getElementById(id);
    if (field && field.tagName !== 'SELECT') {
      addVoiceInput(id);
    }
  }
}
