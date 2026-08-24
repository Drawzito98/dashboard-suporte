// Proteção visual rápida para ambientes compartilhados.
(function initPrivacyScreen() {
  const button = document.getElementById('privacyScreenToggle');
  if (!button) return;

  function setProtected(protectedMode) {
    document.body.classList.toggle('privacy-screen-on', protectedMode);
    button.setAttribute('aria-pressed', String(protectedMode));
    button.setAttribute('aria-label', protectedMode ? 'Mostrar dados da tela' : 'Ocultar dados da tela');
    button.title = protectedMode ? 'Mostrar dados da tela' : 'Ocultar dados da tela';
  }

  button.addEventListener('click', () => {
    setProtected(!document.body.classList.contains('privacy-screen-on'));
  });

  // Se o usuário mudar de aplicativo ou aba, a tela volta protegida.
  document.addEventListener('visibilitychange', () => {
    const appVisible = document.getElementById('appScreen')?.style.display !== 'none';
    if (document.hidden && appVisible) setProtected(true);
  });
})();
