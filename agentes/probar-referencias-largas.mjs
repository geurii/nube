import assert from 'node:assert/strict';
import {esReferenciaLarga, CONSULTAS_LARGAS_POR_DEFECTO} from './radar.mjs';

assert.equal(esReferenciaLarga({segundos: 279}), false, 'los videos de 4:39 no sirven como referencia de largo');
assert.equal(esReferenciaLarga({segundos: 479}), false, 'un video de 7:59 no alcanza');
assert.equal(esReferenciaLarga({segundos: 480}), true, 'un video de 8:00 sí sirve');
assert.equal(esReferenciaLarga({segundos: 720}), true, 'un video de 12:00 sí sirve');
assert.equal(esReferenciaLarga({segundos: 1800}), true, 'un documental de 30 minutos sí sirve como referencia');
assert.equal(esReferenciaLarga({segundos: 3600}), true, 'una hora es el máximo de referencia permitido');
assert.equal(esReferenciaLarga({segundos: 3601}), false, 'no se usan directos o documentales de más de una hora');
assert.ok(CONSULTAS_LARGAS_POR_DEFECTO.some((q) => /Expressy/i.test(q)), 'debe buscar el canal Expressy solicitado');
assert.ok(CONSULTAS_LARGAS_POR_DEFECTO.some((q) => /XpressTV/i.test(q)), 'debe buscar la variante XpressTV');
console.log('REFERENCIAS LARGAS OK: excluye videos de 280 s, exige mínimo 8 minutos y busca documentales del nicho.');
