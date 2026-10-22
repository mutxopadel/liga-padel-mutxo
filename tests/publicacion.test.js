'use strict';

// Funciones puras de la publicación: sin red ni DOM (node --test).
const test = require('node:test');
const assert = require('node:assert/strict');
const {
  codificarBase64Utf8,
  decodificarBase64Utf8,
  rutaLigaPublicada,
  enlaceJugador,
  construirContenidoPublicado,
  esLigaPrincipal,
} = require('../publicacion.js');

const URL_BASE = 'https://mutxopadel.github.io/liga-padel-mutxo/';

test('codificarBase64Utf8 conserva acentos, ñ y emojis', () => {
  const texto = '{"nombre":"Liga Señoría ☀️ Ñandú"}';
  const b64 = codificarBase64Utf8(texto);
  assert.equal(Buffer.from(b64, 'base64').toString('utf8'), texto);
});

test('decodificarBase64Utf8 invierte la codificación aunque traiga saltos de línea', () => {
  const texto = 'Pádel en Mutxo — jornada 1';
  const b64ConSaltos = codificarBase64Utf8(texto).replace(/(.{8})/g, '$1\n');
  assert.equal(decodificarBase64Utf8(b64ConSaltos), texto);
});

test('rutaLigaPublicada construye ligas/<id>.json para ids válidos', () => {
  assert.equal(rutaLigaPublicada('abc123xyz'), 'ligas/abc123xyz.json');
});

test('rutaLigaPublicada acepta los ids con guion de las ligas antiguas migradas', () => {
  assert.equal(rutaLigaPublicada('liga0-abc123'), 'ligas/liga0-abc123.json');
  assert.throws(() => rutaLigaPublicada('../x'), /no es válido/);
});

test('rutaLigaPublicada rechaza ids que no cumplen el patrón', () => {
  for (const id of ['', 'ABC', '../x', 'a b', 'a'.repeat(31), undefined]) {
    assert.throws(() => rutaLigaPublicada(id), /no es válido/);
  }
});

test('enlaceJugador apunta a jugador/?liga=<id>', () => {
  assert.equal(enlaceJugador(URL_BASE, 'abc123'), `${URL_BASE}jugador/?liga=abc123`);
});

test('construirContenidoPublicado añade fecha, id, nombre y creación sin tocar el estado', () => {
  const estado = { girls: ['Ana'], boys: ['Luis'], jornadas: [], liveGenerated: true };
  const entrada = { id: 'abc123', nombre: 'Liga Otoño', creadaEl: '2026-10-10T09:00:00.000Z', liga: estado };
  const contenido = construirContenidoPublicado(estado, entrada, '2026-10-22T10:00:00.000Z');
  assert.deepEqual(contenido, {
    girls: ['Ana'],
    boys: ['Luis'],
    jornadas: [],
    liveGenerated: true,
    publicadoEl: '2026-10-22T10:00:00.000Z',
    ligaId: 'abc123',
    nombre: 'Liga Otoño',
    creadaEl: '2026-10-10T09:00:00.000Z',
  });
  assert.equal('ligaId' in estado, false);
});

test('esLigaPrincipal compara el ligaId del fichero oficial', () => {
  assert.equal(esLigaPrincipal({ ligaId: 'abc123' }, 'abc123'), true);
  assert.equal(esLigaPrincipal({ ligaId: 'otra' }, 'abc123'), false);
  // liga-oficial.json antiguo, publicado antes de existir ligaId.
  assert.equal(esLigaPrincipal({ girls: [] }, 'abc123'), false);
  assert.equal(esLigaPrincipal(null, 'abc123'), false);
});
