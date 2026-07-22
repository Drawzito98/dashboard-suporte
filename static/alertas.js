// Sistema de Alertas — configuráveis com base em desempenho
// Módulo independente, não altera lógica existente

const ALERTAS_STORAGE_KEY = 'sistema_alertas_config_v1';

const DEFAULT_ALERTAS = [
  { id: 'score_baixo', name: 'Score abaixo de 85%', desc: 'Score médio abaixo de 4.25 (0-5)', icone: '⚠️', campo: 'score', operador: '<', valor: 4.25, ativo: true },
  { id: 'queda_20', name: 'Queda superior a 20%', desc: 'Queda nas finalizações > 20% vs período anterior', icone: '📉', campo: 'finalizacoes', operador: 'queda_pct', valor: 20, ativo: true },
  { id: 'meta_nao_atingida', name: 'Meta não atingida', desc: 'Colaborador com objetivo não alcançado', icone: '🎯', campo: 'meta', operador: 'nao_atingiu', valor: 0, ativo: true },
  { id: 'consecutivo_abaixo', name: 'Períodos consecutivos abaixo da média', desc: '2+ períodos seguidos com score abaixo de 4.0', icone: '🔁', campo: 'score', operador: 'consecutivo', valor: 4.0, ativo: true },
  { id: 'transferencia_alta', name: 'Taxa de transferência elevada', desc: 'Taxa de transferência acima de 30%', icone: '🔄', campo: 'transferencia', operador: '>', valor: 0.30, ativo: true },
  { id: 'produtividade_baixa', name: 'Produtividade baixa', desc: 'Produtividade (Fin/Ass) abaixo de 60%', icone: '⚡', campo: 'produtividade', operador: '<', valor: 0.60, ativo: true },
];

let alertasConfig = [];

function loadAlertasConfig() {
  try {
    const raw = localStorage.getItem(ALERTAS_STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) {
        alertasConfig = parsed;
        return;
      }
    }
  } catch (e) {}
  alertasConfig = JSON.parse(JSON.stringify(DEFAULT_ALERTAS));
  if (typeof dbAlertasLoad === 'function') {
    dbAlertasLoad().then(loaded => {
      if (loaded && Array.isArray(loaded) && loaded.length) {
        alertasConfig = loaded;
        saveAlertasConfig();
      }
    });
  }
}

function saveAlertasConfig() {
  try { localStorage.setItem(ALERTAS_STORAGE_KEY, JSON.stringify(alertasConfig)); } catch (e) {}
  if (typeof dbAlertasSave === 'function') {
    dbAlertasSave(alertasConfig);
  }
}

function resetAlertasConfig() {
  alertasConfig = JSON.parse(JSON.stringify(DEFAULT_ALERTAS));
  saveAlertasConfig();
  renderAlertas();
}

function verificarAlertas() {
  const data = _gfData();
  if (!data || !data.length) return [];
  const rows = (data).filter(r => r && !isAggregateName(r['Atendente']));
  const alertasDisparados = [];

  alertasConfig.forEach(config => {
    if (!config.ativo) return;

    if (config.id === 'score_baixo') {
      const scores = rows.map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
      const media = scores.length ? scores.reduce((a, b) => a + Number(b), 0) / scores.length : 0;
      if (media < config.valor) {
        alertasDisparados.push({
          config,
          gravidade: 'alta',
          mensagem: `Score médio geral ${media.toFixed(2)} — abaixo de ${config.valor}.`,
          afetados: rows.length
        });
      }
    }

    if (config.id === 'queda_20') {
      const meses = [...new Set(rows.map(r => r['Mês']))].filter(Boolean).sort();
      if (meses.length >= 2) {
        const ult = meses[meses.length - 1];
        const ant = meses[meses.length - 2];
        const finUlt = rows.filter(r => String(r['Mês']) === ult).reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
        const finAnt = rows.filter(r => String(r['Mês']) === ant).reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
        if (finAnt > 0) {
          const queda = ((finAnt - finUlt) / finAnt) * 100;
          if (queda >= config.valor) {
            alertasDisparados.push({
              config,
              gravidade: 'alta',
              mensagem: `Queda de ${queda.toFixed(1)}% nas finalizações (${formatMesLabel(ant)} → ${formatMesLabel(ult)}).`,
              afetados: 1
            });
          }
        }
      }
    }

    if (config.id === 'meta_nao_atingida') {
      const cols = [...new Set(rows.map(r => r['Atendente']))].filter(Boolean);
      const naoAtingiram = cols.filter(name => {
        const recs = rows.filter(r => String(r['Atendente']) === name);
        const obj = recs.reduce((s, r) => s + (parseInt(r['Objetivo']) || 0), 0);
        const fin = recs.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
        return obj > 0 && fin < obj;
      });
      if (naoAtingiram.length) {
        alertasDisparados.push({
          config,
          gravidade: 'media',
          mensagem: `${naoAtingiram.length} colaborador(es) não atingiram a meta: ${naoAtingiram.join(', ')}.`,
          afetados: naoAtingiram.length
        });
      }
    }

    if (config.id === 'consecutivo_abaixo') {
      const cols = [...new Set(rows.map(r => r['Atendente']))].filter(Boolean);
      const afetados = [];
      cols.forEach(name => {
        const recs = rows.filter(r => String(r['Atendente']) === name);
        const mesesC = [...new Set(recs.map(r => r['Mês']))].filter(Boolean).sort();
        let consec = 0;
        for (let i = mesesC.length - 1; i >= 0; i--) {
          const sc = recs.filter(r => String(r['Mês']) === mesesC[i]).map(r => r['SCORE']).filter(v => v !== null && v !== undefined && !isNaN(Number(v)));
          const avg = sc.length ? sc.reduce((a, b) => a + Number(b), 0) / sc.length : 0;
          if (avg < config.valor) consec++;
          else break;
        }
        if (consec >= 2) afetados.push(name);
      });
      if (afetados.length) {
        alertasDisparados.push({
          config,
          gravidade: 'media',
          mensagem: `${afetados.length} colaborador(es) com 2+ períodos abaixo de ${config.valor}: ${afetados.join(', ')}.`,
          afetados: afetados.length
        });
      }
    }

    if (config.id === 'transferencia_alta') {
      const totalAss = rows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
      const totalTra = rows.reduce((s, r) => s + (parseInt(r['Transferidos']) || 0), 0);
      if (totalAss > 0) {
        const taxa = totalTra / totalAss;
        if (taxa > config.valor) {
          alertasDisparados.push({
            config,
            gravidade: 'media',
            mensagem: `Taxa de transferência de ${(taxa * 100).toFixed(1)}% — acima de ${(config.valor * 100).toFixed(0)}%.`,
            afetados: 1
          });
        }
      }
    }

    if (config.id === 'produtividade_baixa') {
      const totalAss = rows.reduce((s, r) => s + (parseInt(r['Assumidos']) || 0), 0);
      const totalFin = rows.reduce((s, r) => s + (parseInt(r['Finalizados']) || 0), 0);
      if (totalAss > 0) {
        const prod = totalFin / totalAss;
        if (prod < config.valor) {
          alertasDisparados.push({
            config,
            gravidade: 'alta',
            mensagem: `Produtividade de ${(prod * 100).toFixed(1)}% — abaixo de ${(config.valor * 100).toFixed(0)}%.`,
            afetados: 1
          });
        }
      }
    }
  });

  return alertasDisparados;
}

function renderAlertas() {
  const container = document.getElementById('alertasContent');
  if (!container) return;

  if (!alertasConfig.length) loadAlertasConfig();

  // Configuração
  let html = `<div style="margin-bottom:var(--s-4)">
    <h3 style="font-size:13px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">⚙️ Configurar Alertas</h3>
    <div style="display:flex;flex-direction:column;gap:var(--s-2)">`;

  alertasConfig.forEach(alerta => {
    html += `<label style="display:flex;align-items:center;gap:var(--s-3);padding:var(--s-3);border:1px solid var(--border);border-radius:var(--r-md);cursor:pointer;transition:background var(--t-fast);background:${alerta.ativo ? 'var(--bg-surface)' : 'var(--bg-subtle)'}">
      <input type="checkbox" class="alerta-toggle" data-id="${escapeHtml(alerta.id)}" ${alerta.ativo ? 'checked' : ''} style="accent-color:var(--accent)"/>
      <span style="font-size:16px">${alerta.icone}</span>
      <div style="flex:1">
        <div style="font-weight:600;font-size:13px;color:var(--text-strong)">${escapeHtml(alerta.name)}</div>
        <div style="font-size:12px;color:var(--text-muted)">${escapeHtml(alerta.desc)}</div>
      </div>
    </label>`;
  });

  html += `</div></div>`;

  // Alertas ativos
  const disparados = verificarAlertas();
  html += `<h3 style="font-size:13px;font-weight:600;margin-bottom:var(--s-3);color:var(--text-strong)">🚨 Alertas Ativos (${disparados.length})</h3>`;

  if (disparados.length) {
    html += `<div style="display:flex;flex-direction:column;gap:var(--s-2)">`;
    disparados.forEach(alerta => {
      const bg = alerta.gravidade === 'alta' ? 'var(--danger-soft)' : 'var(--warning-soft)';
      html += `<div style="display:flex;align-items:flex-start;gap:var(--s-3);padding:var(--s-3);border:1px solid var(--border);border-radius:var(--r-md);background:${bg}">
        <span style="font-size:18px">${alerta.config.icone}</span>
        <div style="flex:1">
          <div style="font-weight:600;font-size:13px;color:var(--text-strong)">${escapeHtml(alerta.config.name)}</div>
          <div style="font-size:12px;color:var(--text-secondary);margin-top:2px">${escapeHtml(alerta.mensagem)}</div>
        </div>
        <span class="badge" style="background:${alerta.gravidade === 'alta' ? 'var(--danger-soft)' : 'var(--warning-soft)'};color:${alerta.gravidade === 'alta' ? 'var(--danger)' : 'var(--warning)'}">${alerta.gravidade === 'alta' ? 'Crítico' : 'Atenção'}</span>
      </div>`;
    });
    html += `</div>`;
  } else if (rawRecords && rawRecords.length) {
    html += `<div style="padding:var(--s-4);border:1px solid var(--border);border-radius:var(--r-md);background:var(--success-soft);color:var(--success);font-weight:600;font-size:13px;text-align:center">✅ Nenhum alerta disparado.</div>`;
  } else {
    html += `<div class="empty-state"><div class="empty-title">Sem dados</div><div class="empty-sub">Importe um CSV para verificar alertas.</div></div>`;
  }

  container.innerHTML = html;

  // Bind toggles
  container.querySelectorAll('.alerta-toggle').forEach(chk => {
    chk.addEventListener('change', (e) => {
      if (!requireAdmin()) return;
      const id = e.target.getAttribute('data-id');
      const alerta = alertasConfig.find(a => a.id === id);
      if (alerta) {
        alerta.ativo = e.target.checked;
        saveAlertasConfig();
        renderAlertas();
      }
    });
  });
}

function onAlertasTabActivated() {
  renderAlertas();
}

loadAlertasConfig();
