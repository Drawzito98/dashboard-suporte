(function (root) {
  const VALID_ROLES = new Set(['admin', 'viewer', 'colaborador']);

  function getTrustedUserRole(user) {
    const role = user?.app_metadata?.role;
    return VALID_ROLES.has(role) ? role : null;
  }

  function getWorkspaceRole(user) {
    return getTrustedUserRole(user) === 'admin' ? 'admin' : 'colaborador';
  }

  function isTrustedAccountBlocked(user) {
    return getTrustedUserRole(user) !== 'admin' && user?.app_metadata?.ativo === false;
  }

  root.getTrustedUserRole = getTrustedUserRole;
  root.getWorkspaceRole = getWorkspaceRole;
  root.isTrustedAccountBlocked = isTrustedAccountBlocked;

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = { getTrustedUserRole, getWorkspaceRole, isTrustedAccountBlocked };
  }
})(typeof window !== 'undefined' ? window : globalThis);
