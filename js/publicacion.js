'use strict';

// Publicación del admin vía la API de contenidos de GitHub: cada liga va en
// `ligas/<id>.json` (la ve quien tenga su enlace) y, si se pide, también en
// `liga-oficial.json` (la principal, la de quien abre la app sin enlace). El
// token se guarda SOLO en este dispositivo, en su propia clave de localStorage.

const TOKEN_STORAGE_KEY = 'padel-liga-mutxo-token';
const GITHUB_API_CONTENIDOS = 'https://api.github.com/repos/mutxopadel/liga-padel-mutxo/contents/';
const RUTA_LIGA_OFICIAL = 'liga-oficial.json';
// El id acaba en una ruta del repo y en una URL: minúsculas, dígitos y guion
// (las ligas antiguas migradas tienen ids `liga0-xxxxxx`), el mismo patrón
// con el que la app de jugador acepta `?liga=`.
const PATRON_ID_LIGA_PUBLICABLE = /^[a-z0-9-]{1,30}$/;

/* ---------- Funciones puras (probadas en tests/publicacion.test.js) ---------- */

// btoa(texto) a pelo revienta con cualquier carácter fuera de Latin1 (acentos,
// ñ, emojis en los nombres), así que se pasa siempre por bytes UTF-8.
function codificarBase64Utf8(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  bytes.forEach((byte) => { binario += String.fromCharCode(byte); });
  return btoa(binario);
}

/** Inverso de codificarBase64Utf8; tolera los saltos de línea que mete GitHub. */
function decodificarBase64Utf8(base64) {
  const binario = atob(base64.replace(/\s/g, ''));
  const bytes = Uint8Array.from(binario, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

/** Ruta del fichero publicado de una liga; lanza si el id no es publicable. */
function rutaLigaPublicada(id) {
  if (typeof id !== 'string' || !PATRON_ID_LIGA_PUBLICABLE.test(id)) {
    throw new Error(`el identificador de la liga («${id}») no es válido para publicar`);
  }
  return `ligas/${id}.json`;
}

/** Enlace que el admin pasa a los jugadores de una liga concreta. */
function enlaceJugador(urlBase, id) {
  return `${urlBase}jugador/?liga=${id}`;
}

/** Contenido que se sube: el estado de la liga más fecha, id, nombre y creación. */
function construirContenidoPublicado(estadoLiga, entrada, publicadoEl) {
  return {
    ...estadoLiga, publicadoEl, ligaId: entrada.id, nombre: entrada.nombre, creadaEl: entrada.creadaEl,
  };
}

/** ¿El `liga-oficial.json` remoto corresponde a la liga con este id? */
function esLigaPrincipal(contenidoOficial, id) {
  return Boolean(contenidoOficial) && contenidoOficial.ligaId === id;
}

/* ---------- Cliente de la API de contenidos de GitHub ---------- */

class ErrorGitHub extends Error {
  constructor(codigo) {
    super(`GitHub respondió con el código ${codigo}`);
    this.name = 'ErrorGitHub';
    this.codigo = codigo;
    this.tokenInvalido = codigo === 401 || codigo === 403;
  }
}

// `cache: 'no-store'` porque GitHub manda max-age=60: sin él, republicar en
// menos de un minuto leería un sha viejo y el PUT daría 409. Un token
// rechazado se borra para que la siguiente pulsación vuelva a pedirlo.
async function peticionGitHub(ruta, metodo, cuerpo) {
  const headers = {
    Authorization: `Bearer ${localStorage.getItem(TOKEN_STORAGE_KEY)}`,
    Accept: 'application/vnd.github+json',
  };
  if (cuerpo) headers['Content-Type'] = 'application/json';
  const respuesta = await fetch(GITHUB_API_CONTENIDOS + ruta, {
    method: metodo, cache: 'no-store', headers, body: cuerpo && JSON.stringify(cuerpo),
  });
  if (respuesta.ok) return respuesta;
  const error = new ErrorGitHub(respuesta.status);
  if (error.tokenInvalido) localStorage.removeItem(TOKEN_STORAGE_KEY);
  throw error;
}

// Un JSON remoto corrupto no debe bloquear publicar ni retirar: se trata como
// si no tuviera contenido reconocible, pero queda registrado.
function interpretarContenidoRemoto(base64) {
  try {
    return JSON.parse(decodificarBase64Utf8(base64 || ''));
  } catch (err) {
    console.warn('Contenido publicado ilegible', err);
    return null;
  }
}

/** Lee una ruta del repo: {sha, contenido} o null si no existe. */
async function leerRutaGitHub(ruta) {
  try {
    const datos = await (await peticionGitHub(ruta, 'GET')).json();
    return { sha: datos.sha, contenido: interpretarContenidoRemoto(datos.content) };
  } catch (err) {
    if (err instanceof ErrorGitHub && err.codigo === 404) return null;
    throw err;
  }
}

/** Crea (sin sha) o sobrescribe (con el sha actual) una ruta con un JSON. */
async function escribirRutaGitHub(ruta, contenido, sha, mensaje) {
  const cuerpo = { message: mensaje, content: codificarBase64Utf8(JSON.stringify(contenido, null, 2)) };
  if (sha) cuerpo.sha = sha;
  await peticionGitHub(ruta, 'PUT', cuerpo);
}

/** Borra una ruta; GitHub exige el sha de la versión que se borra. */
async function borrarRutaGitHub(ruta, sha, mensaje) {
  await peticionGitHub(ruta, 'DELETE', { message: mensaje, sha });
}

async function subirFichero(ruta, contenido, mensaje) {
  const actual = await leerRutaGitHub(ruta);
  await escribirRutaGitHub(ruta, contenido, actual?.sha, mensaje);
}

/** Traduce un error de publicación a texto para el admin. */
function describirErrorGitHub(err) {
  if (err instanceof ErrorGitHub && err.tokenInvalido) {
    return 'el token es inválido o ha caducado. Vuelve a pulsar el botón para introducir uno nuevo';
  }
  // fetch rechaza con TypeError cuando no hay red.
  if (err instanceof TypeError) return 'no hay conexión';
  return err.message;
}

// Aviso solo informativo (un botón «Entendido»). mostrarModal pide confirmar
// con Cancelar + Continuar en rojo, que confunde cuando no hay nada que decidir.
function mostrarAviso(mensaje) {
  document.getElementById('modal-aviso-mensaje').textContent = mensaje;
  document.getElementById('modal-aviso-overlay').hidden = false;
  document.getElementById('modal-aviso-cerrar').focus();
}

const botonPublicar = () => document.getElementById('btn-publicar');
const botonRetirar = () => document.getElementById('btn-retirar');

// El propio `disabled` de los botones es el cerrojo: evita dos operaciones a
// la vez (doble clic) sin otra variable global.
function operacionEnCurso() {
  return botonPublicar().disabled;
}

async function conOperacionEnCurso(boton, textoOcupado, accion, tarea) {
  const botones = [botonPublicar(), botonRetirar()];
  const textoOriginal = boton.textContent;
  botones.forEach((b) => { b.disabled = true; });
  boton.textContent = textoOcupado;
  try {
    await tarea();
  } catch (err) {
    console.error(`Error al ${accion}`, err);
    mostrarAviso(`No se ha podido ${accion}: ${describirErrorGitHub(err)}.`);
  } finally {
    botones.forEach((b) => { b.disabled = false; });
    boton.textContent = textoOriginal;
  }
}

// Pide el token si no hay uno guardado (primera vez o tras invalidarse).
function conToken(continuar) {
  if (localStorage.getItem(TOKEN_STORAGE_KEY)) {
    continuar();
    return;
  }
  const guardarYContinuar = (token) => {
    localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
    continuar();
  };
  mostrarModalTexto('Pega tu token de GitHub (se guarda solo en este dispositivo — ver README)', '',
    guardarYContinuar, { password: true });
}

/* ---------- Publicar ---------- */

/** Punto de entrada del botón Publicar. No hace nada en modo consulta. */
function publicarResultados() {
  if (modoConsulta || operacionEnCurso()) return;
  conToken(prepararPublicacion);
}

// Se lee la principal remota antes de abrir el modal para premarcar la
// casilla solo si esta liga ya es la principal: así republicar la principal
// no la «desmarca» por descuido.
function prepararPublicacion() {
  conOperacionEnCurso(botonPublicar(), 'Comprobando…', 'publicar', async () => {
    const entrada = entradaActiva();
    const oficial = await leerRutaGitHub(RUTA_LIGA_OFICIAL);
    document.getElementById('modal-publicar-mensaje').textContent =
      `Se publicará «${entrada.nombre}» en su propio enlace: la verá quien lo tenga.`;
    document.getElementById('modal-publicar-principal').checked =
      esLigaPrincipal(oficial?.contenido, entrada.id);
    document.getElementById('modal-publicar-overlay').hidden = false;
  });
}

function confirmarPublicacion() {
  const principal = document.getElementById('modal-publicar-principal').checked;
  document.getElementById('modal-publicar-overlay').hidden = true;
  conOperacionEnCurso(botonPublicar(), 'Publicando…', 'publicar', () => ejecutarPublicacion(principal));
}

// Primero el fichero propio de la liga y después, si toca, la principal: si
// la segunda subida falla, la liga sigue accesible por su enlace.
async function ejecutarPublicacion(principal) {
  const entrada = entradaActiva();
  const enlace = enlaceJugador(URL_PUBLICA_LIGA, entrada.id);
  const contenido = construirContenidoPublicado(ligaState, entrada, new Date().toISOString());
  const mensajeCommit = `Publica «${entrada.nombre}» — ${contenido.publicadoEl}`;
  await subirFichero(rutaLigaPublicada(entrada.id), contenido, mensajeCommit);
  if (!principal) {
    mostrarPublicado(`«${entrada.nombre}» publicada. Pasa este enlace a sus jugadores (visible en ~1 min):`, enlace);
    return;
  }
  try {
    await subirFichero(RUTA_LIGA_OFICIAL, contenido, `${mensajeCommit} (principal)`);
  } catch (err) {
    console.error('Error al publicar como liga principal', err);
    mostrarPublicado(`«${entrada.nombre}» quedó publicada en su enlace, pero NO como liga principal ` +
      `(${describirErrorGitHub(err)}). La principal sigue siendo la anterior. Enlace de esta liga:`, enlace);
    return;
  }
  mostrarPublicado(`«${entrada.nombre}» publicada y es ahora la liga principal (visible en ~1 min). Su enlace:`, enlace);
}

function mostrarPublicado(mensaje, enlace) {
  document.getElementById('modal-publicado-mensaje').textContent = mensaje;
  document.getElementById('modal-publicado-enlace').textContent = enlace;
  document.getElementById('modal-publicado-copiar').textContent = 'Copiar enlace';
  document.getElementById('modal-publicado-overlay').hidden = false;
}

// El enlace va en un texto (no un input) para que haga salto de línea y se vea
// entero en móvil. Se selecciona con Range: si el portapapeles no está
// disponible (http sin localhost, permiso denegado) queda marcado para
// copiarlo a mano.
async function copiarEnlacePublicado() {
  const elemento = document.getElementById('modal-publicado-enlace');
  const boton = document.getElementById('modal-publicado-copiar');
  const rango = document.createRange();
  rango.selectNodeContents(elemento);
  const seleccion = window.getSelection();
  seleccion.removeAllRanges();
  seleccion.addRange(rango);
  try {
    await navigator.clipboard.writeText(elemento.textContent);
    boton.textContent = '¡Copiado!';
  } catch (err) {
    console.warn('No se ha podido copiar el enlace al portapapeles', err);
    boton.textContent = 'Cópialo a mano';
  }
}

/** Punto de entrada del botón Retirar publicación. */
function retirarPublicacion() {
  if (modoConsulta || operacionEnCurso()) return;
  conToken(confirmarRetirada);
}

function confirmarRetirada() {
  const entrada = entradaActiva();
  mostrarModal(
    `Se retirará la publicación de «${entrada.nombre}»: su enlace dejará de funcionar para los jugadores. ¿Continuar?`,
    () => conOperacionEnCurso(botonRetirar(), 'Retirando…', 'retirar la publicación', () => ejecutarRetirada(entrada))
  );
}

// La principal no se retira: los jugadores sin enlace se quedarían sin liga.
async function ejecutarRetirada(entrada) {
  const oficial = await leerRutaGitHub(RUTA_LIGA_OFICIAL);
  if (esLigaPrincipal(oficial?.contenido, entrada.id)) {
    mostrarAviso(`«${entrada.nombre}» es la liga principal (la que ven los jugadores sin enlace), así que no se ` +
      'puede retirar. Publica antes otra liga marcando «liga principal» y después retira esta.');
    return;
  }
  const ruta = rutaLigaPublicada(entrada.id);
  const publicada = await leerRutaGitHub(ruta);
  if (!publicada) {
    mostrarAviso('Esta liga no estaba publicada.');
    return;
  }
  await borrarRutaGitHub(ruta, publicada.sha, `Retira «${entrada.nombre}»`);
  mostrarAviso(`Publicación de «${entrada.nombre}» retirada: su enlace dejará de funcionar en ~1 min.`);
}

// arranque.js ya engancha #btn-publicar; aquí van los controles propios de la
// publicación, que solo existen en index.html (el script va al final del body).
function registrarListenersPublicacion() {
  botonRetirar().addEventListener('click', retirarPublicacion);
  document.getElementById('modal-publicar-confirmar').addEventListener('click', confirmarPublicacion);
  document.getElementById('modal-publicado-copiar').addEventListener('click', copiarEnlacePublicado);
  const cerrarAlPulsar = (idBoton, idOverlay) => document.getElementById(idBoton)
    .addEventListener('click', () => { document.getElementById(idOverlay).hidden = true; });
  cerrarAlPulsar('modal-publicar-cancelar', 'modal-publicar-overlay');
  cerrarAlPulsar('modal-publicado-cerrar', 'modal-publicado-overlay');
  cerrarAlPulsar('modal-aviso-cerrar', 'modal-aviso-overlay');
}

if (typeof document !== 'undefined') registrarListenersPublicacion();

if (typeof module !== 'undefined' && module.exports) {
  module.exports = {
    codificarBase64Utf8, decodificarBase64Utf8, rutaLigaPublicada,
    enlaceJugador, construirContenidoPublicado, esLigaPrincipal,
  };
}
