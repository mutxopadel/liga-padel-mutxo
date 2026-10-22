'use strict';

// Publicación de resultados del admin (token, API de GitHub). Va aparte de app.js, que superaba el límite de tamaño.

/* ============================================================
   PUBLICAR RESULTADOS (admin, Fase 2): sube la liga activa como
   `liga-oficial.json` al repo vía la API REST de contenidos de GitHub, para
   que `jugador.html` la sirva. El token del admin se guarda SOLO en este
   dispositivo, bajo su propia clave de localStorage (nunca junto al estado
   de las ligas ni en el repo).
   ============================================================ */

const TOKEN_STORAGE_KEY = 'padel-liga-mutxo-token';
const GITHUB_API_LIGA_OFICIAL = 'https://api.github.com/repos/mutxopadel/liga-padel-mutxo/contents/liga-oficial.json';

// Codifica un texto (JSON con acentos/ñ/emojis incluidos) a base64 de forma
// segura para Unicode: TextEncoder → bytes → base64. btoa(texto) a pelo
// revienta con cualquier carácter fuera de Latin1, así que NUNCA se usa
// directo sobre el JSON. Función pura y testeable desde Node: el base64 que
// devuelve, decodificado con Buffer.from(b64, 'base64').toString('utf8'),
// reproduce el texto original byte a byte.
function codificarBase64Utf8(texto) {
  const bytes = new TextEncoder().encode(texto);
  let binario = '';
  bytes.forEach((byte) => { binario += String.fromCharCode(byte); });
  return btoa(binario);
}

function botonPublicar() {
  return document.getElementById('btn-publicar');
}

// Punto de entrada del botón. No-op en modo consulta (el botón no debería
// ni estar visible ahí, pero se corta también aquí por si acaso, igual que
// guardarEstado() se corta a sí mismo).
function publicarResultados() {
  if (modoConsulta) return;
  if (!localStorage.getItem(TOKEN_STORAGE_KEY)) {
    pedirTokenGitHub();
    return;
  }
  confirmarPublicacion();
}

// Modal de texto en modo password (Fase 2 de mostrarModalTexto) para pedir
// el token la primera vez (o después de que uno guardado quede invalidado).
function pedirTokenGitHub() {
  mostrarModalTexto(
    'Pega tu token de GitHub (se guarda solo en este dispositivo — ver README)',
    '',
    (token) => {
      localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
      confirmarPublicacion();
    },
    { password: true }
  );
}

function confirmarPublicacion() {
  mostrarModal(
    'Se publicará la liga activa como liga oficial, visible para todos. ¿Continuar?',
    ejecutarPublicacion
  );
}

// GET (para el sha si el archivo ya existe) → PUT (crea o sobrescribe) contra
// la API de contenidos de GitHub. Cabeceras y campos exactamente los de la
// API: Authorization Bearer, Accept vnd.github+json, y en el PUT
// message/content/sha.
async function ejecutarPublicacion() {
  const btn = botonPublicar();
  const textoOriginal = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Publicando…';

  const token = localStorage.getItem(TOKEN_STORAGE_KEY);
  const cabeceras = {
    Authorization: `Bearer ${token}`,
    Accept: 'application/vnd.github+json',
  };

  const restaurarBoton = () => {
    btn.disabled = false;
    btn.textContent = textoOriginal;
  };

  const tokenInvalido = () => {
    localStorage.removeItem(TOKEN_STORAGE_KEY);
    restaurarBoton();
    mostrarModal(
      'Token inválido o caducado. Vuelve a pulsar Publicar para introducir uno nuevo.',
      () => {}
    );
  };

  const errorGenerico = (codigo) => {
    restaurarBoton();
    mostrarModal(`No se ha podido publicar (código ${codigo}).`, () => {});
  };

  try {
    const respuestaGet = await fetch(GITHUB_API_LIGA_OFICIAL, { headers: cabeceras });

    let sha;
    if (respuestaGet.status === 200) {
      const datosExistentes = await respuestaGet.json();
      sha = datosExistentes.sha;
    } else if (respuestaGet.status === 401 || respuestaGet.status === 403) {
      tokenInvalido();
      return;
    } else if (respuestaGet.status !== 404) {
      errorGenerico(respuestaGet.status);
      return;
    }

    const publicadoEl = new Date().toISOString();
    const contenido = { ...ligaState, publicadoEl };
    const cuerpoPut = {
      message: `Publica resultados — ${publicadoEl}`,
      content: codificarBase64Utf8(JSON.stringify(contenido, null, 2)),
    };
    if (sha) cuerpoPut.sha = sha;

    const respuestaPut = await fetch(GITHUB_API_LIGA_OFICIAL, {
      method: 'PUT',
      headers: { ...cabeceras, 'Content-Type': 'application/json' },
      body: JSON.stringify(cuerpoPut),
    });

    if (respuestaPut.status === 401 || respuestaPut.status === 403) {
      tokenInvalido();
      return;
    }
    if (!respuestaPut.ok) {
      errorGenerico(respuestaPut.status);
      return;
    }

    btn.textContent = 'Publicado ✓ (visible en ~1 min)';
    setTimeout(() => {
      btn.textContent = textoOriginal;
      btn.disabled = false;
    }, 3000);
  } catch (err) {
    console.error('Error al publicar la liga', err);
    restaurarBoton();
    mostrarModal('Sin conexión: no se ha podido publicar.', () => {});
  }
}
