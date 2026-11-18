// anotacoes.js — Anotações diárias

const ANOTACOES_EDITING_KEY = 'sistema_anotacao_editando_v1';

function criarAnotacaoOverlay() {
  const div = document.createElement('div');
  div.id = 'anotacaoViewOverlay';
  div.className = 'colab-detail-overlay anotacao-view-overlay';
  div.setAttribute('role', 'dialog');
  div.setAttribute('aria-modal', 'true');
  div.setAttribute('aria-label', 'Visualizar anotação');
  div.innerHTML = '<div class="colab-detail-panel" style="max-width:600px"><div id="anotacaoViewContent"></div></div>';
  document.body.appendChild(div);
  return div;
}

function openAnotacoesOverlay() {
  const overlay = document.getElementById('anotacoesOverlay');
  if (!overlay) return;
  const content = document.getElementById('anotacoesOverlayContent');
  if (!content) return;
  if(typeof routineBusy !== 'undefined' && routineBusy)return;
  if(typeof _captureNote === 'function' && !_captureNote())return;
  content.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line short"></div></div>';
  overlay.classList.add('open');
  const token=AppDataSession.token();
  renderAnotacoes(true);
  dbAnotacoesLoad().then(()=>{if(AppDataSession.current(token))renderAnotacoes();}).catch(()=>{});
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('anotacoesBtn')?.addEventListener('click', openAnotacoesOverlay);
  document.getElementById('anotacoesOverlayClose')?.addEventListener('click', () => {
    document.getElementById('anotacoesOverlay')?.classList.remove('open');
  });
  const overlay = document.getElementById('anotacoesOverlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
