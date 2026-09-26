'use strict';
/**
 * Representación de alcanos como grafos no dirigidos de átomos de carbono
 * (solo enlaces sencillos) y conversión desde/hacia SMILES.
 *
 * Alcance deliberado: hidrocarburos saturados acíclicos o monocíclicos,
 * que es exactamente el dominio que el módulo de nomenclatura resuelve.
 */

class Molecula {
  constructor(n = 0) {
    this.ady = Array.from({ length: n }, () => []);
  }

  get numAtomos() { return this.ady.length; }

  get numEnlaces() {
    return this.ady.reduce((s, v) => s + v.length, 0) / 2;
  }

  /** Número de anillos (número ciclomático) = E − V + 1 para grafo conexo. */
  get numAnillos() { return this.numEnlaces - this.numAtomos + 1; }

  agregarAtomo() {
    this.ady.push([]);
    return this.ady.length - 1;
  }

  enlazar(a, b) {
    if (a === b) throw new Error('Enlace de un átomo consigo mismo');
    if (this.ady[a].includes(b)) throw new Error('Enlace duplicado (solo se admiten enlaces sencillos)');
    this.ady[a].push(b);
    this.ady[b].push(a);
  }

  grado(i) { return this.ady[i].length; }

  esConexa() {
    if (this.numAtomos === 0) return false;
    const visto = new Set([0]);
    const pila = [0];
    while (pila.length) {
      const a = pila.pop();
      for (const b of this.ady[a]) if (!visto.has(b)) { visto.add(b); pila.push(b); }
    }
    return visto.size === this.numAtomos;
  }

  /** Átomos que forman el anillo (vacío si es acíclica). Supone a lo sumo un anillo. */
  atomosDelAnillo() {
    // Poda iterativa de hojas: lo que sobrevive es el ciclo.
    const grado = this.ady.map(v => v.length);
    const eliminado = new Array(this.numAtomos).fill(false);
    const cola = [];
    grado.forEach((g, i) => { if (g <= 1) cola.push(i); });
    while (cola.length) {
      const a = cola.pop();
      if (eliminado[a]) continue;
      eliminado[a] = true;
      for (const b of this.ady[a]) {
        if (!eliminado[b] && --grado[b] === 1) cola.push(b);
      }
    }
    const anillo = [];
    for (let i = 0; i < this.numAtomos; i++) if (!eliminado[i]) anillo.push(i);
    if (!anillo.length) return [];
    // Ordenar recorriendo el ciclo
    const enAnillo = new Set(anillo);
    const orden = [anillo[0]];
    let previo = -1, actual = anillo[0];
    while (true) {
      const sig = this.ady[actual].find(b => enAnillo.has(b) && b !== previo && b !== orden[0]);
      if (sig === undefined) break;
      orden.push(sig);
      previo = actual; actual = sig;
      if (orden.length > anillo.length) break;
    }
    return orden;
  }

  formula() {
    const c = this.numAtomos;
    const h = 2 * c + 2 - 2 * this.numAnillos;
    const sub = n => String(n).split('').map(d => '₀₁₂₃₄₅₆₇₈₉'[d]).join('');
    return { texto: `C${c}H${h}`, unicode: `C${c > 1 ? sub(c) : ''}H${sub(h)}`, c, h };
  }

  /** Escribe un SMILES (no canónico) mediante recorrido en profundidad. */
  aSmiles(inicio = 0) {
    const n = this.numAtomos;
    if (n === 0) return '';
    // 1) DFS para detectar enlaces de cierre de anillo
    const visto = new Array(n).fill(false);
    const padre = new Array(n).fill(-1);
    const hijos = Array.from({ length: n }, () => []);
    const cierres = []; // [a, b] con b ancestro de a
    const dfs = (a) => {
      visto[a] = true;
      for (const b of this.ady[a]) {
        if (b === padre[a]) continue;
        if (!visto[b]) { padre[b] = a; hijos[a].push(b); dfs(b); }
        else if (!cierres.some(([x, y]) => (x === b && y === a))) cierres.push([a, b]);
      }
    };
    dfs(inicio);
    // 2) Asignar dígitos de cierre
    const digitos = Array.from({ length: n }, () => []);
    let d = 1;
    for (const [a, b] of cierres) {
      const etiqueta = d < 10 ? String(d) : `%${d}`;
      digitos[a].push(etiqueta); digitos[b].push(etiqueta); d++;
    }
    // 3) Escritura; el orden de aparición de átomos se registra
    this.ordenSmiles = [];
    const escribir = (a) => {
      this.ordenSmiles.push(a);
      let s = 'C' + digitos[a].join('');
      const h = hijos[a];
      h.forEach((b, k) => {
        s += k < h.length - 1 ? `(${escribir(b)})` : escribir(b);
      });
      return s;
    };
    return escribir(inicio);
  }

  /**
   * Lee un SMILES restringido a carbono con enlaces sencillos.
   * Acepta C, [C], [CH2], [CH3], [CH4], ramas (), cierres de anillo 1-9 y %nn,
   * y el símbolo de enlace sencillo explícito '-'.
   */
  static desdeSmiles(smiles) {
    if (typeof smiles !== 'string' || !smiles.trim()) throw new Error('SMILES vacío');
    const s = smiles.trim();
    const m = new Molecula();
    const pilaRamas = [];
    const anillosAbiertos = new Map();
    let previo = -1;
    let i = 0;
    while (i < s.length) {
      const ch = s[i];
      if (ch === 'C' && s[i + 1] !== 'l') {
        const a = m.agregarAtomo();
        if (previo >= 0) m.enlazar(previo, a);
        previo = a; i++;
      } else if (ch === '[') {
        const fin = s.indexOf(']', i);
        if (fin < 0) throw new Error('Corchete sin cerrar en el SMILES');
        const dentro = s.slice(i + 1, fin);
        if (!/^C(H[0-4]?)?$/.test(dentro)) {
          throw new Error(`Átomo no admitido: [${dentro}] (solo se admiten alcanos)`);
        }
        const a = m.agregarAtomo();
        if (previo >= 0) m.enlazar(previo, a);
        previo = a; i = fin + 1;
      } else if (ch === '(') {
        if (previo < 0) throw new Error('Rama sin átomo previo');
        pilaRamas.push(previo); i++;
      } else if (ch === ')') {
        if (!pilaRamas.length) throw new Error('Paréntesis desbalanceados');
        previo = pilaRamas.pop(); i++;
      } else if (/[0-9%]/.test(ch)) {
        let etiqueta;
        if (ch === '%') { etiqueta = s.slice(i + 1, i + 3); i += 3; }
        else { etiqueta = ch; i++; }
        if (previo < 0) throw new Error('Cierre de anillo sin átomo');
        if (anillosAbiertos.has(etiqueta)) {
          m.enlazar(anillosAbiertos.get(etiqueta), previo);
          anillosAbiertos.delete(etiqueta);
        } else anillosAbiertos.set(etiqueta, previo);
      } else if (ch === '-') {
        i++;
      } else if (ch === '=' || ch === '#') {
        throw new Error('La estructura contiene enlaces múltiples: no es un alcano');
      } else if (ch === '.') {
        throw new Error('La estructura contiene más de un fragmento');
      } else if (ch === 'c') {
        throw new Error('La estructura contiene átomos aromáticos: no es un alcano');
      } else if (/\s/.test(ch)) {
        break; // JSME puede anexar nombre tras un espacio
      } else {
        throw new Error(`Símbolo no admitido en SMILES: "${ch}" (solo se admiten alcanos)`);
      }
    }
    if (pilaRamas.length) throw new Error('Paréntesis desbalanceados');
    if (anillosAbiertos.size) throw new Error('Cierre de anillo sin pareja');
    return m;
  }

  /**
   * Lee un molfile MDL V2000 (el que exporta JSME con molFile()).
   * Conserva la numeración de átomos del editor (índice i ↔ átomo i+1 en JSME).
   */
  static desdeMolfile(texto) {
    if (typeof texto !== 'string') throw new Error('Molfile inválido');
    const lineas = texto.replace(/\r/g, '').split('\n');
    const conteo = lineas[3] || '';
    if (!/V2000/.test(conteo)) throw new Error('Solo se admite el formato molfile V2000');
    const nA = parseInt(conteo.slice(0, 3), 10);
    const nB = parseInt(conteo.slice(3, 6), 10);
    if (!(nA > 0) || nA > 60 || !(nB >= 0)) throw new Error('Molfile vacío o demasiado grande');
    const m = new Molecula(nA);
    for (let i = 0; i < nA; i++) {
      const l = lineas[4 + i] || '';
      const elemento = l.slice(31, 34).trim();
      if (elemento !== 'C') throw new Error(`Átomo no admitido: ${elemento || '?'} (solo se admiten alcanos)`);
      const carga = parseInt(l.slice(36, 39), 10) || 0;
      if (carga !== 0) throw new Error('La estructura contiene átomos cargados');
    }
    for (let j = 0; j < nB; j++) {
      const l = lineas[4 + nA + j] || '';
      const a = parseInt(l.slice(0, 3), 10) - 1;
      const b = parseInt(l.slice(3, 6), 10) - 1;
      const orden = parseInt(l.slice(6, 9), 10);
      if (orden !== 1) throw new Error('La estructura contiene enlaces múltiples: no es un alcano');
      if (!(a >= 0 && a < nA && b >= 0 && b < nA)) throw new Error('Enlace inválido en el molfile');
      m.enlazar(a, b);
    }
    return m;
  }

  /** Valida que el grafo represente un alcano acíclico o monocíclico. */
  validar() {
    if (this.numAtomos === 0) throw new Error('No hay átomos');
    if (!this.esConexa()) throw new Error('La estructura contiene más de un fragmento');
    for (let i = 0; i < this.numAtomos; i++) {
      if (this.grado(i) > 4) throw new Error('Un carbono excede la tetravalencia');
    }
    if (this.numAnillos > 1) throw new Error('Solo se admiten alcanos acíclicos o monocíclicos');
    const anillo = this.atomosDelAnillo();
    if (this.numAnillos === 1 && anillo.length < 3) throw new Error('Anillo inválido');
    return true;
  }
}

module.exports = { Molecula };
