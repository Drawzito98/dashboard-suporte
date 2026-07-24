(function () {
  'use strict';

  const CATEGORIAS = {
    alertas:    { label: '🔴 Alertas Críticos',  emoji: '🔴', cor: 'var(--danger)', corBg: 'var(--danger-soft)' },
    talentos:  { label: '🟡 Talentos Brutos',    emoji: '🟡', cor: 'var(--warning)', corBg: 'var(--warning-soft)' },
    pilares:   { label: '🟢 Os Pilares',          emoji: '🟢', cor: 'var(--success)', corBg: 'var(--success-soft)' },
    promissores: { label: '🔵 Os Promissores',   emoji: '🔵', cor: 'var(--info)', corBg: 'var(--info-soft)' },
  };

  let colaboradores = [
    { id: 1,  nome: 'Pedro Henrique',     setor: 'Financeiro',           perfil: 'Rápido no aprendizado, mas apresenta desvios éticos (fura fila de atendimentos).', acao: 'Feedback duro sobre integridade de processos e conduta.', categoria: 'alertas' },
    { id: 2,  nome: 'André Luis',         setor: 'Estoque/OS',           perfil: 'Problemas com pontualidade, assiduidade e postura (brincadeiras inadequadas).', acao: 'Alinhamento urgente sobre postura corporativa.', categoria: 'alertas' },
    { id: 3,  nome: 'Janaína Francisca',  setor: 'Fiscal',               perfil: 'Boa técnica, mas oscila emocionalmente e é defensiva/resistente a orientações.', acao: 'PDI focado em inteligência emocional e aceitação de feedback.', categoria: 'alertas' },
    { id: 4,  nome: 'Valkênia Ravla',     setor: 'Fiscal',               perfil: 'Em transição, esforçada, mas muito turrona e resistente a opiniões divergentes.', acao: 'Cobrar abertura para novos métodos e estabilização técnica.', categoria: 'alertas' },
    { id: 5,  nome: 'Diego Rair',         setor: 'Integrações',          perfil: 'Altíssima técnica, mas peca na comunicação interpessoal.', acao: 'Cobrar "comunicação de progresso" (dar mais retornos ao time/clientes).', categoria: 'talentos' },
    { id: 6,  nome: 'Michele Ferreira',   setor: 'Fiscal',               perfil: 'Entrega um volume absurdo, mas faz comentários negativos sobre a liderança/colegas.', acao: 'Canalizar a energia dela no projeto do manual e cobrar postura de liderança positiva.', categoria: 'talentos' },
    { id: 7,  nome: 'Leandro Lima',       setor: 'Financeiro',           perfil: 'Referência técnica de total confiança.', acao: 'Desafiar a expandir sua liderança para outras áreas do financeiro.', categoria: 'pilares' },
    { id: 8,  nome: 'Dayane Alves',       setor: 'Financeiro',           perfil: 'Muito versátil e ótima com crises.', acao: 'Blindá-la emocionalmente das reclamações e desmotivação do restante do time.', categoria: 'pilares' },
    { id: 9,  nome: 'Luiz Henrique',      setor: 'Fiscal/Qualidade',     perfil: 'Maduro e focado.', acao: 'Organizar a transição definitiva para a Qualidade e alinhar regras de banco de horas.', categoria: 'pilares' },
    { id: 10, nome: 'Christian Marinho',  setor: 'Estoque/OS',           perfil: 'Consistente, discreto e resiliente.', acao: 'Apenas refinar a clareza e precisão da comunicação dele.', categoria: 'pilares' },
    { id: 11, nome: 'Eric Davi',          setor: 'Fiscal',               perfil: 'Rápido aprendizado e ótima didática.', acao: 'PDI focado em autoconfiança e segurança frente a metas.', categoria: 'promissores' },
    { id: 12, nome: 'Gabriel Davi',       setor: 'Financeiro',           perfil: 'Muito disciplinado e ótimo de grupo.', acao: 'Provocar para que busque desafios técnicos mais profundos.', categoria: 'promissores' },
    { id: 13, nome: 'Caroline de França', setor: 'Fiscal',               perfil: 'Atenta, mas muito influenciável pelos colegas mais velhos.', acao: 'Trazer para perto da liderança e cobrar autonomia (seguir protocolos oficiais).', categoria: 'promissores' },
    { id: 14, nome: 'Renata Alves',       setor: 'Financeiro',           perfil: 'Engajada e participativa.', acao: 'Trabalhar o equilíbrio emocional para momentos de alta pressão e conflito.', categoria: 'promissores' },
  ];

  let proximoId = 15;
  let filtroAtivo = 'todos';
  let editandoId = null;

  function getContainer() {
    return document.getElementById('mapeamentoTimeContent');
  }

  function salvarEstado() {
    try { localStorage.setItem('mapeamento_time_dados', JSON.stringify(colaboradores)); } catch (e) { console.warn('[Mapeamento] Erro ao salvar dados:', e); }
    try { localStorage.setItem('mapeamento_time_next_id', String(proximoId)); } catch (e) { console.warn('[Mapeamento] Erro ao salvar ID:', e); }
  }

  function carregarEstado() {
    try {
      const saved = localStorage.getItem('mapeamento_time_dados');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length) {
          colaboradores = parsed;
          const nid = localStorage.getItem('mapeamento_time_next_id');
          if (nid) proximoId = parseInt(nid, 10) || colaboradores.length + 1;
        }
      }
    } catch (e) { console.error('[Mapeamento] Erro:', e); }
  }

  function render() {
    const container = getContainer();
    if (!container) return;

    const filtrados = filtroAtivo === 'todos'
      ? colaboradores
      : colaboradores.filter(c => c.categoria === filtroAtivo);

    let html = '<div class="mt-container">';

    html += '<div class="mt-header">';
    html += '<h2 style="font-size:20px;font-weight:600;color:var(--text-strong);letter-spacing:-0.02em">Mapeamento de Time</h2>';
    html += '<button class="btn-primary" id="mtAddBtn" type="button" style="display:inline-flex;align-items:center;gap:6px;padding:8px 18px;font-size:13px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg> + Adicionar Colaborador</button>';
    html += '</div>';

    html += '<div class="mt-filtros">';
    const filters = [
      { key: 'todos', label: 'Todos', cor: 'var(--text-secondary)' },
      { key: 'alertas', label: '🔴 Alertas Críticos', cor: 'var(--danger)' },
      { key: 'talentos', label: '🟡 Talentos Brutos', cor: 'var(--warning)' },
      { key: 'pilares', label: '🟢 Os Pilares', cor: 'var(--success)' },
      { key: 'promissores', label: '🔵 Os Promissores', cor: 'var(--info)' },
    ];
    filters.forEach(f => {
      const ativo = filtroAtivo === f.key;
      html += `<button class="mt-filtro-btn${ativo ? ' active' : ''}" data-filtro="${f.key}" style="${ativo ? 'border-color:' + f.cor + ';color:' + f.cor : ''}">${f.label}</button>`;
    });
    html += '</div>';

    if (!filtrados.length) {
      html += '<p style="text-align:center;padding:var(--s-6);color:var(--text-muted);font-size:14px">Nenhum colaborador nesta categoria.</p>';
    } else {
      html += '<div class="mt-grid">';
      filtrados.forEach(c => {
        const cat = CATEGORIAS[c.categoria];
        html += '<div class="mt-card">';
        html += '<div class="mt-card-top">';
        html += `<span class="mt-categoria-badge" style="background:${cat.corBg};color:${cat.cor};border:1px solid ${cat.cor}">${cat.emoji} ${cat.label.replace(/^[^\s]+\s/, '')}</span>`;
        html += '<div class="mt-card-actions">';
        html += `<button class="mt-btn-icon mt-btn-edit" data-id="${c.id}" title="Editar"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></button>`;
        html += `<button class="mt-btn-icon mt-btn-delete" data-id="${c.id}" title="Excluir"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg></button>`;
        html += '</div>';
        html += '</div>';
        html += `<h3 class="mt-card-nome">${c.nome}</h3>`;
        html += `<p class="mt-card-setor">${c.setor}</p>`;
        html += `<p class="mt-card-perfil"><strong>Perfil:</strong> ${c.perfil}</p>`;
        html += `<div class="mt-card-acao"><strong>Ação Imediata do Líder:</strong> ${c.acao}</div>`;
        html += '</div>';
      });
      html += '</div>';
    }

    html += '</div>';
    container.innerHTML = html;
    bindEvents();
  }

  function bindEvents() {
    const container = getContainer();
    if (!container) return;

    const addBtn = document.getElementById('mtAddBtn');
    if (addBtn) addBtn.addEventListener('click', () => abrirModal());

    container.querySelectorAll('.mt-filtro-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        filtroAtivo = btn.dataset.filtro;
        render();
      });
    });

    container.querySelectorAll('.mt-btn-edit').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        const colab = colaboradores.find(c => c.id === id);
        if (colab) abrirModal(colab);
      });
    });

    container.querySelectorAll('.mt-btn-delete').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = parseInt(btn.dataset.id, 10);
        confirmarExcluir(id);
      });
    });
  }

  function abrirModal(colab) {
    editandoId = colab ? colab.id : null;
    const titulo = colab ? 'Editar Colaborador' : 'Adicionar Colaborador';
    const n = colab ? colab.nome : '';
    const s = colab ? colab.setor : '';
    const p = colab ? colab.perfil : '';
    const a = colab ? colab.acao : '';
    const cat = colab ? colab.categoria : 'alertas';

    const overlay = document.createElement('div');
    overlay.className = 'mt-modal-overlay';
    overlay.innerHTML = `
      <div class="mt-modal">
        <button class="mt-modal-close" id="mtModalClose" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        <h3 style="font-size:18px;font-weight:600;color:var(--text-strong);margin-bottom:var(--s-5)">${titulo}</h3>
        <div class="mt-modal-form">
          <div class="field">
            <label class="label">Nome</label>
            <input type="text" id="mtFormNome" class="input" value="${escHtml(n)}" placeholder="Nome do colaborador">
          </div>
          <div class="field">
            <label class="label">Setor</label>
            <input type="text" id="mtFormSetor" class="input" value="${escHtml(s)}" placeholder="Setor">
          </div>
          <div class="field">
            <label class="label">Perfil</label>
            <textarea id="mtFormPerfil" class="input" rows="3" placeholder="Descrição do perfil">${escHtml(p)}</textarea>
          </div>
          <div class="field">
            <label class="label">Ação Imediata do Líder</label>
            <textarea id="mtFormAcao" class="input" rows="2" placeholder="Ação imediata">${escHtml(a)}</textarea>
          </div>
          <div class="field">
            <label class="label">Categoria</label>
            <select id="mtFormCategoria" class="input">
              <option value="alertas" ${cat === 'alertas' ? 'selected' : ''}>🔴 Alertas Críticos</option>
              <option value="talentos" ${cat === 'talentos' ? 'selected' : ''}>🟡 Talentos Brutos</option>
              <option value="pilares" ${cat === 'pilares' ? 'selected' : ''}>🟢 Os Pilares</option>
              <option value="promissores" ${cat === 'promissores' ? 'selected' : ''}>🔵 Os Promissores</option>
            </select>
          </div>
          <div class="mt-modal-btns">
            <button class="btn-small" id="mtModalCancel" type="button">Cancelar</button>
            <button class="btn-primary" id="mtModalSave" type="button" style="display:inline-flex;align-items:center;gap:6px"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg> Salvar</button>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const fechar = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    };

    document.getElementById('mtModalClose').addEventListener('click', fechar);
    document.getElementById('mtModalCancel').addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

    document.getElementById('mtModalSave').addEventListener('click', () => {
      const nome = document.getElementById('mtFormNome').value.trim();
      const setor = document.getElementById('mtFormSetor').value.trim();
      const perfil = document.getElementById('mtFormPerfil').value.trim();
      const acao = document.getElementById('mtFormAcao').value.trim();
      const categoria = document.getElementById('mtFormCategoria').value;

      if (!nome || !setor || !perfil || !acao) {
        alert('Preencha todos os campos.');
        return;
      }

      if (editandoId) {
        const idx = colaboradores.findIndex(c => c.id === editandoId);
        if (idx !== -1) {
          colaboradores[idx] = { ...colaboradores[idx], nome, setor, perfil, acao, categoria };
        }
      } else {
        colaboradores.push({ id: proximoId++, nome, setor, perfil, acao, categoria });
      }

      salvarEstado();
      fechar();
      render();
      if (filtroAtivo !== 'todos' && filtroAtivo !== categoria) {
        filtroAtivo = categoria;
      }
      render();
    });

    document.getElementById('mtFormNome').focus();
  }

  function confirmarExcluir(id) {
    const colab = colaboradores.find(c => c.id === id);
    if (!colab) return;

    const overlay = document.createElement('div');
    overlay.className = 'mt-modal-overlay';
    overlay.innerHTML = `
      <div class="mt-modal" style="max-width:400px">
        <button class="mt-modal-close" id="mtDelClose" type="button"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button>
        <h3 style="font-size:18px;font-weight:600;color:var(--text-strong);margin-bottom:var(--s-3)">Excluir Colaborador</h3>
        <p style="color:var(--text-secondary);margin-bottom:var(--s-5);font-size:14px;line-height:1.5">Tem certeza que deseja excluir <strong>${escHtml(colab.nome)}</strong> da lista?</p>
        <div class="mt-modal-btns">
          <button class="btn-small" id="mtDelCancel" type="button">Cancelar</button>
          <button class="btn-primary" id="mtDelConfirm" type="button" style="display:inline-flex;align-items:center;gap:6px;background:var(--danger);border-color:var(--danger)"><svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg> Excluir</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('open'));

    const fechar = () => {
      overlay.classList.remove('open');
      setTimeout(() => overlay.remove(), 200);
    };

    document.getElementById('mtDelClose').addEventListener('click', fechar);
    document.getElementById('mtDelCancel').addEventListener('click', fechar);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) fechar(); });

    document.getElementById('mtDelConfirm').addEventListener('click', () => {
      colaboradores = colaboradores.filter(c => c.id !== id);
      salvarEstado();
      fechar();
      render();
    });
  }

  function escHtml(str) {
    if (!str) return '';
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  window.onMapeamentoTimeTabActivated = function () {
    const container = getContainer();
    if (!container) return;
    carregarEstado();
    render();
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      const style = document.createElement('style');
      style.textContent = getStyles();
      document.head.appendChild(style);
    });
  } else {
    const style = document.createElement('style');
    style.textContent = getStyles();
    document.head.appendChild(style);
  }

  function getStyles() {
    return `
.mt-container {
  display: flex;
  flex-direction: column;
  gap: var(--s-5, 16px);
}
.mt-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: var(--s-3, 12px);
}
.mt-filtros {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  padding: var(--s-3, 12px) 0;
}
.mt-filtro-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 7px 14px;
  font-size: 12.5px;
  font-weight: 600;
  border: 1.5px solid var(--border, #e2e8f0);
  border-radius: 20px;
  background: var(--bg-surface, #fff);
  color: var(--text-secondary, #334155);
  cursor: pointer;
  transition: all var(--t-fast, 0.15s);
  white-space: nowrap;
}
.mt-filtro-btn:hover {
  border-color: var(--text-muted, #94a3b8);
  background: var(--bg-subtle, #f1f4f9);
}
.mt-filtro-btn.active {
  border-width: 2px;
  font-weight: 700;
}
.mt-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--s-4, 16px);
}
.mt-card {
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: var(--r-lg, 10px);
  padding: var(--s-5, 20px);
  transition: box-shadow var(--t-base, 0.2s);
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.mt-card:hover {
  box-shadow: var(--shadow-md, 0 4px 12px rgba(0,0,0,0.07));
}
.mt-card-top {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: var(--s-2, 8px);
}
.mt-categoria-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 20px;
  white-space: nowrap;
}
.mt-card-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
}
.mt-btn-icon {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: var(--r-sm, 6px);
  background: var(--bg-surface, #fff);
  color: var(--text-secondary, #334155);
  cursor: pointer;
  transition: all var(--t-fast, 0.15s);
  padding: 0;
}
.mt-btn-icon:hover {
  background: var(--bg-subtle, #f1f4f9);
  border-color: var(--border-strong, #cbd5e1);
  color: var(--text-primary, #1f2937);
}
.mt-btn-delete:hover {
  background: var(--danger-soft, #fee2e2);
  border-color: var(--danger, #b91c1c);
  color: var(--danger, #b91c1c);
}
.mt-card-nome {
  font-size: 15px;
  font-weight: 700;
  color: var(--text-strong, #0f172a);
  margin: 0;
  line-height: 1.3;
}
.mt-card-setor {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted, #94a3b8);
  text-transform: uppercase;
  letter-spacing: 0.04em;
  margin: 0;
}
.mt-card-perfil {
  font-size: 13px;
  color: var(--text-secondary, #334155);
  line-height: 1.5;
  margin: 4px 0 0;
}
.mt-card-perfil strong {
  color: var(--text-primary, #1f2937);
}
.mt-card-acao {
  margin-top: 6px;
  padding: 10px 12px;
  background: var(--bg-subtle, #f1f4f9);
  border-left: 3px solid var(--accent, #2563eb);
  border-radius: var(--r-sm, 6px);
  font-size: 13px;
  color: var(--text-secondary, #334155);
  line-height: 1.5;
}
.mt-card-acao strong {
  display: block;
  margin-bottom: 3px;
  font-size: 11px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: var(--accent, #2563eb);
}

.mt-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.5);
  backdrop-filter: blur(4px);
  z-index: 200;
  display: none;
  align-items: center;
  justify-content: center;
  padding: var(--s-5, 20px);
  opacity: 0;
  transition: opacity 0.2s ease;
}
.mt-modal-overlay.open {
  display: flex;
  opacity: 1;
}
.mt-modal {
  width: 100%;
  max-width: 520px;
  max-height: 85vh;
  background: var(--bg-surface, #fff);
  border: 1px solid var(--border, #e2e8f0);
  border-radius: var(--r-xl, 12px);
  box-shadow: var(--shadow-lg, 0 12px 40px rgba(0,0,0,0.12));
  overflow-y: auto;
  padding: var(--s-6, 24px);
  position: relative;
}
.mt-modal-close {
  position: absolute;
  top: var(--s-4, 16px);
  right: var(--s-4, 16px);
  width: 32px;
  height: 32px;
  border: 1px solid var(--border, #e2e8f0);
  border-radius: var(--r-sm, 6px);
  background: var(--bg-surface, #fff);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--text-secondary, #334155);
  transition: all var(--t-fast, 0.15s);
}
.mt-modal-close:hover {
  background: var(--bg-subtle, #f1f4f9);
  color: var(--text-primary, #1f2937);
}
.mt-modal-form {
  display: flex;
  flex-direction: column;
  gap: var(--s-4, 16px);
}
.mt-modal-btns {
  display: flex;
  justify-content: flex-end;
  gap: var(--s-2, 8px);
  margin-top: var(--s-2, 8px);
}
@media (max-width: 768px) {
  .mt-grid {
    grid-template-columns: 1fr;
  }
  .mt-header {
    flex-direction: column;
    align-items: stretch;
  }
  .mt-header .btn-primary {
    width: 100%;
    justify-content: center;
  }
}
    `;
  }
})();
