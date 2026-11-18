// Sistema de Alertas — configuráveis com base em desempenho
// Módulo independente, não altera lógica existente

const ALERTAS_STORAGE_KEY = 'sistema_alertas_config_v1';

const DEFAULT_ALERTAS = [
  { id: 'score_baixo', name: 'Qualidade média do suporte', desc: 'Classifica a média das notas de qualidade do suporte nas faixas ruim, razoável e saudável.', icone: '⭐', campo: 'score', operador: '<', valor: 4.50, metaSaudavel: 4.70, ativo: true },
  { id: 'queda_20', name: 'Evolução de finalizações', desc: 'Identifica uma queda relevante no total finalizado em comparação ao período anterior.', icone: '📉', campo: 'finalizacoes', operador: 'queda_pct', valor: 20, metaSaudavel: 5, ativo: true },
  { id: 'meta_nao_atingida', name: 'Objetivo não atingido', desc: 'Compara as finalizações de cada atendente com o campo Objetivo informado nos dados.', icone: '🎯', campo: 'meta', operador: 'nao_atingiu', valor: 0, ativo: true },
  { id: 'consecutivo_abaixo', name: 'Qualidade baixa recorrente', desc: 'Identifica atendentes com score abaixo da referência por vários períodos consecutivos.', icone: '🔁', campo: 'score', operador: 'consecutivo', valor: 4.50, periodos: 2, ativo: true },
  { id: 'transferencia_alta', name: 'Taxa de transferência', desc: 'Mostra quanto dos atendimentos assumidos precisou ser transferido para outra pessoa ou área.', icone: '🔄', campo: 'transferencia', operador: '>', valor: 0.30, metaSaudavel: 0.25, ativo: true },
  { id: 'produtividade_baixa', name: 'Taxa de conclusão', desc: 'Mostra o percentual dos atendimentos assumidos que foi efetivamente finalizado.', icone: '⚡', campo: 'produtividade', operador: '<', valor: 0.60, metaSaudavel: 0.70, ativo: true },
];

let alertasConfig = [];

function loadAlertasConfig(){
  const value=typeof getSettingsConfirmed==='function'?getSettingsConfirmed('alertas')?.value:null;
  alertasConfig=JSON.parse(JSON.stringify(Array.isArray(value)&&value.length?value:DEFAULT_ALERTAS));
}
function getAlertasConfirmedRules(){return JSON.parse(JSON.stringify(alertasConfig));}
async function saveAlertasConfig(value,id){return dbAlertasSave(value,id);}
function resetAlertasConfig(){if(!requireAdmin()||SettingsDrafts.busy('alertas'))return;SettingsDrafts.store('alertas',DEFAULT_ALERTAS);renderAlertas();}

function verificarAlertas() {
  const data = _gfData();
  if (!data || !data.length) return [];
  const rows = (data).filter(r => r && !isAggregateName(r['Atendente']));
  const alertasDisparados = [];

  alertasConfig.forEach(config => {
    if (!config.ativo) return;

    // Regras personalizadas criadas no editor visual.
    if (config.custom) {
      const sum = key => rows.reduce((total, row) => total + (Number(row[key]) || 0), 0);
      const avgScore = source => {
        const values = source.map(row => Number(row['SCORE'])).filter(Number.isFinite);
        return values.length ? values.reduce((a, b) => a + b, 0) / values.length : null;
      };
      const metricValue = (source, field) => {
        const assumed = source.reduce((total, row) => total + (Number(row['Assumidos']) || 0), 0);
        if (field === 'score') return avgScore(source);
        if (field === 'produtividade') return assumed ? source.reduce((total, row) => total + (Number(row['Finalizados']) || 0), 0) / assumed * 100 : null;
        if (field === 'transferencia') return assumed ? source.reduce((total, row) => total + (Number(row['Transferidos']) || 0), 0) / assumed * 100 : null;
        if (field === 'finalizacoes') return source.reduce((total, row) => total + (Number(row['Finalizados']) || 0), 0);
        if (field === 'assumidos') return source.reduce((total, row) => total + (Number(row['Assumidos']) || 0), 0);
        if ((field === 'tma' || field === 'tmr') && typeof parseDurationToSeconds === 'function') {
          const key = field === 'tma' ? 'TMA' : 'TMR';
          const values = source.map(row => parseDurationToSeconds(row[key])).filter(Number.isFinite);
          return values.length ? values.reduce((a, b) => a + b, 0) / values.length / 60 : null;
        }
        return null;
      };
      let value = metricValue(rows, config.campo);
      let triggered = false;
      let detail = '';
      if (config.operador === 'queda_pct') {
        const periods = [...new Set(rows.map(row => row['Mês']))].filter(Boolean).sort();
        if (periods.length >= 2) {
          const current = metricValue(rows.filter(row => String(row['Mês']) === periods.at(-1)), config.campo);
          const previous = metricValue(rows.filter(row => String(row['Mês']) === periods.at(-2)), config.campo);
          value = previous ? (previous - current) / Math.abs(previous) * 100 : null;
          triggered = value !== null && value >= Number(config.valor);
          detail = value === null ? '' : `Queda calculada: ${value.toFixed(1)}%.`;
        }
      } else {
        triggered = value !== null && (config.operador === '<' ? value < Number(config.valor) : value > Number(config.valor));
        detail = value === null ? '' : `Valor atual: ${value.toFixed(2)}.`;
      }
      if (triggered) alertasDisparados.push({ config, gravidade: config.gravidade || 'media', mensagem: `${config.desc || config.name} ${detail}`, afetados: 1 });
      return;
    }

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
        if (consec >= (Number(config.periodos) || 2)) afetados.push(name);
      });
      if (afetados.length) {
        alertasDisparados.push({
          config,
          gravidade: 'media',
          mensagem: `${afetados.length} colaborador(es) com ${Number(config.periodos) || 2}+ períodos abaixo de ${config.valor}: ${afetados.join(', ')}.`,
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

// O editor visual compartilhado assume a renderização; o motor acima usa só confirmados.
function renderAlertas() {}

function onAlertasTabActivated() {
  renderAlertas();
}

loadAlertasConfig();
