'use strict';
// Funciones que pintan la interfaz a partir del estado.

/* ============================================================
   RENDER
   ============================================================ */

function render() {
  // En modo consulta no se renderizan ni la barra de ligas ni la pestaña
  // Jugadores: así los contenedores de inputs (inputs-girls/inputs-boys) y el
  // <select> de ligas se quedan vacíos, sin generar ningún input editable.
  if (modoConsulta) {
    renderJornadas();
    renderClasificacion();
    return;
  }
  renderSelectorLigas();
  renderJugadores();
  renderJornadas();
  renderClasificacion();
}

// Los nombres de liga los escribe el usuario: siempre con textContent,
// nunca por innerHTML (tampoco en los <option>).
function renderSelectorLigas() {
  const select = document.getElementById('selector-liga');
  if (!select) return;
  select.innerHTML = '';
  appState.ligas.forEach((entrada) => {
    const option = document.createElement('option');
    option.value = entrada.id;
    option.textContent = entrada.nombre;
    select.appendChild(option);
  });
  select.value = appState.activaId;
  document.getElementById('btn-liga-eliminar').disabled = appState.ligas.length <= 1;
}

function renderJugadores() {
  renderColumnaJugadores('inputs-girls', ligaState.girls, 'girls');
  renderColumnaJugadores('inputs-boys', ligaState.boys, 'boys');
}

function renderColumnaJugadores(contenedorId, lista, campo) {
  const contenedor = document.getElementById(contenedorId);
  contenedor.innerHTML = '';
  lista.forEach((nombre, idx) => {
    const fila = document.createElement('div');
    fila.className = 'fila-jugador';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'input-jugador';
    input.placeholder = `Jugador ${idx + 1}`;
    input.value = nombre;
    input.addEventListener('input', (e) => {
      ligaState[campo][idx] = e.target.value;
      guardarEstado();
      renderJornadas();
      renderClasificacion();
    });

    const btnEliminar = document.createElement('button');
    btnEliminar.type = 'button';
    btnEliminar.className = 'btn-eliminar-fila';
    btnEliminar.textContent = '×';
    btnEliminar.setAttribute('aria-label', `Eliminar pareja ${idx + 1}`);
    btnEliminar.disabled = lista.length <= MIN_PAREJAS;
    btnEliminar.addEventListener('click', () => eliminarFila(idx));

    fila.appendChild(input);
    fila.appendChild(btnEliminar);
    contenedor.appendChild(fila);
  });
}

function nombrePareja(pareja) {
  const girl = ligaState.girls[pareja.girlIdx] || `Columna 1 · ${pareja.girlIdx + 1}`;
  const boy = ligaState.boys[pareja.boyIdx] || `Columna 2 · ${pareja.boyIdx + 1}`;
  return `${girl} / ${boy}`;
}

function renderJornadas() {
  const contenedor = document.getElementById('jornadas-container');
  const vacio = document.getElementById('jornadas-vacio');

  if (!ligaState.jornadas.length) {
    contenedor.innerHTML = '';
    vacio.style.display = 'block';
    return;
  }
  vacio.style.display = 'none';

  contenedor.innerHTML = '';
  ligaState.jornadas.forEach((jornada) => {
    const card = document.createElement('div');
    card.className = 'jornada-card' + (jornada.colapsada ? ' colapsada' : '');

    const header = document.createElement('div');
    header.className = 'jornada-header';
    header.innerHTML = `<h3>Jornada ${jornada.numero}</h3>`;

    const btnImagen = document.createElement('button');
    btnImagen.className = 'btn btn-small btn-imagen no-captura';
    btnImagen.textContent = 'Sacar imagen';
    btnImagen.addEventListener('click', (e) => {
      e.stopPropagation();
      const estabaColapsada = jornada.colapsada;
      if (estabaColapsada) card.classList.remove('colapsada');
      capturarImagen(card, `jornada-${jornada.numero}-padel-mutxo`).finally(() => {
        if (estabaColapsada) card.classList.add('colapsada');
      });
    });
    header.appendChild(btnImagen);

    const toggle = document.createElement('span');
    toggle.className = 'jornada-toggle';
    toggle.textContent = '▾';
    header.appendChild(toggle);

    header.addEventListener('click', (e) => {
      if (e.target.closest('.btn-imagen')) return;
      jornada.colapsada = !jornada.colapsada;
      guardarEstado();
      renderJornadas();
    });
    card.appendChild(header);

    const partidosWrap = document.createElement('div');
    partidosWrap.className = 'jornada-partidos';
    jornada.partidos.forEach((partido) => {
      partidosWrap.appendChild(crearPartidoCard(partido));
    });
    card.appendChild(partidosWrap);

    if (jornada.descansa) {
      const descansa = document.createElement('p');
      descansa.className = 'jornada-descansa';
      descansa.textContent = `Pareja ${nombrePareja(jornada.descansa)} descansan`;
      card.appendChild(descansa);
    }

    contenedor.appendChild(card);
  });
}

function crearPartidoCard(partido) {
  const card = document.createElement('div');
  card.className = 'partido-card' + (partido.completado ? ' completado' : '');

  const parejas = document.createElement('div');
  parejas.className = 'partido-parejas';
  const ganaA = partido.ganadorPareja === 'A';
  const ganaB = partido.ganadorPareja === 'B';

  const divA = document.createElement('div');
  divA.className = 'pareja pareja-a' + (ganaA ? ' ganadora' : '');
  divA.textContent = nombrePareja(partido.parejaA);

  const vs = document.createElement('span');
  vs.className = 'vs-label';
  vs.textContent = 'VS';

  const divB = document.createElement('div');
  divB.className = 'pareja pareja-b' + (ganaB ? ' ganadora' : '');
  divB.textContent = nombrePareja(partido.parejaB);

  parejas.appendChild(divA);
  parejas.appendChild(vs);
  parejas.appendChild(divB);
  card.appendChild(parejas);

  const setsGrid = document.createElement('div');
  setsGrid.className = 'sets-grid';
  for (let i = 0; i < 3; i++) {
    const col = document.createElement('div');
    col.className = 'set-col';
    col.innerHTML = `<span class="set-label">Set ${i + 1}</span>`;

    const inputA = crearInputSet(partido, i, 'a');
    const inputB = crearInputSet(partido, i, 'b');
    col.appendChild(inputA);
    col.appendChild(inputB);
    setsGrid.appendChild(col);
  }
  card.appendChild(setsGrid);

  // Modo consulta: sin botón "Partido completado"/"Editar resultado" — no se
  // crea en absoluto, así no hay ningún camino de edición que ocultar a
  // medias (ni siquiera queda en el DOM deshabilitado).
  if (!modoConsulta) {
    const acciones = document.createElement('div');
    acciones.className = 'partido-acciones';
    const btn = document.createElement('button');
    btn.className = 'btn btn-small btn-completar' + (partido.completado ? ' completado' : '');
    btn.textContent = partido.completado ? 'Editar resultado' : 'Partido completado';
    btn.addEventListener('click', () => {
      partido.ganadorPareja = calcularGanadorPartido(partido);
      partido.completado = true;
      guardarEstado();
      render();
    });
    acciones.appendChild(btn);
    card.appendChild(acciones);
  }

  return card;
}

function crearInputSet(partido, setIdx, lado) {
  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0';
  input.max = '7';
  input.className = 'input-set';
  input.value = partido.sets[setIdx][lado] ?? '';
  // Modo consulta: input deshabilitado y sin listener — ni siquiera queda un
  // camino de edición inerte a medias.
  if (modoConsulta) {
    input.disabled = true;
    return input;
  }
  input.addEventListener('input', (e) => {
    const valorCrudo = e.target.value;
    if (valorCrudo === '') {
      partido.sets[setIdx][lado] = null;
      input.classList.remove('invalido');
    } else {
      let n = parseInt(valorCrudo, 10);
      if (Number.isNaN(n)) {
        input.classList.add('invalido');
        return;
      }
      if (n < 0) n = 0;
      if (n > 7) n = 7;
      input.value = String(n);
      partido.sets[setIdx][lado] = n;
      input.classList.remove('invalido');
    }
    guardarEstado();
  });
  return input;
}

function renderClasificacion() {
  const body = document.getElementById('clasificacion-body');
  const stats = ordenarClasificacion(calcularClasificacion());
  body.innerHTML = '';
  stats.forEach((s, idx) => {
    const tr = document.createElement('tr');
    const valores = [idx + 1, s.nombre || '—', s.pj, s.pg, s.setsG, s.setsP, s.juegG, s.juegP, s.puntos];
    valores.forEach((valor, col) => {
      const td = document.createElement('td');
      if (col === 8) td.className = 'col-puntos';
      if (col === 1) {
        // Fase 5: el nombre es un <button> real (accesible por teclado sin
        // roles/tabindex extra) que abre la ficha de ese jugador. Funciona
        // igual en modo consulta: la ficha es pura consulta, no toca estado.
        const btnNombre = document.createElement('button');
        btnNombre.type = 'button';
        btnNombre.className = 'nombre-jugador-btn';
        btnNombre.textContent = String(valor);
        btnNombre.addEventListener('click', () => abrirFichaJugador(s.id));
        td.appendChild(btnNombre);
      } else {
        td.textContent = String(valor);
      }
      tr.appendChild(td);
    });
    body.appendChild(tr);
  });
}

