/* Preferência visual da tabela; mantém os registros e a exportação completos. */
(function () {
  'use strict';
  const storageKey = 'sistema_preview_hidden_columns_v1';
  let hidden = new Set();
  try {
    const saved = JSON.parse(localStorage.getItem(storageKey) || '[]');
    if (Array.isArray(saved)) hidden = new Set(saved.filter(value => typeof value === 'string'));
  } catch (_) {}
  document.addEventListener('click', event => {
    const control = document.getElementById('previewColumnsControl');
    if (control?.open && !control.contains(event.target)) control.open = false;
  });
  document.addEventListener('keydown', event => {
    const control = document.getElementById('previewColumnsControl');
    if (event.key === 'Escape' && control?.open) { control.open = false; control.querySelector('summary')?.focus(); }
  });
  function columnsFor(keys) {
    const columns = [];
    keys.forEach(key => {
      columns.push({ id: key, label: key });
      if (key === 'Finalizados' || key === 'SCORE') columns.push({ id: `variation:${key}`, label: `Variação de ${key === 'SCORE' ? 'Score' : key}` });
      if (key === 'Total') columns.push({ id: 'sparkline:Total', label: 'Gráfico de evolução' });
    });
    if (keys.length) columns.push({ id: 'status:actions', label: 'Status e ações' });
    return columns;
  }
  window.applyPreviewColumns = function (tableRoot, keys) {
    const control = document.getElementById('previewColumnsControl');
    const list = document.getElementById('previewColumnsList');
    const count = document.getElementById('previewColumnsCount');
    const reset = document.getElementById('previewColumnsReset');
    if (!control || !list) return;
    const columns = columnsFor(keys);
    control.hidden = !columns.length;
    if (!columns.length) { list.replaceChildren(); return; }
    // Uma preferência antiga nunca deixa a tabela inteira vazia.
    if (columns.every(column => hidden.has(column.id))) hidden.delete(columns[0].id);
    tableRoot.querySelectorAll('tr').forEach(row => {
      [...row.cells].forEach((cell, index) => { if (columns[index]) cell.dataset.previewColumn = columns[index].id; });
    });
    function persist() { try { localStorage.setItem(storageKey, JSON.stringify([...hidden])); } catch (_) {} }
    function apply() {
      tableRoot.querySelectorAll('[data-preview-column]').forEach(cell => { cell.hidden = hidden.has(cell.dataset.previewColumn); });
      const visible = columns.filter(column => !hidden.has(column.id)).length;
      count.textContent = `${visible}/${columns.length}`;
      list.querySelectorAll('input').forEach(input => {
        input.checked = !hidden.has(input.dataset.column);
        input.disabled = input.checked && visible === 1;
      });
      reset.disabled = visible === columns.length;
      if (typeof syncScrollbar === 'function') syncScrollbar();
    }
    list.replaceChildren();
    columns.forEach(column => {
      const label = document.createElement('label');
      const input = document.createElement('input'); input.type = 'checkbox'; input.dataset.column = column.id;
      const text = document.createElement('span'); text.textContent = column.label;
      label.append(input, text); list.append(label);
      input.addEventListener('change', () => {
        if (input.checked) hidden.delete(column.id); else hidden.add(column.id);
        apply(); persist();
      });
    });
    reset.onclick = () => { hidden.clear(); apply(); persist(); };
    apply();
  };
})();
