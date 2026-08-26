// Sistema de autenticação Supabase
let currentUser = null;
let authPromiseResolve = null;

function getCurrentUser() {
  return currentUser;
}
function requireProvisionalPasswordChange(user) {
  if (!user?.user_metadata?.must_change_password) return;
  document.getElementById('provisionalPasswordOverlay')?.remove();
  const overlay = document.createElement('div');
  overlay.id = 'provisionalPasswordOverlay';
  overlay.style.cssText = 'position:fixed;inset:0;z-index:20000;display:grid;place-items:center;padding:18px;background:rgba(10,18,32,.72);backdrop-filter:blur(6px)';
  overlay.innerHTML = '<form id="provisionalPasswordForm" style="width:min(390px,100%);padding:28px;border:1px solid var(--border);border-radius:var(--r-xl);background:var(--bg-surface);box-shadow:var(--shadow-lg)"><span style="display:block;margin-bottom:6px;color:var(--accent);font-size:11px;font-weight:800;text-transform:uppercase">Primeiro acesso</span><h2 style="margin:0 0 6px;color:var(--text-strong)">Crie sua nova senha</h2><p style="margin:0 0 18px;color:var(--text-secondary);font-size:13px">Por segurança, substitua a senha provisória antes de continuar.</p><label class="field"><span>Nova senha</span><input id="provisionalNewPassword" type="password" minlength="8" autocomplete="new-password" required placeholder="mínimo 8 caracteres"></label><label class="field" style="margin-top:10px"><span>Confirmar nova senha</span><input id="provisionalConfirmPassword" type="password" minlength="8" autocomplete="new-password" required></label><div id="provisionalPasswordError" style="min-height:18px;margin-top:8px;color:var(--danger);font-size:12px"></div><button class="btn-primary" type="submit" style="width:100%;justify-content:center;margin-top:6px">Salvar nova senha</button></form>';
  document.body.appendChild(overlay);
  const form = overlay.querySelector('#provisionalPasswordForm');
  const newPassword = overlay.querySelector('#provisionalNewPassword');
  const confirmation = overlay.querySelector('#provisionalConfirmPassword');
  const errorEl = overlay.querySelector('#provisionalPasswordError');
  newPassword.focus();
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (newPassword.value.length < 8) { errorEl.textContent = 'Use pelo menos 8 caracteres.'; return; }
    if (newPassword.value !== confirmation.value) { errorEl.textContent = 'As senhas não coincidem.'; return; }
    if (newPassword.value === '12345678') { errorEl.textContent = 'Escolha uma senha diferente da provisória.'; return; }
    const button = form.querySelector('button');
    button.disabled = true;
    button.textContent = 'Salvando...';
    const metadata = { ...(user.user_metadata || {}), must_change_password: false };
    const { data, error } = await sbClient.auth.updateUser({ password: newPassword.value, data: metadata });
    if (error) {
      errorEl.textContent = error.message || 'Não foi possível alterar a senha.';
      button.disabled = false;
      button.textContent = 'Salvar nova senha';
      return;
    }
    currentUser = data.user || currentUser;
    overlay.remove();
    if (typeof showToast === 'function') showToast('Senha alterada com sucesso.', 'success');
  });
}


async function initAuth() {
  if (!sbClient) return null;

  // Verifica sessão existente
  try {
    const { data: { session: cachedSession } } = await sbClient.auth.getSession();
    let session = cachedSession;
    if (cachedSession?.user) {
      const { data: refreshedData, error: refreshError } = await sbClient.auth.refreshSession();
      if (refreshedData?.session?.user) {
        session = refreshedData.session;
      } else if (refreshError) {
        console.warn("[Auth] Não foi possível renovar a sessão; usando a sessão local:", refreshError.message);
      }
    }
    if (session?.user) {
      currentUser = session.user;
      hideAuthOverlay();
      setTimeout(() => requireProvisionalPasswordChange(currentUser), 0);
      return currentUser;
    }
  } catch (e) {
    console.warn('[Auth] Erro ao verificar sessão:', e);
  }

  // Cria uma Promise que resolve quando o usuário fizer login
  const authPromise = new Promise((resolve) => {
    authPromiseResolve = resolve;
  });

  // Escuta mudanças de auth
  sbClient.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      currentUser = session.user;
      setTimeout(() => requireProvisionalPasswordChange(currentUser), 0);
      hideAuthOverlay();
      if (authPromiseResolve) {
        authPromiseResolve(currentUser);
        authPromiseResolve = null;
      }
    } else {
      currentUser = null;
    }
  });

  showAuthOverlay();
  return authPromise;
}

function showAuthOverlay() {
  const el = document.getElementById('authOverlay');
  if (el) el.style.display = 'flex';
}

function hideAuthOverlay() {
  const el = document.getElementById('authOverlay');
  if (el) el.style.display = 'none';
}

function showAuthError(form, msg) {
  const el = document.getElementById(form === 'login' ? 'loginError' : 'registerError');
  const success = document.getElementById('registerSuccess');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  if (success) success.classList.add('hidden');
}

function showAuthSuccess(msg) {
  const el = document.getElementById('registerSuccess');
  const err = document.getElementById('registerError');
  if (el) { el.textContent = msg; el.classList.remove('hidden'); }
  if (err) err.classList.add('hidden');
}

function setAuthLoading(loading) {
  const loader = document.getElementById('authLoading');
  const form = document.querySelector('.auth-form');
  if (loader) loader.classList.toggle('hidden', !loading);
  if (form) form.style.display = loading ? 'none' : '';
}

document.addEventListener('DOMContentLoaded', () => {
  const loginTab = document.getElementById('authLoginTab');
  const registerTab = document.getElementById('authRegisterTab');
  const loginForm = document.getElementById('authLoginForm');
  const registerForm = document.getElementById('authRegisterForm');

  if (loginTab && registerTab) {
    loginTab.addEventListener('click', () => {
      loginTab.classList.add('active');
      registerTab.classList.remove('active');
      loginForm.style.display = '';
      registerForm.style.display = 'none';
      document.getElementById('loginError').classList.add('hidden');
      document.getElementById('registerError').classList.add('hidden');
      document.getElementById('registerSuccess').classList.add('hidden');
    });
    registerTab.addEventListener('click', () => {
      registerTab.classList.add('active');
      loginTab.classList.remove('active');
      registerForm.style.display = '';
      loginForm.style.display = 'none';
      document.getElementById('loginError').classList.add('hidden');
      document.getElementById('registerError').classList.add('hidden');
      document.getElementById('registerSuccess').classList.add('hidden');
    });
  }

  const loginBtn = document.getElementById('loginBtn');
  if (loginBtn) {
    loginBtn.addEventListener('click', async () => {
      const email = document.getElementById('loginEmail').value.trim().toLowerCase();
      const password = document.getElementById('loginPassword').value;
      if (!email || !password) { showAuthError('login', 'Preencha email e senha.'); return; }
      setAuthLoading(true);
      showAuthError('login', '');
      try {
        const { data: currentSessionData } = await sbClient.auth.getSession();
        const sessionEmail = String(currentSessionData?.session?.user?.email || '').toLowerCase();
        if (sessionEmail && sessionEmail !== email) await sbClient.auth.signOut({ scope: 'local' });
        const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
        if (error) {
          setAuthLoading(false);
          showAuthError('login', error.message === 'Invalid login credentials' ? 'Email ou senha incorretos.' : error.message);
          return;
        }
        if (String(data?.user?.email || '').toLowerCase() !== email) {
          await sbClient.auth.signOut({ scope: 'local' });
          setAuthLoading(false);
          showAuthOverlay();
          showAuthError('login', 'A sessão aberta não corresponde ao e-mail informado. Entre novamente.');
          return;
        }
        setAuthLoading(false);
      } catch (e) {
        setAuthLoading(false);
        showAuthError('login', 'Erro de conexão. Tente novamente.');
        console.warn('[Auth] Erro no login:', e);
      }
    });
  }

  const registerBtn = document.getElementById('registerBtn');
  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const email = document.getElementById('registerEmail').value.trim();
      const name = document.getElementById('registerName')?.value.trim();
      const password = document.getElementById('registerPassword').value;
      if (!email || !password) { showAuthError('register', 'Preencha email e senha.'); return; }
      if (password.length < 6) { showAuthError('register', 'Senha deve ter no mínimo 6 caracteres.'); return; }
      setAuthLoading(true);
      showAuthError('register', '');
      try {
        const { data, error } = await sbClient.auth.signUp({ email, password, options: { data: { name } } });
        setAuthLoading(false);
        if (error) {
          showAuthError('register', error.message);
        } else if (data?.user?.identities?.length === 0) {
          showAuthError('register', 'Este email já está cadastrado.');
        } else {
          showAuthSuccess('Conta criada! Verifique seu email para confirmar o cadastro.');
        }
      } catch (e) {
        setAuthLoading(false);
        showAuthError('register', 'Erro de conexão. Tente novamente.');
        console.warn('[Auth] Erro no cadastro:', e);
      }
    });
  }

  const logoutButtons = [
    document.getElementById('logoutBtn'),
    document.getElementById('switchAccountBtn'),
    document.getElementById('chatLogoutBtn')
  ].filter(Boolean);
  logoutButtons.forEach((logoutBtn) => {
    logoutBtn.addEventListener('click', async () => {
      logoutButtons.forEach(button => { button.disabled = true; });
      try {
        const { error } = await sbClient.auth.signOut({ scope: 'local' });
        if (error) throw error;
      } catch (e) {
        console.warn('[Auth] Erro no logout:', e);
      }
      currentUser = null;
      sessionStorage.removeItem('blocked_error_shown');
      window.location.replace(window.location.pathname + window.location.search);
    });
  });

  // ── Esqueci minha senha ──
  const forgotPwdBtn = document.getElementById('forgotPwdBtn');
  const forgotForm = document.getElementById('authForgotForm');
  const forgotBackBtn = document.getElementById('forgotBackBtn');
  const forgotSendBtn = document.getElementById('forgotSendBtn');

  if (forgotPwdBtn && forgotForm && loginForm) {
    forgotPwdBtn.addEventListener('click', () => {
      loginForm.style.display = 'none';
      forgotForm.style.display = '';
      document.getElementById('forgotEmail').value = document.getElementById('loginEmail').value;
      document.getElementById('forgotError').classList.add('hidden');
      document.getElementById('forgotSuccess').classList.add('hidden');
    });
    forgotBackBtn?.addEventListener('click', () => {
      forgotForm.style.display = 'none';
      loginForm.style.display = '';
      document.getElementById('forgotError').classList.add('hidden');
      document.getElementById('forgotSuccess').classList.add('hidden');
    });
    forgotSendBtn?.addEventListener('click', async () => {
      const email = document.getElementById('forgotEmail').value.trim();
      const errEl = document.getElementById('forgotError');
      const sucEl = document.getElementById('forgotSuccess');
      if (!email) { if (errEl) { errEl.textContent = 'Digite seu email.'; errEl.classList.remove('hidden'); } return; }
      if (errEl) errEl.classList.add('hidden');
      if (sucEl) sucEl.classList.add('hidden');
      setAuthLoading(true);
      try {
        const { error } = await sbClient.auth.resetPasswordForEmail(email, {
          redirectTo: window.location.origin
        });
        setAuthLoading(false);
        if (error) {
          if (errEl) { errEl.textContent = error.message; errEl.classList.remove('hidden'); }
        } else {
          if (sucEl) {
            sucEl.textContent = 'Email de recuperação enviado! Verifique sua caixa de entrada.';
            sucEl.classList.remove('hidden');
          }
        }
      } catch (e) {
        setAuthLoading(false);
        if (errEl) { errEl.textContent = 'Erro de conexão. Tente novamente.'; errEl.classList.remove('hidden'); }
        console.warn('[Auth] Erro na recuperação de senha:', e);
      }
    });
  }

  // Enter key nos campos de login/register
  document.getElementById('loginPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') loginBtn?.click();
  });
  document.getElementById('registerPassword')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') registerBtn?.click();
  });
  document.getElementById('forgotEmail')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') forgotSendBtn?.click();
  });
});
