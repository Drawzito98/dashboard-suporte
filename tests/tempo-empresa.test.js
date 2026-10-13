const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const context = vm.createContext({});
vm.runInContext(fs.readFileSync(require('node:path').join(__dirname, '../static/tempo-empresa.js'), 'utf8'), context);
function tempo(data, hoje) { return vm.runInContext(`getTempoEmpresa(${JSON.stringify(data)}, new Date(${JSON.stringify(hoje)} + 'T12:00:00'))`, context); }
assert.equal(tempo('2023-10-13', '2026-10-13'), '3 anos');
assert.equal(tempo('2023-10-14', '2026-10-13'), '2 anos e 11 meses');
assert.equal(tempo('2026-09-13', '2026-10-13'), '1 mês');
assert.equal(tempo('2026-10-13', '2026-10-13'), 'Menos de 1 mês');
assert.equal(tempo('2024-02-29', '2025-02-28'), '1 ano');
assert.equal(tempo('2026-01-31', '2026-02-28'), '1 mês');
assert.equal(tempo('', '2026-10-13'), 'Admissão não informada');
assert.equal(tempo('2026-02-30', '2026-10-13'), 'Data de admissão inválida');
assert.equal(tempo('2026-10-14', '2026-10-13'), 'Admissão futura');
console.log('Tempo de empresa: aniversários, fim de mês, ano bissexto e datas ausentes/inválidas verificados.');
