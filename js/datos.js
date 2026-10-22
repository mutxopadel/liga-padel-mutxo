'use strict';
// Captura de imagen PNG y exportación/importación de la liga en JSON.

/* ============================================================
   SACAR IMAGEN (captura de DOM a PNG descargable)
   ============================================================ */

function capturarImagen(elemento, nombreArchivo) {
  return html2canvas(elemento, {
    backgroundColor: '#0a0e1a',
    scale: 2,
    ignoreElements: (el) => el.classList && el.classList.contains('no-captura'),
  }).then((canvas) => {
    return new Promise((resolve) => {
      canvas.toBlob((blob) => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${nombreArchivo}.png`;
        a.click();
        URL.revokeObjectURL(url);
        resolve();
      }, 'image/png');
    });
  }).catch((err) => {
    console.error('Error al generar la imagen', err);
    alert('No se ha podido generar la imagen.');
  });
}

function exportarJSON() {
  const fecha = new Date().toISOString().slice(0, 10);
  const blob = new Blob([JSON.stringify(ligaState, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `liga-padel-mutxo-${fecha}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

// Validación de forma compartida entre importar JSON e importar por enlace:
// un objeto de liga válido tiene las columnas de nombres y una lista de
// jornadas (aunque esté vacía).
function formaValidaLiga(parsed) {
  return Boolean(parsed) &&
    Array.isArray(parsed.girls) &&
    Array.isArray(parsed.boys) &&
    ('jornadas' in parsed);
}

// Nombre para la liga que se crea al importar: el del archivo sin extensión
// si dice algo, y si no un nombre genérico.
function nombreLigaDesdeArchivo(nombreArchivo) {
  const base = String(nombreArchivo || '').replace(/\.json$/i, '').trim();
  return base ? base.slice(0, 40) : 'Liga importada';
}

// Importar ya no sobrescribe la liga activa: añade una liga nueva a la lista
// y la activa, así se pueden traer ligas de otros dispositivos sin perder
// las que ya hay en este navegador.
function importarJSON(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!formaValidaLiga(parsed)) {
        throw new Error('forma invalida');
      }
      const nombre = nombreLigaDesdeArchivo(file.name);
      mostrarModal(`El archivo se añadirá como una liga nueva ("${nombre}") sin tocar las que ya tienes. ¿Continuar?`, () => {
        crearLiga(nombre, parsed);
      });
    } catch (err) {
      alert('El archivo no tiene un formato válido de liga.');
    }
  };
  reader.readAsText(file);
}

