'use strict';

/* App de jugador (`jugador/index.html`): misma app que el admin pero en modo
   consulta desde el primer instante. En vez de leer la liga de localStorage,
   descarga la que el admin ha publicado: `ligas/<id>.json` si el jugador
   llegó con un enlace `?liga=<id>`, o `liga-oficial.json` (la principal) si
   no tiene ninguna guardada.

   Aquí NO se toca la clave `padel-liga-mutxo-v1`: no se llama a
   cargarEstado() y guardarEstado() está cortado por modoConsulta, así que las
   ligas del admin (si este navegador es también el suyo) quedan intactas.
   Las claves propias del jugador son las dos de abajo. */

const ARCHIVO_LIGA_OFICIAL = '../liga-oficial.json';
const CLAVE_LIGAS_JUGADOR = 'padel-liga-mutxo-jugador-ligas';
const CLAVE_ACTIVA_JUGADOR = 'padel-liga-mutxo-jugador-activa';
// Mismo patrón que valida el admin al publicar: el id acaba en una ruta, así
// que nada de barras ni puntos (evita `?liga=../x`). El guion, por los ids
// `liga0-xxxxxx` de las ligas antiguas migradas.
const PATRON_ID_LIGA = /^[a-z0-9-]{1,30}$/;

/* ---------- Funciones puras (probadas con node --test) ---------- */

// Indica si `id` puede usarse como id de liga (y por tanto en una ruta).
function esIdLigaValido(id) {
  return typeof id === 'string' && PATRON_ID_LIGA.test(id);
}

// Lee `?liga=` de un URLSearchParams o de un string de query; devuelve el id
// solo si es válido, para que un enlace manipulado se ignore sin más.
function leerIdLigaDeUrl(busqueda) {
  const params = typeof busqueda === 'string' ? new URLSearchParams(busqueda) : busqueda;
  if (!params || typeof params.get !== 'function') return null;
  const id = params.get('liga');
  return esIdLigaValido(id) ? id : null;
}

// Añade la liga a la lista sin duplicar; si ya estaba, se respeta el nombre
// guardado (el real, descargado antes). Devuelve una lista nueva.
function anadirLiga(lista, id, nombre, creadaEl) {
  if (lista.some((liga) => liga.id === id)) return lista.slice();
  const liga = { id, nombre: nombre || id };
  if (typeof creadaEl === 'string') liga.creadaEl = creadaEl;
  return [...lista, liga];
}

// Devuelve una lista nueva con el nombre actualizado (si el nombre es útil).
function renombrarLiga(lista, id, nombre) {
  if (typeof nombre !== 'string' || !nombre.trim()) return lista.slice();
  return lista.map((liga) => (liga.id === id ? { ...liga, nombre: nombre.trim() } : liga));
}

// Devuelve una lista nueva con la fecha de creación de la liga (si es string).
function fecharLiga(lista, id, creadaEl) {
  if (typeof creadaEl !== 'string') return lista.slice();
  return lista.map((liga) => (liga.id === id ? { ...liga, creadaEl } : liga));
}

// Orden del selector: la liga más antigua arriba, como en la app de gestión.
// Las que no tienen `creadaEl` van primero: se publicaron antes de que
// existiera ese campo, así que son más antiguas que cualquiera con fecha. Se
// mantiene su orden actual (Array.sort es estable). Devuelve una lista nueva.
function ordenarLigas(lista) {
  const sinFecha = lista.filter((liga) => typeof liga.creadaEl !== 'string');
  const conFecha = lista.filter((liga) => typeof liga.creadaEl === 'string')
    .sort((a, b) => (a.creadaEl < b.creadaEl ? -1 : a.creadaEl > b.creadaEl ? 1 : 0));
  return [...sinFecha, ...conFecha];
}

// Devuelve una lista nueva sin la liga indicada.
function quitarLiga(lista, id) {
  return lista.filter((liga) => liga.id !== id);
}

// Descarta entradas corruptas de lo leído de localStorage (puede haberlo
// editado cualquiera) y los ids repetidos.
function sanearListaLigas(bruta) {
  if (!Array.isArray(bruta)) return [];
  return bruta.reduce((lista, entrada) => {
    if (!entrada || !esIdLigaValido(entrada.id)) return lista;
    const nombre = typeof entrada.nombre === 'string' ? entrada.nombre : entrada.id;
    return anadirLiga(lista, entrada.id, nombre, entrada.creadaEl);
  }, []);
}

// Ruta a descargar: la liga activa si la hay; si no, la principal.
function rutaDescargaLiga(idActiva) {
  return esIdLigaValido(idActiva) ? `../ligas/${idActiva}.json` : ARCHIVO_LIGA_OFICIAL;
}

/* ---------- Almacenamiento (todo en try/catch: modo privado, cuota…) ---------- */

function leerLigasGuardadas() {
  try {
    return sanearListaLigas(JSON.parse(localStorage.getItem(CLAVE_LIGAS_JUGADOR)));
  } catch (err) {
    console.warn('No se han podido leer las ligas guardadas.', err);
    return [];
  }
}

function guardarLigasGuardadas(lista) {
  try {
    localStorage.setItem(CLAVE_LIGAS_JUGADOR, JSON.stringify(lista));
  } catch (err) {
    console.warn('No se han podido guardar las ligas.', err);
  }
}

// Id de la liga activa, solo si sigue estando en la lista guardada.
function leerLigaActiva(lista) {
  try {
    const id = localStorage.getItem(CLAVE_ACTIVA_JUGADOR);
    return lista.some((liga) => liga.id === id) ? id : null;
  } catch (err) {
    console.warn('No se ha podido leer la liga activa.', err);
    return null;
  }
}

function guardarLigaActiva(id) {
  try {
    if (id) localStorage.setItem(CLAVE_ACTIVA_JUGADOR, id);
    else localStorage.removeItem(CLAVE_ACTIVA_JUGADOR);
  } catch (err) {
    console.warn('No se ha podido guardar la liga activa.', err);
  }
}

// Si la URL trae un `?liga=` válido, lo guarda y lo marca activo.
function registrarLigaDeEnlace() {
  const id = leerIdLigaDeUrl(window.location.search);
  if (!id) return;
  guardarLigasGuardadas(anadirLiga(leerLigasGuardadas(), id));
  guardarLigaActiva(id);
  quitarLigaDeLaBarra();
}

// Una vez registrado, `?liga=` sobra en la barra: si se quedara, recargar
// después de cambiar de liga con el selector devolvería a la del enlace.
// replaceState conserva ruta y hash y no añade entrada al historial.
function quitarLigaDeLaBarra() {
  const url = new URL(window.location.href);
  url.searchParams.delete('liga');
  window.history.replaceState(window.history.state, '', url.pathname + url.search + url.hash);
}

/* ---------- Pantalla ---------- */

// Mensajes de la página de jugador. No hay modales de aviso en esta página:
// se escribe en un párrafo fijo bajo la cabecera, siempre con textContent.
function mostrarMensajeJugador(texto) {
  const el = document.getElementById('mensaje-jugador');
  if (!el) return;
  el.textContent = texto;
  el.hidden = false;
}

function ocultarMensajeJugador() {
  const el = document.getElementById('mensaje-jugador');
  if (el) el.hidden = true;
}

// "Actualizado: <fecha legible>" a partir del campo opcional `publicadoEl`
// (ISO) del JSON publicado. Si el campo no viene o no es una fecha válida,
// la línea sencillamente no se muestra.
function mostrarFechaPublicacion(publicadoEl) {
  const linea = document.getElementById('actualizado-jugador');
  if (!linea) return;
  if (typeof publicadoEl !== 'string' || !publicadoEl) return;
  const fecha = new Date(publicadoEl);
  if (Number.isNaN(fecha.getTime())) return;
  linea.textContent = `Actualizado: ${fecha.toLocaleString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })}`;
  linea.hidden = false;
}

function ocultarFechaPublicacion() {
  const linea = document.getElementById('actualizado-jugador');
  if (linea) linea.hidden = true;
}

// Pinta el selector de ligas; solo se ve con 2 o más ligas guardadas. Con
// `idSeleccionado` null queda sin opción marcada (la activa se acaba de retirar).
function pintarSelectorLigas(listaGuardada, idSeleccionado) {
  const lista = ordenarLigas(listaGuardada);
  const selector = document.getElementById('selector-liga-jugador');
  if (!selector) return;
  selector.hidden = lista.length < 2;
  selector.replaceChildren(
    ...lista.map((liga) => {
      const opcion = document.createElement('option');
      opcion.value = liga.id;
      opcion.textContent = liga.nombre;
      return opcion;
    })
  );
  const indice = lista.findIndex((liga) => liga.id === idSeleccionado);
  selector.selectedIndex = indice;
}

// Una liga que el admin ha retirado: se quita de la lista y se vacía la
// pantalla. Si quedan otras, la primera pasa a ser la activa y se descarga en
// el acto (así el jugador nunca se queda en blanco); el aviso se escribe
// DESPUÉS de esa carga porque una carga correcta borra el mensaje. No hay
// recursión sin fin: cada vuelta quita una liga de la lista.
async function gestionarLigaRetirada(id) {
  const lista = leerLigasGuardadas();
  const retirada = lista.find((liga) => liga.id === id);
  const restantes = quitarLiga(lista, id);
  guardarLigasGuardadas(restantes);
  guardarLigaActiva(restantes.length ? ordenarLigas(restantes)[0].id : null);
  ligaState = estadoInicial();
  render();
  ocultarFechaPublicacion();
  pintarSelectorLigas(restantes, null);

  const aviso = `La liga «${retirada ? retirada.nombre : id}» ya no está publicada.`;
  if (restantes.length) {
    // Si la carga siguiente falló, manda su mensaje (sin red, otra liga retirada…).
    if (await cargarLigaOficial()) mostrarMensajeJugador(aviso);
  } else {
    mostrarMensajeJugador(`${aviso} Pulsa Actualizar para ver la liga principal.`);
  }
}

// Guarda el nombre real y la fecha de creación de la liga (los del JSON) en la
// lista del jugador.
function recordarDatosLiga(id, estado) {
  if (!id) return;
  const lista = renombrarLiga(leerLigasGuardadas(), id, estado.nombre);
  guardarLigasGuardadas(fecharLiga(lista, id, estado.creadaEl));
}

// Descarga la liga activa (o la principal) y la pinta. `cache: 'no-store'`
// para que el navegador no sirva una versión vieja de su propia caché HTTP;
// del respaldo offline se encarga el service worker (red primero con
// fallback a la copia cacheada), así que un fallo de red aquí significa que
// no hay red Y no hay copia guardada. Devuelve true si la liga se pintó.
async function cargarLigaOficial() {
  const lista = leerLigasGuardadas();
  const idActiva = leerLigaActiva(lista);
  let respuesta;
  try {
    respuesta = await fetch(rutaDescargaLiga(idActiva), { cache: 'no-store' });
  } catch (err) {
    console.warn('No se ha podido descargar la liga publicada.', err);
    mostrarMensajeJugador('Sin conexión. Vuelve a intentarlo con internet.');
    return false;
  }

  if (respuesta.status === 404) {
    if (idActiva) await gestionarLigaRetirada(idActiva);
    else mostrarMensajeJugador('El administrador aún no ha publicado la liga.');
    return false;
  }

  let estado;
  try {
    if (!respuesta.ok) throw new Error(`respuesta ${respuesta.status}`);
    estado = await respuesta.json();
    // formaValidaLiga solo exige girls/boys/jornadas: los campos extra que
    // añade la publicación (`publicadoEl`, `ligaId`, `nombre`) pasan sin problema.
    if (!formaValidaLiga(estado)) throw new Error('forma invalida');
  } catch (err) {
    console.warn('La liga publicada no se ha podido leer.', err);
    mostrarMensajeJugador('La liga publicada no se ha podido leer.');
    return false;
  }

  recordarDatosLiga(idActiva, estado);
  pintarSelectorLigas(leerLigasGuardadas(), idActiva);
  ligaState = normalizarLiga(estado);
  ocultarMensajeJugador();
  mostrarFechaPublicacion(estado.publicadoEl);
  render();
  return true;
}

// Arranque de `jugador/index.html`: solo lectura desde el primer instante;
// la liga viene de `ligas/<id>.json` o de `liga-oficial.json`, no del
// localStorage del admin.
function initJugador() {
  modoConsulta = true;

  registrarLigaDeEnlace();
  registrarListenersComunes();
  registrarListenersJugador();
  registrarServiceWorker();

  cargarLigaOficial();
}

// Al volver atrás el navegador puede restaurar la página desde su caché
// (bfcache) con el selector y la liga que tenía antes de cambiar: se repinta
// el selector y se recarga la activa desde el almacenamiento.
function restaurarTrasVolver(evento) {
  if (!evento.persisted) return;
  const lista = leerLigasGuardadas();
  pintarSelectorLigas(lista, leerLigaActiva(lista));
  cargarLigaOficial();
}

// Botón "Actualizar" (recarga la liga activa sin recargar la página) y
// selector de liga. cargarLigaOficial() ya gestiona mensajes de error y
// fecha; aquí solo se cuida el estado visual del botón, restaurado siempre
// al terminar con try/finally.
function registrarListenersJugador() {
  const btnActualizar = document.getElementById('btn-actualizar-jugador');
  const textoOriginal = btnActualizar.textContent;
  btnActualizar.addEventListener('click', async () => {
    btnActualizar.disabled = true;
    btnActualizar.textContent = 'Actualizando…';
    try {
      await cargarLigaOficial();
    } finally {
      btnActualizar.disabled = false;
      btnActualizar.textContent = textoOriginal;
    }
  });

  const selector = document.getElementById('selector-liga-jugador');
  selector.addEventListener('change', () => {
    guardarLigaActiva(selector.value);
    cargarLigaOficial();
  });

  window.addEventListener('pageshow', restaurarTrasVolver);
}

// Exportación para los tests de Node; en el navegador `module` no existe.
if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    esIdLigaValido,
    leerIdLigaDeUrl,
    anadirLiga,
    renombrarLiga,
    fecharLiga,
    ordenarLigas,
    quitarLiga,
    sanearListaLigas,
    rutaDescargaLiga,
  };
}
