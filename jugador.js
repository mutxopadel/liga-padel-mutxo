'use strict';

// Arranque y carga de la app de jugador (liga-oficial.json, modo consulta). Va aparte de app.js, que superaba el límite de tamaño.

/* ============================================================
   APP DE JUGADOR (`jugador.html`)

   Misma app, misma lógica: `jugador.html` carga este mismo `app.js` con
   `<body data-pagina="jugador">` y lo único que cambia es el arranque —
   modo consulta desde el primer instante (todas las salvaguardas de la
   Fase 4) y, en vez de leer localStorage, se descarga la liga que el admin
   ha publicado en `liga-oficial.json` dentro del propio sitio.

   Aquí NO se toca en ningún momento la clave `padel-liga-mutxo-v1`: no se
   llama a cargarEstado() y guardarEstado() está cortado por modoConsulta,
   así que las ligas del admin (si este navegador es también el suyo) quedan
   intactas byte a byte.
   ============================================================ */

const ARCHIVO_LIGA_OFICIAL = '../liga-oficial.json';

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

// Descarga la liga publicada por el admin y la pinta. `cache: 'no-store'`
// para que el navegador no sirva una versión vieja de su propia caché HTTP;
// del respaldo offline se encarga el service worker (red primero con
// fallback a la copia cacheada), así que un fallo de red aquí significa que
// no hay red Y no hay copia guardada.
async function cargarLigaOficial() {
  let respuesta;
  try {
    respuesta = await fetch(ARCHIVO_LIGA_OFICIAL, { cache: 'no-store' });
  } catch (err) {
    console.warn('No se ha podido descargar la liga publicada.', err);
    mostrarMensajeJugador('Sin conexión. Vuelve a intentarlo con internet.');
    return;
  }

  if (respuesta.status === 404) {
    mostrarMensajeJugador('El administrador aún no ha publicado la liga.');
    return;
  }

  let estado;
  try {
    if (!respuesta.ok) throw new Error(`respuesta ${respuesta.status}`);
    estado = await respuesta.json();
    // formaValidaLiga solo exige girls/boys/jornadas: el campo extra
    // `publicadoEl` que añade la publicación pasa sin problema.
    if (!formaValidaLiga(estado)) throw new Error('forma invalida');
  } catch (err) {
    console.warn('La liga publicada no se ha podido leer.', err);
    mostrarMensajeJugador('La liga publicada no se ha podido leer.');
    return;
  }

  ligaState = normalizarLiga(estado);
  ocultarMensajeJugador();
  mostrarFechaPublicacion(estado.publicadoEl);
  render();
}

// Arranque de `jugador.html`: solo lectura desde el primer instante y la
// liga viene de `liga-oficial.json`, no de localStorage.
function initJugador() {
  modoConsulta = true;

  registrarListenersComunes();
  registrarListenersJugador();
  registrarServiceWorker();

  cargarLigaOficial();
}

// Botón "Actualizar" de jugador.html, junto a la línea "Actualizado: …":
// fuerza una nueva descarga de liga-oficial.json sin recargar la página.
// cargarLigaOficial() ya gestiona los mensajes de error y repinta la fecha;
// aquí solo se cuida el estado visual del botón, siempre restaurado al
// terminar (éxito o error) con try/finally.
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
}
