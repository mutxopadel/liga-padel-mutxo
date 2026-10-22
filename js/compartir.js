'use strict';
// Compartir la liga por enlace con el estado comprimido en el fragmento de la URL.

/* ============================================================
   COMPARTIR POR ENLACE (estado comprimido en el fragmento de la URL,
   sin servidor: CompressionStream/DecompressionStream nativas del
   navegador + base64url)
   ============================================================ */

const URL_PUBLICA_LIGA = 'https://mutxopadel.github.io/liga-padel-mutxo/';

// ArrayBuffer -> base64url (sin '+', '/' ni '=', apto para un fragmento de URL).
function bufferABase64Url(buffer) {
  const bytes = new Uint8Array(buffer);
  let binario = '';
  for (let i = 0; i < bytes.length; i++) binario += String.fromCharCode(bytes[i]);
  const base64 = btoa(binario);
  return base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// base64url -> ArrayBuffer (inverso de bufferABase64Url).
function base64UrlABuffer(base64url) {
  let base64 = base64url.replace(/-/g, '+').replace(/_/g, '/');
  while (base64.length % 4 !== 0) base64 += '=';
  const binario = atob(base64);
  const bytes = new Uint8Array(binario.length);
  for (let i = 0; i < binario.length; i++) bytes[i] = binario.charCodeAt(i);
  return bytes.buffer;
}

// Comprime un texto con deflate-raw y devuelve el ArrayBuffer resultante.
// Función pura además de asíncrona: no toca el DOM ni el estado global,
// testeable directamente desde Node (ver notas de verificación).
async function comprimirTexto(texto) {
  const stream = new Blob([texto]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Response(stream).arrayBuffer();
}

// Descomprime un ArrayBuffer/Uint8Array deflate-raw y devuelve el texto.
async function descomprimirABuffer(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
  const buffer = await new Response(stream).arrayBuffer();
  return new TextDecoder().decode(buffer);
}

// Serializa un estado de liga a base64url comprimido, listo para meter en el hash.
async function comprimirEstadoABase64Url(estado) {
  const buffer = await comprimirTexto(JSON.stringify(estado));
  return bufferABase64Url(buffer);
}

// Inverso de comprimirEstadoABase64Url: de base64url a objeto de estado.
async function descomprimirBase64UrlAEstado(base64url) {
  const buffer = base64UrlABuffer(base64url);
  const json = await descomprimirABuffer(buffer);
  return JSON.parse(json);
}

function soportaCompressionStream() {
  return typeof CompressionStream !== 'undefined' && typeof DecompressionStream !== 'undefined';
}

// Compartir enlace (Fase 4): tras las comprobaciones de siempre (file://,
// soporte de CompressionStream), en vez de generar directamente el enlace
// editable se abre un modal para elegir entre "solo lectura" (#ver=) y
// "copia completa editable" (#liga=, igual que la Fase 2). Ambos usan
// exactamente el mismo payload comprimido — solo cambia el prefijo del hash.
async function compartirEnlace() {
  if (location.protocol === 'file:') {
    mostrarModal(
      `El enlace compartible solo funciona en la versión web publicada, no al abrir el archivo directamente. Usa ${URL_PUBLICA_LIGA} para compartir ligas por enlace.`,
      () => {}
    );
    return;
  }
  if (!soportaCompressionStream()) {
    mostrarModal('Este navegador no soporta la compresión necesaria para generar el enlace compartible.', () => {});
    return;
  }

  try {
    const datos = await comprimirEstadoABase64Url(ligaState);
    mostrarModalCompartir(datos);
  } catch (err) {
    console.error('Error al generar el enlace compartible', err);
    mostrarModal('No se ha podido generar el enlace compartible.', () => {});
  }
}

// Modal de elección de tipo de enlace. Reutiliza el patrón de los demás
// modales (overlay + listeners que se desenganchan al cerrar).
function mostrarModalCompartir(datosBase64) {
  const overlay = document.getElementById('modal-compartir-overlay');
  const btnLectura = document.getElementById('btn-enlace-lectura');
  const btnEditable = document.getElementById('btn-enlace-editable');
  const btnCancelar = document.getElementById('modal-compartir-cancelar');

  overlay.hidden = false;

  const cerrar = () => {
    overlay.hidden = true;
    btnLectura.removeEventListener('click', onLectura);
    btnEditable.removeEventListener('click', onEditable);
    btnCancelar.removeEventListener('click', cerrar);
  };
  function onLectura() {
    cerrar();
    copiarEnlaceGenerado('ver', datosBase64);
  }
  function onEditable() {
    cerrar();
    copiarEnlaceGenerado('liga', datosBase64);
  }

  btnLectura.addEventListener('click', onLectura);
  btnEditable.addEventListener('click', onEditable);
  btnCancelar.addEventListener('click', cerrar);
}

// Copia al portapapeles el enlace ya generado (mismo payload, prefijo según
// el tipo elegido) y da el mismo feedback visual de siempre en el botón.
async function copiarEnlaceGenerado(prefijo, datosBase64) {
  const btn = document.getElementById('btn-compartir');
  try {
    const url = `${location.origin}${location.pathname}#${prefijo}=${datosBase64}`;
    await navigator.clipboard.writeText(url);

    const textoOriginal = btn.textContent;
    btn.textContent = '¡Enlace copiado!';
    btn.disabled = true;
    setTimeout(() => {
      btn.textContent = textoOriginal;
      btn.disabled = false;
    }, 2000);
  } catch (err) {
    console.error('Error al copiar el enlace compartible', err);
    mostrarModal('No se ha podido copiar el enlace compartible.', () => {});
  }
}

// Al cargar la página con un hash "#liga=..." o "#ver=...": descomprime y
// valida con la MISMA validación de forma que importarJSON. "#liga=" sigue
// funcionando exactamente igual que en la Fase 2/3 (importa como liga nueva
// tras confirmación). "#ver=" entra en modo consulta (ver manejarHashVer).
async function manejarHashCompartido() {
  const hash = location.hash;

  if (hash.startsWith('#ver=')) {
    await manejarHashVer(hash.slice('#ver='.length));
    return;
  }

  if (!hash.startsWith('#liga=')) return;

  const datosHash = hash.slice('#liga='.length);
  const limpiarHash = () => history.replaceState(null, '', location.pathname + location.search);

  let estado;
  try {
    estado = await descomprimirBase64UrlAEstado(datosHash);
    if (!formaValidaLiga(estado)) throw new Error('forma invalida');
  } catch (err) {
    console.warn('Enlace de liga corrupto o inválido.', err);
    limpiarHash();
    mostrarModal('El enlace no contiene una liga válida; no se ha importado nada.', () => {});
    return;
  }

  limpiarHash();
  mostrarModal('¿Importar la liga del enlace? Se añadirá como una liga nueva sin tocar las que ya tienes.', () => {
    crearLiga('Liga importada', estado);
  });
}

// "#ver=...": modo consulta. A diferencia de "#liga=" NO se pregunta nada,
// NO se toca `appState` ni localStorage, y el hash NO se limpia (así
// recargar la página o reenviar la URL tal cual sigue funcionando). Un
// enlace corrupto recibe el MISMO tratamiento que un "#liga=" corrupto: aviso,
// se limpia el hash y la app queda utilizable en su estado normal.
async function manejarHashVer(datosHash) {
  let estado;
  try {
    estado = await descomprimirBase64UrlAEstado(datosHash);
    if (!formaValidaLiga(estado)) throw new Error('forma invalida');
  } catch (err) {
    console.warn('Enlace de solo lectura corrupto o inválido.', err);
    history.replaceState(null, '', location.pathname + location.search);
    mostrarModal('El enlace no contiene una liga válida; no se ha podido abrir.', () => {});
    return;
  }

  modoConsulta = true;
  ligaState = normalizarLiga(estado);
  activarModoConsulta();
}

// Ajusta la UI para el modo consulta: banner visible, pestaña/sección
// Jugadores y barra de ligas ocultas, pestaña activa inicial = Jornadas, y
// vuelve a renderizar (ya con modoConsulta=true, así que render()/
// crearInputSet()/crearPartidoCard() toman automáticamente el camino de
// solo lectura).
function activarModoConsulta() {
  document.getElementById('banner-modo-consulta').hidden = false;
  document.querySelector('.tab-btn[data-tab="jugadores"]').hidden = true;
  document.getElementById('ligas-barra').hidden = true;
  // Pestaña Jugadores oculta, pero Jornadas sí se ve en consulta — y ahí
  // vive ahora #btn-publicar (Remate). ?. porque jugador.html no tiene esta
  // fila (misma función no se llama ahí, pero por si el selector cambia).
  document.querySelector('.acciones-jornadas')?.setAttribute('hidden', '');
  activarTab('jornadas');
  render();
}

