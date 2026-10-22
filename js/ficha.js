'use strict';
// Ficha de jugador: cálculo de sus datos y su modal.

/* ============================================================
   FICHA DE JUGADOR

   Modal de solo consulta con el detalle de un jugador: resumen (mismos
   números que la tabla, reutilizando calcularClasificacion/
   ordenarClasificacion), historial de partidos completados, compañeros/
   rivales aún pendientes según el calendario completo, y evolución de
   posición jornada a jornada. Ninguna función de esta sección llama a
   guardarEstado() ni muta ligaState de forma persistente: es pura consulta,
   funciona igual con modoConsulta activado.
   ============================================================ */

// Partido completado o no en el que participa personId, con quién jugó de
// compañero y contra quién, tal cual lo ve ese partido concreto. Se comparte
// entre historialDeJugador() y pendientesDeJugador() para no repetir la
// lógica de "¿en qué lado juega esta persona y quién más hay en ese partido?".
function participacionEnPartido(partido, personId) {
  const idsA = personasDePareja(partido.parejaA);
  const idsB = personasDePareja(partido.parejaB);
  const enA = idsA.includes(personId);
  const enB = idsB.includes(personId);
  if (!enA && !enB) return null;
  const propios = enA ? idsA : idsB;
  const rivales = enA ? idsB : idsA;
  const companeroId = propios.find((id) => id !== personId) || null;
  const lado = enA ? 'A' : 'B';
  return { lado, companeroId, rivalesIds: rivales };
}

// Historial de partidos COMPLETADOS de un jugador, ordenado por jornada.
// Cada entrada: { jornadaNumero, companeroId, rivalesIds, sets, gano, perdio }.
// Función pura, testeable desde consola: historialDeJugador('g0').
function historialDeJugador(personId) {
  const historial = [];
  for (const jornada of ligaState.jornadas) {
    for (const partido of jornada.partidos) {
      if (!partido.completado) continue;
      const participacion = participacionEnPartido(partido, personId);
      if (!participacion) continue;
      const gano = partido.ganadorPareja === participacion.lado;
      const perdio = partido.ganadorPareja !== null && partido.ganadorPareja !== participacion.lado;
      historial.push({
        jornadaNumero: jornada.numero,
        companeroId: participacion.companeroId,
        rivalesIds: participacion.rivalesIds,
        sets: partido.sets,
        gano,
        perdio,
      });
    }
  }
  historial.sort((a, b) => a.jornadaNumero - b.jornadaNumero);
  return historial;
}

// Compañeros/as y rivales con los que personId TODAVÍA no ha coincidido,
// recorriendo TODO el calendario (partidos completados o no: el calendario ya
// fija quién juega con quién). "Compañero posible" se limita a la columna
// opuesta (la única con la que se puede formar pareja); "rival posible"
// incluye a cualquier otra persona, de cualquier columna. Función pura,
// testeable desde consola: pendientesDeJugador('g0').
function pendientesDeJugador(personId) {
  const tipo = personId[0];
  const companerosPosibles = tipo === 'g'
    ? ligaState.boys.map((_, i) => personaId('b', i))
    : ligaState.girls.map((_, i) => personaId('g', i));

  const companerosVistos = new Set();
  const rivalesVistos = new Set();

  for (const jornada of ligaState.jornadas) {
    for (const partido of jornada.partidos) {
      const participacion = participacionEnPartido(partido, personId);
      if (!participacion) continue;
      if (participacion.companeroId) companerosVistos.add(participacion.companeroId);
      participacion.rivalesIds.forEach((id) => rivalesVistos.add(id));
    }
  }

  const pendientesPareja = companerosPosibles.filter((id) => !companerosVistos.has(id));
  const pendientesRival = todasLasPersonas()
    .filter((id) => id !== personId)
    .filter((id) => !rivalesVistos.has(id));

  return { pendientesPareja, pendientesRival };
}

// Ejecuta fn() con `ligaState` apuntando temporalmente a las mismas columnas
// pero con `jornadas` sustituido, y lo restaura después SIEMPRE (incluso si
// fn lanza). Es el mecanismo que usa evolucionPosiciones() para reutilizar
// calcularClasificacion()/ordenarClasificacion() tal cual —sin duplicar sus
// fórmulas— recalculando la clasificación como si solo existieran las
// jornadas pasadas hasta un punto dado. Seguro porque es 100% síncrono (sin
// await de por medio): no hay manejador de evento que pueda colarse y ver el
// ligaState sustituido a medio camino.
function conJornadasTemporales(jornadasTemporales, fn) {
  const original = ligaState;
  ligaState = { ...original, jornadas: jornadasTemporales };
  try {
    return fn();
  } finally {
    ligaState = original;
  }
}

// Posición de personId en cada jornada que ya tiene al menos un partido
// completado, recalculando la clasificación acumulada (jornadas 1..k) en
// cada punto. [{ jornadaNumero, posicion }]. Función pura, testeable desde
// consola: evolucionPosiciones('g0').
function evolucionPosiciones(personId) {
  const evolucion = [];
  for (let k = 0; k < ligaState.jornadas.length; k++) {
    const jornada = ligaState.jornadas[k];
    if (!jornada.partidos.some((p) => p.completado)) continue;
    const jornadasHastaAqui = ligaState.jornadas.slice(0, k + 1);
    const posicion = conJornadasTemporales(jornadasHastaAqui, () => {
      const stats = ordenarClasificacion(calcularClasificacion());
      return stats.findIndex((s) => s.id === personId) + 1;
    });
    evolucion.push({ jornadaNumero: jornada.numero, posicion });
  }
  return evolucion;
}

function crearElementoFicha(tag, className, texto) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (texto !== undefined) el.textContent = texto;
  return el;
}

function construirCabeceraFicha(personId, nombre, posicion) {
  const cabecera = crearElementoFicha('div', 'ficha-cabecera');
  cabecera.appendChild(crearElementoFicha('h2', 'ficha-nombre', nombre || '—'));
  cabecera.appendChild(crearElementoFicha('p', 'ficha-posicion', `${posicion}º en la clasificación`));
  return cabecera;
}

function construirResumenFicha(datos) {
  const resumen = crearElementoFicha('div', 'ficha-resumen');
  const pp = datos.pj - datos.pg;
  const items = [
    ['PJ', datos.pj],
    ['PG', datos.pg],
    ['PP', pp],
    ['Sets a favor', datos.setsG],
    ['Sets en contra', datos.setsP],
    ['Juegos a favor', datos.juegG],
    ['Juegos en contra', datos.juegP],
    ['Puntos', datos.puntos],
  ];
  items.forEach(([etiqueta, valor]) => {
    const tile = crearElementoFicha('div', 'ficha-stat');
    tile.appendChild(crearElementoFicha('span', 'ficha-stat-valor', String(valor)));
    tile.appendChild(crearElementoFicha('span', 'ficha-stat-etiqueta', etiqueta));
    resumen.appendChild(tile);
  });
  return resumen;
}

function construirHistorialFicha(personId) {
  const seccion = crearElementoFicha('div', 'ficha-seccion');
  seccion.appendChild(crearElementoFicha('h3', null, 'Historial de partidos'));

  const historial = historialDeJugador(personId);
  if (!historial.length) {
    seccion.appendChild(crearElementoFicha('p', 'ficha-vacio', 'Aún no ha completado ningún partido.'));
    return seccion;
  }

  const lista = crearElementoFicha('ul', 'ficha-historial-lista');
  historial.forEach((h) => {
    const li = document.createElement('li');
    li.className = 'ficha-historial-item' + (h.gano ? ' ganado' : h.perdio ? ' perdido' : '');

    const cabeceraLi = crearElementoFicha('div', 'ficha-historial-cabecera');
    cabeceraLi.appendChild(crearElementoFicha('span', 'ficha-historial-jornada', `Jornada ${h.jornadaNumero}`));
    cabeceraLi.appendChild(crearElementoFicha(
      'span',
      'ficha-historial-resultado',
      h.gano ? 'Ganado' : h.perdio ? 'Perdido' : 'Sin decidir'
    ));
    li.appendChild(cabeceraLi);

    const companeroNombre = (h.companeroId && nombrePersona(h.companeroId)) || '—';
    const rivalesNombres = h.rivalesIds.map((id) => nombrePersona(id) || '—').join(' / ');
    li.appendChild(crearElementoFicha('p', 'ficha-historial-detalle', `Con ${companeroNombre} vs ${rivalesNombres}`));

    const marcador = h.sets.filter(setJugado).map((s) => `${s.a}-${s.b}`).join(', ') || 'Sin sets registrados';
    li.appendChild(crearElementoFicha('p', 'ficha-historial-marcador', marcador));

    lista.appendChild(li);
  });
  seccion.appendChild(lista);
  return seccion;
}

function construirPendientesFicha(personId) {
  const seccion = crearElementoFicha('div', 'ficha-seccion');
  seccion.appendChild(crearElementoFicha('h3', null, 'Pendientes'));

  const { pendientesPareja, pendientesRival } = pendientesDeJugador(personId);

  const bloquePareja = crearElementoFicha('div', 'ficha-pendientes-bloque');
  bloquePareja.appendChild(crearElementoFicha('p', 'ficha-pendientes-titulo', 'Pendientes como pareja'));
  bloquePareja.appendChild(crearElementoFicha(
    'p',
    'ficha-pendientes-lista',
    pendientesPareja.length ? pendientesPareja.map((id) => nombrePersona(id) || '—').join(', ') : 'Nadie pendiente'
  ));
  seccion.appendChild(bloquePareja);

  const bloqueRival = crearElementoFicha('div', 'ficha-pendientes-bloque');
  bloqueRival.appendChild(crearElementoFicha('p', 'ficha-pendientes-titulo', 'Pendientes como rival'));
  bloqueRival.appendChild(crearElementoFicha(
    'p',
    'ficha-pendientes-lista',
    pendientesRival.length ? pendientesRival.map((id) => nombrePersona(id) || '—').join(', ') : 'Nadie pendiente'
  ));
  seccion.appendChild(bloqueRival);

  return seccion;
}

function construirEvolucionFicha(personId) {
  const seccion = crearElementoFicha('div', 'ficha-seccion');
  seccion.appendChild(crearElementoFicha('h3', null, 'Evolución de posición'));

  const evolucion = evolucionPosiciones(personId);
  if (!evolucion.length) {
    seccion.appendChild(crearElementoFicha('p', 'ficha-vacio', 'Aún no hay ninguna jornada completada.'));
    return seccion;
  }

  const texto = evolucion.map((e) => `J${e.jornadaNumero}: ${e.posicion}º`).join(' · ');
  seccion.appendChild(crearElementoFicha('p', 'ficha-evolucion-lista', texto));
  return seccion;
}

// Id de la persona cuya ficha está abierta ahora mismo (para el botón "Sacar
// imagen"). null cuando el modal está cerrado.
// Estado global mutable aceptado (misma excepción que estado.js): scripts clásicos sin módulos.
let fichaAbiertaPersonId = null;

function abrirFichaJugador(personId) {
  const stats = ordenarClasificacion(calcularClasificacion());
  const posicion = stats.findIndex((s) => s.id === personId) + 1;
  const datos = stats.find((s) => s.id === personId);
  if (!datos) return; // persona inexistente (estado manipulado a mano): no hay ficha que abrir

  const nombre = nombrePersona(personId);
  const cuerpo = document.getElementById('modal-ficha-cuerpo');
  cuerpo.innerHTML = '';
  cuerpo.appendChild(construirCabeceraFicha(personId, nombre, posicion));
  cuerpo.appendChild(construirResumenFicha(datos));
  cuerpo.appendChild(construirHistorialFicha(personId));
  cuerpo.appendChild(construirPendientesFicha(personId));
  cuerpo.appendChild(construirEvolucionFicha(personId));

  fichaAbiertaPersonId = personId;
  document.getElementById('modal-ficha-overlay').hidden = false;
}

function cerrarFichaJugador() {
  document.getElementById('modal-ficha-overlay').hidden = true;
  fichaAbiertaPersonId = null;
}

// Nombre de archivo apto para descarga a partir del nombre del jugador (sin
// acentos ni caracteres raros); si queda vacío (nombre en blanco), usa un
// nombre genérico para no producir un archivo sin extensión visible.
function slugArchivo(texto) {
  const slug = String(texto || '')
    .toLowerCase()
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
  return slug || 'jugador';
}

