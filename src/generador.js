'use strict';
/**
 * Generador aleatorio de alcanos ramificados, acíclicos y cíclicos,
 * con tres niveles de dificultad.
 */
const { Molecula } = require('./molecula');

// Plantillas de sustituyentes: SMILES cuyo primer átomo es el punto de unión.
// `alcance` = número de carbonos de la rama más larga desde el punto de unión.
const SUSTITUYENTES = {
  metilo:            { smiles: 'C',        alcance: 1 },
  etilo:             { smiles: 'CC',       alcance: 2 },
  propilo:           { smiles: 'CCC',      alcance: 3 },
  isopropilo:        { smiles: 'C(C)C',    alcance: 2 },
  butilo:            { smiles: 'CCCC',     alcance: 4 },
  'sec-butilo':      { smiles: 'C(C)CC',   alcance: 3 },
  isobutilo:         { smiles: 'CC(C)C',   alcance: 3 },
  'tert-butilo':     { smiles: 'C(C)(C)C', alcance: 2 },
  pentilo:           { smiles: 'CCCCC',    alcance: 5 },
  '2,2-dimetilpropilo': { smiles: 'CC(C)(C)C', alcance: 3 },
  '3-metilbutan-2-ilo': { smiles: 'C(C)C(C)C', alcance: 3 },
};

// Pesos por nivel: los sustituyentes simples aparecen con más frecuencia.
const NIVELES = {
  1: {
    etiqueta: 'Básico',
    cadena: [4, 7], anillo: [3, 6], nSust: [1, 2],
    sust: { metilo: 5, etilo: 2 },
  },
  2: {
    etiqueta: 'Intermedio',
    cadena: [5, 9], anillo: [4, 7], nSust: [2, 3],
    sust: { metilo: 5, etilo: 3, propilo: 2, isopropilo: 2 },
  },
  3: {
    etiqueta: 'Avanzado',
    cadena: [6, 12], anillo: [3, 8], nSust: [2, 4],
    sust: {
      metilo: 5, etilo: 3, propilo: 2, isopropilo: 2, butilo: 1, 'sec-butilo': 1,
      isobutilo: 1, 'tert-butilo': 1, pentilo: 1, '2,2-dimetilpropilo': 1, '3-metilbutan-2-ilo': 1,
    },
  },
};

const entero = (a, b, rnd) => a + Math.floor(rnd() * (b - a + 1));

function elegirPonderado(pesos, rnd) {
  const entradas = Object.entries(pesos);
  const total = entradas.reduce((s, [, p]) => s + p, 0);
  let r = rnd() * total;
  for (const [k, p] of entradas) { if ((r -= p) < 0) return k; }
  return entradas[entradas.length - 1][0];
}

/** Injerta la plantilla `clave` sobre el átomo `destino` de `mol`. */
function injertar(mol, destino, clave) {
  const frag = Molecula.desdeSmiles(SUSTITUYENTES[clave].smiles);
  const base = mol.numAtomos;
  for (let i = 0; i < frag.numAtomos; i++) mol.agregarAtomo();
  for (let a = 0; a < frag.numAtomos; a++) {
    for (const b of frag.ady[a]) if (a < b) mol.enlazar(base + a, base + b);
  }
  mol.enlazar(destino, base);
}

/**
 * Genera un alcano aleatorio.
 * @param {{tipo?: 'aciclico'|'ciclico'|'mixto', nivel?: 1|2|3, rnd?: () => number}} opciones
 */
function generar({ tipo = 'mixto', nivel = 2, rnd = Math.random } = {}) {
  const cfg = NIVELES[nivel] || NIVELES[2];
  const ciclico = tipo === 'ciclico' || (tipo === 'mixto' && rnd() < 0.5);

  for (let intento = 0; intento < 200; intento++) {
    const mol = new Molecula();
    let posiciones; // átomos del padre aptos para sustituir
    let n;
    if (ciclico) {
      n = entero(cfg.anillo[0], cfg.anillo[1], rnd);
      for (let i = 0; i < n; i++) mol.agregarAtomo();
      for (let i = 0; i < n; i++) mol.enlazar(i, (i + 1) % n);
      posiciones = [...Array(n).keys()];
    } else {
      n = entero(cfg.cadena[0], cfg.cadena[1], rnd);
      for (let i = 0; i < n; i++) mol.agregarAtomo();
      for (let i = 0; i < n - 1; i++) mol.enlazar(i, i + 1);
      posiciones = [...Array(n).keys()].slice(1, -1); // no en los extremos
    }

    const k = entero(cfg.nSust[0], cfg.nSust[1], rnd);
    let ok = true;
    for (let s = 0; s < k; s++) {
      const clave = elegirPonderado(cfg.sust, rnd);
      const alcance = SUSTITUYENTES[clave].alcance;
      const validas = posiciones.filter(p => {
        if (mol.grado(p) >= 4) return false;
        if (ciclico) return alcance <= Math.max(3, n); // evita cadenas desproporcionadas
        // En acíclicos, que la rama no supere a la cadena principal hacia ningún extremo
        return alcance <= Math.min(p, n - 1 - p);
      });
      if (!validas.length) { ok = false; break; }
      injertar(mol, validas[entero(0, validas.length - 1, rnd)], clave);
    }
    if (!ok) continue;
    // Anillo sin sustituyentes o cadena sin ramificar: se descarta (se piden ramificados)
    if (mol.numAtomos === n) continue;
    if (mol.numAtomos > 30) continue;
    mol.validar();
    return { molecula: mol, smiles: mol.aSmiles(0), ciclico, nivel: cfg.etiqueta };
  }
  throw new Error('No se pudo generar una estructura con los parámetros dados');
}

module.exports = { generar, NIVELES, SUSTITUYENTES };
