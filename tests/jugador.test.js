'use strict';

// Pruebas de las funciones puras de la app de jugador. Sin red ni DOM.
const test = require('node:test');
const assert = require('node:assert');
const {
  esIdLigaValido,
  leerIdLigaDeUrl,
  anadirLiga,
  renombrarLiga,
  quitarLiga,
  sanearListaLigas,
  rutaDescargaLiga,
} = require('../jugador.js');

test('esIdLigaValido acepta minúsculas y dígitos y rechaza el resto', () => {
  assert.ok(esIdLigaValido('aaa111'));
  assert.ok(esIdLigaValido('a'.repeat(30)));
  for (const malo of ['', 'a'.repeat(31), 'ABC', '../x', 'a/b', 'a.b', 'a b', null, undefined, 5]) {
    assert.strictEqual(esIdLigaValido(malo), false, String(malo));
  }
});

test('esIdLigaValido acepta los ids con guion de las ligas antiguas migradas', () => {
  assert.ok(esIdLigaValido('liga0-abc123'));
  assert.strictEqual(esIdLigaValido('../x'), false);
});

test('leerIdLigaDeUrl lee de string y de URLSearchParams', () => {
  assert.strictEqual(leerIdLigaDeUrl('?liga=abc123'), 'abc123');
  assert.strictEqual(leerIdLigaDeUrl(new URLSearchParams('liga=abc123&x=1')), 'abc123');
});

test('leerIdLigaDeUrl ignora ids inválidos o ausentes', () => {
  assert.strictEqual(leerIdLigaDeUrl(''), null);
  assert.strictEqual(leerIdLigaDeUrl('?otra=abc'), null);
  assert.strictEqual(leerIdLigaDeUrl('?liga=../x'), null);
  assert.strictEqual(leerIdLigaDeUrl('?liga=ABC'), null);
  assert.strictEqual(leerIdLigaDeUrl(null), null);
});

test('anadirLiga usa el id como nombre provisional y no duplica', () => {
  const una = anadirLiga([], 'aaa');
  assert.deepStrictEqual(una, [{ id: 'aaa', nombre: 'aaa' }]);
  const conNombre = [{ id: 'aaa', nombre: 'Liga A' }];
  assert.deepStrictEqual(anadirLiga(conNombre, 'aaa'), conNombre);
  assert.deepStrictEqual(anadirLiga(conNombre, 'bbb'), [...conNombre, { id: 'bbb', nombre: 'bbb' }]);
});

test('anadirLiga, renombrarLiga y quitarLiga no mutan la lista original', () => {
  const lista = [{ id: 'aaa', nombre: 'aaa' }];
  anadirLiga(lista, 'bbb');
  renombrarLiga(lista, 'aaa', 'Nueva');
  quitarLiga(lista, 'aaa');
  assert.deepStrictEqual(lista, [{ id: 'aaa', nombre: 'aaa' }]);
});

test('renombrarLiga cambia solo la liga indicada e ignora nombres vacíos', () => {
  const lista = [{ id: 'aaa', nombre: 'aaa' }, { id: 'bbb', nombre: 'bbb' }];
  assert.deepStrictEqual(renombrarLiga(lista, 'bbb', ' Liga B '), [
    { id: 'aaa', nombre: 'aaa' },
    { id: 'bbb', nombre: 'Liga B' },
  ]);
  assert.deepStrictEqual(renombrarLiga(lista, 'bbb', '  '), lista);
  assert.deepStrictEqual(renombrarLiga(lista, 'bbb', undefined), lista);
});

test('quitarLiga elimina por id', () => {
  const lista = [{ id: 'aaa', nombre: 'A' }, { id: 'bbb', nombre: 'B' }];
  assert.deepStrictEqual(quitarLiga(lista, 'aaa'), [{ id: 'bbb', nombre: 'B' }]);
  assert.deepStrictEqual(quitarLiga(lista, 'zzz'), lista);
});

test('sanearListaLigas descarta basura, ids malos y repetidos', () => {
  assert.deepStrictEqual(sanearListaLigas(null), []);
  assert.deepStrictEqual(sanearListaLigas({}), []);
  const bruta = [
    { id: 'aaa', nombre: 'A' },
    { id: 'aaa', nombre: 'otra' },
    { id: '../x', nombre: 'mala' },
    { id: 'bbb' },
    null,
    'texto',
  ];
  assert.deepStrictEqual(sanearListaLigas(bruta), [
    { id: 'aaa', nombre: 'A' },
    { id: 'bbb', nombre: 'bbb' },
  ]);
});

test('rutaDescargaLiga: liga activa o principal', () => {
  assert.strictEqual(rutaDescargaLiga('aaa111'), '../ligas/aaa111.json');
  assert.strictEqual(rutaDescargaLiga(null), '../liga-oficial.json');
  assert.strictEqual(rutaDescargaLiga('../x'), '../liga-oficial.json');
});
