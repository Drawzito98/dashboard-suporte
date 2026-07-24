// ─── Month Filters ─────────────────────────────────────────
function getActiveMonths() {
  if (mesSelect && mesSelect.value === '__multi__') {
    return Array.isArray(selectedMonths) ? selectedMonths.filter(Boolean) : [];
  }
  if (mesSelect && mesSelect.value && mesSelect.value !== 'all') return [mesSelect.value];
  return [];
}

function monthFilterActive() {
  return getActiveMonths().length > 0;
}

function monthMatches(value) {
  const months = getActiveMonths();
  if (!months.length) return true;
  return months.includes(String(value));
}

function getMonthScopeLabel() {
  const months = getActiveMonths().slice().sort();
  if (!months.length) return 'Todos';
  if (months.length === 1) return months[0];
  return `${months[0]} → ${months[months.length - 1]} (${months.length} meses)`;
}

function syncMonthPickerVisibility() {
  if (!monthPicker || !mesSelect) return;
  monthPicker.classList.toggle('hidden', mesSelect.value !== '__multi__');
}

function renderMonthChips() {
  if (!monthChips) return;
  if (!selectedMonths.length) {
    monthChips.innerHTML = '<span class="badge">Nenhum mês marcado</span>';
    return;
  }
  monthChips.innerHTML = selectedMonths.slice().sort().map(m => `<span class="chip">${escapeHtml(m)} <button data-month="${escapeHtml(m)}" class="chip-remove">×</button></span>`).join(' ');
  Array.from(monthChips.querySelectorAll('.chip-remove')).forEach(btn => {
    btn.addEventListener('click', (e) => {
      const val = e.target.getAttribute('data-month');
      selectedMonths = selectedMonths.filter(m => m !== val);
      const checkbox = monthChecklist && monthChecklist.querySelector(`input[value="${CSS.escape(val)}"]`);
      if (checkbox) checkbox.checked = false;
      renderMonthChips();
      updateFilterOptions();
      updateView();
    });
  });
}

function renderMonthPickerOptions() {
  if (!monthChecklist) return;
  const meses = uniqueSorted(rawRecords.map(r => r['Mês']));
  monthChecklist.innerHTML = meses.map(m => `
<label class="month-option"><input type="checkbox" class="month-checkbox" value="${escapeHtml(m)}" ${selectedMonths.includes(m) ? 'checked' : ''}/><span>${escapeHtml(m)}</span></label>`).join('');
  monthChecklist.querySelectorAll('.month-checkbox').forEach(chk => {
    chk.addEventListener('change', (e) => {
      const val = String(e.target.value);
      if (e.target.checked) {
        if (!selectedMonths.includes(val)) selectedMonths.push(val);
      } else {
        selectedMonths = selectedMonths.filter(m => m !== val);
      }
      selectedMonths.sort();
      renderMonthChips();
      updateFilterOptions();
      updateView();
    });
  });
  renderMonthChips();
  syncMonthPickerVisibility();
}
