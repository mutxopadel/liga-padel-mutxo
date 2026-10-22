'use strict';
// Modal de confirmación reutilizable.

/* ============================================================
   MODAL DE CONFIRMACIÓN
   ============================================================ */

function mostrarModal(mensaje, onConfirmar) {
  const overlay = document.getElementById('modal-overlay');
  const mensajeEl = document.getElementById('modal-mensaje');
  mensajeEl.textContent = mensaje;
  overlay.hidden = false;

  const btnConfirmar = document.getElementById('modal-confirmar');
  const btnCancelar = document.getElementById('modal-cancelar');

  const cerrar = () => {
    overlay.hidden = true;
    btnConfirmar.removeEventListener('click', onConfirmarHandler);
    btnCancelar.removeEventListener('click', cerrar);
  };
  function onConfirmarHandler() {
    cerrar();
    onConfirmar();
  }

  btnConfirmar.addEventListener('click', onConfirmarHandler);
  btnCancelar.addEventListener('click', cerrar);
}

// Variante del modal con un campo de texto (nombres de liga, y desde la
// publicación de resultados también el token de GitHub). Devuelve el valor
// recortado por callback; el botón de confirmar queda deshabilitado mientras
// el campo esté vacío, así que nunca sale un valor en blanco.
//
// `opciones.password` (opcional, por defecto false) pone el input en
// type="password" para no dejar el token a la vista, y sube su maxlength
// (los tokens de GitHub superan los 40 caracteres del nombre de liga); al
// cerrar el modal se restaura SIEMPRE a type="text"/maxlength="40", así que
// la siguiente llamada (p. ej. "Nombre de la liga nueva") no hereda nada.
function mostrarModalTexto(mensaje, valorInicial, onConfirmar, opciones = {}) {
  const overlay = document.getElementById('modal-texto-overlay');
  const mensajeEl = document.getElementById('modal-texto-mensaje');
  const input = document.getElementById('modal-texto-input');
  const btnConfirmar = document.getElementById('modal-texto-confirmar');
  const btnCancelar = document.getElementById('modal-texto-cancelar');

  const esPassword = Boolean(opciones.password);
  input.type = esPassword ? 'password' : 'text';
  input.setAttribute('maxlength', esPassword ? '255' : '40');

  mensajeEl.textContent = mensaje;
  input.value = valorInicial;
  overlay.hidden = false;

  const sincronizar = () => {
    btnConfirmar.disabled = input.value.trim() === '';
  };
  sincronizar();

  const cerrar = () => {
    overlay.hidden = true;
    input.removeEventListener('input', sincronizar);
    input.removeEventListener('keydown', onTecla);
    btnConfirmar.removeEventListener('click', onConfirmarHandler);
    btnCancelar.removeEventListener('click', cerrar);
    input.type = 'text';
    input.setAttribute('maxlength', '40');
  };
  function onConfirmarHandler() {
    const valor = input.value.trim();
    if (!valor) return;
    cerrar();
    onConfirmar(valor);
  }
  function onTecla(e) {
    if (e.key === 'Enter') {
      e.preventDefault();
      onConfirmarHandler();
    } else if (e.key === 'Escape') {
      cerrar();
    }
  }

  input.addEventListener('input', sincronizar);
  input.addEventListener('keydown', onTecla);
  btnConfirmar.addEventListener('click', onConfirmarHandler);
  btnCancelar.addEventListener('click', cerrar);
  input.focus();
  input.select();
}

