'use strict';
// Reparación de equidad del calendario ya elegido.

/* ============================================================
   REPARACIÓN DE EQUIDAD: tras elegir el mejor calendario, en vez de seguir
   optimizando el total a ciegas, se identifica a la persona con MENOS
   rivales distintos y se busca un intercambio concreto entre dos partidos
   de una misma jornada que le añada uno de sus rivales que le faltan — solo
   se aplica si no empeora a nadie más. Ataca directamente el peor caso
   (fairness), no la media.
   ============================================================ */

function idsPersonas(n) {
  const ids = [];
  for (let i = 0; i < n; i++) ids.push(`g${i}`);
  for (let i = 0; i < n; i++) ids.push(`b${i}`);
  return ids;
}

// Localiza en qué partido de una jornada (y en qué lado, A o B) juega una
// persona. Devuelve null si esa jornada la persona descansa.
function localizarEnAgrupamiento(agrupamiento, personId) {
  const tipo = personId[0];
  const idx = Number(personId.slice(1));
  for (let i = 0; i < agrupamiento.length; i++) {
    const [parejaA, parejaB] = agrupamiento[i];
    for (const lado of ['A', 'B']) {
      const pareja = lado === 'A' ? parejaA : parejaB;
      const coincide = tipo === 'g' ? pareja.girlIdx === idx : pareja.boyIdx === idx;
      if (coincide) return { partidoIdx: i, lado };
    }
  }
  return null;
}

// Contador incremental de rivalidades persona-a-persona: contador[id] es un
// Map oponente -> nº de veces que se han enfrentado. Se usa (en vez de
// recontar todo el calendario en cada intento) porque un solo intercambio
// entre dos partidos solo puede afectar a las 4 parejas implicadas — de
// lo contrario, para N grande, repasar toda la liga en cada intento de
// intercambio es demasiado lento (llegó a tardar >30s con N=16).
function crearContadorRivales(agrupamientos, n) {
  const contador = {};
  for (const id of idsPersonas(n)) contador[id] = new Map();
  for (const agrupamiento of agrupamientos) {
    for (const [parejaA, parejaB] of agrupamiento) {
      ajustarContadorPartido(contador, parejaA, parejaB, 1);
    }
  }
  return contador;
}

function ajustarContadorPartido(contador, parejaA, parejaB, delta) {
  const gA = `g${parejaA.girlIdx}`, bA = `b${parejaA.boyIdx}`;
  const gB = `g${parejaB.girlIdx}`, bB = `b${parejaB.boyIdx}`;
  for (const [x, y] of [[gA, bB], [bA, gB], [gA, gB], [bA, bB]]) {
    contador[x].set(y, (contador[x].get(y) || 0) + delta);
    contador[y].set(x, (contador[y].get(x) || 0) + delta);
  }
}

function distintosCubiertos(mapaOponentes) {
  let cubiertos = 0;
  for (const veces of mapaOponentes.values()) {
    if (veces > 0) cubiertos++;
  }
  return cubiertos;
}

// Acotado por construcción: como máximo RONDAS_MAXIMAS_EQUIDAD vueltas
// completas, y se para en cuanto una vuelta entera no logra ningún arreglo
// — nunca reintenta de forma indefinida. Recorre a TODAS las personas con
// hueco en cada vuelta (no solo a la peor cubierta): que una no tenga
// arreglo disponible no debe impedir arreglar a otras.
const RONDAS_MAXIMAS_EQUIDAD = 20;

function repararEquidad(agrupamientos, n) {
  const maxPosibles = 2 * n - 1;
  const contador = crearContadorRivales(agrupamientos, n);

  for (let ronda = 0; ronda < RONDAS_MAXIMAS_EQUIDAD; ronda++) {
    let algunArreglo = false;
    const necesitados = shuffle(
      idsPersonas(n).filter((id) => distintosCubiertos(contador[id]) < maxPosibles)
    );
    if (necesitados.length === 0) break; // todo el mundo cubre a todos

    for (const persona of necesitados) {
      if (distintosCubiertos(contador[persona]) >= maxPosibles) continue; // ya se arregló esta vuelta

      const faltantes = shuffle(
        idsPersonas(n).filter((id) => id !== persona && (contador[persona].get(id) || 0) === 0)
      );

      let arreglado = false;
      for (const candidato of faltantes) {
        for (let r = 0; r < agrupamientos.length && !arreglado; r++) {
          const locPersona = localizarEnAgrupamiento(agrupamientos[r], persona);
          const locCandidato = localizarEnAgrupamiento(agrupamientos[r], candidato);
          if (!locPersona || !locCandidato || locPersona.partidoIdx === locCandidato.partidoIdx) continue;

          const agrupamiento = agrupamientos[r];
          const partidoX = agrupamiento[locPersona.partidoIdx];
          const partidoY = agrupamiento[locCandidato.partidoIdx];
          const parejaX = locPersona.lado === 'A' ? partidoX[0] : partidoX[1];
          const parejaXop = locPersona.lado === 'A' ? partidoX[1] : partidoX[0];
          const parejaY = locCandidato.lado === 'A' ? partidoY[0] : partidoY[1];
          const parejaYop = locCandidato.lado === 'A' ? partidoY[1] : partidoY[0];

          const afectados = [parejaX, parejaXop, parejaY, parejaYop].flatMap((p) => [
            `g${p.girlIdx}`,
            `b${p.boyIdx}`,
          ]);
          const antes = {};
          for (const id of afectados) antes[id] = distintosCubiertos(contador[id]);

          ajustarContadorPartido(contador, parejaX, parejaXop, -1);
          ajustarContadorPartido(contador, parejaY, parejaYop, -1);
          ajustarContadorPartido(contador, parejaX, parejaY, 1);
          ajustarContadorPartido(contador, parejaXop, parejaYop, 1);

          const empeoraAAlguien = afectados.some((id) => distintosCubiertos(contador[id]) < antes[id]);
          if (empeoraAAlguien) {
            ajustarContadorPartido(contador, parejaX, parejaY, -1);
            ajustarContadorPartido(contador, parejaXop, parejaYop, -1);
            ajustarContadorPartido(contador, parejaX, parejaXop, 1);
            ajustarContadorPartido(contador, parejaY, parejaYop, 1);
          } else {
            agrupamiento[locPersona.partidoIdx] = [parejaX, parejaY];
            agrupamiento[locCandidato.partidoIdx] = [parejaXop, parejaYop];
            arreglado = true;
            algunArreglo = true;
          }
        }
        if (arreglado) break;
      }
    }

    if (!algunArreglo) break; // vuelta completa sin ningún arreglo: converge, parar
  }
}

// numGirls debe ser igual a numBoys (soporte para grupos desiguales, con
// distinto nº de chicas que de chicos, no implementado: requeriría decidir
// qué pasa con las personas sobrantes de más de un tipo cada jornada).
// numGirls/numBoys ya no están fijados a 8: cualquier tamaño funciona igual,
// par o impar — con n impar, una pareja descansa cada jornada por turnos
// (ver generarCandidato).
//
// Criterio de cobertura total de rivales: dado que la fase 2 es una búsqueda
// heurística (no existe una fórmula cerrada que garantice el óptimo para
// cualquier n), se generan varios calendarios candidatos completos y se
// devuelve el de mayor cobertura de rivalidad — acotado a
// CANDIDATOS_CALENDARIO intentos, siempre converge.
// Nota de extensión futura (sin implementar): un hipotético modo de "parejas
// fijas" (la pareja se decide una vez, no cada jornada) necesitaría un
// generador de calendario distinto — round-robin directo entre las parejas
// ya formadas, no entre personas de columnas separadas — y una clasificación
// por pareja en vez de por persona. Ver el detalle en README.md.
function generarCalendario(numGirls = 8, numBoys = 8) {
  if (numGirls !== numBoys) {
    throw new Error('generarCalendario requiere el mismo número de personas en cada columna.');
  }
  const n = numGirls;
  const coberturaMaxima = (n * (n - 1)) / 2 /* GG */ + (n * (n - 1)) / 2 /* BB */ + n * n /* GB */;

  let mejorCandidato = null;
  for (let intento = 0; intento < CANDIDATOS_CALENDARIO; intento++) {
    const candidato = generarCandidato(n);
    if (!mejorCandidato || candidato.cobertura > mejorCandidato.cobertura) {
      mejorCandidato = candidato;
    }
    if (mejorCandidato.cobertura === coberturaMaxima) break;
  }

  repararEquidad(mejorCandidato.agrupamientos, n);

  return mejorCandidato.agrupamientos.map((agrupamiento, r) => {
    const partidos = agrupamiento.map(([parejaA, parejaB], p) => ({
      id: `j${r + 1}-p${p + 1}`,
      parejaA,
      parejaB,
      sets: [
        { a: null, b: null },
        { a: null, b: null },
        { a: null, b: null },
      ],
      completado: false,
      ganadorPareja: null,
    }));
    return {
      numero: r + 1,
      partidos,
      colapsada: false,
      descansa: mejorCandidato.descansaPorJornada[r],
    };
  });
}

