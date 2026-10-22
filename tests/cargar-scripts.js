'use strict';

// Carga scripts clásicos de js/ (sin módulos, ámbito global compartido) en un
// contexto vm aislado, para poder probarlos sin navegador. Los `let`/`const`
// de nivel superior no cuelgan del objeto global, así que se leen y escriben
// evaluando expresiones dentro del contexto.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const DIR_JS = path.join(__dirname, '..', 'js');

function crearLocalStorageFalso() {
  const datos = new Map();
  return {
    getItem: (k) => (datos.has(k) ? datos.get(k) : null),
    setItem: (k, v) => { datos.set(k, String(v)); },
    removeItem: (k) => { datos.delete(k); },
    clear: () => { datos.clear(); },
  };
}

function crearElementoFalso() {
  const el = {
    style: {},
    dataset: {},
    children: [],
    classList: { add() {}, remove() {}, toggle() {}, contains: () => false },
    appendChild(h) { el.children.push(h); return h; },
    addEventListener() {},
    setAttribute() {},
    querySelector: () => null,
    querySelectorAll: () => [],
  };
  return el;
}

// files: nombres de js/ en orden de carga. Devuelve { ctx, evaluar, asignar }.
function cargarScripts(files) {
  const document = {
    getElementById: () => null,
    querySelector: () => null,
    querySelectorAll: () => [],
    createElement: crearElementoFalso,
    addEventListener() {},
  };
  const localStorage = crearLocalStorageFalso();
  const sandbox = { document, localStorage, console };
  sandbox.window = sandbox;
  const ctx = vm.createContext(sandbox);
  for (const file of files) {
    const ruta = path.join(DIR_JS, file);
    vm.runInContext(fs.readFileSync(ruta, 'utf8'), ctx, { filename: ruta });
  }
  return {
    ctx,
    // Evalúa una expresión en el ámbito global del contexto (lee funciones y
    // lets). El resultado se devuelve clonado vía JSON: así los arrays y
    // objetos pertenecen al realm de Node y deepStrictEqual los compara bien.
    evaluar: (codigo) => {
      const json = vm.runInContext(`JSON.stringify(${codigo})`, ctx);
      return json === undefined ? undefined : JSON.parse(json);
    },
    // Asigna a una variable de nivel superior un valor JSON-serializable.
    asignar: (nombre, valor) => vm.runInContext(`${nombre} = ${JSON.stringify(valor)}`, ctx),
  };
}

module.exports = { cargarScripts };
