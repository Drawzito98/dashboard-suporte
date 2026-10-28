/* Shared keyboard behavior for legacy overlays and horizontal table regions. */
(function () {
  'use strict';
  const selector = '.colab-detail-overlay, .modal-overlay, .kpi-drill-overlay, .rs-modal-overlay';
  const scrollSelector = '.table-wrap, .ranking-table-wrap, .pp-table, .projecao-table-scroll, .ponto-table, .diag-scroll, .panorama-table-wrap';
  const opened = new Map(), scrollRegions = new WeakMap();
  let stack = [], scheduled = false;
  function visible(element) {
    return element.isConnected && !element.hidden && element.getClientRects().length > 0 &&
      getComputedStyle(element).visibility !== 'hidden' && getComputedStyle(element).opacity !== '0';
  }
  function nativeModal() { return document.querySelector('dialog:modal'); }
  function paletteOpen() { return document.querySelector('.command-palette-overlay:not([hidden])'); }
  function items(dialog) {
    return [...dialog.querySelectorAll('button, a[href], input, select, textarea, [tabindex], [contenteditable="true"]')]
      .filter(element => !element.disabled && !element.closest('[inert]') && element.tabIndex >= 0 && visible(element));
  }
  function focusDialog(dialog) {
    if (!dialog.hasAttribute('tabindex')) dialog.tabIndex = -1;
    (items(dialog)[0] || dialog).focus({ preventScroll: true });
  }
  function top() { return stack[stack.length - 1]; }
  function syncDialogs() {
    const before = top();
    const visibleDialogs = [...document.querySelectorAll(selector)].filter(visible);
    stack = stack.filter(dialog => visibleDialogs.includes(dialog));
    for (const dialog of visibleDialogs) {
      if (opened.has(dialog)) continue;
      opened.set(dialog, document.activeElement);
      stack.push(dialog);
      dialog.setAttribute('role', 'dialog');
      dialog.setAttribute('aria-modal', 'true');
      if (!nativeModal() && !paletteOpen()) focusDialog(dialog);
    }
    document.body.classList.toggle('has-accessible-dialog', stack.length > 0);
    for (const [dialog, opener] of opened) {
      if (visibleDialogs.includes(dialog)) continue;
      opened.delete(dialog);
      if (dialog === before && !nativeModal() && !paletteOpen()) {
        if (opener?.isConnected && visible(opener) && (!top() || top().contains(opener))) opener.focus({ preventScroll: true });
        else if (top()) focusDialog(top());
      }
    }
  }
  function syncTables() {
    for (const region of document.querySelectorAll(scrollSelector)) {
      const overflow = region.scrollWidth > region.clientWidth + 1 && visible(region);
      if (overflow && !scrollRegions.has(region)) {
        const added = [];
        for (const [key, value] of [['tabindex', '0'], ['role', 'region'], ['aria-label', region.dataset.scrollLabel || region.querySelector('caption')?.textContent.trim() || 'Tabela com rolagem horizontal']]) {
          if (!region.hasAttribute(key)) { region.setAttribute(key, value); added.push(key); }
        }
        scrollRegions.set(region, added);
      } else if (!overflow && scrollRegions.has(region)) {
        scrollRegions.get(region).forEach(key => region.removeAttribute(key));
        scrollRegions.delete(region);
      }
    }
  }
  function schedule() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => { scheduled = false; syncDialogs(); syncTables(); });
  }
  // Capture owns Escape so historical document listeners cannot close underlying editors.
  document.addEventListener('keydown', event => {
    if (!['Escape', 'Tab'].includes(event.key)) return;
    if (paletteOpen()) {
      if (event.key === 'Escape' && typeof window.closeAdminCommandPalette === 'function') { event.preventDefault(); event.stopImmediatePropagation(); window.closeAdminCommandPalette(); }
      return;
    }
    if (nativeModal()) {
      if (event.key === 'Escape') event.stopImmediatePropagation(); // browser cancel + module guard remain authoritative
      return;
    }
    syncDialogs();
    const dialog = top();
    if (!dialog) return;
    if (event.key === 'Escape') {
      event.preventDefault(); event.stopImmediatePropagation();
      dialog.querySelector('.colab-detail-close, .modal-close, .rs-modal-close, .kpi-drill-close, [data-close], [aria-label*="Fechar"]')?.click();
      return;
    }
    const controls = items(dialog), first = controls[0], last = controls[controls.length - 1];
    if (!first) { event.preventDefault(); focusDialog(dialog); }
    else if (!dialog.contains(document.activeElement)) { event.preventDefault(); (event.shiftKey ? last : first).focus(); }
    else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }, true);
  document.addEventListener('focusin', event => {
    if (top() && !nativeModal() && !paletteOpen() && !top().contains(event.target)) focusDialog(top());
  });
  function init() {
    new MutationObserver(schedule).observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'hidden', 'open'] });
    window.addEventListener('resize', schedule);
    if (typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver(schedule);
      observer.observe(document.body);
    }
    schedule();
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
