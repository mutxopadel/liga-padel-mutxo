'use strict';
// Tabs e inicialización de la página (DOMContentLoaded); se carga el último.

/* ============================================================
   TABS
   ============================================================ */

function activarTab(nombreTab) {
  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.tab === nombreTab);
  });
  document.querySelectorAll('.tab-section').forEach((section) => {
    section.classList.toggle('active', section.id === `tab-${nombreTab}`);
  });
}

/* ============================================================
   INICIALIZACIÓN

   Dos arranques distintos sobre el MISMO código: `index.html` (admin) e
   `jugador.html`. Los listeners se registran por página — cada bloque solo
   se llama desde la página cuyos elementos existen — en vez de sembrar
   null-checks por todas partes.
   ============================================================ */

function init() {
  if (document.body.dataset.pagina === 'jugador') {
    initJugador();
    return;
  }
  initAdmin();
}

// Arranque de `index.html`: el de siempre.
function initAdmin() {
  cargarEstado();
  render();

  registrarListenersComunes();
  registrarListenersAdmin();

  manejarHashCompartido();
  registrarServiceWorker();
}

// Listeners de elementos que existen en las DOS páginas.
function registrarListenersComunes() {
  document.getElementById('tab-nav').addEventListener('click', (e) => {
    const btn = e.target.closest('.tab-btn');
    if (!btn) return;
    activarTab(btn.dataset.tab);
  });

  document.getElementById('btn-imagen-clasificacion').addEventListener('click', () => {
    const fecha = new Date().toISOString().slice(0, 10);
    capturarImagen(document.getElementById('clasificacion-capturable'), `clasificacion-padel-mutxo-${fecha}`);
  });

  // Ficha de jugador (Fase 5): botón "Cerrar" y clic fuera del cuadro (el
  // resto de modales de la app no cierra con clic fuera; se añade solo aquí).
  document.getElementById('modal-ficha-cerrar').addEventListener('click', cerrarFichaJugador);
  document.getElementById('modal-ficha-overlay').addEventListener('click', (e) => {
    if (e.target === e.currentTarget) cerrarFichaJugador();
  });
  document.getElementById('modal-ficha-imagen').addEventListener('click', () => {
    if (!fichaAbiertaPersonId) return;
    const nombre = nombrePersona(fichaAbiertaPersonId);
    capturarImagen(document.getElementById('modal-ficha'), `ficha-${slugArchivo(nombre)}-padel-mutxo`);
  });
}

// Listeners de los controles de gestión, que solo existen en `index.html`.
function registrarListenersAdmin() {
  document.getElementById('selector-liga').addEventListener('change', (e) => {
    activarLiga(e.target.value);
  });
  document.getElementById('btn-liga-nueva').addEventListener('click', nuevaLiga);
  document.getElementById('btn-liga-renombrar').addEventListener('click', renombrarLigaActiva);
  document.getElementById('btn-liga-eliminar').addEventListener('click', eliminarLigaActiva);

  document.getElementById('btn-agregar-fila').addEventListener('click', agregarFila);
  document.getElementById('btn-generar-liga').addEventListener('click', generarLiga);
  document.getElementById('loading-aceptar').addEventListener('click', ocultarGenerando);
  document.getElementById('btn-exportar').addEventListener('click', exportarJSON);
  document.getElementById('btn-compartir').addEventListener('click', compartirEnlace);
  document.getElementById('btn-publicar').addEventListener('click', publicarResultados);
  document.getElementById('input-importar').addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (file) importarJSON(file);
    e.target.value = '';
  });
}

// PWA (Fase 6): solo se registra el service worker cuando la app se sirve
// por https o localhost. Por file:// (doble clic) no se registra nada y
// todo sigue funcionando exactamente igual que antes.
function registrarServiceWorker() {
  const protocoloValido = location.protocol === 'https:' ||
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';
  if ('serviceWorker' in navigator && protocoloValido) {
    // El SW vive en la raíz del sitio. `index.html` lo registra desde ahí
    // mismo; `jugador/index.html` está una carpeta por debajo y lo registra
    // con ruta relativa '../sw.js' — sigue siendo válido y el scope por
    // defecto (la raíz) cubre igualmente `jugador/`.
    const ruta = document.body.dataset.pagina === 'jugador' ? '../sw.js' : 'sw.js';
    navigator.serviceWorker.register(ruta).catch((err) => {
      console.warn('No se pudo registrar el service worker:', err);
    });
  }
}

document.addEventListener('DOMContentLoaded', init);
