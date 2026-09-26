'use strict';
/**
 * Servidor Express: sirve la interfaz, el editor JSME (desde node_modules,
 * sin depender de CDN) y la API de generación / nomenclatura.
 */
const path = require('path');
const express = require('express');
const { Molecula } = require('./src/molecula');
const { nombrarTodo } = require('./src/nomenclatura');
const { generar } = require('./src/generador');

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || '127.0.0.1';

app.disable('x-powered-by');
app.use(express.json({ limit: '4kb' }));
app.use((req, res, next) => {
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'same-origin');
  next();
});

app.use('/jsme', express.static(path.join(__dirname, 'node_modules', 'jsme-editor'), { maxAge: '7d' }));
app.use(express.static(path.join(__dirname, 'public')));

/**
 * GET /api/generar?tipo=aciclico|ciclico|mixto&nivel=1|2|3
 * Devuelve solo la estructura (el nombre NO se envía para no revelarlo).
 */
app.get('/api/generar', (req, res) => {
  const tipo = ['aciclico', 'ciclico', 'mixto'].includes(req.query.tipo) ? req.query.tipo : 'mixto';
  const nivel = [1, 2, 3].includes(Number(req.query.nivel)) ? Number(req.query.nivel) : 2;
  try {
    const g = generar({ tipo, nivel });
    res.json({ smiles: g.smiles, ciclico: g.ciclico, nivel: g.nivel, formula: g.molecula.formula() });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/**
 * POST /api/nombrar  { smiles }
 * Nombra la estructura: nombre preferido IUPAC (PIN) y nombre general,
 * en español e inglés, más la justificación (padre, localizadores).
 */
app.post('/api/nombrar', (req, res) => {
  const { smiles, molfile } = req.body || {};
  const smilesOk = typeof smiles === 'string' && smiles.length <= 200;
  const molOk = typeof molfile === 'string' && molfile.length <= 8000;
  if (!smilesOk && !molOk) {
    return res.status(400).json({ error: 'Debe enviar un SMILES o un molfile válido' });
  }
  try {
    const mol = molOk ? Molecula.desdeMolfile(molfile) : Molecula.desdeSmiles(smiles);
    mol.validar();
    const n = nombrarTodo(mol);
    res.json({
      smiles: mol.aSmiles(0),
      formula: mol.formula(),
      pinEs: n.pinEs.nombre,
      generalEs: n.generalEs.nombre,
      pinEn: n.pin.nombre,
      generalEn: n.general.nombre,
      justificacion: {
        tipoPadre: n.pinEs.tipoPadre,
        nombrePadre: n.pinEs.nombrePadre,
        carbonosPadre: n.pinEs.carbonosPadre,
        atomosPadre: n.pinEs.atomosPadre,
        sustituyentes: n.pinEs.sustituyentes,
      },
    });
  } catch (e) {
    res.status(422).json({ error: e.message });
  }
});

app.listen(PORT, HOST, () => {
  console.log(`Alcanos IUPAC escuchando en http://${HOST}:${PORT}`);
});
