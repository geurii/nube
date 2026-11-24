import assert from 'node:assert/strict';
import {materialDesdeFuentes, seleccionarFuentesParaGuion} from './fuentes-guion.mjs';

const fuente = (dominio, texto, ruta = '/') => ({
  titulo: 'Investigación ' + dominio,
  dominio,
  url: 'https://' + dominio + ruta,
  texto: texto.repeat(1),
  apoyo: false,
});
const fuentes = [
  fuente('archivo-a.example.com', 'A'.repeat(3000)),
  fuente('museo-b.example.org', 'B'.repeat(3000)),
  fuente('universidad-c.example.net', 'C'.repeat(3000)),
  {...fuente('wikipedia.org', 'W'.repeat(9000)), apoyo: true},
];

const largo = seleccionarFuentesParaGuion(fuentes, 'largo');
assert.equal(largo.length, 3, 'el largo debe usar 3 fuentes web independientes');
assert.equal(new Set(largo.map(x => x.dominio)).size, 3, 'no se aceptan dominios repetidos');
assert.ok(largo.reduce((n, x) => n + x.texto.length, 0) >= 8500, 'el largo requiere 8.500 caracteres');
assert.ok(materialDesdeFuentes(largo).includes('FUENTE CONSULTADA 3'), 'el material debe conservar cada fuente y su URL');

const corto = seleccionarFuentesParaGuion(fuentes, 'short');
assert.equal(corto.length, 1, 'el Short conserva una fuente web principal');
assert.equal(corto[0].dominio, 'archivo-a.example.com');

assert.throws(
  () => seleccionarFuentesParaGuion([fuente('unica.example.com', 'X'.repeat(12000))], 'largo'),
  /3 dominios y 8.500 caracteres/,
  'un largo no puede aprobarse con una sola fuente, aunque sea extensa',
);
assert.throws(
  () => seleccionarFuentesParaGuion([
    fuente('mismo.example.com', 'A'.repeat(5000), '/uno'),
    fuente('mismo.example.com', 'B'.repeat(5000), '/dos'),
    fuente('mismo.example.com', 'C'.repeat(5000), '/tres'),
  ], 'largo'),
  /3 dominios/,
  'tres páginas del mismo dominio no cuentan como tres fuentes independientes',
);
console.log('PRUEBA DE FUENTES OK: diversidad, volumen, bloqueo de investigación insuficiente y material completo.');
