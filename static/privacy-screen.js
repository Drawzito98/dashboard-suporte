// Proteção visual rápida para ambientes compartilhados.
(function initPrivacyScreen() {
  const button = document.getElementById('privacyScreenToggle');
  if (!button) return;
  const storageKey = 'dashboard_privacy_screen_on';

  function setProtected(protectedMode) {
    document.body.classList.toggle('privacy-screen-on', protectedMode);
    button.setAttribute('aria-pressed', String(protectedMode));
    button.setAttribute('aria-label', protectedMode ? 'Mostrar dados da tela' : 'Ocultar dados da tela');
    button.title = protectedMode ? 'Mostrar dados da tela' : 'Ocultar dados da tela';
    localStorage.setItem(storageKey, protectedMode ? '1' : '0');
  }

  button.addEventListener('click', () => {
    setProtected(!document.body.classList.contains('privacy-screen-on'));
  });

  setProtected(localStorage.getItem(storageKey) === '1');
})();
