// Gerenciamento de usuários (via API serverless Vercel)
let editingUserId = null;

async function getCurrentUserRole() {
  try {
    const { data: { user } } = await sbClient.auth.getUser();
    return user?.user_metadata?.role || 'admin';
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

async function carregarUsuarios() {
  const container = document.getElementById('listaUsuarios');
  if (!container) return;
  if (!requireAdmin()) { container.innerHTML = '<p style="text-align:center;padding:var(--s-4);color:var(--text-muted)">Sem permissão.</p>'; return; }
  container.innerHTML = '<p style="text-align:center;padding:var(--s-4);color:var(--text-muted)">Carregando...</p>';

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
      container.innerHTML = '<p style="text-align:center;padding:var(--s-4);color:var(--text-muted)">Nenhum usuário encontrado.</p>';
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
        const role = u.user_metadata?.role || 'admin';
        const isYou = email === currentEmail;
        const roleLabel = role === 'admin' ? 'Admin' : role === 'colaborador' ? 'Colaborador' : 'Visualizador';
        const isSelf = isYou;
        const csvNome = u.user_metadata?.csv_nome || '';
        const csvSetor = u.user_metadata?.csv_setor || '';

        return `<tr>
          <td>${escapeHtml(name) || '<span style="color:var(--text-muted);font-style:italic">—</span>'}</td>
          <td>${escapeHtml(email)}${isYou ? ' <strong>(você)</strong>' : ''}</td>
          <td><span class="role-badge role-${role}">${roleLabel}</span></td>
          <td>${created}</td>
          <td style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn-small btn-edit-name" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-name="${escapeHtml(name)}" style="font-size:11px">✏️ Nome</button>
            <button class="btn-small btn-reset-pwd" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" style="font-size:11px">🔑 Senha</button>
            ${role === 'colaborador' && !isSelf ? `<button class="btn-small btn-csv-map" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-csv-nome="${escapeHtml(csvNome)}" data-csv-setor="${escapeHtml(csvSetor)}" style="font-size:11px">📋 Vincular CSV</button>` : ''}
            ${!isSelf ? `<button class="btn-small btn-reset-default" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" style="font-size:11px">🔢 Padrão</button>` : ''}
            ${!isSelf ? `<button class="btn-small btn-toggle-role" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-role="${role}" style="font-size:11px">${role === 'admin' ? '👁️ Tornar viewer' : role === 'colaborador' ? '👁️ Tornar viewer' : '👑 Tornar admin'}</button>` : ''}
            ${!isSelf && role !== 'colaborador' ? `<button class="btn-small btn-toggle-colab" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-role="${role}" style="font-size:11px">📬 Tornar colaborador</button>` : ''}
            ${!isSelf ? `<button class="btn-small btn-toggle-block" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-ativo="${u.user_metadata?.ativo !== false}" style="font-size:11px">${u.user_metadata?.ativo === false ? '🔓 Desbloquear' : '🔒 Bloquear'}</button>` : ''}
            ${!isSelf ? `<button class="btn-small btn-delete-user" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" style="color:var(--danger);font-size:11px">🗑️</button>` : ''}
          </td>
        </tr>`;
      }),
      '</tbody></table></div>'
    ].join('');

    container.innerHTML = html;

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
        document.getElementById('csvMapSetor').value = btn.dataset.csvSetor;
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
    <div class="form-stack" style="max-width:500px;margin-bottom:var(--s-6)">
      <h3 style="margin:0 0 var(--s-3)">Criar novo usuário</h3>
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
          <option value="admin">Administrador (controle total)</option>
          <option value="viewer">Visualizador (só ver dados)</option>
          <option value="colaborador">Colaborador (próprios dados)</option>
        </select>
      </label>
      <label class="field" id="csvColabField" style="display:none">
        <span>Colaborador do CSV</span>
        <select id="novoUserCsvColab">
          <option value="">Selecione...</option>
        </select>
      </label>
      <button class="btn-primary" id="criarUsuarioBtn" type="button" style="width:100%;justify-content:center">Criar usuário</button>
      <div id="novoUserError" class="auth-error hidden"></div>
      <div id="novoUserSuccess" class="auth-success hidden"></div>
    </div>
    <hr style="margin:var(--s-4) 0;border-color:var(--border)">
    <h3 style="margin:0 0 var(--s-3)">Usuários cadastrados</h3>
    <div id="listaUsuarios"></div>

    <!-- Reset Password Overlay -->
    <div id="resetPwdOverlay" class="hidden" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
      <div style="background:var(--bg-surface);border-radius:var(--r-lg);padding:var(--s-6);max-width:400px;width:90%;box-shadow:var(--shadow-lg)">
        <h3 style="margin:0 0 var(--s-2)">Redefinir senha</h3>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin:0 0 var(--s-4)">
          Usuário: <strong id="resetPwdEmail"></strong>
        </p>
        <label class="field" style="position:relative">
          <span>Nova senha</span>
          <input id="resetPwdNewPassword" type="password" placeholder="mínimo 6 caracteres" />
          <span id="resetPwdToggle" style="position:absolute;right:8px;bottom:6px;cursor:pointer;font-size:18px;user-select:none" title="Mostrar/esconder senha">👁️</span>
        </label>
        <div style="display:flex;gap:var(--s-2);margin-top:var(--s-3)">
          <button class="btn-primary" id="resetPwdConfirmBtn" type="button" style="flex:1;justify-content:center">Salvar</button>
          <button class="btn-small" id="resetPwdCancelBtn" type="button" style="flex:1;justify-content:center">Cancelar</button>
        </div>
        <div id="resetPwdError" class="auth-error hidden"></div>
        <div id="resetPwdSuccess" class="auth-success hidden"></div>
      </div>
    </div>

    <!-- CSV Map Overlay -->
    <div id="csvMapOverlay" class="hidden" style="position:fixed;inset:0;z-index:9999;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
      <div style="background:var(--bg-surface);border-radius:var(--r-lg);padding:var(--s-6);max-width:420px;width:90%;box-shadow:var(--shadow-lg)">
        <h3 style="margin:0 0 var(--s-2)">Vincular colaborador ao CSV</h3>
        <p style="font-size:0.875rem;color:var(--text-secondary);margin:0 0 var(--s-4)">
          Usuário: <strong id="csvMapUserEmail"></strong>
        </p>
        <input type="hidden" id="csvMapUserId" />
        <label class="field">
          <span>Nome exato no CSV</span>
          <input id="csvMapNome" type="text" placeholder="Ex: João Silva" />
        </label>
        <label class="field">
          <span>Setor (opcional)</span>
          <input id="csvMapSetor" type="text" placeholder="Ex: Suporte N1" />
        </label>
        <div style="display:flex;gap:var(--s-2);margin-top:var(--s-3)">
          <button class="btn-primary" id="csvMapSalvarBtn" type="button" style="flex:1;justify-content:center">Salvar</button>
          <button class="btn-small" id="csvMapCancelarBtn" type="button" style="flex:1;justify-content:center">Cancelar</button>
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
    if (document.getElementById('novoUserRole').value === 'colaborador') {
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
      const colabInfo = JSON.parse(localStorage.getItem('sistema_colaboradores_info_v1') || '{}');
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
      if (role === 'colaborador') {
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
        body: JSON.stringify({ id, csv_nome: csvNome, csv_setor: csvSetor || null })
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
  content.innerHTML = '<div class="card" style="padding:var(--s-5)"><div class="skeleton skeleton-title"></div><div class="skeleton skeleton-line"></div><div class="skeleton skeleton-line"></div></div>';
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
