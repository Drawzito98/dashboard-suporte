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
      '<th>Email</th><th>Cargo</th><th>Criado em</th><th>Ações</th>',
      '</tr></thead><tbody>',
      ...users.map(u => {
        const created = u.created_at ? new Date(u.created_at).toLocaleString('pt-BR') : '-';
        const email = u.email || u.id;
        const role = u.user_metadata?.role || 'admin';
        const isYou = email === currentEmail;
        const roleLabel = role === 'admin' ? 'Admin' : 'Visualizador';
        const isSelf = isYou;

        return `<tr>
          <td>${escapeHtml(email)}${isYou ? ' <strong>(você)</strong>' : ''}</td>
          <td><span class="role-badge role-${role}">${roleLabel}</span></td>
          <td>${created}</td>
          <td style="display:flex;gap:4px;flex-wrap:wrap">
            <button class="btn-small btn-reset-pwd" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" style="font-size:11px">🔑 Senha</button>
            ${!isSelf ? `<button class="btn-small btn-toggle-role" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" data-role="${role}" style="font-size:11px">${role === 'admin' ? '👁️ Tornar viewer' : '👑 Tornar admin'}</button>` : ''}
            ${!isSelf ? `<button class="btn-small btn-delete-user" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" style="color:var(--danger);font-size:11px">🗑️</button>` : ''}
          </td>
        </tr>`;
      }),
      '</tbody></table></div>'
    ].join('');

    container.innerHTML = html;

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
        const newRole = btn.dataset.role === 'admin' ? 'viewer' : 'admin';
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
  const container = document.getElementById('usuariosContent');
  if (!container) return;

  container.innerHTML = `
    <div class="form-stack" style="max-width:500px;margin-bottom:var(--s-6)">
      <h3 style="margin:0 0 var(--s-3)">Criar novo usuário</h3>
      <label class="field">
        <span>Email</span>
        <input id="novoUserEmail" type="email" placeholder="email@exemplo.com" />
      </label>
      <label class="field">
        <span>Senha</span>
        <input id="novoUserPassword" type="password" placeholder="mínimo 6 caracteres" />
      </label>
      <label class="field">
        <span>Cargo</span>
        <select id="novoUserRole">
          <option value="viewer">Visualizador (só ver dados)</option>
          <option value="admin">Administrador (controle total)</option>
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
        <label class="field">
          <span>Nova senha</span>
          <input id="resetPwdNewPassword" type="password" placeholder="mínimo 6 caracteres" />
        </label>
        <div style="display:flex;gap:var(--s-2);margin-top:var(--s-3)">
          <button class="btn-primary" id="resetPwdConfirmBtn" type="button" style="flex:1;justify-content:center">Salvar</button>
          <button class="btn-small" id="resetPwdCancelBtn" type="button" style="flex:1;justify-content:center">Cancelar</button>
        </div>
        <div id="resetPwdError" class="auth-error hidden"></div>
        <div id="resetPwdSuccess" class="auth-success hidden"></div>
      </div>
    </div>
  `;

  // Bind events
  document.getElementById('novoUserEmail')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('criarUsuarioBtn')?.click();
  });
  document.getElementById('novoUserPassword')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('criarUsuarioBtn')?.click();
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
      const res = await fetch('/api/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await _authHeaders()) },
        body: JSON.stringify({ email, password, role })
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        okEl.textContent = `Usuário "${email}" criado como ${role === 'admin' ? 'Admin' : 'Visualizador'}!`;
        okEl.classList.remove('hidden');
        document.getElementById('novoUserEmail').value = '';
        document.getElementById('novoUserPassword').value = '';
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

  carregarUsuarios();
}

// Hook into tab switching
document.addEventListener('DOMContentLoaded', () => {
  const observer = new MutationObserver(() => {
    const tab = document.querySelector('#tab-usuarios');
    if (tab && tab.classList.contains('active') && !tab.dataset.rendered) {
      tab.dataset.rendered = '1';
      renderUsuariosAba();
    }
  });
  const tabBar = document.getElementById('tabBar');
  if (tabBar) observer.observe(tabBar, { attributes: true, subtree: true });

  document.getElementById('refreshUsuariosBtn')?.addEventListener('click', () => {
    carregarUsuarios();
  });
});
