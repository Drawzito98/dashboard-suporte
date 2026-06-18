// Gerenciamento de usuários (via API serverless Vercel)
async function carregarUsuarios() {
  const container = document.getElementById('usuariosContent');
  if (!container) return;
  container.innerHTML = '<p style="text-align:center;padding:var(--s-4);color:var(--text-muted)">Carregando...</p>';

  try {
    const res = await fetch('/api/users');
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

    const html = [
      '<div class="table-wrap"><table><thead><tr>',
      '<th>Email</th><th>Criado em</th><th>Último login</th><th>Ações</th>',
      '</tr></thead><tbody>',
      ...users.map(u => {
        const created = u.created_at ? new Date(u.created_at).toLocaleString('pt-BR') : '-';
        const lastLogin = u.last_sign_in_at ? new Date(u.last_sign_in_at).toLocaleString('pt-BR') : 'Nunca';
        const email = u.email || u.id;
        return `<tr>
          <td>${escapeHtml(email)}</td>
          <td>${created}</td>
          <td>${lastLogin}</td>
          <td><button class="btn-small btn-delete-user" data-id="${escapeHtml(u.id)}" data-email="${escapeHtml(email)}" style="color:var(--danger)">Remover</button></td>
        </tr>`;
      }),
      '</tbody></table></div>'
    ].join('');

    container.innerHTML = html;
    container.querySelectorAll('.btn-delete-user').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        const email = btn.dataset.email;
        if (!confirm(`Remover usuário "${email}"? Esta ação não pode ser desfeita.`)) return;
        btn.disabled = true;
        btn.textContent = 'Removendo...';
        const res = await fetch('/api/users', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id })
        });
        if (res.ok) {
          carregarUsuarios();
        } else {
          const d = await res.json();
          alert('Erro ao remover: ' + (d.error || 'desconhecido'));
          btn.disabled = false;
          btn.textContent = 'Remover';
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
      <button class="btn-primary" id="criarUsuarioBtn" type="button" style="width:100%;justify-content:center">Criar usuário</button>
      <div id="novoUserError" class="auth-error hidden"></div>
      <div id="novoUserSuccess" class="auth-success hidden"></div>
    </div>
    <hr style="margin:var(--s-4) 0;border-color:var(--border)">
    <h3 style="margin:0 0 var(--s-3)">Usuários cadastrados</h3>
    <div id="listaUsuarios"></div>
  `;

  document.getElementById('novoUserEmail')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('criarUsuarioBtn')?.click();
  });
  document.getElementById('novoUserPassword')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('criarUsuarioBtn')?.click();
  });

  document.getElementById('criarUsuarioBtn')?.addEventListener('click', async () => {
    const email = document.getElementById('novoUserEmail').value.trim();
    const password = document.getElementById('novoUserPassword').value;
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (res.ok && !data.error) {
        okEl.textContent = `Usuário "${email}" criado com sucesso!`;
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

  document.getElementById('listaUsuarios').innerHTML = '<p style="text-align:center;color:var(--text-muted)">Carregando...</p>';
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
