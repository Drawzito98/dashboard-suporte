const { getTrustedUserRole, getWorkspaceRole, isTrustedAccountBlocked } = require('../static/auth-policy.js');

module.exports = ({ describe, it, assert }) => {
  describe('auth policy', () => {
    it('recognizes admin only from protected metadata', () => {
      assert.equal(getTrustedUserRole({ app_metadata: { role: 'admin' } }), 'admin');
      assert.equal(getWorkspaceRole({ app_metadata: { role: 'admin' } }), 'admin');
    });

    it('ignores a role forged in editable user metadata', () => {
      const user = { app_metadata: {}, user_metadata: { role: 'admin' } };
      assert.equal(getTrustedUserRole(user), null);
      assert.equal(getWorkspaceRole(user), 'colaborador');
    });

    it('keeps viewer and collaborator out of admin workspace', () => {
      assert.equal(getWorkspaceRole({ app_metadata: { role: 'viewer' } }), 'colaborador');
      assert.equal(getWorkspaceRole({ app_metadata: { role: 'colaborador' } }), 'colaborador');
    });

    it('blocks inactive non-admin accounts', () => {
      assert.equal(isTrustedAccountBlocked({ app_metadata: { role: 'viewer', ativo: false } }), true);
      assert.equal(isTrustedAccountBlocked({ app_metadata: { role: 'colaborador', ativo: false } }), true);
    });

    it('does not let an inactive flag lock the principal admin out', () => {
      assert.equal(isTrustedAccountBlocked({ app_metadata: { role: 'admin', ativo: false } }), false);
    });

    it('defaults unknown and missing roles to the restricted workspace', () => {
      assert.equal(getTrustedUserRole({ app_metadata: { role: 'owner' } }), null);
      assert.equal(getWorkspaceRole(null), 'colaborador');
    });
  });
};
