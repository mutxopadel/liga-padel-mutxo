'use strict';

// Caracterización de la lógica de partidos y la clasificación, con ligas
// construidas a mano (3 chicas y 3 chicos; ids internos g0..g2 y b0..b2).
const test = require('node:test');
const assert = require('node:assert/strict');
const { cargarScripts } = require('./cargar-scripts.js');

const entorno = cargarScripts(['estado.js', 'clasificacion.js']);

const NOMBRES = {
  girls: ['Ana', 'Bea', 'Cris'],
  boys: ['Dani', 'Edu', 'Fer'],
};

const sets = (...pares) => pares.map(([a, b]) => ({ a, b }));

// Partido terminado: pareja = [indice chica, indice chico].
function partido(parejaA, parejaB, setsJugados, ganadorPareja) {
  return {
    parejaA: { girlIdx: parejaA[0], boyIdx: parejaA[1] },
    parejaB: { girlIdx: parejaB[0], boyIdx: parejaB[1] },
    sets: setsJugados,
    completado: true,
    ganadorPareja,
  };
}

function cargarLiga(partidos, nombres = NOMBRES) {
  entorno.asignar('ligaState', { ...nombres, jornadas: [{ partidos }], liveGenerated: true });
}

function clasificar() {
  const stats = entorno.evaluar('calcularClasificacion()');
  const porNombre = Object.fromEntries(stats.map((s) => [s.nombre, s]));
  const orden = entorno.evaluar('ordenarClasificacion(calcularClasificacion())').map((s) => s.nombre);
  return { porNombre, orden };
}

const ganador = (partidoSets) => entorno.evaluar(`calcularGanadorPartido(${JSON.stringify({ sets: partidoSets })})`);

test('calcularGanadorPartido: 2-0 y 2-1 dan ganador', () => {
  assert.equal(ganador(sets([6, 2], [6, 3], [null, null])), 'A');
  assert.equal(ganador(sets([2, 6], [3, 6], [null, null])), 'B');
  assert.equal(ganador(sets([6, 4], [4, 6], [6, 3])), 'A');
  assert.equal(ganador(sets([6, 4], [4, 6], [3, 6])), 'B');
});

test('calcularGanadorPartido: sets incompletos o empatados no dan ganador', () => {
  assert.equal(ganador(sets([null, null], [null, null], [null, null])), null);
  assert.equal(ganador(sets([6, 2], [null, null], [null, null])), null);
  assert.equal(ganador(sets([6, 2], [2, 6], [null, null])), null);
  assert.equal(ganador(sets([6, 2], [null, 3], [null, null])), null);
});

test('calcularGanadorPartido: un set 0-0 cuenta como no jugado', () => {
  assert.equal(ganador(sets([6, 2], [0, 0], [6, 1])), 'A');
  assert.equal(ganador(sets([6, 2], [6, 3], [0, 0])), 'A');
  assert.equal(ganador(sets([6, 2], [0, 0], [0, 0])), null);
});

test('puntos: 3 por victoria y 1 por derrota, a ambos miembros de la pareja', () => {
  cargarLiga([partido([0, 0], [1, 1], sets([6, 0], [6, 0]), 'A')]);
  const { porNombre, orden } = clasificar();
  for (const nombre of ['Ana', 'Dani']) {
    assert.equal(porNombre[nombre].puntos, 3);
    assert.equal(porNombre[nombre].pg, 1);
  }
  for (const nombre of ['Bea', 'Edu']) {
    assert.equal(porNombre[nombre].puntos, 1);
    assert.equal(porNombre[nombre].pg, 0);
  }
  assert.equal(porNombre.Ana.pj, 1);
  assert.equal(porNombre.Ana.setsG, 2);
  assert.equal(porNombre.Ana.juegG, 12);
  assert.equal(porNombre.Bea.setsP, 2);
  assert.equal(porNombre.Bea.juegP, 12);
  assert.deepEqual(orden.slice(0, 4), ['Ana', 'Dani', 'Bea', 'Edu']);
});

test('los partidos sin completar no puntúan ni cuentan como jugados', () => {
  const pendiente = partido([0, 0], [1, 1], sets([6, 0], [6, 0]), 'A');
  pendiente.completado = false;
  cargarLiga([pendiente]);
  const { porNombre } = clasificar();
  assert.ok(Object.values(porNombre).every((s) => s.pj === 0 && s.puntos === 0));
});

test('un partido completado sin ganador deja 0 puntos a todos pero suma pj', () => {
  cargarLiga([partido([0, 0], [1, 1], sets([6, 2], [2, 6], [null, null]), null)]);
  const { porNombre } = clasificar();
  assert.equal(porNombre.Ana.pj, 1);
  assert.equal(porNombre.Ana.puntos, 0);
  assert.equal(porNombre.Bea.puntos, 0);
});

test('desempate 1: mini-liga (victorias entre empatados) gana a la diferencia de sets', () => {
  // Ana y Edu empatan a 4 puntos. Edu venció a un rival del grupo y Ana no,
  // aunque Ana tiene mejor diferencia de sets (+1 frente a 0).
  cargarLiga([
    partido([1, 1], [0, 0], sets([7, 6], [6, 7], [6, 4]), 'A'),
    partido([2, 2], [1, 1], sets([6, 4], [6, 4]), 'A'),
    partido([0, 2], [1, 0], sets([7, 6], [6, 7], [6, 4]), 'A'),
  ]);
  const { porNombre, orden } = clasificar();
  assert.equal(porNombre.Ana.puntos, 4);
  assert.equal(porNombre.Edu.puntos, 4);
  const dif = (s) => s.setsG - s.setsP;
  assert.ok(dif(porNombre.Ana) > dif(porNombre.Edu));
  assert.ok(orden.indexOf('Edu') < orden.indexOf('Ana'));
});

test('desempate 2: diferencia de sets cuando la mini-liga empata', () => {
  // Cris y Edu: 1 punto cada uno, sin victorias entre ellos. Cris tiene mejor
  // diferencia de sets aunque peor diferencia de juegos.
  cargarLiga([
    partido([2, 0], [1, 2], sets([2, 6], [6, 3], [3, 6]), 'B'),
    partido([0, 2], [1, 1], sets([7, 6], [7, 6]), 'A'),
  ]);
  const { porNombre, orden } = clasificar();
  const { Cris, Edu } = porNombre;
  assert.equal(Cris.puntos, Edu.puntos);
  assert.ok(Cris.setsG - Cris.setsP > Edu.setsG - Edu.setsP);
  assert.ok(Cris.juegG - Cris.juegP < Edu.juegG - Edu.juegP);
  assert.ok(orden.indexOf('Cris') < orden.indexOf('Edu'));
});

test('desempate 3: diferencia de juegos cuando mini-liga y sets empatan', () => {
  // Ana y Edu: 4 puntos, 1 victoria entre empatados cada uno, diferencia de
  // sets 0 los dos; solo difieren en juegos.
  cargarLiga([
    partido([0, 2], [2, 1], sets([6, 4], [6, 4]), 'A'),
    partido([0, 0], [2, 1], sets([0, 6], [0, 6]), 'B'),
  ]);
  const { porNombre, orden } = clasificar();
  const { Ana, Edu } = porNombre;
  assert.equal(Ana.puntos, Edu.puntos);
  assert.equal(Ana.setsG - Ana.setsP, Edu.setsG - Edu.setsP);
  const dj = (s) => s.juegG - s.juegP;
  assert.notEqual(dj(Ana), dj(Edu));
  const mejor = dj(Ana) > dj(Edu) ? 'Ana' : 'Edu';
  const peor = mejor === 'Ana' ? 'Edu' : 'Ana';
  assert.ok(orden.indexOf(mejor) < orden.indexOf(peor));
});

test('desempate 4: alfabético (sin tener en cuenta acentos ni mayúsculas) con todo igual', () => {
  const nombres = { girls: ['Zoe', 'Álvaro', 'beto'], boys: ['Dani', 'Edu', 'Fer'] };
  cargarLiga([], nombres);
  const { orden } = clasificar();
  assert.deepEqual(orden.slice(0, 3), ['Álvaro', 'beto', 'Dani']);
  assert.deepEqual(orden.slice(3), ['Edu', 'Fer', 'Zoe']);
});
