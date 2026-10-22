'use strict';
// Algoritmo de generación del calendario (round-robin y agrupamiento de partidos).

/* ============================================================
   ALGORITMO DE GENERACIÓN DE CALENDARIO (round-robin / método del polígono
   + agrupamiento de partidos que maximiza la cobertura de rivales)
   Funciones puras, sin efectos secundarios — testeables desde la consola:
     generarCalendario()
   ============================================================ */

function shuffle(array) {
  const copia = array.slice();
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

// Clave canónica (sin importar el orden) para un par de índices del mismo grupo.
function clavePar(a, b) {
  return a < b ? `${a}-${b}` : `${b}-${a}`;
}

// Método del círculo clásico de programación de round-robin (1-factorización
// de K_n): produce n-1 rondas de n/2 emparejamientos de POSICIONES 0..n-1
// donde cada par de posiciones aparece emparejado exactamente una vez.
// Es la misma construcción determinista que ya se usaba para las parejas
// chica-chico, aplicada ahora también al agrupamiento en partidos — sirve
// como punto de partida de altísima calidad para la fase de refinamiento,
// en vez de arrancar desde un agrupamiento puramente al azar.
function metodoDelCirculo(n) {
  const rondas = [];
  const fijo = n - 1;
  for (let r = 0; r < n - 1; r++) {
    const pares = [[fijo, r]];
    for (let k = 1; k < n / 2; k++) {
      const a = (((r - k) % (n - 1)) + (n - 1)) % (n - 1);
      const b = (r + k) % (n - 1);
      pares.push([a, b]);
    }
    rondas.push(pares);
  }
  return rondas;
}

// Agrupa las n parejas de una jornada en n/2 partidos, con un orden aleatorio.
function agrupamientoAleatorio(pares) {
  const barajado = shuffle(pares);
  const partidos = [];
  for (let p = 0; p < barajado.length / 2; p++) {
    partidos.push([barajado[p * 2], barajado[p * 2 + 1]]);
  }
  return partidos;
}

// Historial de cruces de rivalidad ya jugados: Map clave -> nº de veces.
// Se usan contadores (no un simple Set) porque la fase de refinamiento
// necesita poder "retirar" la contribución de una jornada y volver a
// calcularla sin perder la cuenta de lo que aportan las demás.
function contarClave(mapa, clave) {
  return mapa.get(clave) || 0;
}

// Nº de claves realmente cubiertas ahora mismo (valor > 0). NO se puede usar
// mapa.size: el refinamiento decrementa claves a 0 sin borrarlas (para poder
// volver a incrementarlas), así que .size cuenta también pares "desregistrados".
function contarCubiertos(mapa) {
  let cubiertos = 0;
  for (const valor of mapa.values()) {
    if (valor > 0) cubiertos++;
  }
  return cubiertos;
}

function registrarAgrupamiento(agrupamiento, rivalesGG, rivalesBB, rivalesGB, delta) {
  for (const [parejaA, parejaB] of agrupamiento) {
    const claves = [
      [rivalesGG, clavePar(parejaA.girlIdx, parejaB.girlIdx)],
      [rivalesBB, clavePar(parejaA.boyIdx, parejaB.boyIdx)],
      [rivalesGB, `g${parejaA.girlIdx}-b${parejaB.boyIdx}`],
      [rivalesGB, `g${parejaB.girlIdx}-b${parejaA.boyIdx}`],
    ];
    for (const [mapa, clave] of claves) {
      mapa.set(clave, contarClave(mapa, clave) + delta);
    }
  }
}

// Cuenta cuántos de los 4 cruces de rivalidad (chica-chica, chico-chico,
// chica-chico ×2) de cada partido son NUEVOS (cuenta 0) respecto al resto
// del calendario ya generado.
function puntuarAgrupamiento(agrupamiento, rivalesGG, rivalesBB, rivalesGB) {
  let nuevos = 0;
  for (const [parejaA, parejaB] of agrupamiento) {
    if (contarClave(rivalesGG, clavePar(parejaA.girlIdx, parejaB.girlIdx)) === 0) nuevos++;
    if (contarClave(rivalesBB, clavePar(parejaA.boyIdx, parejaB.boyIdx)) === 0) nuevos++;
    if (contarClave(rivalesGB, `g${parejaA.girlIdx}-b${parejaB.boyIdx}`) === 0) nuevos++;
    if (contarClave(rivalesGB, `g${parejaB.girlIdx}-b${parejaA.boyIdx}`) === 0) nuevos++;
  }
  return nuevos;
}

const INTENTOS_AGRUPAMIENTO = 500;

// El presupuesto de refinamiento escala con n: grupos grandes tienen mucho
// más espacio de combinaciones que cubrir, así que necesitan más pasadas
// para acercarse a su techo de cobertura; grupos pequeños ya lo alcanzan
// con pocas. Medido en la práctica: más allá de
// esto los rendimientos son marginales frente al coste en tiempo, y esto
// mantiene la generación bien por debajo de 5s incluso con n=16.
function pasadasRefinamiento(n) {
  return Math.max(8, n);
}

// Prueba varios agrupamientos aleatorios de las parejas de la jornada y se
// queda con el que más cruces de rivalidad nuevos aporta (nunca reintenta de
// forma indefinida: número de intentos acotado, siempre converge).
function mejorAgrupamientoPartidos(pares, rivalesGG, rivalesBB, rivalesGB) {
  const puntuacionMaxima = (pares.length / 2) * 4;
  let mejor = null;
  let mejorPuntuacion = -1;
  for (let intento = 0; intento < INTENTOS_AGRUPAMIENTO && mejorPuntuacion < puntuacionMaxima; intento++) {
    const candidato = agrupamientoAleatorio(pares);
    const puntuacion = puntuarAgrupamiento(candidato, rivalesGG, rivalesBB, rivalesGB);
    if (puntuacion > mejorPuntuacion) {
      mejorPuntuacion = puntuacion;
      mejor = candidato;
    }
  }
  return mejor;
}

// Construye UN calendario candidato completo: fase 1 (parejas chica-chico,
// método del polígono) + fase 2 (agrupamiento en partidos). La fase 2 arranca
// desde el método del círculo aplicado a las posiciones (garantiza de
// entrada cobertura óptima de rivalidad chica-chica) y luego aplica varias
// pasadas de refinamiento por coordenadas, cada una recalculando una jornada
// contra el resto del calendario ya fijado, para acercar también la
// cobertura chico-chico y chica-chico a la totalidad. Devuelve además el nº
// total de cruces de rivalidad distintos cubiertos, para comparar candidatos.
//
// Si n es impar, cada jornada sobra una pareja (no se puede repartir un
// número impar de parejas en partidos de 2 en 2): descansa la pareja de la
// posición r en la jornada r. Como 2 es invertible módulo n cuando n es
// impar, rotar el descanso por posición garantiza que cada chica Y cada
// chico descansan exactamente una jornada en toda la liga (nunca más de
// una vez, nunca ninguna).
function generarCandidato(n) {
  const girlsOrder = shuffle([...Array(n).keys()]);
  const boysOrder = shuffle([...Array(n).keys()]);
  const esImpar = n % 2 !== 0;
  const posicionesRondas = esImpar ? null : metodoDelCirculo(n); // n-1 rondas de posiciones

  const paresPorJornada = [];
  for (let r = 0; r < n; r++) {
    const pares = [];
    for (let i = 0; i < n; i++) {
      pares.push({ girlIdx: girlsOrder[i], boyIdx: boysOrder[(i + r) % n] });
    }
    paresPorJornada.push(pares);
  }

  // Con n impar, la pareja que descansa en la jornada r es la de la
  // posición r (girlsOrder[r] junto con el chico que le toque esa jornada).
  const parejaActiva = (pares, r) => (esImpar ? pares.filter((_, idx) => idx !== r) : pares);

  const rivalesGG = new Map();
  const rivalesBB = new Map();
  const rivalesGB = new Map();

  const agrupamientos = paresPorJornada.map((pares, r) => {
    const activos = parejaActiva(pares, r);
    let agrupamiento;
    if (esImpar) {
      // Sin tabla algebraica fija posible (el conjunto activo cambia de
      // posiciones cada jornada): se arranca desde un agrupamiento aleatorio
      // y se confía en las pasadas de refinamiento de más abajo.
      agrupamiento = agrupamientoAleatorio(activos);
    } else {
      const posiciones = posicionesRondas[r % (n - 1)];
      agrupamiento = posiciones.map(([p, q]) => [pares[p], pares[q]]);
    }
    registrarAgrupamiento(agrupamiento, rivalesGG, rivalesBB, rivalesGB, 1);
    return agrupamiento;
  });

  // Importante: la reoptimización de una jornada solo mira cuántos cruces
  // NUEVOS aporta el candidato, sin saber cuántos cruces únicos aportaba la
  // jornada anterior que ahora se pierden. Sin comparar contra quedarse como
  // estaba, una pasada podía cambiar una jornada por otra "mejor" en
  // aislado pero peor en total (deshacía cobertura ya conseguida). Por eso
  // se compara explícitamente contra el agrupamiento anterior y solo se
  // sustituye si es estrictamente mejor — la cobertura total nunca baja.
  const pasadas = pasadasRefinamiento(n);
  for (let pasada = 0; pasada < pasadas; pasada++) {
    for (const r of shuffle([...Array(n).keys()])) {
      const anterior = agrupamientos[r];
      const activos = parejaActiva(paresPorJornada[r], r);
      registrarAgrupamiento(anterior, rivalesGG, rivalesBB, rivalesGB, -1);
      const candidato = mejorAgrupamientoPartidos(activos, rivalesGG, rivalesBB, rivalesGB);
      const puntuacionCandidato = puntuarAgrupamiento(candidato, rivalesGG, rivalesBB, rivalesGB);
      const puntuacionAnterior = puntuarAgrupamiento(anterior, rivalesGG, rivalesBB, rivalesGB);
      agrupamientos[r] = puntuacionCandidato > puntuacionAnterior ? candidato : anterior;
      registrarAgrupamiento(agrupamientos[r], rivalesGG, rivalesBB, rivalesGB, 1);
    }
  }

  const cobertura = contarCubiertos(rivalesGG) + contarCubiertos(rivalesBB) + contarCubiertos(rivalesGB);
  const descansaPorJornada = esImpar ? paresPorJornada.map((pares, r) => pares[r]) : paresPorJornada.map(() => null);
  return { agrupamientos, cobertura, descansaPorJornada };
}

const CANDIDATOS_CALENDARIO = 6;

