import assert from 'node:assert/strict';
import {proximoHorario} from './horarios.mjs';
const base = Date.UTC(2026, 10, 23, 2, 0, 0); // 02:00 UTC; margen hasta 02:40
const short = proximoHorario('short', base);
assert.equal(short.toISOString(), '2026-11-23T04:23:00.000Z');
const largo = proximoHorario('largo', base);
assert.equal(largo.toISOString(), '2026-11-23T12:23:00.000Z');
const cerca = proximoHorario('short', Date.UTC(2026, 10, 23, 3, 50));
assert.equal(cerca.toISOString(), '2026-11-23T07:23:00.000Z');
console.log('OK: slots Shorts cada 3 h y largos cada 12 h, alineados con cron UTC.');
