window.ChartTheme = {
  isDark: () => document.documentElement.getAttribute('data-theme') === 'dark',

  text: () => ChartTheme.isDark() ? '#e2e8f0' : '#1e293b',
  muted: () => ChartTheme.isDark() ? '#8892a6' : '#64748b',
  strong: () => ChartTheme.isDark() ? '#f8fafc' : '#0f172a',
  border: () => ChartTheme.isDark() ? '#1f2a40' : '#e2e8f0',

  grid: () => ChartTheme.isDark() ? 'rgba(148,163,184,0.15)' : 'rgba(148,163,184,0.12)',
  gridStrong: () => ChartTheme.isDark() ? 'rgba(148,163,184,0.28)' : 'rgba(148,163,184,0.22)',

  accent: () => ChartTheme.isDark() ? '#60a5fa' : '#2563eb',
  success: () => ChartTheme.isDark() ? '#34d399' : '#059669',
  warning: () => ChartTheme.isDark() ? '#fbbf24' : '#d97706',
  danger: () => ChartTheme.isDark() ? '#f87171' : '#dc2626',

  surface: () => ChartTheme.isDark() ? '#131c2f' : '#ffffff',
  canvas: () => ChartTheme.isDark() ? '#0f172a' : '#ffffff',

  tooltip: (opts) => Object.assign({
    backgroundColor: ChartTheme.surface(),
    titleColor: ChartTheme.strong(),
    bodyColor: ChartTheme.text(),
    borderColor: ChartTheme.border(),
    borderWidth: 1,
    padding: 10,
    cornerRadius: 8,
    boxPadding: 6,
    usePointStyle: true
  }, opts || {}),

  applyDefaults: function() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = ChartTheme.text();
    Chart.defaults.borderColor = ChartTheme.border();
  },

  datasetColors: function(count) {
    const isDark = ChartTheme.isDark();
    if (isDark) {
      const palette = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#67e8f9', '#fda4af', '#c4b5fd', '#86efac'];
      return palette.slice(0, count);
    }
    const palette = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#e11d48', '#8b5cf6', '#059669'];
    return palette.slice(0, count);
  },

  neutralPalette: function(count) {
    const isDark = ChartTheme.isDark();
    if (isDark) {
      const p = ['#60a5fa', '#34d399', '#fbbf24', '#a78bfa', '#fb923c', '#67e8f9', '#fda4af', '#c4b5fd', '#86efac', '#f97316'];
      return p.slice(0, count);
    }
    const p = ['#2563eb', '#059669', '#d97706', '#7c3aed', '#ea580c', '#0891b2', '#e11d48', '#8b5cf6', '#16a34a', '#f97316'];
    return p.slice(0, count);
  },

  dataLabelsDefaults: function() {
    return {
      color: ChartTheme.strong(),
      font: { weight: 'bold', size: 12 },
      backgroundColor: ChartTheme.surface(),
      borderRadius: 4,
      padding: { top: 4, bottom: 4, left: 6, right: 6 }
    };
  },

  green: () => ChartTheme.isDark() ? 'rgba(52,211,153,0.8)' : 'rgba(5,150,105,0.8)',
  blue: () => ChartTheme.isDark() ? 'rgba(96,165,250,0.8)' : 'rgba(37,99,235,0.8)',
  orange: () => ChartTheme.isDark() ? 'rgba(251,146,60,0.8)' : 'rgba(234,88,12,0.8)',
  amber: () => ChartTheme.isDark() ? 'rgba(251,191,36,0.8)' : 'rgba(217,119,6,0.8)',
  purple: () => ChartTheme.isDark() ? 'rgba(167,139,250,0.8)' : 'rgba(124,58,237,0.8)',
  red: () => ChartTheme.isDark() ? 'rgba(248,113,113,0.8)' : 'rgba(220,38,38,0.8)',
  teal: () => ChartTheme.isDark() ? 'rgba(45,212,191,0.8)' : 'rgba(13,148,136,0.8)',
  indigo: () => ChartTheme.isDark() ? 'rgba(129,140,248,0.8)' : 'rgba(99,102,241,0.8)',
};
