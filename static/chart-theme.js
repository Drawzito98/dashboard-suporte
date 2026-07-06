// Centralized chart theme — reads CSS custom properties for light/dark mode
window.ChartTheme = {
  isDark: () => document.documentElement.getAttribute('data-theme') === 'dark',

  text: () => ChartTheme.isDark() ? '#ffffff' : '#000000',
  muted: () => getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim() || '#94a3b8',
  strong: () => ChartTheme.isDark() ? '#ffffff' : '#000000',
  border: () => getComputedStyle(document.documentElement).getPropertyValue('--border').trim() || (ChartTheme.isDark() ? '#1f2a40' : '#e2e8f0'),

  grid: () => ChartTheme.isDark() ? 'rgba(148,163,184,0.2)' : 'rgba(148,163,184,0.15)',
  gridStrong: () => ChartTheme.isDark() ? 'rgba(148,163,184,0.35)' : 'rgba(148,163,184,0.25)',

  accent: () => getComputedStyle(document.documentElement).getPropertyValue('--accent').trim() || (ChartTheme.isDark() ? '#60a5fa' : '#2563eb'),
  success: () => getComputedStyle(document.documentElement).getPropertyValue('--success').trim() || (ChartTheme.isDark() ? '#34d399' : '#047857'),
  warning: () => getComputedStyle(document.documentElement).getPropertyValue('--warning').trim() || (ChartTheme.isDark() ? '#fbbf24' : '#b45309'),
  danger: () => getComputedStyle(document.documentElement).getPropertyValue('--danger').trim() || (ChartTheme.isDark() ? '#f87171' : '#b91c1c'),

  surface: () => getComputedStyle(document.documentElement).getPropertyValue('--bg-surface').trim() || (ChartTheme.isDark() ? '#131c2f' : '#ffffff'),
  canvas: () => getComputedStyle(document.documentElement).getPropertyValue('--bg-canvas').trim() || (ChartTheme.isDark() ? '#0f172a' : '#ffffff'),

  // Convenience: full tooltip config
  tooltip: (opts) => Object.assign({
    backgroundColor: ChartTheme.surface(),
    titleColor: ChartTheme.strong(),
    bodyColor: ChartTheme.text(),
    borderColor: ChartTheme.border(),
    borderWidth: 1,
    padding: 8,
    cornerRadius: 6,
    boxPadding: 4,
    usePointStyle: true
  }, opts || {}),

  // Chart.js defaults updater — call after theme change
  applyDefaults: function() {
    if (typeof Chart === 'undefined') return;
    Chart.defaults.color = ChartTheme.text();
    Chart.defaults.borderColor = ChartTheme.border();
  },

  // Series color palettes
  datasetColors: function(count) {
    const isDark = ChartTheme.isDark();
    if (isDark) {
      const palette = ['#60a5fa', '#34d399', '#fbbf24', '#f87171', '#a78bfa', '#fb923c', '#67e8f9', '#fda4af', '#c4b5fd', '#86efac'];
      return palette.slice(0, count);
    }
    const palette = ['#2563eb', '#16a34a', '#d97706', '#dc2626', '#7c3aed', '#ea580c', '#0891b2', '#e11d48', '#8b5cf6', '#059669'];
    return palette.slice(0, count);
  },

  // Specific dataset colors used across the app
  green: () => ChartTheme.isDark() ? 'rgba(52,211,153,0.85)' : 'rgba(16,185,129,0.85)',
  blue: () => ChartTheme.isDark() ? 'rgba(96,165,250,0.85)' : 'rgba(37,99,235,0.85)',
  orange: () => ChartTheme.isDark() ? 'rgba(251,146,60,0.85)' : 'rgba(249,115,22,0.85)',
  amber: () => ChartTheme.isDark() ? 'rgba(251,191,36,0.85)' : 'rgba(245,158,11,0.85)',
  purple: () => ChartTheme.isDark() ? 'rgba(167,139,250,0.85)' : 'rgba(139,92,246,0.85)',
  red: () => ChartTheme.isDark() ? 'rgba(248,113,113,0.85)' : 'rgba(239,68,68,0.85)',
  teal: () => ChartTheme.isDark() ? 'rgba(45,212,191,0.85)' : 'rgba(20,184,166,0.85)',
  indigo: () => ChartTheme.isDark() ? 'rgba(129,140,248,0.85)' : 'rgba(99,102,241,0.85)',
};
