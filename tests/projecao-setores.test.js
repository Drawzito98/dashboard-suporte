const fs = require('fs');
const vm = require('vm');
const assert = require('node:assert/strict');
const context = { document: { addEventListener() {} }, module: { exports: {} } };
vm.runInNewContext(fs.readFileSync(require('path').join(__dirname, '../static/projecao.js'), 'utf8'), context);
const { buildProjecaoSectorIndex, shiftProjecaoMonth } = context.module.exports;
assert.equal(shiftProjecaoMonth('2026-01', -1), '2025-12');
assert.equal(shiftProjecaoMonth('2026-12', 1), '2027-01');
assert.equal(shiftProjecaoMonth('2026-09', 1), '2026-10');
assert.equal(shiftProjecaoMonth('2026-13', 1), '');
const records = [
  { Atendente: 'Maria Luisa', Setor: 'Estoque', 'Mês': '2026-09' },
  { Atendente: 'Maria Luisa', Setor: 'OS', 'Mês': '2026-09' },
  { Atendente: 'João Silva', Setor: 'Financeiro', 'Mês': '2026-08' },
  { Atendente: 'João Silva', Setor: 'Estoque', 'Mês': '2026-09' }
];
const index = buildProjecaoSectorIndex(records, { ' JOAO   SILVA ': { setor_atual: ' ESTOQUE ' }, Carla: { setor_atual: 'Estoque' } });
assert.equal(index.belongs('Maria Luisa', 'Estoque', '2026-10'), true);
assert.equal(index.belongs('Maria Luisa', 'OS', '2026-10'), true);
assert.equal(index.belongs('Maria Luisa', 'Financeiro', '2026-10'), false);
assert.equal(index.belongs('João Silva', 'Estoque', '2026-10'), true);
assert.equal(index.belongs('João Silva', 'Financeiro', '2026-10'), false);
assert.equal(index.belongs('João Silva', 'Financeiro', '2026-08'), true);
assert.equal(index.belongs('Carla', 'Estoque', '2026-10'), true);
assert.equal(index.options.filter(s => s.toLowerCase() === 'estoque').length, 1);
const transferred = buildProjecaoSectorIndex(records, { 'Maria Luisa': { setor_atual: 'Financeiro' } });
assert.equal(transferred.belongs('Maria Luisa', 'Financeiro', '2026-10'), true);
assert.equal(transferred.belongs('Maria Luisa', 'Estoque', '2026-10'), false);
assert.equal(transferred.belongs('Maria Luisa', 'Estoque', '2026-09'), true);
console.log('Setores: múltiplos setores, mês selecionado, cadastro atual e normalização verificados.');
