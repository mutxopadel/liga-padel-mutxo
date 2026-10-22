'use strict';
// Acciones de la interfaz y overlay de carga durante la generación de la liga.

/* ============================================================
   ACCIONES DE UI
   ============================================================ */

// Mínimo funcional, no arbitrario: con 1 sola pareja por grupo no hay nadie
// contra quien jugar (generarCalendario produciría una liga con 0 partidos
// reales — ver notas de la sesión). 2 es el mínimo que da al menos 1 partido.
const MIN_PAREJAS = 2;

function nombresCompletos() {
  return ligaState.girls.every((n) => n.trim() !== '') &&
         ligaState.boys.every((n) => n.trim() !== '');
}

// Añadir/eliminar fila cambia cuántas personas hay, así que cualquier
// calendario ya generado queda con índices que no corresponden a nada —
// si ya había una liga generada, se avisa (mismo mecanismo que regenerar)
// antes de invalidarla.
function conConfirmacionSiHayLiga(mensaje, accion) {
  if (ligaState.liveGenerated) {
    mostrarModal(mensaje, accion);
  } else {
    accion();
  }
}

function agregarFila() {
  conConfirmacionSiHayLiga(
    'Añadir una pareja invalida el calendario ya generado y borrará los resultados actuales. ¿Continuar?',
    () => {
      ligaState.girls.push('');
      ligaState.boys.push('');
      ligaState.jornadas = [];
      ligaState.liveGenerated = false;
      guardarEstado();
      render();
    }
  );
}

function eliminarFila(idx) {
  if (ligaState.girls.length <= MIN_PAREJAS) return;
  conConfirmacionSiHayLiga(
    'Eliminar una pareja invalida el calendario ya generado y borrará los resultados actuales. ¿Continuar?',
    () => {
      ligaState.girls.splice(idx, 1);
      ligaState.boys.splice(idx, 1);
      ligaState.jornadas = [];
      ligaState.liveGenerated = false;
      guardarEstado();
      render();
    }
  );
}

function generarLiga() {
  if (!nombresCompletos()) {
    const total = ligaState.girls.length + ligaState.boys.length;
    alert(`Rellena los ${total} nombres (${ligaState.girls.length} en la Columna 1 y ${ligaState.boys.length} en la Columna 2) antes de generar la liga.`);
    return;
  }

  const ejecutar = () => {
    mostrarGenerando();
    // setTimeout con delay > 0 (no 0) para dar tiempo real al navegador a
    // pintar el overlay antes de que el cálculo síncrono bloquee el hilo
    // principal; el spinner (animación CSS de solo transform) sigue
    // corriendo en el compositor mientras tanto.
    setTimeout(() => {
      ligaState.jornadas = generarCalendario(ligaState.girls.length, ligaState.boys.length);
      ligaState.liveGenerated = true;
      guardarEstado();
      render();
      mostrarGenerado();
    }, 50);
  };

  if (ligaState.liveGenerated) {
    mostrarModal('Esto borrará los resultados actuales. ¿Continuar?', ejecutar);
  } else {
    ejecutar();
  }
}

/* ============================================================
   OVERLAY DE CARGA (generación de liga)
   ============================================================ */

function mostrarGenerando() {
  document.getElementById('loading-spinner').hidden = false;
  document.getElementById('loading-check').hidden = true;
  document.getElementById('loading-mensaje').innerHTML =
    'Generando<span class="puntos"><span>.</span><span>.</span><span>.</span></span>';
  document.getElementById('loading-aceptar').hidden = true;
  document.getElementById('loading-overlay').hidden = false;
}

function mostrarGenerado() {
  document.getElementById('loading-spinner').hidden = true;
  document.getElementById('loading-check').hidden = false;
  document.getElementById('loading-mensaje').textContent = 'Liga generada';
  document.getElementById('loading-aceptar').hidden = false;
}

function ocultarGenerando() {
  document.getElementById('loading-overlay').hidden = true;
}

