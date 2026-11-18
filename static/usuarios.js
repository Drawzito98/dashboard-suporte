// Gerenciamento de usuários (via API serverless Vercel)
let editingUserId = null;

async function getCurrentUserRole() {
  try {
    const { data: { user } } = await sbClient.auth.getUser();
    return user?.app_metadata?.role || 'viewer';
  } catch {
    return 'viewer';
  }
}

async function _authHeaders() {
  try {
    const { data } = await sbClient.auth.getSession();
    const token = data?.session?.access_token;
    return token ? { 'Authorization': `Bearer ${token}` } : {};
  } catch { return {}; }
}


function findCsvSectorByName(name) {
  const target = String(name || '').trim();
  if (!target || typeof rawRecords === 'undefined') return '';
  const match = rawRecords.find(record => String(record?.Atendente || '').trim().localeCompare(target, 'pt-BR', { sensitivity: 'base' }) === 0 && String(record?.Setor || '').trim());
  return String(match?.Setor || '').trim();
}
async function carregarUsuarios() {
  const container = document.getElementById('listaUsuarios');
  if (!container) return;
  if (!requireAdmin()) { container.innerHTML = '<p class="admin-empty">Sem permissão.</p>'; return; }
  container.innerHTML = '<p class="admin-empty">Carregando...</p>';

  try {
    const headers = { ...(await _authHeaders()) };
    const res = await fetch('/api/users', { headers });
    const data = await res.json();

    if (!res.ok || data.error) {
      container.innerHTML = `<div class="auth-error">Erro ao carregar: ${data.error || 'desconhecido'}</div>`;
      return;
    }

    const users = Array.isArray(data) ? data : (data.users || []);
    if (!users.length) {
      container.innerHTML = '<p class="admin-empty">Nenhum usuário encontrado.</p>';
      return;
    }

    // Get current user email to identify admin
    const { data: { user: currentUser } } = await sbClient.auth.getUser();
    const currentEmail = currentUser?.email || '';

    const html = [
      '<div class="table-wrap"><table><thead><tr>',
      '<th>Nome</th><th>Email</th><th>Cargo</th><th>Criado em</th><th>Ações</th>',
      '</tr></thead><tbody>',
      ...users.map(u => {
        const created = u.created_at ? new Date(u.created_at).toLocaleString('pt-BR') : '-';
        const email = u.email || u.id;
        const name = u.user_metadata?.name || '';
        const displayName = name.trim().split(/\s+/)[0] || '';
        const role = u.app_metadata?.role || 'viewer';
        const isYou = email === currentEmail;
        const roleLabel = role === 'admin' ? 'Admin' : role === 'colaborador' ? 'Colaborador' : 'Visualizador';
        const isSelf = isYou;
        const csvNome = u.app_metadata?.csv_nome || u.user_metadata?.csv_nome || '';
        const csvSetor = u.app_metadata?.csv_setor || u.user_metadata?.csv_setor || '';

        return `<tr data-user-role="${role}">
          <td title="${escapeHtml(name)}">${escapeHtml(displayName) || '<span class="users-empty-name">—</span>'}</td>
          <td>${escapeHtml(email)}${isYou ? ' <strong>(você)</strong>' : ''}</td>
          <td><span class="role-badge role-${role}">${roleLabel}</span></td>
          <td>${created}</td>
          <td class="users-actions">
            <button class="btn-small btn-edit-name users-action" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-name="${escapeHtml(name)}"><svg class="ui-icon" aria-hidden="true"><use href="#ui-icon-edit"></use></svg> Nome</button>
            <button class="btn-small btn-reset-pwd users-action" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}">🔑 Senha</button>
            ${role !== 'admin' && !isSelf ? `<button class="btn-small btn-csv-map users-action" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-csv-nome="${escapeHtml(csvNome)}" data-csv-setor="${escapeHtml(csvSetor)}"><svg class="ui-icon" aria-hidden="true"><use href="#ui-icon-clipboard"></use></svg> Vincular CSV</button>` : ''}
            ${!isSelf ? `<button class="btn-small btn-reset-default users-action" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}">🔢 Padrão</button>` : ''}
            ${!isSelf ? `<button class="btn-small btn-toggle-role users-action" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-role="${role}">${role === 'admin' ? '👁️ Tornar viewer' : role === 'colaborador' ? '👁️ Tornar viewer' : '👑 Tornar admin'}</button>` : ''}
            ${!isSelf && role !== 'colaborador' ? `<button class="btn-small btn-toggle-colab users-action" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-role="${role}">📬 Tornar colaborador</button>` : ''}
            ${!isSelf ? `<button class="btn-small btn-toggle-block users-action" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-ativo="${u.app_metadata?.ativo !== false}">${u.app_metadata?.ativo === false ? '🔓 Desbloquear' : '🔒 Bloquear'}</button>` : ''}
            ${!isSelf ? `<button class="btn-small btn-delete-user users-danger-action" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}">🗑️</button>` : ''}
          </td>
        </tr>`;
      }),
      '</tbody></table></div>'
    ].join('');

    container.innerHTML = html;
    const sourceTable = container.querySelector("table");
    const sourceWrap = sourceTable?.closest(".table-wrap");
    if (sourceTable && sourceWrap) {
      const grouped = document.createElement("div");
      grouped.className = "user-role-groups";
      const groupConfig = [
        { role: "admin", label: "Administradores", icon: "👑" },
        { role: "viewer", label: "Visualizadores", icon: "👁️" },
        { role: "colaborador", label: "Colaboradores", icon: "👥" }
      ];
      groupConfig.forEach((group, index) => {
        const rows = [...sourceTable.querySelectorAll(`tbody tr[data-user-role="${group.role}"]`)];
        if (!rows.length) return;
        const details = document.createElement("details");
        details.className = `user-role-group user-role-group-${group.role}`;
        details.open = index === 0;
        const summary = document.createElement("summary");
        summary.innerHTML = `<span><span class="user-role-group-icon">${group.icon}</span><strong>${group.label}</strong></span><span class="user-role-group-count">${rows.length}</span>`;
        const wrap = document.createElement("div");
        wrap.className = "table-wrap user-role-table";
        const table = sourceTable.cloneNode(false);
        table.appendChild(sourceTable.tHead.cloneNode(true));
        const tbody = document.createElement("tbody");
        rows.forEach(row => tbody.appendChild(row));
        table.appendChild(tbody);
        wrap.appendChild(table);
        details.append(summary, wrap);
        grouped.appendChild(details);
      });
      sourceWrap.replaceWith(grouped);
    }

    const bulkCsvButton = document.getElementById('bulkCsvLinkBtn');
    if (bulkCsvButton) bulkCsvButton.onclick = async () => {
      const records = typeof rawRecords !== 'undefined' ? rawRecords : [];
      const csvNames = [...new Set(records.map(record => String(record?.Atendente || '').trim()).filter(name => name && (typeof isAggregateName !== 'function' || !isAggregateName(name)) && (typeof isColabActive !== 'function' || isColabActive(name))))];
      const colabInfo = JSON.parse(appStorage.getItem('sistema_colaboradores_info_v1') || '{}');
      const exactName = value => csvNames.find(name => name.localeCompare(String(value || '').trim(), 'pt-BR', { sensitivity: 'base' }) === 0) || '';
      const registeredEmails = new Set(Object.values(colabInfo).map(info => String(info?.email || '').trim().toLowerCase()).filter(Boolean));
      const teamUsers = users.filter(user => {
        const email = String(user.email || '').toLowerCase();
        const role = user.app_metadata?.role;
        return user.app_metadata?.ativo !== false && email !== currentEmail.toLowerCase() && (role !== 'admin' || registeredEmails.has(email));
      });
      const pending = [];
      const mappings = teamUsers.map(user => {
        const email = String(user.email || '').toLowerCase();
        const registeredName = Object.keys(colabInfo).find(name => String(colabInfo[name]?.email || '').trim().toLowerCase() === email);
        const csvName = exactName(user.app_metadata?.csv_nome || user.user_metadata?.csv_nome) || exactName(user.user_metadata?.name) || exactName(registeredName);
        if (!csvName) pending.push(user.user_metadata?.name || user.email || 'Sem identificação');
        return { user, csvName, sector: findCsvSectorByName(csvName) };
      });
      if (!mappings.length) {
        document.getElementById('syncActiveTeamResult').textContent = 'Nenhum usuário ativo da equipe foi encontrado.';
        return;
      }
      if (!confirm('Padronizar ' + mappings.length + ' acessos como colaborador e aplicar os vínculos CSV identificados?')) return;
      bulkCsvButton.disabled = true;
      bulkCsvButton.textContent = 'Padronizando...';
      let updated = 0;
      const failed = [];
      for (const mapping of mappings) {
        try {
          const response = await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
            body: JSON.stringify({ id: mapping.user.id, role: 'colaborador', ativo: true, ...(mapping.csvName ? { csv_nome: mapping.csvName, csv_setor: mapping.sector || null } : {}) })
          });
          if (response.ok) updated += 1;
          else failed.push(mapping.csvName || mapping.user.user_metadata?.name || mapping.user.email);
        } catch { failed.push(mapping.csvName || mapping.user.user_metadata?.name || mapping.user.email); }
      }
      const resultEl = document.getElementById('syncActiveTeamResult');
      const unresolved = [...new Set([...pending, ...failed])];
      resultEl.innerHTML = '<strong>' + updated + ' acessos padronizados</strong>' + (unresolved.length ? ' · ' + unresolved.length + ' sem vínculo CSV<div class="users-result-note">O desafio e o humor já estão liberados. Revise apenas os resultados mensais de: ' + unresolved.map(escapeHtml).join(', ') + '.</div>' : '<div class="users-result-success">Todos receberam o mesmo acesso e foram vinculados aos resultados.</div>');
      bulkCsvButton.disabled = false;
      bulkCsvButton.textContent = 'Padronizar equipe e CSV';
      carregarUsuarios();
    };

    // Edit name
    container.querySelectorAll('.btn-edit-name').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!requireAdmin()) return;
        const id = btn.dataset.id;
        const currentName = btn.dataset.name || '';
        const newName = prompt('Nome do usuário:', currentName);
        if (newName === null) return;
        if (!newName.trim()) { showToast('Nome não pode ficar vazio.', 'error'); return; }
        btn.disabled = true;
        try {
          const res = await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
            body: JSON.stringify({ id, name: newName.trim() })
          });
          if (res.ok) {
            showToast('Nome atualizado!', 'success');
            carregarUsuarios();
          } else {
            const d = await res.json();
            showToast(d.error || 'Erro ao atualizar nome', 'error');
            btn.disabled = false;
          }
        } catch (e) {
          showToast('Erro de conexão', 'error');
          btn.disabled = false;
        }
      });
    });

    // Password reset default
    container.querySelectorAll('.btn-reset-default').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!requireAdmin()) return;
        if (!confirm(`Redefinir senha de "${btn.dataset.email}" para "12345678"?`)) return;
        btn.disabled = true;
        try {
          const res = await fetch('/api/users', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
            body: JSON.stringify({ id: btn.dataset.id, password: '12345678' })
          });
          if (res.ok) {
            showToast(`Senha de "${btn.dataset.email}" redefinida para 12345678`, 'success');
          } else {
            const d = await res.json();
            showToast(d.error || 'Erro ao redefinir senha', 'error');
          }
        } catch (e) {
          showToast('Erro de conexão', 'error');
        }
        btn.disabled = false;
      });
    });

    // Password reset
    container.querySelectorAll('.btn-reset-pwd').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('resetPwdOverlay').classList.remove('hidden');
        editingUserId = btn.dataset.id;
        document.getElementById('resetPwdEmail').textContent = btn.dataset.email;
        document.getElementById('resetPwdNewPassword').value = '';
        document.getElementById('resetPwdError').classList.add('hidden');
        document.getElementById('resetPwdSuccess').classList.add('hidden');
      });
    });

    // Toggle role
    container.querySelectorAll('.btn-toggle-role').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!requireAdmin()) return;
        const id = btn.dataset.id;
        const newRole = btn.dataset.role === 'colaborador' ? 'viewer' : (btn.dataset.role === 'admin' ? 'viewer' : 'admin');
        if (!confirm(`Alterar ${btn.dataset.email} para "${newRole === 'admin' ? 'Admin' : 'Visualizador'}"?`)) return;
        btn.disabled = true;
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
          body: JSON.stringify({ id, role: newRole })
        });
        if (res.ok) {
          carregarUsuarios();
        } else {
          const d = await res.json();
          alert('Erro: ' + (d.error || 'desconhecido'));
          btn.disabled = false;
        }
      });
    });

    // Toggle colaborador
    container.querySelectorAll('.btn-toggle-colab').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!requireAdmin()) return;
        const id = btn.dataset.id;
        const newRole = 'colaborador';
        if (!confirm(`Alterar ${btn.dataset.email} para "Colaborador"?`)) return;
        btn.disabled = true;
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
          body: JSON.stringify({ id, role: newRole })
        });
        if (res.ok) {
          carregarUsuarios();
        } else {
          const d = await res.json();
          alert('Erro: ' + (d.error || 'desconhecido'));
          btn.disabled = false;
        }
      });
    });

    // Block/Unblock
    container.querySelectorAll('.btn-toggle-block').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!requireAdmin()) return;
        const id = btn.dataset.id;
        const email = btn.dataset.email;
        const isAtivo = btn.dataset.ativo === 'true';
        const acao = isAtivo ? 'BLOQUEAR' : 'DESBLOQUEAR';
        if (!confirm(`${acao} o usuário "${email}"? ${isAtivo ? 'Ele não conseguirá acessar o app até ser desbloqueado.' : 'Ele poderá acessar o app novamente.'}`)) return;
        btn.disabled = true;
        const res = await fetch('/api/users', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
          body: JSON.stringify({ id, ativo: !isAtivo })
        });
        if (res.ok) {
          carregarUsuarios();
        } else {
          const d = await res.json();
          alert('Erro: ' + (d.error || 'desconhecido'));
          btn.disabled = false;
        }
      });
    });

    // CSV mapping overlay
    container.querySelectorAll('.btn-csv-map').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('csvMapOverlay').classList.remove('hidden');
        document.getElementById('csvMapUserId').value = btn.dataset.id;
        document.getElementById('csvMapUserEmail').textContent = btn.dataset.email;
        document.getElementById('csvMapNome').value = btn.dataset.csvNome;
        const namesList = document.getElementById('csvMapNomes');
        if (namesList) {
          const names = [...new Set((typeof rawRecords !== 'undefined' ? rawRecords : [])
            .map(record => String(record?.Atendente || '').trim())
            .filter(name => name && (typeof isAggregateName !== 'function' || !isAggregateName(name))))].sort();
          namesList.innerHTML = names.map(name => '<option value="' + escapeHtml(name) + '"></option>').join('');
        }
        document.getElementById('csvMapSetor').value = findCsvSectorByName(btn.dataset.csvNome) || btn.dataset.csvSetor || '';
        document.getElementById('csvMapError').classList.add('hidden');
        document.getElementById('csvMapSuccess').classList.add('hidden');
      });
    });

    // Delete
    container.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!requireAdmin()) return;
        const id = btn.dataset.id;
        const email = btn.dataset.email;
        if (!confirm(`Remover usuário "${email}"? Esta ação não pode ser desfeita.`)) return;
        btn.disabled = true;
        btn.textContent = '...';
        const res = await fetch('/api/users', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
          body: JSON.stringify({ id })
        });
        if (res.ok) {
          carregarUsuarios();
        } else {
          const d = await res.json();
          alert('Erro ao remover: ' + (d.error || 'desconhecido'));
          btn.disabled = false;
        }
      });
    });
  } catch (e) {
    container.innerHTML = `<div class="auth-error">Erro de conexão: ${e.message}</div>`;
  }
}

function renderUsuariosAba() {
  const container = document.getElementById('usuariosOverlayContent');
  if (!container) return;

  container.innerHTML = `
    <section class="card users-sync-card">
      <div class="users-sync-heading">
        <div><h3 class="users-sync-title">Acessos da equipe ativa</h3><p class="users-sync-description">Cria somente contas ausentes, vinculadas ao e-mail e aos resultados do colaborador.</p></div>
        <div class="users-sync-actions"><button class="btn-small" id="bulkCsvLinkBtn" type="button">Padronizar equipe e CSV</button><button class="btn-primary" id="syncActiveTeamBtn" type="button">Criar acessos ausentes</button></div>
      </div>
      <p class="users-sync-note">Senha provisória: <strong>12345678</strong>. A troca será obrigatória no primeiro acesso.</p>
      <div id="syncActiveTeamResult" class="users-sync-result"></div>
    </section>
    <div class="form-stack users-create-form">
      <h3 class="users-create-title">Criar novo usuário</h3>
      <label class="field">
        <span>Nome</span>
        <input id="novoUserName" type="text" placeholder="Nome do usuário" />
      </label>
      <label class="field">
        <span>Email</span>
        <input id="novoUserEmail" type="email" placeholder="email@exemplo.com" />
      </label>
      <label class="field">
        <span>Senha</span>
        <input id="novoUserPassword" type="text" placeholder="mínimo 6 caracteres" />
      </label>
      <label class="field">
        <span>Cargo</span>
        <select id="novoUserRole">
          <option value="colaborador">Colaborador (próprios dados)</option>
          <option value="viewer">Visualizador (só ver dados)</option>
          <option value="admin">Administrador (controle total)</option>
        </select>
      </label>
      <label class="field" id="csvColabField" style="display:none">
        <span>Colaborador do CSV</span>
        <select id="novoUserCsvColab">
          <option value="">Selecione...</option>
        </select>
      </label>
      <button class="btn-primary admin-full-action" id="criarUsuarioBtn" type="button">Criar usuário</button>
      <div id="novoUserError" class="auth-error hidden"></div>
      <div id="novoUserSuccess" class="auth-success hidden"></div>
    </div>
    <hr class="users-divider">
    <h3 class="users-create-title">Usuários cadastrados</h3>
    <div id="listaUsuarios"></div>

    <!-- Reset Password Overlay -->
    <div id="resetPwdOverlay" class="hidden admin-dialog-overlay">
      <div class="admin-password-panel">
        <h3 class="admin-dialog-title">Redefinir senha</h3>
        <p class="admin-dialog-description">
          Usuário: <strong id="resetPwdEmail"></strong>
        </p>
        <label class="field users-password-field">
          <span>Nova senha</span>
          <input id="resetPwdNewPassword" type="password" placeholder="mínimo 6 caracteres" />
          <span id="resetPwdToggle" title="Mostrar/esconder senha" class="users-password-toggle">👁️</span>
        </label>
        <div class="admin-dialog-actions">
          <button class="btn-primary admin-dialog-action" id="resetPwdConfirmBtn" type="button">Salvar</button>
          <button class="btn-small admin-dialog-action" id="resetPwdCancelBtn" type="button">Cancelar</button>
        </div>
        <div id="resetPwdError" class="auth-error hidden"></div>
        <div id="resetPwdSuccess" class="auth-success hidden"></div>
      </div>
    </div>

    <!-- CSV Map Overlay -->
    <div id="csvMapOverlay" class="hidden admin-dialog-overlay">
      <div class="admin-name-panel">
        <h3 class="admin-dialog-title">Vincular colaborador aos resultados</h3>
        <p class="admin-dialog-description">
          Usuário: <strong id="csvMapUserEmail"></strong>
        </p>
        <input type="hidden" id="csvMapUserId" />
        <label class="field">
          <span>Nome exato no CSV</span>
          <input id="csvMapNome" type="text" list="csvMapNomes" autocomplete="off" placeholder="Selecione ou digite o nome exato" />
          <datalist id="csvMapNomes"></datalist>
        </label>
        <label class="field">
          <span>Setor identificado</span>
          <input id="csvMapSetor" type="text" placeholder="Preenchido automaticamente" />
        </label>
        <div class="admin-dialog-actions">
          <button class="btn-primary admin-dialog-action" id="csvMapSalvarBtn" type="button">Salvar</button>
          <button class="btn-small admin-dialog-action" id="csvMapCancelarBtn" type="button">Cancelar</button>
        </div>
        <div id="csvMapError" class="auth-error hidden"></div>
        <div id="csvMapSuccess" class="auth-success hidden"></div>
      </div>
    </div>
  `;

  // Toggle visibilidade senha no reset
  document.getElementById('resetPwdToggle')?.addEventListener('click', () => {
    const input = document.getElementById('resetPwdNewPassword');
    const icon = document.getElementById('resetPwdToggle');
    if (input.type === 'password') {
      input.type = 'text';
      icon.textContent = '🙈';
    } else {
      input.type = 'password';
      icon.textContent = '👁️';
    }
  });

  // Bind events
  document.getElementById('novoUserEmail')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('criarUsuarioBtn')?.click();
  });
  document.getElementById('novoUserPassword')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('criarUsuarioBtn')?.click();
  });

  // Mostra/esconde select de colaborador CSV conforme cargo
  document.getElementById('novoUserRole')?.addEventListener('change', () => {
    const field = document.getElementById('csvColabField');
    if (!field) return;
    if (document.getElementById('novoUserRole').value !== 'admin') {
      field.style.display = '';
      // Popula dropdown com colaboradores ativos do CSV
      const select = document.getElementById('novoUserCsvColab');
      if (select) {
        const currentVal = select.value;
        select.innerHTML = '<option value="">Selecione...</option>';
        try {
          const nomes = [...new Set((typeof rawRecords !== 'undefined' ? rawRecords : []).filter(r => r && r['Atendente'] && typeof isAggregateName === 'function' && !isAggregateName(r['Atendente']) && typeof isColabActive === 'function' && isColabActive(r['Atendente'])).map(r => r['Atendente']))].sort();
          nomes.forEach(n => {
            const opt = document.createElement('option');
            opt.value = n;
            opt.textContent = n;
            select.appendChild(opt);
          });
        } catch (e) { console.warn('[usuarios] Erro ao carregar CSV names:', e); }
        if (currentVal) select.value = currentVal;
      }
    } else {
      field.style.display = 'none';
    }
  });

  // Quando selecionar nome, sugere email e senha
  document.getElementById('novoUserCsvColab')?.addEventListener('change', () => {
    const nome = document.getElementById('novoUserCsvColab').value;
    if (!nome) return;
    // Busca email do cadastro de Colaboradores
    try {
      const colabInfo = JSON.parse(appStorage.getItem('sistema_colaboradores_info_v1') || '{}');
      const info = colabInfo[nome];
      const emailInput = document.getElementById('novoUserEmail');
      if (info?.email && emailInput && !emailInput.value) {
        emailInput.value = info.email;
      } else if (emailInput && !emailInput.value) {
        const sugerido = nome.toLowerCase().replace(/\s+/g, '.').normalize('NFD').replace(/[\u0300-\u036f]/g, '') + '@exemplo.com';
        emailInput.value = sugerido;
      }
    } catch {}
    const pwdInput = document.getElementById('novoUserPassword');
    if (pwdInput && !pwdInput.value) {
      pwdInput.value = '12345678';
    }
  });

  document.getElementById('syncActiveTeamBtn')?.addEventListener('click', async event => {
    if (!requireAdmin()) return;
    const colabInfo = JSON.parse(appStorage.getItem('sistema_colaboradores_info_v1') || '{}');
    const records = typeof rawRecords !== 'undefined' ? rawRecords : [];
    const recordNames = records.filter(row => row?.Atendente && (typeof isAggregateName !== 'function' || !isAggregateName(row.Atendente))).map(row => String(row.Atendente).trim());
    const names = [...new Set([...recordNames, ...Object.keys(colabInfo)])].filter(name => name && (typeof isColabActive !== 'function' || isColabActive(name))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    const collaborators = names.map(name => {
      const row = records.find(item => String(item?.Atendente || '').trim() === name && item?.Setor);
      return { name, email: String(colabInfo[name]?.email || '').trim(), sector: String(row?.Setor || '').trim() };
    });
    const resultEl = document.getElementById('syncActiveTeamResult');
    if (!collaborators.length) { resultEl.textContent = 'Nenhum colaborador ativo encontrado.'; return; }
    if (!confirm('Criar os acessos ausentes para ' + collaborators.length + ' colaboradores ativos? A senha provisória será 12345678.')) return;
    const button = event.currentTarget;
    button.disabled = true;
    button.textContent = 'Criando acessos...';
    resultEl.textContent = '';
    try {
      const response = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
        body: JSON.stringify({ action: 'sync_active_team', collaborators })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Não foi possível criar os acessos.');
      const skipped = [...(data.skipped || []), ...(data.failed || [])];
      resultEl.innerHTML = '<strong>' + Number(data.created?.length || 0) + ' criados</strong> · ' + Number(data.existing?.length || 0) + ' já existentes · ' + skipped.length + ' pendentes' +
        (skipped.length ? '<div class="users-result-error">' + skipped.map(item => '<div>' + escapeHtml(item.name) + ' (' + escapeHtml(item.email || 'sem e-mail') + '): ' + escapeHtml(item.reason || 'revise o cadastro') + '</div>').join('') + '</div>' : '<div class="users-result-success">Todos os colaboradores ativos possuem acesso.</div>');
      carregarUsuarios();
    } catch (error) {
      resultEl.innerHTML = '<span class="users-danger">' + escapeHtml(error.message) + '</span>';
    }
    button.disabled = false;
    button.textContent = 'Criar acessos ausentes';
  });

  document.getElementById('criarUsuarioBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const email = document.getElementById('novoUserEmail').value.trim();
    const password = document.getElementById('novoUserPassword').value;
    const role = document.getElementById('novoUserRole')?.value || 'viewer';
    const errEl = document.getElementById('novoUserError');
    const okEl = document.getElementById('novoUserSuccess');
    errEl.classList.add('hidden');
    okEl.classList.add('hidden');

    if (!email || !password) { errEl.textContent = 'Preencha email e senha.'; errEl.classList.remove('hidden'); return; }
    if (password.length < 6) { errEl.textContent = 'Senha deve ter no mínimo 6 caracteres.'; errEl.classList.remove('hidden'); return; }

    const btn = document.getElementById('criarUsuarioBtn');
    btn.disabled = true;
    btn.textContent = 'Criando...';

    try {
      const name = document.getElementById('novoUserName')?.value.trim() || '';
      const body = { email, password, role };
      if (name) body.name = name;
      if (role !== 'admin') {
        const csvNome = document.getElementById('novoUserCsvColab')?.value || '';
        if (csvNome) body.csv_nome = csvNome;
      }
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
        body: JSON.stringify(body)
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        okEl.textContent = `Usuário "${email}" criado como ${role === 'admin' ? 'Admin' : role === 'colaborador' ? 'Colaborador' : 'Visualizador'}!`;
        okEl.classList.remove('hidden');
        document.getElementById('novoUserEmail').value = '';
        document.getElementById('novoUserPassword').value = '';
        document.getElementById('novoUserName').value = '';
        document.getElementById('novoUserCsvColab').value = '';
        carregarUsuarios();
      } else {
        errEl.textContent = data.error || data.msg || 'Erro ao criar usuário.';
        errEl.classList.remove('hidden');
      }
    } catch (e) {
      errEl.textContent = 'Erro de conexão: ' + e.message;
      errEl.classList.remove('hidden');
    }
    btn.disabled = false;
    btn.textContent = 'Criar usuário';
  });

  // Password reset overlay
  document.getElementById('resetPwdConfirmBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const pwd = document.getElementById('resetPwdNewPassword').value;
    const errEl = document.getElementById('resetPwdError');
    const okEl = document.getElementById('resetPwdSuccess');
    errEl.classList.add('hidden');
    okEl.classList.add('hidden');

    if (!pwd || pwd.length < 6) { errEl.textContent = 'Senha deve ter no mínimo 6 caracteres.'; errEl.classList.remove('hidden'); return; }

    const btn = document.getElementById('resetPwdConfirmBtn');
    btn.disabled = true;
    btn.textContent = 'Salvando...';

    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
        body: JSON.stringify({ id: editingUserId, password: pwd })
      });
      if (res.ok) {
        okEl.textContent = 'Senha alterada com sucesso!';
        okEl.classList.remove('hidden');
        setTimeout(() => {
          document.getElementById('resetPwdOverlay').classList.add('hidden');
        }, 1500);
      } else {
        const d = await res.json();
        errEl.textContent = d.error || 'Erro ao alterar senha.';
        errEl.classList.remove('hidden');
      }
    } catch (e) {
      errEl.textContent = 'Erro de conexão: ' + e.message;
      errEl.classList.remove('hidden');
    }
    btn.disabled = false;
    btn.textContent = 'Salvar';
  });

  document.getElementById('resetPwdCancelBtn')?.addEventListener('click', () => {
    document.getElementById('resetPwdOverlay').classList.add('hidden');
  });
  document.getElementById('resetPwdNewPassword')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('resetPwdConfirmBtn')?.click();
    if (e.key === 'Escape') document.getElementById('resetPwdOverlay')?.classList.add('hidden');
  });

  // CSV Map overlay
  const csvMapNameInput = document.getElementById('csvMapNome');
  const updateCsvSector = () => {
    const sectorInput = document.getElementById('csvMapSetor');
    const identified = findCsvSectorByName(csvMapNameInput?.value);
    if (sectorInput) sectorInput.value = identified;
  };
  csvMapNameInput?.addEventListener('input', updateCsvSector);
  csvMapNameInput?.addEventListener('change', updateCsvSector);
  document.getElementById('csvMapSalvarBtn')?.addEventListener('click', async () => {
    if (!requireAdmin()) return;
    const id = document.getElementById('csvMapUserId').value;
    const csvNome = document.getElementById('csvMapNome').value.trim();
    const csvSetor = document.getElementById('csvMapSetor').value.trim();
    const errEl = document.getElementById('csvMapError');
    const okEl = document.getElementById('csvMapSuccess');
    errEl.classList.add('hidden');
    okEl.classList.add('hidden');
    if (!csvNome) { errEl.textContent = 'Informe o nome do colaborador no CSV.'; errEl.classList.remove('hidden'); return; }
    const btn = document.getElementById('csvMapSalvarBtn');
    btn.disabled = true;
    btn.textContent = 'Salvando...';
    try {
      const res = await fetch('/api/users', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
        body: JSON.stringify({ id, role: 'colaborador', ativo: true, csv_nome: csvNome, csv_setor: csvSetor || null })
      });
      if (res.ok) {
        okEl.textContent = 'Vínculo salvo!';
        okEl.classList.remove('hidden');
        setTimeout(() => {
          document.getElementById('csvMapOverlay').classList.add('hidden');
          carregarUsuarios();
        }, 1200);
      } else {
        const d = await res.json();
        errEl.textContent = d.error || 'Erro ao salvar.';
        errEl.classList.remove('hidden');
      }
    } catch (e) {
      errEl.textContent = 'Erro de conexão: ' + e.message;
      errEl.classList.remove('hidden');
    }
    btn.disabled = false;
    btn.textContent = 'Salvar';
  });

  document.getElementById('csvMapCancelarBtn')?.addEventListener('click', () => {
    document.getElementById('csvMapOverlay').classList.add('hidden');
  });

  carregarUsuarios();
}

function openUsuariosOverlay() {
  const overlay = document.getElementById('usuariosOverlay');
  if (!overlay) return;
  const content = document.getElementById('usuariosOverlayContent');
  if (!content) return;
  content.innerHTML = '<div class="card admin-content-padding"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>';
  overlay.classList.add('open');
  setTimeout(() => renderUsuariosAba(), 50);
}

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('usuariosBtn')?.addEventListener('click', openUsuariosOverlay);
  document.getElementById('usuariosOverlayClose')?.addEventListener('click', () => {
    document.getElementById('usuariosOverlay')?.classList.remove('open');
  });
  const overlay = document.getElementById('usuariosOverlay');
  overlay?.addEventListener('click', (e) => {
    if (e.target === overlay) overlay.classList.remove('open');
  });
});
