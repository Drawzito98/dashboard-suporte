// Declarative dependency inventory; also consumed by release validation.
window.APP_MODULES = {
  "data-attendance": {
    "scripts": [
      "/static/repositories/attendance.js?v=133"
    ],
    "exports": [
      "AppRepositories.attendance.dbAusenciasLoad",
      "AppRepositories.attendance.dbAusenciasSave",
      "AppRepositories.attendance.dbAusenciasDelete",
      "AppRepositories.attendance.dbAvaliacaoAtendLoad",
      "AppRepositories.attendance.dbAvaliacaoAtendSave",
      "AppRepositories.attendance.dbAvaliacaoAtendDelete",
      "AppRepositories.attendance.notifyFeriasUpdated",
      "AppRepositories.attendance.dbFeriasLoad",
      "AppRepositories.attendance.dbFeriasSave",
      "AppRepositories.attendance.dbFeriasDelete",
      "AppRepositories.attendance.dbAcompDiarioLoad",
      "AppRepositories.attendance.dbAcompDiarioSave",
      "AppRepositories.attendance.dbAcompDiarioDelete"
    ]
  },
  "data-audit": {
    "scripts": [
      "/static/repositories/audit.js?v=135"
    ],
    "exports": [
      "AppRepositories.audit.dbComentariosLoad",
      "AppRepositories.audit.dbComentarioAdd",
      "AppRepositories.audit.dbComentarioDel",
      "AppRepositories.audit.dbHistoricoLoad",
      "AppRepositories.audit.dbHistoricoAdd"
    ]
  },
  "data-development": {
    "scripts": [
      "/static/repositories/development.js?v=3"
    ],
    "exports": [
      "AppRepositories.development.dbFeedbacksLoad",
      "AppRepositories.development.dbFeedbacksSave",
      "AppRepositories.development.dbFeedbacksDelete",
      "AppRepositories.development.dbAvaliacoesLoad",
      "AppRepositories.development.dbAvaliacaoSave",
      "AppRepositories.development.dbAvaliacaoStatus",
      "AppRepositories.development.dbAvaliacaoDelete"
    ]
  },
  "data-legacy": {
    "scripts": [
      "/static/repositories/legacy.js?v=1"
    ],
    "exports": [
      "AppRepositories.legacy.migrateLocalToSupabase"
    ]
  },
  "data-people": {
    "scripts": [
      "/static/repositories/people.js?v=131"
    ],
    "exports": [
      "AppRepositories.people.dbFotosLoad",
      "AppRepositories.people.dbFotoSave",
      "AppRepositories.people.dbInativosLoad",
      "AppRepositories.people.dbInativosSave",
      "AppRepositories.people.dbSetorInativosLoad",
      "AppRepositories.people.dbSetorInativosSave",
      "AppRepositories.people.dbColabInfoLoad",
      "AppRepositories.people.dbColabInfoSave",
      "AppRepositories.people.dbColabActivate"
    ]
  },
  "data-performance": {
    "scripts": [
      "/static/repositories/performance.js?v=132"
    ],
    "exports": [
      "AppRepositories.performance.dbMetasLoad",
      "AppRepositories.performance.dbMetasSave",
      "AppRepositories.performance.dbMetasDelete",
      "AppRepositories.performance.dbScoringLoad",
      "AppRepositories.performance.dbScoringSave",
      "AppRepositories.performance.dbAlertasLoad",
      "AppRepositories.performance.dbAlertasSave",
      "AppRepositories.performance.dbPontosExtrasLoad",
      "AppRepositories.performance.dbPontosExtrasSave",
      "AppRepositories.performance.dbPontosExtrasDelete"
    ]
  },
  "data-routine": {
    "scripts": [
      "/static/repositories/routine.js?v=2"
    ],
    "exports": [
      "AppRepositories.routine.dbAnotacoesLoad",
      "AppRepositories.routine.dbAnotacoesSave",
      "AppRepositories.routine.dbAnotacoesDelete",
      "AppRepositories.routine.dbAnotacaoFavorito",
      "AppRepositories.routine.dbTarefasLoad",
      "AppRepositories.routine.dbTarefasSave",
      "AppRepositories.routine.dbTarefasDelete",
      "AppRepositories.routine.dbTarefaStatus",
      "AppRepositories.routine.dbRegrasLoad",
      "AppRepositories.routine.dbRegrasSave",
      "AppRepositories.routine.dbRegrasDelete",
      "AppRepositories.routine.dbRegraMove"
    ]
  },
  "ponto": {
    "scripts": [
      "/static/ponto-engine.js?v=4",
      "/static/ponto.js?v=11"
    ],
    "styles": [
      "/static/ponto.css?v=3"
    ],
    "exports": [
      "onPontoTabActivated",
      "renderPontoProfile",
      "openPontoEmployee",
      "openPontoAnalysis"
    ]
  },
  "pdi": {
    "scripts": [
      "/static/perfil-pdi-engine.js?v=1",
      "/static/perfil-pdi.js?v=7"
    ],
    "styles": [
      "/static/perfil-pdi.css?v=1"
    ],
    "exports": [
      "openPerfilPdi",
      "onPerfilPdiTabActivated"
    ]
  },
  "equipe360": {
    "scripts": [
      "/static/equipe360-data.js?v=1",
      "/static/equipe360.js?v=7"
    ],
    "styles": [
      "/static/equipe360.css?v=2"
    ],
    "exports": [
      "openEquipe360"
    ]
  },
  "panorama": {
    "scripts": [
      "/static/relatorio-setorial.js?v=1360"
    ],
    "styles": [],
    "exports": [
      "onRelatorioSetorialTabActivated"
    ]
  }
};
