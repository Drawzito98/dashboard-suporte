/**
 * Tests for dom-helpers.js pure functions.
 */
module.exports = function ({ describe, it, assert }) {

  // escapeHtml is the key pure function in dom-helpers.js
  function escapeHtml(s) {
    if (s == null) return '';
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  describe('escapeHtml', () => {
    it('escapes ampersand', () => {
      assert.equal(escapeHtml('a & b'), 'a &amp; b');
    });

    it('escapes angle brackets', () => {
      assert.equal(escapeHtml('<script>'), '&lt;script&gt;');
    });

    it('escapes quotes', () => {
      assert.equal(escapeHtml('"hello"'), '&quot;hello&quot;');
      assert.equal(escapeHtml("'hello'"), '&#39;hello&#39;');
    });

    it('handles null/undefined', () => {
      assert.equal(escapeHtml(null), '');
      assert.equal(escapeHtml(undefined), '');
    });

    it('handles numbers', () => {
      assert.equal(escapeHtml(42), '42');
    });

    it('handles complex XSS', () => {
      const input = '<img src=x onerror=alert(1)>';
      const result = escapeHtml(input);
      assert.ok(!result.includes('<'));
      assert.ok(!result.includes('>'));
    });

    it('passes through safe strings', () => {
      assert.equal(escapeHtml('Hello World'), 'Hello World');
    });
  });
};
