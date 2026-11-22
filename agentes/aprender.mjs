// APRENDER DE LOS RESULTADOS: mira cómo le fue de verdad a cada video (vistas, retención, vista media de YouTube Analytics), separa los que NO rindieron y le pide
// a la IA lecciones concretas SOLO a partir de esas cifras. Las lecciones quedan en lecciones.json y todo el equipo las aplica en los próximos videos.
// Corre en cada ciclo de la oficina pero solo trabaja si hay datos nuevos (máx. 1 vez cada 12 h). Nunca detiene el flujo.
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {chatAlternativo} from './llm.mjs';
import {agregarLecciones} from './lecciones.mjs';

const CANAL = (process.env.CANAL || 'lqns').trim();
const dir = path.join('oficina-salida', CANAL);
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const corto = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Videos con datos suficientes, ya con más de 24 h, y cuáles fueron los malos (menos vistas que la mediana o retención baja). */
export const separarResultados = (carpeta = dir, ahora = Date.now()) => {
  const an = leer(path.join(carpeta, 'analitica.json'), {});
  const titulos = new Map([...(leer(path.join(carpeta, 'subidos.json'), {videos: []}).videos ?? []), ...(leer(path.join(carpeta, 'vistas.json'), {videos: []}).videos ?? [])].map((v) => [v.id, v]));
  const todos = (an.porVideo ?? []).map((v) => ({...v, titulo: titulos.get(v.id)?.titulo ?? `video ${v.id}`, publicado: titulos.get(v.id)?.publicado ?? titulos.get(v.id)?.fecha ?? null}))
    .filter((v) => (!v.publicado || ahora - Date.parse(v.publicado) > 24 * 3600 * 1000) && Number.isFinite(v.vistas));
  if (todos.length < 3) return {todos, malos: [], buenos: []};
  const vs = todos.map((v) => v.vistas).sort((a, b) => a - b);
  const mediana = vs[Math.floor(vs.length / 2)];
  const malos = todos.filter((v) => v.vistas < mediana || (Number.isFinite(v.retencionPct) && v.retencionPct < 35));
  const buenos = todos.filter((v) => v.vistas >= mediana && !(Number.isFinite(v.retencionPct) && v.retencionPct < 35));
  return {todos, malos, buenos, mediana};
};

const fila = (v) => `"${corto(v.titulo, 70)}": ${v.vistas} vistas, retención ${v.retencionPct ?? 'sin dato'}%, vista media ${v.duracionMediaSeg ?? 'sin dato'} s`;

export const aprender = async (carpeta = dir) => {
  const {todos, malos, buenos, mediana} = separarResultados(carpeta);
  if (todos.length < 3 || !malos.length) return {nuevas: 0, motivo: 'sin datos suficientes o ningún video flojo'};
  const huella = crypto.createHash('sha1').update(JSON.stringify(todos.map((v) => [v.id, v.vistas, v.retencionPct]))).digest('hex');
  const rutaE = path.join(carpeta, 'aprender-estado.json');
  const e = leer(rutaE, {});
  if (e.huella === huella || (e.fecha && Date.now() - Date.parse(e.fecha) < 12 * 3600 * 1000)) return {nuevas: 0, motivo: 'ya aprendido con estos datos'};
  const r = await chatAlternativo([
    {role: 'system', content: 'Eres un analista de YouTube riguroso. Respondes en español, sin tecnicismos y SOLO con JSON válido. Usas únicamente las cifras dadas; nunca inventas datos ni causas que las cifras no sugieran (si dudas, lo dices).'},
    {role: 'user', content: `Canal faceless de misterio (Shorts, voz en off). Mediana de vistas: ${mediana}.\nVIDEOS QUE NO RINDIERON:\n${malos.slice(0, 8).map(fila).join('\n')}\nVIDEOS QUE SÍ RINDIERON MEJOR:\n${buenos.slice(0, 5).map(fila).join('\n') || '(ninguno)'}\n\nCompara y da lecciones CONCRETAS y accionables para los próximos guiones (gancho, título, duración, tema, ritmo), apoyadas en las cifras. Devuelve {"lecciones": ["máx. 5 frases cortas, cada una empieza con un verbo (Evita…, Usa…, Acorta…) y cita la cifra que la respalda"]}`},
  ], {maxTokens: 1200, json: true, temperatura: 0.3});
  let nuevas = 0;
  if (r) {
    try {
      const j = JSON.parse(r.texto.slice(r.texto.indexOf('{'), r.texto.lastIndexOf('}') + 1));
      nuevas = agregarLecciones(CANAL, (Array.isArray(j.lecciones) ? j.lecciones : []).map((t) => ({texto: String(t), fuente: 'resultados'})), path.dirname(carpeta));
    } catch { /* sin JSON */ }
  }
  fs.writeFileSync(rutaE, JSON.stringify({fecha: new Date().toISOString(), huella, nuevas}, null, 2));
  return {nuevas, malos: malos.length};
};

if (path.basename(String(process.argv[1] ?? '')) === 'aprender.mjs') {
  try { console.log('Aprender de resultados:', JSON.stringify(await aprender())); } catch (e) { console.log('Aprender: no se pudo (' + String(e.message ?? e).slice(0, 100) + ')'); }
}
