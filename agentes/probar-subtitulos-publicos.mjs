import assert from 'node:assert/strict';
import {parsearTranscripcion} from './analizar-videos.mjs';

const xml = '<transcript><text start="12.5">Hola &amp; mundo</text><text start="20">Segundo bloque</text></transcript>';
const desdeXml = parsearTranscripcion(xml);
assert.equal(desdeXml.length, 2);
assert.equal(desdeXml[0].tiempo, '00:12');
assert.equal(desdeXml[0].texto, 'Hola & mundo');

const json3 = JSON.stringify({events:[
  {tStartMs:12500,segs:[{utf8:'Primera parte '},{utf8:'del subtítulo'}]},
  {tStartMs:20000,segs:[{utf8:'Segunda parte'}]},
]});
const desdeJson3 = parsearTranscripcion(json3);
assert.equal(desdeJson3.length, 2);
assert.equal(desdeJson3[0].tiempo, '00:12');
assert.equal(desdeJson3[0].texto, 'Primera parte del subtítulo');

const vtt = 'WEBVTT\n\n00:00:12.500 --> 00:00:14.000\nTexto WebVTT\n\n00:00:20.000 --> 00:00:22.000\nOtro bloque';
const desdeVtt = parsearTranscripcion(vtt);
assert.equal(desdeVtt.length, 2);
assert.equal(desdeVtt[0].tiempo, '00:12');
assert.equal(desdeVtt[0].texto, 'Texto WebVTT');

console.log('SUBTÍTULOS OK: XML, JSON3 y WebVTT conservan marcas temporales.');
