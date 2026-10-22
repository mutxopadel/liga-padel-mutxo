'use strict';
// Estado global de la app, persistencia en localStorage y gestión de la lista de ligas.


/* ============================================================
   ESTADO Y PERSISTENCIA
   ============================================================ */

const STORAGE_KEY = 'padel-liga-mutxo-v1';

// Los nombres internos girls/boys, girlIdx/boyIdx y los ids g<idx>/b<idx> son
// legado del modelo mixto original de la liga (dos columnas por género). La
// UI ya no muestra esa semántica ("Columna 1"/"Columna 2"), pero estos
// nombres se conservan tal cual por compatibilidad con el estado guardado en
// localStorage y con los JSON ya exportados — cambiarlos rompería ambos.
function estadoInicial() {
  return {
    girls: Array(8).fill(''),
    boys: Array(8).fill(''),
    jornadas: [],
    liveGenerated: false,
  };
}

/* ------------------------------------------------------------
   VARIAS LIGAS EN EL MISMO NAVEGADOR

   Bajo la MISMA clave de localStorage (`padel-liga-mutxo-v1`, sin cambiar
   de nombre) ya no vive una liga suelta sino el contenedor completo:

     appState = {
       ligas: [ { id, nombre, creadaEl, liga: <estado de UNA liga> } ],
       activaId: <id de la liga seleccionada>
     }

   `ligaState` sigue existiendo y sigue siendo el estado PLANO de UNA liga
   (girls/boys/jornadas/liveGenerated), pero ahora es una REFERENCIA al
   objeto `liga` de la entrada activa. Gracias a eso todas las funciones que
   leen o escriben `ligaState` (render, clasificación, resultados, export,
   enlace…) siguen funcionando sin enterarse de que hay varias ligas:
   cambiar de liga activa es reasignar `ligaState` y volver a renderizar.

   El formato de UNA liga (el del export, el del enlace compartido y el de
   los JSON antiguos) NO cambia: sigue siendo el objeto plano.
   ------------------------------------------------------------ */

// Excepción a la norma «sin estado global mutable»: la app son scripts
// clásicos sin módulos ni build, y todas las vistas leen la liga activa de
// estas variables. Las escrituras a localStorage pasan solo por
// guardarEstado().
let appState = { ligas: [], activaId: null };
let ligaState = estadoInicial();

// Modo consulta (enlaces #ver=): cuando es true, `ligaState` apunta
// al estado descomprimido del enlace, SIN relación alguna con `appState` (el
// contenedor cargado de localStorage se queda exactamente como estaba). Es
// la variable que activa todas las salvaguardas de solo lectura: bloquea
// guardarEstado() (ver más abajo) y hace que render()/crearInputSet()/
// crearPartidoCard() no generen ningún camino de edición.
//
// `jugador.html` (app de jugador) reutiliza EXACTAMENTE estas salvaguardas:
// la activa al arrancar y nunca la desactiva (ver initJugador()).
let modoConsulta = false;

function crearIdLiga() {
  let id;
  do {
    id = Math.random().toString(36).slice(2, 8) + Date.now().toString(36).slice(-3);
  } while (appState.ligas.some((entrada) => entrada.id === id));
  return id;
}

// Envuelve un estado plano de liga en una entrada del contenedor.
function nuevaEntradaLiga(nombre, estadoLiga) {
  return {
    id: crearIdLiga(),
    nombre,
    creadaEl: new Date().toISOString(),
    liga: normalizarLiga(estadoLiga),
  };
}

// Red de seguridad mínima para estados que vienen de fuera (localStorage,
// archivo, enlace): no cambia el formato, solo garantiza que `jornadas` es
// un array para que el render no reviente con datos manipulados a mano.
function normalizarLiga(estadoLiga) {
  if (!formaValidaLiga(estadoLiga)) return estadoInicial();
  if (!Array.isArray(estadoLiga.jornadas)) estadoLiga.jornadas = [];
  return estadoLiga;
}

function appStateInicial() {
  const contenedor = { ligas: [], activaId: null };
  appState = contenedor;
  const entrada = nuevaEntradaLiga('Liga 1', estadoInicial());
  contenedor.ligas.push(entrada);
  contenedor.activaId = entrada.id;
  return contenedor;
}

// Forma del contenedor multi-liga (lo que se guarda desde que hay varias ligas).
function formaValidaAppState(parsed) {
  return Boolean(parsed) && Array.isArray(parsed.ligas) && 'activaId' in parsed;
}

// Entrada de la liga activa. Si `activaId` apunta a algo que ya no existe
// (estado manipulado a mano), se recompone sobre la primera liga.
function entradaActiva() {
  let entrada = appState.ligas.find((l) => l.id === appState.activaId);
  if (!entrada) {
    entrada = appState.ligas[0];
    if (entrada) appState.activaId = entrada.id;
  }
  return entrada;
}

// Punto único de escritura: antes de serializar se vuelca `ligaState` en la
// entrada activa, así cualquier reasignación de `ligaState` seguida de
// guardarEstado() queda persistida sin tocar el resto de ligas.
function guardarEstado() {
  // Salvaguarda central del modo consulta: pase lo que pase más arriba
  // (colapsar una jornada, un listener que se escape, lo que sea), en modo
  // consulta NUNCA se escribe en localStorage ni se toca `appState`. Es el
  // único punto de escritura de toda la app, así que basta con cortarlo aquí.
  if (modoConsulta) return;
  const entrada = entradaActiva();
  if (entrada) entrada.liga = ligaState;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appState));
}

// Reconstruye una lista de entradas saneada a partir de lo guardado:
// descarta entradas irreconocibles y rellena los campos que falten.
function normalizarEntradas(ligas) {
  const usados = new Set();
  const entradas = [];
  ligas.forEach((entrada, idx) => {
    if (!entrada || !formaValidaLiga(entrada.liga)) return;
    let id = typeof entrada.id === 'string' && entrada.id && !usados.has(entrada.id)
      ? entrada.id
      : `liga${idx}-${Math.random().toString(36).slice(2, 8)}`;
    usados.add(id);
    entradas.push({
      id,
      nombre: typeof entrada.nombre === 'string' && entrada.nombre.trim() ? entrada.nombre : `Liga ${idx + 1}`,
      creadaEl: typeof entrada.creadaEl === 'string' ? entrada.creadaEl : new Date().toISOString(),
      liga: normalizarLiga(entrada.liga),
    });
  });
  return entradas;
}

// Migración interna y silenciosa: un valor guardado con la forma "plana" de
// anterior al contenedor multi-liga se envuelve como única liga ("Liga 1") y se reescribe
// ya envuelto. Sin pérdida de datos y sin preguntar nada al usuario.
function cargarEstado() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) {
    appStateInicial();
    ligaState = entradaActiva().liga;
    return;
  }

  let migrado = false;
  try {
    const parsed = JSON.parse(raw);
    if (formaValidaAppState(parsed)) {
      const ligas = normalizarEntradas(parsed.ligas);
      if (!ligas.length) throw new Error('sin ligas utilizables');
      appState = { ligas, activaId: parsed.activaId };
    } else if (formaValidaLiga(parsed)) {
      appState = { ligas: [], activaId: null }; // lista vacía para generar el id
      const entrada = nuevaEntradaLiga('Liga 1', parsed);
      appState.ligas.push(entrada);
      appState.activaId = entrada.id;
      migrado = true;
    } else {
      throw new Error('forma invalida');
    }
  } catch (e) {
    console.warn('Estado corrupto en localStorage, usando estado inicial.', e);
    appStateInicial();
    migrado = true;
  }

  ligaState = entradaActiva().liga;
  if (migrado) guardarEstado();
}

/* ------------------------------------------------------------
   ACCIONES SOBRE LA LISTA DE LIGAS
   ------------------------------------------------------------ */

// "Liga N" con el primer N libre, para no repetir nombres por defecto.
function nombrePorDefectoLiga() {
  const nombres = new Set(appState.ligas.map((entrada) => entrada.nombre));
  let n = appState.ligas.length + 1;
  while (nombres.has(`Liga ${n}`)) n++;
  return `Liga ${n}`;
}

// Crea una liga (vacía o con un estado importado), la activa y renderiza.
function crearLiga(nombre, estadoLiga) {
  const entrada = nuevaEntradaLiga(nombre, estadoLiga || estadoInicial());
  appState.ligas.push(entrada);
  appState.activaId = entrada.id;
  ligaState = entrada.liga;
  guardarEstado();
  render();
  return entrada;
}

function activarLiga(id) {
  const entrada = appState.ligas.find((l) => l.id === id);
  if (!entrada || id === appState.activaId) return;
  guardarEstado(); // deja consolidada la liga que se abandona
  appState.activaId = id;
  ligaState = entrada.liga;
  guardarEstado();
  render();
}

function nuevaLiga() {
  mostrarModalTexto('Nombre de la liga nueva', nombrePorDefectoLiga(), (nombre) => {
    crearLiga(nombre, estadoInicial());
  });
}

function renombrarLigaActiva() {
  const entrada = entradaActiva();
  if (!entrada) return;
  mostrarModalTexto('Nuevo nombre de la liga', entrada.nombre, (nombre) => {
    entrada.nombre = nombre;
    guardarEstado();
    render();
  });
}

// Mínimo de 1 liga: sin ninguna no habría estado que mostrar ni editar.
function eliminarLigaActiva() {
  if (appState.ligas.length <= 1) return;
  const entrada = entradaActiva();
  if (!entrada) return;
  mostrarModal(`Se eliminará la liga "${entrada.nombre}" con todos sus datos. ¿Continuar?`, () => {
    appState.ligas = appState.ligas.filter((l) => l.id !== entrada.id);
    const primera = appState.ligas[0];
    appState.activaId = primera.id;
    ligaState = primera.liga;
    guardarEstado();
    render();
  });
}

