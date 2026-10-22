# Plan: adecuar Liga Mutxo a las normas de código

Objetivo: que todo el proyecto cumpla `~/.claude/normas-codigo.md` sin cambiar
nada de lo que ve o hace el usuario. Producción la usan jugadores reales: cada
fase se prueba en navegador antes de subir.

Supuestos y decisiones:
- Se sigue con JS clásico (sin módulos ni build). Los ficheros comparten el
  ámbito global y se cargan en orden con `<script>`. Pasar a módulos ES sería
  una reescritura.
- El estado global (`appState`, `ligaState`, `modoConsulta`,
  `fichaAbiertaPersonId`) se queda: toda la app está construida sobre él. Se
  documenta la excepción con su porqué en el fichero de estado.
- `jugador.js` (349 líneas) y `publicacion.js` (316) pasan del objetivo de 300
  pero no del límite de 500: no se parten.

## Fase 1 — Partir `app.js` (movimiento puro)
- [x] **T1** · Sonnet · depende de: nada.
  - Entregable: carpeta `js/` con estos ficheros, cada uno ≤ 500 líneas
    (objetivo ≤ 300). Los rangos son de las secciones actuales de `app.js`:
    - `estado.js`: ESTADO Y PERSISTENCIA, VARIAS LIGAS y ACCIONES SOBRE LA LISTA DE LIGAS (1–247).
    - `calendario.js`: ALGORITMO DE GENERACIÓN DE CALENDARIO hasta antes de REPARACIÓN DE EQUIDAD.
    - `equidad.js`: REPARACIÓN DE EQUIDAD hasta antes de LÓGICA DE PARTIDOS.
    - `clasificacion.js`: LÓGICA DE PARTIDOS y CLASIFICACIÓN.
    - `render.js`: RENDER.
    - `ficha.js`: FICHA DE JUGADOR.
    - `modales.js`: MODAL DE CONFIRMACIÓN.
    - `acciones.js`: ACCIONES DE UI y OVERLAY DE CARGA.
    - `datos.js`: SACAR IMAGEN, export e import (`capturarImagen` … `importarJSON`).
    - `compartir.js`: COMPARTIR POR ENLACE (hasta antes de TABS).
    - `arranque.js`: TABS e INICIALIZACIÓN, con el `DOMContentLoaded` al final.
  - `publicacion.js` y `jugador.js` se mueven a `js/`, y los `require` de `tests/` se actualizan.
  - `app.js` se borra.
  - `index.html` y `jugador/index.html` cargan los ficheros en el orden de arriba y
    `arranque.js` el último. `index.html` carga además `publicacion.js` y
    `jugador/index.html` carga `jugador.js`, ambos antes de `arranque.js`.
  - `sw.js`: `ARCHIVOS` actualizado y `CACHE` a `liga-mutxo-v14`.
  - Aceptación:
    - El diff es solo movimiento: la concatenación ordenada de `js/*.js` (sin
      publicacion/jugador) más las cabeceras nuevas da las mismas líneas que el
      `app.js` original.
    - `node --check` de todos los JS. Los 21 tests en verde.
    - `index.html` y `jugador/` cargan sin errores de consola.
    - Flujo admin completo (generar liga, meter resultado, clasificación, ficha,
      exportar, enlace `#ver=`) y jugador con `?liga=`, probado con `agent-browser`
      sobre una copia servida en local. Captura por paso.
    - Cumple las normas de código.
  - Prohibido: cambiar lógica o nombres, tocar CSS, commit, push.
- [x] Revisión del diff, commit, push y despliegue verificado.

## Fase 2 — Tests, CSS, comentarios (T2a, T2b y T2c en paralelo)
- [ ] **T2a · tests** · Sonnet · paralelizable con T2b y T2c. Dueño de
  `tests/cargar-scripts.js` (nuevo), `tests/calendario.test.js` y
  `tests/clasificacion.test.js`.
  - El helper carga los `js/*.js` indicados en un contexto `vm` de Node con
    `document` y `localStorage` mínimos.
  - Tests de caracterización:
    - `generarCalendario`: n×n con nadie repitiendo pareja y cobertura de rivales.
    - `calcularGanadorPartido`.
    - `calcularClasificacion` / `ordenarClasificacion`: puntos 3/1, desempate
      por mini-liga, diferencia de sets, diferencia de juegos y alfabético.
  - Sin red y sin dependencias. Prohibido tocar `js/`.
- [ ] **T2b · CSS** · Sonnet · paralelizable con T2a y T2c. Dueño de `css/`
  (nuevo), `style.css` (se borra), los `<link>` de `index.html` y
  `jugador/index.html`, y `sw.js`.
  - `css/tokens.css`, `css/base.css` y `css/componentes.css`; si este último
    pasa de 400 líneas, `css/modales.css`. Todos ≤ 400.
  - Bloque `@media (prefers-reduced-motion: reduce)` que anula transiciones y animaciones.
  - `:focus-visible` visible en `.btn`, `.tab-btn`, inputs y selects, con un token de color.
  - Sin comentarios que citen fases. `CACHE` a `liga-mutxo-v15`.
  - Aceptación: capturas de admin y jugador a 390 y 1280 px, comparadas
    antes/después, sin diferencias salvo el foco.
- [ ] **T2c · comentarios** · Sonnet · paralelizable con T2a y T2b. Dueño de `js/*.js`.
  - Quitar o reescribir los comentarios que citan fases o planes («Fase N»,
    «Remate», «plan»), dejando el porqué.
  - Nota de excepción del estado global en `js/estado.js`.
  - Prohibido cambiar código ejecutable.
- [ ] **T3 · revisor** (Sonnet, distinto de los constructores): regresión en
  navegador de admin y jugador a 390 y 1280 px, con captura por caso.
- [ ] Commit, push y despliegue verificado. Cierre del plan.
