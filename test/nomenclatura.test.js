'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const { Molecula } = require('../src/molecula');
const { nombrar } = require('../src/nomenclatura');
const { generar } = require('../src/generador');

const n = (smi, estilo = 'pin', idioma = 'en') => nombrar(Molecula.desdeSmiles(smi), estilo, idioma).nombre;

// [SMILES, PIN (en), nombre general (en), PIN (es)]
const CASOS = [
  ['C', 'methane', 'methane', 'metano'],
  ['CC(C)C', '2-methylpropane', '2-methylpropane', '2-metilpropano'],
  ['CC(C)(C)C', '2,2-dimethylpropane', '2,2-dimethylpropane', '2,2-dimetilpropano'],
  ['CCCC(C)CC', '3-methylhexane', '3-methylhexane', '3-metilhexano'],
  ['CCC(CC)CC', '3-ethylpentane', '3-ethylpentane', '3-etilpentano'],
  ['CC(C)C(C)(C)C', '2,2,3-trimethylbutane', '2,2,3-trimethylbutane', '2,2,3-trimetilbutano'],
  // Cadenas de igual longitud: gana la de más sustituyentes (P-45.2.1)
  ['CCCCC(CC)C(C)C', '3-ethyl-2-methylheptane', '3-ethyl-2-methylheptane', '3-etil-2-metilheptano'],
  // Empate de localizadores: el primero en orden alfabético recibe el menor (P-31.1.4.3.4)
  ['CCC(C)C(CC)CC', '3-ethyl-4-methylhexane', '3-ethyl-4-methylhexane', '3-etil-4-metilhexano'],
  ['CCCCC(C(C)C)CCC', '4-(propan-2-yl)octane', '4-isopropyloctane', '4-(propan-2-il)octano'],
  ['CCCCC(CC(C)C)CCCC', '5-(2-methylpropyl)nonane', '5-isobutylnonane', '5-(2-metilpropil)nonano'],
  ['CCCCC(C(C)CC)C(C)CC', '4-(butan-2-yl)-3-methyloctane', '4-sec-butyl-3-methyloctane', '4-(butan-2-il)-3-metiloctano'],
  ['CCCCC(C(C)C(C)C)CCCC', '5-(3-methylbutan-2-yl)nonane', '5-(3-methylbutan-2-yl)nonane', '5-(3-metilbutan-2-il)nonano'],
  ['CCCCCC(C(C)C)(C(C)C)CCCCC', '6,6-di(propan-2-yl)undecane', '6,6-diisopropylundecane', '6,6-di(propan-2-il)undecano'],
  ['CCCCCC(CC(C)C)(CC(C)C)CCCCC', '6,6-bis(2-methylpropyl)undecane', '6,6-diisobutylundecane', '6,6-bis(2-metilpropil)undecano'],
  ['CCCCCC(C(C)(C)C)(C(C)(C)C)CCCCC', '6,6-di-tert-butylundecane', '6,6-di-tert-butylundecane', '6,6-di-tert-butilundecano'],
  // Cicloalcanos: el anillo es el padre (P-44.1.2.2)
  ['C1CCCCC1', 'cyclohexane', 'cyclohexane', 'ciclohexano'],
  ['CC1CCCCC1', 'methylcyclohexane', 'methylcyclohexane', 'metilciclohexano'],
  ['CC1CCC(C)CC1', '1,4-dimethylcyclohexane', '1,4-dimethylcyclohexane', '1,4-dimetilciclohexano'],
  ['CCC1CCCC(C)C1', '1-ethyl-3-methylcyclohexane', '1-ethyl-3-methylcyclohexane', '1-etil-3-metilciclohexano'],
  ['CCC1CCCC1C', '1-ethyl-2-methylcyclopentane', '1-ethyl-2-methylcyclopentane', '1-etil-2-metilciclopentano'],
  ['CC1(C)CC1C', '1,1,2-trimethylcyclopropane', '1,1,2-trimethylcyclopropane', '1,1,2-trimetilciclopropano'],
  ['CC(C)C1CCCCC1', '(propan-2-yl)cyclohexane', 'isopropylcyclohexane', '(propan-2-il)ciclohexano'],
  ['CC(C)(C)C1CCC(C)CC1', '1-tert-butyl-4-methylcyclohexane', '1-tert-butyl-4-methylcyclohexane', '1-tert-butil-4-metilciclohexano'],
  ['CCCCCCCCCCC1CC1', 'decylcyclopropane', 'decylcyclopropane', 'decilciclopropano'],
  ['CC1CCC(C(C)C)CC1', '1-methyl-4-(propan-2-yl)cyclohexane', '1-isopropyl-4-methylcyclohexane', '1-metil-4-(propan-2-il)ciclohexano'],
];

for (const [smi, pin, gen, pinEs] of CASOS) {
  test(`${smi} → ${pin}`, () => {
    assert.equal(n(smi), pin);
    assert.equal(n(smi, 'general'), gen);
    assert.equal(n(smi, 'pin', 'es'), pinEs);
  });
}

test('el nombre no depende del orden de escritura del SMILES', () => {
  assert.equal(n('C(C)(C)CC(CC)CCC'), n('CCCC(CC)CC(C)C'));
  assert.equal(n('C1(C)CCC(CC)CC1'), n('CCC1CCC(C)CC1'));
});

test('rechaza estructuras que no son alcanos', () => {
  assert.throws(() => Molecula.desdeSmiles('C=C'));
  assert.throws(() => Molecula.desdeSmiles('CCO'));
  assert.throws(() => Molecula.desdeSmiles('c1ccccc1'));
  assert.throws(() => Molecula.desdeSmiles('C1CC2CCC1C2').validar());
});

test('molfile y SMILES producen el mismo nombre', () => {
  const mol = `
  test

  4  3  0  0  0  0  0  0  0  0999 V2000
    0.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    2.0000    0.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
    1.0000    1.0000    0.0000 C   0  0  0  0  0  0  0  0  0  0  0  0
  1  2  1  0  0  0  0
  2  3  1  0  0  0  0
  2  4  1  0  0  0  0
M  END`;
  assert.equal(nombrar(Molecula.desdeMolfile(mol)).nombre, '2-methylpropane');
});

test('generador: 3000 estructuras válidas, ramificadas y nombrables', () => {
  for (let i = 0; i < 3000; i++) {
    const tipo = ['aciclico', 'ciclico', 'mixto'][i % 3];
    const nivel = (i % 9 < 3) ? 1 : (i % 9 < 6 ? 2 : 3);
    const g = generar({ tipo, nivel });
    const m = Molecula.desdeSmiles(g.smiles);
    const r = nombrar(m);
    assert.ok(r.sustituyentes.length > 0, g.smiles);
    if (tipo === 'ciclico') assert.equal(r.tipoPadre, 'anillo');
    if (tipo === 'aciclico') assert.equal(r.tipoPadre, 'cadena');
  }
});
