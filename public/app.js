/* global JSApplet */
(function () {
'use strict';

let editor = null;
let ejercicio = null;   // { molfile, formula } de la estructura generada

const $ = (id) => document.getElementById(id);

// JSME invoca esta función global cuando termina de cargar.
window.jsmeOnLoad = function () {
  $('jsme_container').innerHTML = '';
  editor = new JSApplet.JSME('jsme_container', '100%', '380px', {
    options: 'depict,nocanonize,noquery,nosearchinchiKey,star',
  });
  generar();
};

function mensaje(texto, tipo = '') {
  const m = $('mensaje');
  m.textContent = texto;
  m.className = 'mensaje ' + tipo;
}

async function generar() {
  if (!editor) return;
  const tipo = $('tipo').value;
  const nivel = $('nivel').value;
  $('btnGenerar').disabled = true;
  mensaje('');
  try {
    const r = await fetch(`api/generar?tipo=${tipo}&nivel=${nivel}`);
    const d = await r.json();
    if (!r.ok) throw new Error(d.error || 'Error al generar');
    salirModoDibujo();
    editor.readGenericMolecularInput(d.smiles);
    try { editor.setMolecularAreaScale(1.5); } catch (_) { /* opcional */ }
    // Se guarda el molfile para conservar la numeración de átomos del editor.
    ejercicio = { molfile: editor.molFile(), formula: d.formula };
    $('formula').innerHTML = formulaHTML(d.formula);
    $('resultado').hidden = true;
    $('respuesta').value = '';
    $('btnDesplegar').disabled = false;
    $('respuesta').focus();
  } catch (e) {
    mensaje(e.message, 'error');
  } finally {
    $('btnGenerar').disabled = false;
  }
}

async function nombrar(molfile) {
  const r = await fetch('api/nombrar', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ molfile }),
  });
  const d = await r.json();
  if (!r.ok) throw new Error(d.error || 'No se pudo nombrar la estructura');
  return d;
}

async function desplegar() {
  if (!ejercicio) return;
  try {
    salirModoDibujo();
    editor.readMolFile(ejercicio.molfile);
    const d = await nombrar(ejercicio.molfile);
    mostrar(d, true);
  } catch (e) {
    mensaje(e.message, 'error');
  }
}

async function nombrarDibujo() {
  try {
    const molfile = editor.molFile();
    if (!editor.smiles()) throw new Error('Dibuje una estructura primero');
    const d = await nombrar(molfile);
    $('formula').innerHTML = formulaHTML(d.formula);
    mostrar(d, false);
  } catch (e) {
    $('resultado').hidden = true;
    mensaje(e.message, 'error');
  }
}

function mostrar(d, compararRespuesta) {
  mensaje('');
  $('pinEs').innerHTML = cursivas(d.pinEs);
  $('generalEs').innerHTML = cursivas(d.generalEs);
  const mismo = d.generalEs === d.pinEs;
  $('generalEs').hidden = mismo;
  $('dtGeneral').hidden = mismo;
  $('pinEn').innerHTML = cursivas(d.pinEn) + (d.generalEn !== d.pinEn ? ' &nbsp;·&nbsp; ' + cursivas(d.generalEn) : '');

  const j = d.justificacion;
  const li = [];
  li.push(j.tipoPadre === 'anillo'
    ? `Estructura padre: anillo de ${j.carbonosPadre} carbonos (${j.nombrePadre}). El anillo tiene prioridad sobre las cadenas.`
    : `Cadena principal: ${j.carbonosPadre} carbonos (${j.nombrePadre}), la más larga${j.sustituyentes.length ? ' y con más sustituyentes' : ''}.`);
  if (j.sustituyentes.length) {
    li.push('Sustituyentes: ' + j.sustituyentes.map(s => `${s.nombre} en C${s.locante}`).join(', ') + '.');
    li.push(`Conjunto de localizadores: {${j.sustituyentes.map(s => s.locante).join(', ')}}.`);
  }
  li.push(`Fórmula molecular: ${d.formula.texto} (CₙH${j.tipoPadre === 'anillo' ? '₂ₙ' : '₂ₙ₊₂'}).`);
  $('justificacion').innerHTML = li.map(t => `<li>${cursivas(t)}</li>`).join('');

  const v = $('veredicto');
  const resp = $('respuesta').value.trim();
  if (compararRespuesta && resp) {
    const aceptados = [d.pinEs, d.generalEs, d.pinEn, d.generalEn].map(normalizar);
    const ok = aceptados.includes(normalizar(resp));
    v.textContent = ok ? '✔ ¡Correcto!' : `✘ Tu respuesta: «${resp}» no coincide.`;
    v.className = 'veredicto ' + (ok ? 'ok' : 'mal');
    v.hidden = false;
  } else {
    v.hidden = true;
  }
  $('resultado').hidden = false;
  resaltarPadre(j.atomosPadre);
}

/** Colorea los átomos de la estructura padre en JSME (índices 1-based). */
function resaltarPadre(atomos) {
  try {
    editor.resetAtomColors(1);
    const csv = atomos.map(i => `${i + 1},3`).join(',');
    editor.setAtomBackgroundColors(1, csv);
  } catch (_) { /* versión de JSME sin soporte de color: se ignora */ }
}

function normalizar(s) {
  return s.toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s+/g, '')
    .replace(/[‐‑–—]/g, '-');
}

function escapar(s) {
  return s.replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

/** Escapa el texto y pone en cursiva los prefijos tert- y sec- (convención IUPAC). */
function cursivas(s) {
  return escapar(s).replace(/\b(tert|sec)-/g, '<em>$1</em>-');
}

function formulaHTML(f) {
  return `C<sub>${f.c > 1 ? f.c : ''}</sub>H<sub>${f.h}</sub>`;
}

function salirModoDibujo() {
  if ($('modoDibujo').checked) {
    $('modoDibujo').checked = false;
    aplicarModo();
  }
}

function aplicarModo() {
  const dibujo = $('modoDibujo').checked;
  editor.options(dibujo ? 'nodepict' : 'depict');
  $('btnNombrarDibujo').hidden = !dibujo;
  if (dibujo) {
    editor.resetAtomColors(1);
    mensaje('Modo dibujo: dibuje un alcano y presione «Nombrar mi dibujo».');
  } else {
    mensaje('');
  }
}

$('btnGenerar').addEventListener('click', generar);
$('btnDesplegar').addEventListener('click', desplegar);
$('btnNombrarDibujo').addEventListener('click', nombrarDibujo);
$('modoDibujo').addEventListener('change', () => { if (editor) aplicarModo(); });
$('formRespuesta').addEventListener('submit', (e) => { e.preventDefault(); desplegar(); });
})();
