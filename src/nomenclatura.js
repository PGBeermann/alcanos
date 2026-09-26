'use strict';
/**
 * Nomenclatura sistemática de alcanos acíclicos y monocíclicos.
 *
 * Referencia normativa: Favre, H. A.; Powell, W. H. "Nomenclature of Organic
 * Chemistry. IUPAC Recommendations and Preferred Names 2013", RSC, 2014
 * (en adelante, "Blue Book 2013"). Secciones aplicadas:
 *   P-21.2  Nombres de alcanos lineales (raíces numéricas: met-, et-, prop-, but-, pent-...).
 *   P-22.1  Cicloalcanos: prefijo "ciclo" + nombre del alcano lineal.
 *   P-29.2  Prefijos de sustituyentes: "alquil" (valencia libre en C1) y
 *           "alcan-x-il" (valencia libre en otra posición) para nombres PIN.
 *   P-29.6  Prefijos retenidos: tert-butilo (preferido); isopropilo, isobutilo
 *           y sec-butilo solo en nomenclatura general.
 *   P-44.1.2.2 Los anillos son preferidos frente a las cadenas (criterio 2013).
 *   P-44.3  Cadena principal acíclica: la de mayor número de átomos de carbono.
 *   P-45.2.1 Mayor número de prefijos sustituyentes.
 *   P-45.2.2 / P-31.1.4 Localizadores más bajos (primer punto de diferencia).
 *   P-45.2.3 / P-31.1.4.3.4 Localizador más bajo al prefijo citado primero
 *           en orden alfanumérico.
 *   P-14.3  Localizadores: se omiten en anillos monosustituidos.
 *   P-14.4  Multiplicadores di-, tri-... y bis-, tris-... para prefijos compuestos.
 *   P-14.5  Orden alfanumérico (se ignoran multiplicadores y prefijos en
 *           cursiva como tert-, sec-, salvo en prefijos compuestos).
 *   P-16.5  Signos de inclusión ( ), [ ], { }.
 *
 * Los nombres se generan en inglés (idioma normativo de la IUPAC) o en español
 * (versión española de las recomendaciones: terminaciones -ano / -il, ciclo-).
 * El orden alfanumérico se calcula sobre el nombre en el idioma de salida.
 */

const RAICES = [null, 'meth', 'eth', 'prop', 'but', 'pent', 'hex', 'hept', 'oct', 'non', 'dec',
  'undec', 'dodec', 'tridec', 'tetradec', 'pentadec', 'hexadec', 'heptadec', 'octadec',
  'nonadec', 'icos', 'henicos', 'docos', 'tricos', 'tetracos', 'pentacos', 'hexacos',
  'heptacos', 'octacos', 'nonacos', 'triacont'];

const MULT_SIMPLE = [null, '', 'di', 'tri', 'tetra', 'penta', 'hexa', 'hepta', 'octa', 'nona', 'deca'];
const MULT_COMPUESTO = [null, '', 'bis', 'tris', 'tetrakis', 'pentakis', 'hexakis', 'heptakis', 'octakis', 'nonakis', 'decakis'];

const IDIOMAS = {
  en: {
    raices: RAICES,
    alcano: 'ane', il: 'yl', ciclo: 'cyclo', metano: 'methane',
    tertButil: 'tert-butyl', claveTert: 'butyl',
    // Retenidos solo para nomenclatura general (P-29.6.2.3)
    retenidos: { 'propan-2-yl': 'isopropyl', 'butan-2-yl': 'sec-butyl', '2-methylpropyl': 'isobutyl' },
  },
  es: {
    raices: RAICES.map(r => r && r.replace(/^meth/, 'met').replace(/^eth/, 'et')),
    alcano: 'ano', il: 'il', ciclo: 'ciclo', metano: 'metano',
    tertButil: 'tert-butil', claveTert: 'butil',
    retenidos: { 'propan-2-il': 'isopropil', 'butan-2-il': 'sec-butil', '2-metilpropil': 'isobutil' },
  },
};

function raiz(n, idioma = 'en') {
  if (n < 1 || n >= RAICES.length) throw new Error(`Cadena de ${n} carbonos fuera del alcance (1–${RAICES.length - 1})`);
  return IDIOMAS[idioma].raices[n];
}

/** Clave de ordenamiento alfanumérico (P-14.5). */
function claveAlfabetica(nombre) {
  return nombre.toLowerCase().replace(/\b(tert|sec)-/g, '').replace(/[^a-z]/g, '');
}

/** Encierra con el signo de inclusión adecuado según el anidamiento (P-16.5.4). */
function encerrar(s) {
  let prof = 0, max = 0;
  for (const ch of s) {
    if ('([{'.includes(ch)) max = Math.max(max, ++prof);
    else if (')]}'.includes(ch)) prof--;
  }
  const [a, b] = [['(', ')'], ['[', ']'], ['{', '}']][max % 3];
  return a + s + b;
}

function compararArreglos(x, y) {
  const n = Math.min(x.length, y.length);
  for (let i = 0; i < n; i++) if (x[i] !== y[i]) return x[i] - y[i];
  return x.length - y.length;
}

class Nombrador {
  constructor(mol, estilo = 'pin', idioma = 'en') {
    this.mol = mol;
    this.estilo = estilo; // 'pin' | 'general'
    this.idioma = idioma; // 'en' | 'es'
    this.L = IDIOMAS[idioma];
    this.cache = new Map();
  }

  /** Caminos desde `inicio` hasta hojas, sin pasar por `excluidos`. */
  caminosHastaHojas(inicio, excluidos) {
    const res = [];
    const camino = [inicio];
    const visitado = new Set([...excluidos, inicio]);
    const dfs = (a) => {
      const sig = this.mol.ady[a].filter(b => !visitado.has(b));
      if (!sig.length) { res.push(camino.slice()); return; }
      for (const b of sig) {
        visitado.add(b); camino.push(b);
        dfs(b);
        camino.pop(); visitado.delete(b);
      }
    };
    dfs(inicio);
    return res;
  }

  /**
   * Sustituyentes sobre una cadena/anillo numerado. `orden[i]` recibe el localizador i+1.
   * `excluir` es el átomo de unión al padre (solo para sustituyentes).
   */
  sustituyentesDe(orden, excluir) {
    const enPadre = new Set(orden);
    const subs = [];
    orden.forEach((a, i) => {
      for (const b of this.mol.ady[a]) {
        if (enPadre.has(b) || b === excluir) continue;
        subs.push({ locante: i + 1, ...this.nombrarSustituyente(b, a), atomo: b });
      }
    });
    return subs;
  }

  /** Datos de comparación de una numeración candidata. */
  evaluar(orden, excluir) {
    const subs = this.sustituyentesDe(orden, excluir);
    const locantes = subs.map(s => s.locante).sort((a, b) => a - b);
    const grupos = agrupar(subs);
    const locantesAlfa = grupos.flatMap(g => g.locantes);
    return { orden, subs, grupos, locantes, locantesAlfa };
  }

  /**
   * Nombra el sustituyente que comienza en `raizAtomo` y se une a `padre` (P-29.2).
   * Devuelve { nombre, compuesto, conLocante, clave }.
   */
  nombrarSustituyente(raizAtomo, padre) {
    const k = `${raizAtomo}|${padre}`;
    if (this.cache.has(k)) return this.cache.get(k);

    const hijos = this.mol.ady[raizAtomo].filter(b => b !== padre);

    // tert-butilo: prefijo retenido y preferido (P-29.6.2.3)
    if (hijos.length === 3 && hijos.every(h => this.mol.grado(h) === 1)) {
      const r = { nombre: this.L.tertButil, compuesto: false, conLocante: false, clave: this.L.claveTert, cursiva: 'tert' };
      this.cache.set(k, r);
      return r;
    }

    // Candidatas: cadenas que contienen el átomo con valencia libre.
    const ramas = hijos.map(h => this.caminosHastaHojas(h, [raizAtomo, padre]));
    const cadenas = [[raizAtomo]];
    ramas.forEach(lista => lista.forEach(p => cadenas.push([raizAtomo, ...p])));
    for (let i = 0; i < ramas.length; i++) {
      for (let j = 0; j < ramas.length; j++) {
        if (i === j) continue;
        for (const p of ramas[i]) for (const q of ramas[j]) cadenas.push([...p.slice().reverse(), raizAtomo, ...q]);
      }
    }
    // Las cadenas que empiezan en la raíz también se evalúan invertidas.
    const candidatas = [];
    for (const c of cadenas) { candidatas.push(c); if (c[0] === raizAtomo && c.length > 1) candidatas.push(c.slice().reverse()); }

    let mejor = null;
    for (const orden of candidatas) {
      const ev = this.evaluar(orden, padre);
      ev.valenciaLibre = orden.indexOf(raizAtomo) + 1;
      ev.nombre = this.ensamblarSustituyente(ev);
      if (!mejor || compararSustituyente(ev, mejor) < 0) mejor = ev;
    }

    let nombre = mejor.nombre;
    const retenido = this.estilo === 'general' ? this.L.retenidos[nombre] : undefined;
    if (retenido) nombre = retenido;
    const compuesto = mejor.subs.length > 0 && !retenido;
    const conLocante = /\d/.test(nombre);
    const r = {
      nombre, compuesto, conLocante,
      clave: claveAlfabetica(nombre),
      cursiva: (nombre.match(/^(tert|sec)-/) || [, ''])[1],
      detalle: { cadena: mejor.orden.length, valenciaLibre: mejor.valenciaLibre },
    };
    this.cache.set(k, r);
    return r;
  }

  ensamblarSustituyente(ev) {
    const n = ev.orden.length;
    const r = raiz(n, this.idioma), il = this.L.il;
    const base = ev.valenciaLibre === 1 ? `${r}${il}` : `${r}an-${ev.valenciaLibre}-${il}`;
    return prefijos(ev.grupos, false) + base;
  }
}

function compararSustituyente(a, b) {
  return (b.orden.length - a.orden.length)
    || (b.subs.length - a.subs.length)
    || (a.valenciaLibre - b.valenciaLibre)
    || compararArreglos(a.locantes, b.locantes)
    || compararArreglos(a.locantesAlfa, b.locantesAlfa)
    || (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0);
}

function compararPadre(a, b) {
  return (b.orden.length - a.orden.length)
    || (b.subs.length - a.subs.length)
    || compararArreglos(a.locantes, b.locantes)
    || compararArreglos(a.locantesAlfa, b.locantesAlfa)
    || (a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0);
}

/** Agrupa sustituyentes idénticos y los ordena alfanuméricamente (P-14.5). */
function agrupar(subs) {
  const mapa = new Map();
  for (const s of subs) {
    if (!mapa.has(s.nombre)) mapa.set(s.nombre, { ...s, locantes: [] });
    mapa.get(s.nombre).locantes.push(s.locante);
  }
  const grupos = [...mapa.values()];
  grupos.forEach(g => g.locantes.sort((a, b) => a - b));
  grupos.sort((a, b) => (a.clave < b.clave ? -1 : a.clave > b.clave ? 1 : 0)
    || (a.cursiva < b.cursiva ? -1 : a.cursiva > b.cursiva ? 1 : 0)
    || (a.nombre < b.nombre ? -1 : 1));
  return grupos;
}

/** Construye la cadena de prefijos sustituyentes con localizadores y multiplicadores (P-14.3, P-14.4, P-16.5). */
function prefijos(grupos, omitirLocantes) {
  return grupos.map(g => {
    const n = g.locantes.length;
    let texto;
    if (g.compuesto) {
      texto = (n > 1 ? MULT_COMPUESTO[n] : '') + encerrar(g.nombre);
    } else if (g.conLocante) {
      texto = (n > 1 ? MULT_SIMPLE[n] : '') + encerrar(g.nombre);
    } else {
      const sep = n > 1 && /^(tert|sec)-/.test(g.nombre) ? '-' : '';
      texto = (n > 1 ? MULT_SIMPLE[n] : '') + sep + g.nombre;
    }
    return omitirLocantes ? texto : `${g.locantes.join(',')}-${texto}`;
  }).join('-');
}

/**
 * Nombra un alcano (acíclico o monocíclico).
 * @param {Molecula} mol
 * @param {'pin'|'general'} estilo
 */
function nombrar(mol, estilo = 'pin', idioma = 'en') {
  mol.validar();
  const nb = new Nombrador(mol, estilo, idioma);
  const L = IDIOMAS[idioma];
  const alcano = k => (k === 1 ? L.metano : raiz(k, idioma) + L.alcano);
  const n = mol.numAtomos;
  const anillo = mol.atomosDelAnillo();

  let mejor;
  if (anillo.length) {
    // P-44.1.2.2: el anillo es la estructura padre.
    const m = anillo.length;
    for (let s = 0; s < m; s++) {
      for (const dir of [1, -1]) {
        const orden = Array.from({ length: m }, (_, i) => anillo[((s + dir * i) % m + m) % m]);
        const ev = nb.evaluar(orden, -1);
        ev.nombre = prefijos(ev.grupos, ev.subs.length === 1) + L.ciclo + alcano(m);
        if (!mejor || compararPadre(ev, mejor) < 0) mejor = ev;
      }
    }
    mejor.tipoPadre = 'anillo';
    mejor.nombrePadre = L.ciclo + alcano(m);
  } else if (n === 1) {
    mejor = { orden: [0], subs: [], grupos: [], locantes: [], nombre: L.metano };
    mejor.tipoPadre = 'cadena'; mejor.nombrePadre = L.metano;
  } else {
    const hojas = [];
    for (let i = 0; i < n; i++) if (mol.grado(i) === 1) hojas.push(i);
    for (const h of hojas) {
      for (const orden of nb.caminosHastaHojas(h, [])) {
        if (orden.length < 2) continue;
        const ev = nb.evaluar(orden, -1);
        ev.nombre = prefijos(ev.grupos, false) + alcano(orden.length);
        if (!mejor || compararPadre(ev, mejor) < 0) mejor = ev;
      }
    }
    mejor.tipoPadre = 'cadena';
    mejor.nombrePadre = alcano(mejor.orden.length);
  }

  return {
    nombre: mejor.nombre,
    tipoPadre: mejor.tipoPadre,
    nombrePadre: mejor.nombrePadre,
    carbonosPadre: mejor.orden.length,
    atomosPadre: mejor.orden,
    sustituyentes: mejor.subs
      .map(s => ({ locante: s.locante, nombre: s.nombre }))
      .sort((a, b) => a.locante - b.locante),
    locantes: mejor.locantes,
  };
}

/** Nombres completos: PIN y general, en inglés y español. */
function nombrarTodo(mol) {
  const pin = nombrar(mol, 'pin', 'en');
  return {
    pin,
    general: nombrar(mol, 'general', 'en'),
    pinEs: nombrar(mol, 'pin', 'es'),
    generalEs: nombrar(mol, 'general', 'es'),
  };
}

module.exports = { nombrar, nombrarTodo, claveAlfabetica, encerrar, raiz };
