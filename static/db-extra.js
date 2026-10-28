// Facade de compatibilidade. Implementações isoladas por domínio e carregadas sob demanda.
// ─── Helpers internos ────────────────────────────────────────────
// _uid() e _email() mantidos como fallback; _getUserId/_getUserEmail são usados no resto do arquivo

async function _uid() {
  return typeof _getUserId === 'function' ? _getUserId() : (async () => { try { const u = await sbClient?.auth?.getUser(); return u?.data?.user?.id ?? null; } catch { return null; } })();
}

async function _email() {
  return typeof _getUserEmail === 'function' ? _getUserEmail() : (async () => { try { const u = await sbClient?.auth?.getUser(); return u?.data?.user?.email ?? null; } catch { return null; } })();
}

async function _getUserId() {
  try {
    const token = typeof AppDataSession !== 'undefined' ? AppDataSession.token() : null;
    const { data } = await sbClient.auth.getUser();
    if (token && (!AppDataSession.current(token) || token.owner !== data?.user?.id)) return null;
    return data?.user?.id || null;
  } catch { return null; }
}

async function _getUserEmail() {
  try {
    const { data } = await sbClient.auth.getUser();
    return data?.user?.email || '';
  } catch { return ''; }
}


// ─── FALLBACK ────────────────────────────────────────────────────

function _fallbackLoad(key, defaultVal) {
  try {
    const raw = appStorage.getItem(key);
    return raw ? JSON.parse(raw) : defaultVal;
  } catch { return defaultVal; }
}


const METAS_LOCAL_KEY = 'sistema_metas_v1';
const SCORING_LOCAL_KEY = 'sistema_scoring_rules_v1';
const ALERTAS_LOCAL_KEY = 'sistema_alertas_config_v1';
const PONTOS_EXTRAS_LOCAL_KEY = 'sistema_pontos_extras_v1';
const FOTOS_LOCAL_KEY = 'sistema_colab_fotos_v1';
const INATIVOS_LOCAL_KEY = 'sistema_inactive_colabs_v1';
const INATIVOS_SETORES_LOCAL_KEY = 'sistema_inactive_setores_v1';
const COLAB_INFO_LOCAL_KEY = 'sistema_colaboradores_info_v1';
const FEEDBACKS_LOCAL_KEY = 'sistema_feedbacks_v1';
const ANOTACOES_LOCAL_KEY = 'sistema_anotacoes_diarias_v1';
const TAREFAS_LOCAL_KEY = 'sistema_tarefas_v1';
const REGRAS_LOCAL_KEY = 'sistema_regras_v1';
const AUSENCIAS_LOCAL_KEY = 'sistema_ausencias_v1';
const AVALIACAO_ATEND_LOCAL_KEY = 'sistema_avaliacao_atendimentos_v1';
const FERIAS_LOCAL_KEY = 'sistema_ferias_v1';
const ACOMP_DIARIO_LOCAL_KEY = 'sistema_acompanhamento_diario_v1';
const COMENTARIOS_LOCAL_KEY = 'sistema_comentarios_v1';
const HISTORICO_LOCAL_KEY = 'sistema_historico_v1';
const MIGRATION_FLAG_KEY = 'sistema_migrated_to_supabase_v1';

// A chamada pertence à sessão que a iniciou, inclusive durante o download do domínio.
async function _loadDataDomain(name) {
  const token = typeof AppDataSession !== 'undefined' ? AppDataSession.token() : null;
  await FeatureLoader.ensure(name);
  if (token && !AppDataSession.current(token)) throw new Error('Sessão alterada durante o carregamento.');
}

async function dbMetasLoad(...args) {
  await _loadDataDomain("data-performance");
  return AppRepositories.performance.dbMetasLoad(...args);
}
async function dbMetasSave(...args) {
  await _loadDataDomain("data-performance");
  return AppRepositories.performance.dbMetasSave(...args);
}
async function dbScoringLoad(...args) {
  await _loadDataDomain("data-performance");
  return AppRepositories.performance.dbScoringLoad(...args);
}
async function dbScoringSave(...args) {
  await _loadDataDomain("data-performance");
  return AppRepositories.performance.dbScoringSave(...args);
}
async function dbAlertasLoad(...args) {
  await _loadDataDomain("data-performance");
  return AppRepositories.performance.dbAlertasLoad(...args);
}
async function dbAlertasSave(...args) {
  await _loadDataDomain("data-performance");
  return AppRepositories.performance.dbAlertasSave(...args);
}
async function dbPontosExtrasLoad(...args) {
  await _loadDataDomain("data-performance");
  return AppRepositories.performance.dbPontosExtrasLoad(...args);
}
async function dbPontosExtrasSave(...args) {
  await _loadDataDomain("data-performance");
  return AppRepositories.performance.dbPontosExtrasSave(...args);
}
async function dbPontosExtrasDelete(...args) {
  await _loadDataDomain("data-performance");
  return AppRepositories.performance.dbPontosExtrasDelete(...args);
}
async function dbFotosLoad(...args) {
  await _loadDataDomain("data-people");
  return AppRepositories.people.dbFotosLoad(...args);
}
async function dbFotoSave(...args) {
  await _loadDataDomain("data-people");
  return AppRepositories.people.dbFotoSave(...args);
}
async function dbInativosLoad(...args) {
  await _loadDataDomain("data-people");
  return AppRepositories.people.dbInativosLoad(...args);
}
async function dbInativosSave(...args) {
  await _loadDataDomain("data-people");
  return AppRepositories.people.dbInativosSave(...args);
}
async function dbSetorInativosLoad(...args) {
  await _loadDataDomain("data-people");
  return AppRepositories.people.dbSetorInativosLoad(...args);
}
async function dbSetorInativosSave(...args) {
  await _loadDataDomain("data-people");
  return AppRepositories.people.dbSetorInativosSave(...args);
}
async function dbColabInfoLoad(...args) {
  await _loadDataDomain("data-people");
  return AppRepositories.people.dbColabInfoLoad(...args);
}
async function dbColabInfoSave(...args) {
  await _loadDataDomain("data-people");
  return AppRepositories.people.dbColabInfoSave(...args);
}
async function dbFeedbacksLoad(...args) {
  await _loadDataDomain("data-development");
  return AppRepositories.development.dbFeedbacksLoad(...args);
}
async function dbFeedbacksSave(...args) {
  await _loadDataDomain("data-development");
  return AppRepositories.development.dbFeedbacksSave(...args);
}
async function dbFeedbacksDelete(...args) {
  await _loadDataDomain("data-development");
  return AppRepositories.development.dbFeedbacksDelete(...args);
}
async function dbAnotacoesLoad(...args) {
  await _loadDataDomain("data-routine");
  return AppRepositories.routine.dbAnotacoesLoad(...args);
}
async function dbAnotacoesSave(...args) {
  await _loadDataDomain("data-routine");
  return AppRepositories.routine.dbAnotacoesSave(...args);
}
async function dbAnotacoesDelete(...args) {
  await _loadDataDomain("data-routine");
  return AppRepositories.routine.dbAnotacoesDelete(...args);
}
async function dbTarefasLoad(...args) {
  await _loadDataDomain("data-routine");
  return AppRepositories.routine.dbTarefasLoad(...args);
}
async function dbTarefasSave(...args) {
  await _loadDataDomain("data-routine");
  return AppRepositories.routine.dbTarefasSave(...args);
}
async function dbTarefasDelete(...args) {
  await _loadDataDomain("data-routine");
  return AppRepositories.routine.dbTarefasDelete(...args);
}
async function dbRegrasLoad(...args) {
  await _loadDataDomain("data-routine");
  return AppRepositories.routine.dbRegrasLoad(...args);
}
async function dbRegrasSave(...args) {
  await _loadDataDomain("data-routine");
  return AppRepositories.routine.dbRegrasSave(...args);
}
async function dbRegrasDelete(...args) {
  await _loadDataDomain("data-routine");
  return AppRepositories.routine.dbRegrasDelete(...args);
}
async function dbAusenciasLoad(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbAusenciasLoad(...args);
}
async function dbAusenciasSave(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbAusenciasSave(...args);
}
async function dbAusenciasDelete(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbAusenciasDelete(...args);
}
async function dbAvaliacaoAtendLoad(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbAvaliacaoAtendLoad(...args);
}
async function dbAvaliacaoAtendSave(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbAvaliacaoAtendSave(...args);
}
async function dbAvaliacaoAtendDelete(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbAvaliacaoAtendDelete(...args);
}
async function dbFeriasLoad(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbFeriasLoad(...args);
}
async function dbFeriasSave(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbFeriasSave(...args);
}
async function dbFeriasDelete(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbFeriasDelete(...args);
}
async function dbAcompDiarioLoad(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbAcompDiarioLoad(...args);
}
async function dbAcompDiarioSave(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbAcompDiarioSave(...args);
}
async function dbAcompDiarioDelete(...args) {
  await _loadDataDomain("data-attendance");
  return AppRepositories.attendance.dbAcompDiarioDelete(...args);
}
async function dbComentariosLoad(...args) {
  await _loadDataDomain("data-audit");
  return AppRepositories.audit.dbComentariosLoad(...args);
}
async function dbComentarioAdd(...args) {
  await _loadDataDomain("data-audit");
  return AppRepositories.audit.dbComentarioAdd(...args);
}
async function dbComentarioDel(...args) {
  await _loadDataDomain("data-audit");
  return AppRepositories.audit.dbComentarioDel(...args);
}
async function dbHistoricoLoad(...args) {
  await _loadDataDomain("data-audit");
  return AppRepositories.audit.dbHistoricoLoad(...args);
}
async function dbHistoricoAdd(...args) {
  await _loadDataDomain("data-audit");
  return AppRepositories.audit.dbHistoricoAdd(...args);
}
async function migrateLocalToSupabase(...args) {
  await _loadDataDomain("data-legacy");
  return AppRepositories.legacy.migrateLocalToSupabase(...args);
}

// ─── INIT ────────────────────────────────────────────────────────
// Chamado pelo app.js no DOMContentLoaded para carregar dados do Supabase
async function initDbExtra() {
  if (!sbClient) return;
  try {
    // Unowned historical browser data is preserved, never uploaded automatically.
    await Promise.allSettled([
      dbMetasLoad(),
      dbComentariosLoad(),
      dbHistoricoLoad(),
      dbScoringLoad(),
      dbAlertasLoad(),
      dbFotosLoad(),
      dbInativosLoad(),
      dbSetorInativosLoad(),
      dbFeedbacksLoad(),
      dbAnotacoesLoad(),
      dbTarefasLoad(),
      dbRegrasLoad(),
      dbPontosExtrasLoad(),
      dbColabInfoLoad(),
      typeof dbAvaliacoesLoad === 'function' ? dbAvaliacoesLoad() : Promise.resolve(),
      typeof dbReportesListar === 'function' ? dbReportesListar() : Promise.resolve(),
      dbAusenciasLoad(),
      dbAvaliacaoAtendLoad(),
      dbFeriasLoad(),
      dbAcompDiarioLoad()
    ]);
  } catch (e) { console.error('[db-extra]', e); }
}
