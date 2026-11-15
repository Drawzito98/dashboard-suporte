// opa-semanal-parse.js — leitura do pacote semanal exportado do Looker (Opa! Suite).
// Módulo puro (sem DOM, sem rede): roda no navegador e no Node para testes.
(function (root) {
  'use strict';

  // ---------- utilidades ----------
  const stripAccents = s => String(s ?? '').normalize('NFD').replace(/[̀-ͯ]/g, '');

  // Alguns compactadores gravam nomes não-ASCII como "#U00ed". Desfaz antes de normalizar.
  function unescapeZipName(s) {
    return String(s ?? '').replace(/#U([0-9a-fA-F]{4})/g, (_, h) => String.fromCharCode(parseInt(h, 16)));
  }

  // "dashboard-opa!_atendimentos/comparativo_de_per#U00edodo.csv" -> "comparativo_de_periodo"
  function fileKey(path) {
    const base = unescapeZipName(String(path)).split(/[\\/]/).pop().replace(/\.csv$/i, '');
    return stripAccents(base).toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  }

  // Chave de ligação entre o Looker e o cadastro do app: primeiro nome, sem acento, minúsculo.
  function firstNameKey(fullName) {
    const t = stripAccents(String(fullName ?? '')).toLowerCase().trim().split(/\s+/)[0] || '';
    return t.replace(/[^a-z0-9]/g, '');
  }

  function parseCsv(text) {
    const src = String(text ?? '').replace(/^﻿/, '');
    const rows = []; let row = [], cell = '', quoted = false;
    for (let i = 0; i < src.length; i++) {
      const c = src[i];
      if (quoted) {
        if (c === '"') { if (src[i + 1] === '"') { cell += '"'; i++; } else quoted = false; }
        else cell += c;
      } else if (c === '"') quoted = true;
      else if (c === ',') { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && src[i + 1] === '\n') i++;
        row.push(cell); cell = ''; rows.push(row); row = [];
      } else cell += c;
    }
    if (cell !== '' || row.length) { row.push(cell); rows.push(row); }
    return rows.filter(r => r.some(v => String(v).trim() !== ''));
  }

  // "4,3%" -> 4.3 · "R$ 0,00" -> 0 · "'+0,2%" -> 0.2 · "1.308" -> 1308 · "" -> null
  function parseNumber(value) {
    let s = String(value ?? '').replace(/R\$/g, '').replace(/[%'+\s ]/g, '');
    if (s === '' || /^[-–—]+$/.test(s)) return null;
    if (s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
    const n = Number(s);
    return Number.isFinite(n) ? n : null;
  }

  // "13:11:32" · "14m57s" · "23h24m40s" -> segundos. Aceita segundos arredondados para 60.
  function parseDuration(value) {
    const s = String(value ?? '').trim();
    if (!s || /^[-–—]+$/.test(s)) return null;
    let m = s.match(/^(\d+):(\d{1,2}):(\d{1,2})$/);
    if (m) return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
    m = s.match(/^(?:(\d+)h)?\s*(?:(\d+)m)?\s*(?:(\d+)s)?$/);
    if (m && (m[1] || m[2] || m[3])) return Number(m[1] || 0) * 3600 + Number(m[2] || 0) * 60 + Number(m[3] || 0);
    return null;
  }

  function formatDuration(sec) {
    if (sec == null || !Number.isFinite(sec)) return '–';
    const n = Math.round(sec), h = Math.floor(n / 3600), m = Math.floor(n / 60) % 60, s = n % 60;
    if (h > 0) return `${h}h${String(m).padStart(2, '0')}m`;
    if (m > 0) return `${m}m${String(s).padStart(2, '0')}s`;
    return `${s}s`;
  }

  // Segunda-feira da semana de uma data AAAA-MM-DD (UTC, sem fuso).
  function semanaInicio(dateStr) {
    const [y, mo, d] = String(dateStr).split('-').map(Number);
    const dt = new Date(Date.UTC(y, mo - 1, d));
    dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7));
    return dt.toISOString().slice(0, 10);
  }

  const isIsoDate = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s));
  const sum = (arr, f) => arr.reduce((t, x) => t + (Number(f(x)) || 0), 0);

  // ---------- leitura do pacote ----------
  const REQUIRED = [
    'atendimentos_assumidos', 'atendimentos_finalizados', 'atendimentos_por_dia',
    'performance_por_colaborador', 'performance_por_departamento'
  ];

  // Converte linhas em objetos usando o cabeçalho normalizado.
  function toObjects(rows, headerAt = 0, skip = 0) {
    const head = (rows[headerAt] || []).map(h => fileKey(h));
    return rows.slice(headerAt + 1 + skip).map(r => Object.fromEntries(head.map((h, i) => [h, r[i]])));
  }

  function parsePacote(files) {
    // files: { caminhoOuNome: textoCsv }
    const by = {};
    Object.entries(files || {}).forEach(([name, text]) => { by[fileKey(name)] = text; });
    const missing = REQUIRED.filter(k => !(k in by));
    if (missing.length) throw new Error('Arquivos ausentes no pacote: ' + missing.join(', ') + '.');
    const rows = k => (k in by ? parseCsv(by[k]) : []);
    const card = k => { const r = rows(k)[1] || []; return [r[0], r[1]]; };
    const kv = k => { const r = card(k); return { v: r[0] ?? '', d: r[1] ?? '' }; };

    const dias = rows('atendimentos_por_dia').slice(2)
      .map(r => ({ data: String(r[0] || '').trim(), assumidos: parseNumber(r[1]) || 0, finalizados: parseNumber(r[2]) || 0 }))
      .filter(d => isIsoDate(d.data));
    if (!dias.length) throw new Error('A tabela "atendimentos por dia" não tem datas válidas.');
    const datas = dias.map(d => d.data).sort();

    const heatRows = rows('assumidos_por_dia_hora');
    const heat = heatRows.length ? {
      dias: heatRows[0].slice(1),
      linhas: heatRows.slice(2).map(r => ({ hora: r[0], valores: r.slice(1).map(parseNumber) }))
    } : { dias: [], linhas: [] };

    const aval = {};
    toObjects(rows('avaliacao_por_colaborador_ia_cliente')).forEach(o => { aval[firstNameKey(o.atendente)] = o; });
    const colabs = toObjects(rows('performance_por_colaborador')).filter(o => o.atendente).map(o => ({
      chave: firstNameKey(o.atendente), nome: String(o.atendente).replace(/\s+/g, ' ').trim(),
      assumidos: parseNumber(o.assumidos) || 0, finalizados: parseNumber(o.finalizados) || 0,
      transferidos: parseNumber(o.transferidos) || 0, clientes: parseNumber(o.clientes) || 0,
      mediaCliente: parseNumber(o.media_aval ?? o.media_avaliacao),
      mediaIa: parseNumber((aval[firstNameKey(o.atendente)] || {}).media_ia),
      tma: parseDuration(o.tma), tmi: parseDuration(o.tmi), tmr: parseDuration(o.tmr)
    }));

    const deptos = toObjects(rows('performance_por_departamento')).filter(o => o.departamento).map(o => ({
      nome: o.departamento, assumidos: parseNumber(o.assumidos) || 0, finalizados: parseNumber(o.finalizados) || 0,
      transferidos: parseNumber(o.transferidos) || 0, tmr: parseDuration(o.tmr), score: parseNumber(o.score),
      avaliados: parseNumber(o.avaliados) || 0, encInatividade: parseNumber(o.enc_inatividade) || 0
    }));

    const motivos = toObjects(rows('motivos_de_atendimento')).filter(o => o.motivo).map(o => ({
      nome: o.motivo, finalizados: parseNumber(o.finalizados) || 0, tmr: parseDuration(o.tmr)
    }));
    const recorrencia = toObjects(rows('recorrencia_por_motivo')).filter(o => o.motivo)
      .map(o => ({ nome: o.motivo, taxa: parseNumber(o.taxa_de_recorrencia_mesmo_motivo) }));
    const estrelas = rows('distribuicao_de_notas_por_estrela').slice(1).map(r => {
      const m = String(r[0]).match(/\((\d)\)/);
      return m ? { estrelas: Number(m[1]), quantidade: sum(r.slice(1), parseNumber) } : null;
    }).filter(Boolean);

    const avalRows = rows('avaliacao_do_cliente_estrelas').slice(1);
    const pick = (rs, re) => { const r = rs.find(x => re.test(fileKey(x[0]))); return r ? parseNumber(r[1]) : null; };
    const plant = k => rows(k).slice(1);
    const plantao = {
      diurno: pick(plant('plantao_diurno_noturno'), /^diurno/), noturno: pick(plant('plantao_diurno_noturno'), /^noturno/),
      repassado: pick(plant('plantao_resolvidos_repassados'), /^repassado/), resolvido: pick(plant('plantao_resolvidos_repassados'), /^resolvido/)
    };

    const cmpRows = rows('comparativo_de_periodo').slice(1);
    const comparativo = Object.fromEntries(cmpRows.map(r => [fileKey(r[0]), { atual: r[1], anterior: r[2], var: r[3] }]));

    const kpis = {
      assumidos: parseNumber(kv('atendimentos_assumidos').v), finalizados: parseNumber(kv('atendimentos_finalizados').v),
      clientes: parseNumber(kv('clientes_atendidos').v),
      tme: parseDuration(kv('tme_tempo_medio_de_espera').v), tmi: parseDuration(kv('tmi_tempo_medio_de_interacao').v),
      tmr: parseDuration(kv('tmr_tempo_medio_de_resolucao').v), score: parseNumber(kv('score_medio_cliente').v),
      inatividadeQtd: parseNumber(kv('encerrados_por_inatividade').v), inatividadePct: parseNumber(card('encerrados_por_inatividade')[1]),
      recorrenciaPct: parseNumber(kv('taxa_de_recorrencia').v), slaPlantaoPct: parseNumber(kv('sla_do_plantao_2h').v),
      avaliados: pick(avalRows, /^atendimentos_avaliados/), naoAvaliados: pick(avalRows, /nao_avaliados/),
      comTme: sum(rows('tempo_de_fila_por_faixa').slice(1), r => sum(r.slice(1), parseNumber)),
      linhasAnaliseLivre: Math.max(0, rows('analise_livre').length - 1),
      pontosVolume12m: Math.max(0, rows('volume_assumidos_vs_finalizados_12_meses').length - 2),
      custoMedio: parseNumber((rows('custo_medio_por_atendimento')[1] || [])[0]),
      custoIntegracoes: parseNumber((rows('custo_com_integracoes')[1] || [])[0])
    };
    if (kpis.assumidos == null || kpis.finalizados == null) throw new Error('Não encontrei os totais de assumidos e finalizados.');

    const pacote = {
      periodoInicio: datas[0], periodoFim: datas[datas.length - 1], semanaInicio: semanaInicio(datas[0]),
      kpis, comparativo, dias, heat, deptos, colabs, motivos, recorrencia, estrelas, plantao
    };
    pacote.conferencia = conferir(pacote, Object.values(by).join('\n'));
    return pacote;
  }

  // ---------- conferência ----------
  function conferir(p, textoBruto) {
    const out = []; const k = p.kpis;
    const ok = (titulo, texto) => out.push({ tipo: 'ok', titulo, texto });
    const aviso = (titulo, texto) => out.push({ tipo: 'aviso', titulo, texto });

    const somas = [
      ['dias (assumidos)', sum(p.dias, d => d.assumidos), k.assumidos], ['dias (finalizados)', sum(p.dias, d => d.finalizados), k.finalizados],
      ['atendentes (assumidos)', sum(p.colabs, c => c.assumidos), k.assumidos], ['atendentes (finalizados)', sum(p.colabs, c => c.finalizados), k.finalizados],
      ['departamentos (assumidos)', sum(p.deptos, d => d.assumidos), k.assumidos], ['departamentos (finalizados)', sum(p.deptos, d => d.finalizados), k.finalizados]
    ];
    const bad = somas.filter(([, a, b]) => a !== b);
    if (bad.length) aviso('Totais não batem', bad.map(([n, a, b]) => `${n}: ${a} contra ${b} no cartão`).join('; ') + '.');
    else ok('Totais batem', `Dias, atendentes e departamentos somam ${k.assumidos} assumidos e ${k.finalizados} finalizados, igual aos cartões.`);

    const cmpF = p.comparativo.finalizados && parseNumber(p.comparativo.finalizados.atual);
    if (cmpF != null && cmpF !== k.finalizados)
      aviso('Comparativo de período', `A linha Finalizados do comparativo mostra ${cmpF} e o cartão principal mostra ${k.finalizados}. O comparativo pode estar usando outro recorte de datas.`);

    if (k.pontosVolume12m < 2)
      aviso('Volume dos 12 meses', `O gráfico de 12 meses trouxe ${k.pontosVolume12m} ponto(s). Esperava-se uma série mensal; confira o filtro de período do volume.`);

    if (k.comTme != null && k.assumidos && k.comTme / k.assumidos < 0.5)
      aviso('Espera média (TME)', `Só ${k.comTme} de ${k.assumidos} atendimentos têm tempo de espera (${Math.round(k.comTme / k.assumidos * 100)}%). O TME é uma média dessa parte.`);

    if (k.inatividadePct != null && k.inatividadePct >= 50)
      aviso('Resolução média (TMR)', `${k.inatividadePct}% dos atendimentos foram encerrados por inatividade. O TMR reflete em boa parte o prazo do fechamento automático.`);

    if (k.linhasAnaliseLivre && k.linhasAnaliseLivre < k.assumidos)
      aviso('Análise livre incompleta', `A tabela detalhada tem ${k.linhasAnaliseLivre} linhas para ${k.assumidos} atendimentos. Provável limite de linhas na exportação.`);

    const estrelasTotal = sum(p.estrelas, e => e.quantidade);
    if (k.avaliados != null && p.estrelas.length && estrelasTotal !== k.avaliados)
      aviso('Avaliações', `A distribuição por estrela soma ${estrelasTotal}, e o cartão informa ${k.avaliados} avaliados.`);

    if (/\b\d+:\d{2}:60\b|\d+m60s|\d+h60m/.test(textoBruto || ''))
      aviso('Formatação de tempos', 'Há tempos com 60 segundos (por exemplo 23:04:60). É arredondamento da exportação e foi tratado na leitura.');

    if (k.custoMedio == null) aviso('Custos em branco', 'O custo médio por atendimento veio vazio no export.');

    const dias = (Date.parse(p.periodoFim) - Date.parse(p.periodoInicio)) / 86400000 + 1;
    if (dias > 7) aviso('Período maior que uma semana', `Os dados cobrem ${dias} dias (${p.periodoInicio} a ${p.periodoFim}). Para a evolução semanal, exporte com o filtro de uma semana.`);
    return out;
  }

  // ---------- ligação com o cadastro do app ----------
  // infoMap: { "Nome Completo": { nivel: "N2", ... } } (formato de dbColabInfoLoad)
  function ligarColaboradores(colabs, infoMap) {
    const porChave = {};
    Object.keys(infoMap || {}).forEach(nome => { (porChave[firstNameKey(nome)] = porChave[firstNameKey(nome)] || []).push(nome); });
    return colabs.map(c => {
      const cands = porChave[c.chave] || [];
      if (cands.length === 1) return { ...c, nomeApp: cands[0], nivel: String((infoMap[cands[0]] || {}).nivel || '').trim().toUpperCase(), ligacao: 'ok' };
      return { ...c, nomeApp: '', nivel: '', ligacao: cands.length > 1 ? 'ambigua' : 'sem_cadastro' };
    });
  }

  const api = { fileKey, firstNameKey, parseCsv, parseNumber, parseDuration, formatDuration, semanaInicio, parsePacote, conferir, ligarColaboradores };
  root.OpaSemanalParse = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);
