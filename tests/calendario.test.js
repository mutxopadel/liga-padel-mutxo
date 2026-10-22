'use strict';

// Caracterización de generarCalendario: fija lo que el código hace hoy.
// El algoritmo es aleatorio, así que la cobertura de rivales solo se acota.
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarScripts } = require('./cargar-scripts.js');

const entorno = cargarScripts(['estado.js', 'calendario.js', 'equidad.js']);
const generar = (n) => entorno.evaluar(`generarCalendario(${n}, ${n})`);

// El 8x8 tarda ~1,5 s: se genera una sola vez y lo comparten sus tests.
let calendario8;
const calendarioDe8 = () => {
  calendario8 = calendario8 || generar(8);
  return calendario8;
};

const clave = (a, b) => (a < b ? `${a}-${b}` : `${b}-${a}`);

// Cobertura tal como la mide el código: cruces distintos chica-chica,
// chico-chico y chica-chico (dirigido: chica de un lado, chico del otro).
function medirCobertura(calendario) {
  const gg = new Set();
  const bb = new Set();
  const gb = new Set();
  for (const jornada of calendario) {
    for (const { parejaA: a, parejaB: b } of jornada.partidos) {
      gg.add(clave(a.girlIdx, b.girlIdx));
      bb.add(clave(a.boyIdx, b.boyIdx));
      gb.add(`g${a.girlIdx}-b${b.boyIdx}`);
      gb.add(`g${b.girlIdx}-b${a.boyIdx}`);
    }
  }
  return { gg: gg.size, bb: bb.size, gb: gb.size };
}

function parejasDe(jornada) {
  return jornada.partidos.flatMap((p) => [p.parejaA, p.parejaB]);
}

function comprobarEstructura(calendario, n) {
  const vistas = new Set();
  for (const jornada of calendario) {
    // Con n impar la pareja que descansa también es una pareja de la liga.
    const descansa = jornada.descansa ? [jornada.descansa] : [];
    for (const pareja of [...parejasDe(jornada), ...descansa]) {
      const k = `${pareja.girlIdx}-${pareja.boyIdx}`;
      assert.ok(!vistas.has(k), `pareja repetida ${k}`);
      vistas.add(k);
    }
  }
  assert.equal(vistas.size, n * n);
}

test('8x8: 8 jornadas de 4 partidos, cada persona una vez por jornada', () => {
  const calendario = calendarioDe8();
  assert.equal(calendario.length, 8);
  calendario.forEach((jornada, r) => {
    assert.equal(jornada.numero, r + 1);
    assert.equal(jornada.partidos.length, 4);
    assert.equal(jornada.descansa, null);
    assert.equal(jornada.colapsada, false);
    const chicas = parejasDe(jornada).map((p) => p.girlIdx).sort();
    const chicos = parejasDe(jornada).map((p) => p.boyIdx).sort();
    const todos = [0, 1, 2, 3, 4, 5, 6, 7];
    assert.deepEqual(chicas, todos);
    assert.deepEqual(chicos, todos);
  });
});

test('8x8: nadie repite compañero y se forman las 64 parejas distintas', () => {
  comprobarEstructura(calendarioDe8(), 8);
});

test('8x8: los partidos nacen vacíos y con id j<n>-p<m>', () => {
  const [primera] = calendarioDe8();
  assert.deepEqual(primera.partidos.map((p) => p.id), ['j1-p1', 'j1-p2', 'j1-p3', 'j1-p4']);
  for (const partido of primera.partidos) {
    assert.equal(partido.completado, false);
    assert.equal(partido.ganadorPareja, null);
    assert.deepEqual(partido.sets, [{ a: null, b: null }, { a: null, b: null }, { a: null, b: null }]);
  }
});

test('8x8: la cobertura de rivales no supera el máximo y queda cerca de él', () => {
  const { gg, bb, gb } = medirCobertura(calendarioDe8());
  // Máximos: C(8,2)=28 chica-chica, 28 chico-chico y 8*8=64 chica-chico.
  assert.ok(gg <= 28 && bb <= 28 && gb <= 64);
  // Suelos holgados (valores observados: gg/bb 24-28, gb 54-64) para no ser frágil.
  assert.ok(gg >= 20, `gg=${gg}`);
  assert.ok(bb >= 20, `bb=${bb}`);
  assert.ok(gb >= 44, `gb=${gb}`);
});

test('5x5 (impar): 5 jornadas de 2 partidos y cada persona descansa una sola vez', () => {
  const calendario = generar(5);
  assert.equal(calendario.length, 5);
  comprobarEstructura(calendario, 5);
  const descansanChicas = [];
  const descansanChicos = [];
  for (const jornada of calendario) {
    assert.equal(jornada.partidos.length, 2);
    const chicas = new Set(parejasDe(jornada).map((p) => p.girlIdx));
    const chicos = new Set(parejasDe(jornada).map((p) => p.boyIdx));
    assert.equal(chicas.size, 4);
    assert.equal(chicos.size, 4);
    assert.ok(!chicas.has(jornada.descansa.girlIdx));
    assert.ok(!chicos.has(jornada.descansa.boyIdx));
    descansanChicas.push(jornada.descansa.girlIdx);
    descansanChicos.push(jornada.descansa.boyIdx);
  }
  assert.deepEqual(descansanChicas.sort(), [0, 1, 2, 3, 4]);
  assert.deepEqual(descansanChicos.sort(), [0, 1, 2, 3, 4]);
});

test('4x4: 4 jornadas de 2 partidos sin compañeros repetidos', () => {
  const calendario = generar(4);
  assert.equal(calendario.length, 4);
  assert.ok(calendario.every((j) => j.partidos.length === 2));
  comprobarEstructura(calendario, 4);
});

test('exige el mismo número de personas en cada columna', () => {
  assert.throws(() => entorno.evaluar('generarCalendario(8, 7)'), /mismo número/);
});
