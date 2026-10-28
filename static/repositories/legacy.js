// Persistência de legacy; contratos preservados pelo facade db-extra.js.
(function (root) {
// ─── MIGRAÇÃO ÚNICA localStorage → Supabase ──────────────────────
// Executa uma vez para migrar dados antigos que estão apenas no localStorage


async function migrateLocalToSupabase() {
  if (!sbClient) return;
  try {
    if (appStorage.getItem(MIGRATION_FLAG_KEY)) return;
    const uid = await _getUserId();
    if (!uid) return;

    // Metas
    const metasRaw = appStorage.getItem(METAS_LOCAL_KEY);
    if (metasRaw) {
      const metas = JSON.parse(metasRaw);
      if (Array.isArray(metas) && metas.length > 0) {
        const { data: existing } = await sbClient.from('metas').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbMetasSave(metas);
        }
      }
    }

    // Comentários
    const comRaw = appStorage.getItem(COMENTARIOS_LOCAL_KEY);
    if (comRaw) {
      const com = JSON.parse(comRaw);
      if (typeof com === 'object' && Object.keys(com).length > 0) {
        const { data: existing } = await sbClient.from('comentarios').select('id').limit(1);
        if (!existing || existing.length === 0) {
          const rows = [];
          for (const mes of Object.keys(com)) {
            for (const c of com[mes]) {
              rows.push({ mes, texto: c.texto, user_email: c.user || '' });
            }
          }
          if (rows.length) await sbClient.from('comentarios').insert(rows);
        }
      }
    }

    // Histórico
    const histRaw = appStorage.getItem(HISTORICO_LOCAL_KEY);
    if (histRaw) {
      const hist = JSON.parse(histRaw);
      if (Array.isArray(hist) && hist.length > 0) {
        const { data: existing } = await sbClient.from('historico').select('id').limit(1);
        if (!existing || existing.length === 0) {
          const rows = hist.map(h => ({
            action: h.action || '',
            colaborador: h.colaborador || '',
            mes: h.mes || '',
            campo: h.campo || '',
            before_value: h.before || '',
            after_value: h.after || '',
            detalhes: h.detalhes || '',
            user_email: h.user || ''
          }));
          if (rows.length) await sbClient.from('historico').insert(rows);
        }
      }
    }

    // Scoring rules
    const scoreRaw = appStorage.getItem(SCORING_LOCAL_KEY);
    if (scoreRaw) {
      const rules = JSON.parse(scoreRaw);
      if (Array.isArray(rules) && rules.length > 0) {
        const { data: existing } = await sbClient.from('scoring_config').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbScoringSave(rules);
        }
      }
    }

    // Alertas config
    const alertRaw = appStorage.getItem(ALERTAS_LOCAL_KEY);
    if (alertRaw) {
      const config = JSON.parse(alertRaw);
      if (Array.isArray(config) && config.length > 0) {
        const { data: existing } = await sbClient.from('alertas_config').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbAlertasSave(config);
        }
      }
    }

    // Fotos
    const fotosRaw = appStorage.getItem(FOTOS_LOCAL_KEY);
    if (fotosRaw) {
      const fotos = JSON.parse(fotosRaw);
      if (typeof fotos === 'object' && Object.keys(fotos).length > 0) {
        const { data: existing } = await sbClient.from('colaborador_fotos').select('id').limit(1);
        if (!existing || existing.length === 0) {
          for (const nome of Object.keys(fotos)) {
            if (fotos[nome]) {
              await sbClient.from('colaborador_fotos').insert({ nome, foto_url: fotos[nome] });
            }
          }
        }
      }
    }

    // Inativos
    const inatRaw = appStorage.getItem(INATIVOS_LOCAL_KEY);
    if (inatRaw) {
      const names = JSON.parse(inatRaw);
      if (Array.isArray(names) && names.length > 0) {
        const { data: existing } = await sbClient.from('colab_inativos').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbInativosSave(new Set(names));
        }
      }
    }

    // Setores inativos
    const setorInatRaw = appStorage.getItem(INATIVOS_SETORES_LOCAL_KEY);
    if (setorInatRaw) {
      const names = JSON.parse(setorInatRaw);
      if (Array.isArray(names) && names.length > 0) {
        const { data: existing } = await sbClient.from('setor_inativos').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          await dbSetorInativosSave(new Set(names));
        }
      }
    }

    // Feedbacks
    const fbRaw = appStorage.getItem(FEEDBACKS_LOCAL_KEY);
    if (fbRaw) {
      const fb = JSON.parse(fbRaw);
      if (Array.isArray(fb) && fb.length > 0) {
        const { data: existing } = await sbClient.from('feedbacks').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const f of fb) {
            await sbClient.from('feedbacks').insert({
              user_id: uid,
              colaborador: f.colaborador || '',
              mes: f.mes || '',
              sugestao_automatica: f.sugestao_automatica || '',
              anotacoes: f.anotacoes || '',
              feedback_final: f.feedback_final || ''
            });
          }
        }
      }
    }

    // Anotações diárias
    const anotRaw = appStorage.getItem(ANOTACOES_LOCAL_KEY);
    if (anotRaw) {
      const anot = JSON.parse(anotRaw);
      if (Array.isArray(anot) && anot.length > 0) {
        const { data: existing } = await sbClient.from('anotacoes_diarias').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const a of anot) {
            await sbClient.from('anotacoes_diarias').insert({
              user_id: uid,
              data: a.data || '',
              conteudo: a.conteudo || ''
            });
          }
        }
      }
    }

    // Tarefas
    const tarefasRaw = appStorage.getItem(TAREFAS_LOCAL_KEY);
    if (tarefasRaw) {
      const tarefas = JSON.parse(tarefasRaw);
      if (Array.isArray(tarefas) && tarefas.length > 0) {
        const { data: existing } = await sbClient.from('tarefas').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const t of tarefas) {
            await sbClient.from('tarefas').insert({
              user_id: uid,
              titulo: t.titulo || '',
              descricao: t.descricao || '',
              data: t.data || '',
              prioridade: t.prioridade || 'media',
              status: t.status || 'pendente'
            });
          }
        }
      }
    }

    // Pontos Extras
    const peRaw = appStorage.getItem(PONTOS_EXTRAS_LOCAL_KEY);
    if (peRaw) {
      const pe = JSON.parse(peRaw);
      if (Array.isArray(pe) && pe.length > 0) {
        const { data: existing } = await sbClient.from('pontos_extras').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const b of pe) {
            await sbClient.from('pontos_extras').insert({
              user_id: uid,
              colaborador: b.colaborador || '',
              descricao: b.descricao || '',
              pontos: parseFloat(b.pontos) || 0
            });
          }
        }
      }
    }

    // Colaboradores Info
    const ciRaw = appStorage.getItem(COLAB_INFO_LOCAL_KEY);
    if (ciRaw) {
      const ci = JSON.parse(ciRaw);
      if (typeof ci === 'object' && Object.keys(ci).length > 0) {
        const { data: existing } = await sbClient.from('colaboradores_info').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const [nome, info] of Object.entries(ci)) {
            await sbClient.from('colaboradores_info').insert({
              user_id: uid,
              nome,
              data_aniversario: info.data_aniversario || null,
              data_admissao: info.data_admissao || null,
              email: info.email || '',
              setor_atual: info.setor_atual || '',
              tarefas_desempenhadas: info.tarefas_desempenhadas || '',
              objetivos_futuros: info.objetivos_futuros || '',
              observacoes: info.observacoes || '',
              conduta_negativa: info.conduta_negativa || '',
              conduta_motivo: info.conduta_motivo || '',
              feito_relevante: info.feito_relevante || '',
              feito_descricao: info.feito_descricao || '',
              nivel: info.nivel || '',
              ...(info.salario == null || info.salario === '' ? {} : { salario: Number(info.salario) })
            });
          }
        }
      }
    }

    // Ausências
    const ausRaw = appStorage.getItem(AUSENCIAS_LOCAL_KEY);
    if (ausRaw) {
      const aus = JSON.parse(ausRaw);
      if (Array.isArray(aus) && aus.length > 0) {
        const { data: existing } = await sbClient.from('ausencias').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const a of aus) {
            await sbClient.from('ausencias').insert({
              user_id: uid,
              colaborador: a.colaborador || '',
              data: a.data || '',
              periodo: a.periodo || 'dia_inteiro',
              motivo: a.motivo || ''
            });
          }
        }
      }
    }

    // Avaliação de Atendimentos
    const avRaw = appStorage.getItem(AVALIACAO_ATEND_LOCAL_KEY);
    if (avRaw) {
      const av = JSON.parse(avRaw);
      if (Array.isArray(av) && av.length > 0) {
        const { data: existing } = await sbClient.from('avaliacao_atendimentos').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const a of av) {
            await sbClient.from('avaliacao_atendimentos').insert({
              user_id: uid,
              protocolo: a.protocolo || '',
              colaborador: a.colaborador || '',
              nota: parseFloat(a.nota) || 5,
              justa: a.justa !== false,
              resumo: a.resumo || '',
              imagem: a.imagem || ''
            });
          }
        }
      }
    }

    // Férias
    const ferRaw = appStorage.getItem(FERIAS_LOCAL_KEY);
    if (ferRaw) {
      const fer = JSON.parse(ferRaw);
      if (Array.isArray(fer) && fer.length > 0) {
        const { data: existing } = await sbClient.from('ferias').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const f of fer) {
            await sbClient.from('ferias').insert({
              user_id: uid,
              colaborador: f.colaborador || '',
              data_inicio: f.data_inicio || '',
              data_fim: f.data_fim || ''
            });
          }
        }
      }
    }

    // Acompanhamento Diário
    const adRaw = appStorage.getItem(ACOMP_DIARIO_LOCAL_KEY);
    if (adRaw) {
      const ad = JSON.parse(adRaw);
      if (Array.isArray(ad) && ad.length > 0) {
        const { data: existing } = await sbClient.from('acompanhamento_diario').select('id').eq('user_id', uid).limit(1);
        if (!existing || existing.length === 0) {
          for (const a of ad) {
            await sbClient.from('acompanhamento_diario').insert({
              user_id: uid,
              colaborador: a.colaborador || '',
              data: a.data || '',
              setor: a.setor || '',
              assumidos: a.assumidos || 0,
              transferidos: a.transferidos || 0,
              finalizados: a.finalizados || 0,
              nota: a.nota || 0
            });
          }
        }
      }
    }

    appStorage.setItem(MIGRATION_FLAG_KEY, '1');
  } catch (e) { console.warn('[db-extra] migrateLocalToSupabase error:', e); }
}


  root.AppRepositories = root.AppRepositories || {};
  root.AppRepositories.legacy = { migrateLocalToSupabase };
})(window);
