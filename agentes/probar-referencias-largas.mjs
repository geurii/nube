import assert from 'node:assert/strict';
import {esReferenciaLarga, CONSULTAS_LARGAS_POR_DEFECTO} from './radar.mjs';

assert.equal(esReferenciaLarga({segundos: 279}), false, 'los videos de 4:39 no sirven como referencia de largo');
assert.equal(esReferenciaLarga({segundos: 479}), false, 'un video de 7:59 no alcanza');
assert.equal(esReferenciaLarga({segundos: 480}), true, 'un video de 8:00 sí sirve');
assert.equal(esReferenciaLarga({segundos: 720}), true, 'un video de 12:00 sí sirve');
assert.equal(esReferenciaLarga({segundos: 1800}), true, 'un documental de 30 minutos sí sirve como referencia');
assert.equal(esReferenciaLarga({segundos: 3600}), true, 'una hora es el máximo de referencia permitido');
assert.equal(esReferenciaLarga({segundos: 3601}), true, 'un documental de más de una hora puede ser referencia');
assert.equal(esReferenciaLarga({segundos: 14400}), true, 'se permiten documentales de hasta cuatro horas');
assert.equal(esReferenciaLarga({segundos: 14401}), false, 'se excluyen emisiones de más de cuatro horas');
assert.ok(CONSULTAS_LARGAS_POR_DEFECTO.some((q) => /LEMMiNO/i.test(q)), 'debe incluir un referente documental consolidado');
assert.ok(CONSULTAS_LARGAS_POR_DEFECTO.some((q) => /RealLifeLore/i.test(q)), 'debe incluir un referente de gran audiencia');
assert.ok(CONSULTAS_LARGAS_POR_DEFECTO.some((q) => /ARTE/i.test(q)), 'debe buscar documentales de una fuente europea consolidada');
assert.ok(CONSULTAS_LARGAS_POR_DEFECTO.some((q) => /歴史|未解決事件/.test(q)), 'debe buscar en japonés');
assert.ok(CONSULTAS_LARGAS_POR_DEFECTO.some((q) => /documentaire/.test(q)), 'debe buscar en francés');
assert.ok(CONSULTAS_LARGAS_POR_DEFECTO.some((q) => /Dokumentation/.test(q)), 'debe buscar en alemán');
console.log('REFERENCIAS LARGAS OK: duración mínima, canales consolidados y búsquedas multilingües.');
