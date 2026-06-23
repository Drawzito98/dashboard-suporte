// Sistema de autenticação Supabase
let currentUser = null;
let authPromiseResolve = null;

function getCurrentUser() {
  return currentUser;
}

async function initAuth() {
  if (!sbClient) return null;

  // Verifica sessão existente
  const { data: { session } } = await sbClient.auth.getSession();
  if (session?.user) {
    currentUser = session.user;
    hideAuthOverlay();
    return currentUser;
  }

  // Cria uma Promise que resolve quando o usuário fizer login
  const authPromise = new Promise((resolve) => {
    authPromiseResolve = resolve;
  });

  // Escuta mudanças de auth
  sbClient.auth.onAuthStateChange((event, session) => {
    if (session?.user) {
      currentUser = session.user;
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
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value;
      if (!email || !password) { showAuthError('login', 'Preencha email e senha.'); return; }
      setAuthLoading(true);
      showAuthError('login', '');
      const { data, error } = await sbClient.auth.signInWithPassword({ email, password });
      setAuthLoading(false);
      if (error) {
        showAuthError('login', error.message === 'Invalid login credentials'
          ? 'Email ou senha incorretos.'
          : error.message);
      }
    });
  }

  const registerBtn = document.getElementById('registerBtn');
  if (registerBtn) {
    registerBtn.addEventListener('click', async () => {
      const email = document.getElementById('registerEmail').value.trim();
      const password = document.getElementById('registerPassword').value;
      if (!email || !password) { showAuthError('register', 'Preencha email e senha.'); return; }
      if (password.length < 6) { showAuthError('register', 'Senha deve ter no mínimo 6 caracteres.'); return; }
      setAuthLoading(true);
      showAuthError('register', '');
      const { data, error } = await sbClient.auth.signUp({ email, password });
      setAuthLoading(false);
      if (error) {
        showAuthError('register', error.message);
      } else if (data?.user?.identities?.length === 0) {
        showAuthError('register', 'Este email já está cadastrado.');
      } else {
        showAuthSuccess('Conta criada! Verifique seu email para confirmar o cadastro.');
      }
    });
  }

  const logoutBtn = document.getElementById('logoutBtn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async () => {
      await sbClient.auth.signOut();
      currentUser = null;
      window.location.reload();
    });
  }

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
