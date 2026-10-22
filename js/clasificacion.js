'use strict';
// Lógica de partidos (sets, ganador) y cálculo de la clasificación.

/* ============================================================
   LÓGICA DE PARTIDOS (sets, ganador)
   ============================================================ */

function setJugado(set) {
  return !(set.a === 0 && set.b === 0) && set.a !== null && set.b !== null;
}

function ganadorSet(set) {
  if (!setJugado(set)) return null;
  if (set.a > set.b) return 'A';
  if (set.b > set.a) return 'B';
  return null;
}

function calcularGanadorPartido(partido) {
  let setsA = 0;
  let setsB = 0;
  for (const set of partido.sets) {
    const g = ganadorSet(set);
    if (g === 'A') setsA++;
    else if (g === 'B') setsB++;
  }
  if (setsA >= 2) return 'A';
  if (setsB >= 2) return 'B';
  return null;
}

/* ============================================================
   CLASIFICACIÓN
   ============================================================ */

function personaId(tipo, idx) {
  return `${tipo}${idx}`;
}

function nombrePersona(id) {
  const tipo = id[0];
  const idx = Number(id.slice(1));
  return tipo === 'g' ? ligaState.girls[idx] : ligaState.boys[idx];
}

function personasDePareja(pareja) {
  return [personaId('g', pareja.girlIdx), personaId('b', pareja.boyIdx)];
}

function todasLasPersonas() {
  const ids = [];
  for (let i = 0; i < ligaState.girls.length; i++) ids.push(personaId('g', i));
  for (let i = 0; i < ligaState.boys.length; i++) ids.push(personaId('b', i));
  return ids;
}

function partidosCompletados() {
  const resultado = [];
  for (const jornada of ligaState.jornadas) {
    for (const partido of jornada.partidos) {
      if (partido.completado) resultado.push(partido);
    }
  }
  return resultado;
}

function calcularClasificacion() {
  const stats = {};
  for (const id of todasLasPersonas()) {
    stats[id] = {
      id,
      nombre: nombrePersona(id),
      pj: 0,
      pg: 0,
      setsG: 0,
      setsP: 0,
      juegG: 0,
      juegP: 0,
      puntos: 0,
    };
  }

  for (const partido of partidosCompletados()) {
    const idsA = personasDePareja(partido.parejaA);
    const idsB = personasDePareja(partido.parejaB);

    let setsA = 0;
    let setsB = 0;
    let juegA = 0;
    let juegB = 0;
    for (const set of partido.sets) {
      if (!setJugado(set)) continue;
      juegA += set.a;
      juegB += set.b;
      const g = ganadorSet(set);
      if (g === 'A') setsA++;
      else if (g === 'B') setsB++;
    }

    for (const id of idsA) {
      stats[id].pj++;
      stats[id].setsG += setsA;
      stats[id].setsP += setsB;
      stats[id].juegG += juegA;
      stats[id].juegP += juegB;
    }
    for (const id of idsB) {
      stats[id].pj++;
      stats[id].setsG += setsB;
      stats[id].setsP += setsA;
      stats[id].juegG += juegB;
      stats[id].juegP += juegA;
    }

    if (partido.ganadorPareja === 'A') {
      for (const id of idsA) { stats[id].pg++; stats[id].puntos += 3; }
      for (const id of idsB) { stats[id].puntos += 1; }
    } else if (partido.ganadorPareja === 'B') {
      for (const id of idsB) { stats[id].pg++; stats[id].puntos += 3; }
      for (const id of idsA) { stats[id].puntos += 1; }
    }
    // sin ganador claro: 0 puntos para ambos, ya por defecto
  }

  return Object.values(stats);
}

function victoriasEnGrupo(idJugador, idsGrupo) {
  let victorias = 0;
  for (const partido of partidosCompletados()) {
    const idsA = personasDePareja(partido.parejaA);
    const idsB = personasDePareja(partido.parejaB);
    const enA = idsA.includes(idJugador);
    const enB = idsB.includes(idJugador);
    if (!enA && !enB) continue;

    const rivales = enA ? idsB : idsA;
    const rivalDelGrupo = rivales.some((id) => idsGrupo.includes(id));
    if (!rivalDelGrupo) continue;

    if ((enA && partido.ganadorPareja === 'A') || (enB && partido.ganadorPareja === 'B')) {
      victorias++;
    }
  }
  return victorias;
}

function ordenarClasificacion(stats) {
  const grupos = new Map();
  for (const s of stats) {
    if (!grupos.has(s.puntos)) grupos.set(s.puntos, []);
    grupos.get(s.puntos).push(s);
  }

  const resultado = [];
  for (const puntos of [...grupos.keys()].sort((a, b) => b - a)) {
    const grupo = grupos.get(puntos);
    const idsGrupo = grupo.map((s) => s.id);

    grupo.sort((a, b) => {
      const victA = victoriasEnGrupo(a.id, idsGrupo);
      const victB = victoriasEnGrupo(b.id, idsGrupo);
      if (victB !== victA) return victB - victA;
      const diffSetsA = a.setsG - a.setsP;
      const diffSetsB = b.setsG - b.setsP;
      if (diffSetsB !== diffSetsA) return diffSetsB - diffSetsA;
      const diffJuegosA = a.juegG - a.juegP;
      const diffJuegosB = b.juegG - b.juegP;
      if (diffJuegosB !== diffJuegosA) return diffJuegosB - diffJuegosA;
      return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' });
    });

    resultado.push(...grupo);
  }

  return resultado;
}

