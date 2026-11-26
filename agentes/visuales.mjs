// Visuales del canal: exclusivamente pixel art original generado por los dos pintores.
// No descarga, consulta, incrusta ni convierte fotografías o imágenes reales.
import fs from 'node:fs';
import path from 'node:path';
import {pintarEscenas} from './pintor.mjs';

/** Limpia los cuadros anteriores del mismo video. */
export const limpiarVisualesDe = (slug) => {
  for (const carpeta of ['pintados', 'referencias']) {
    const dir = path.resolve('public', carpeta);
    try { for (const f of fs.readdirSync(dir)) if (f.startsWith(`${slug}-`)) fs.rmSync(path.join(dir, f), {force: true}); } catch { /* carpeta aún no creada */ }
  }
};

/** Genera cada plano desde cero en pixel art dibujado y animado. */
export const crearVisuales = async ({llamar, escenas, slug, tema, nota = () => {}}) => {
  limpiarVisualesDe(slug);
  const indices = escenas.map((_, i) => i);
  const pintados = await pintarEscenas({llamar, escenas, indices, slug, tema, nota});
  const fondos = {};
  for (const [i, lista] of Object.entries(pintados)) fondos[Number(i)] = lista;
  const completas = Object.keys(fondos).length;
  const faltantes = indices.filter((i) => !fondos[i]);
  if (faltantes.length) throw new Error(`Los pintores no generaron pixel art para las escenas: ${faltantes.join(', ')}. No se sustituirán por fotos.`);
  nota(`Pixel art original: ${completas}/${indices.length} escenas dibujadas en cuatro cuadros distintos. Fotografías e imágenes reales: 0.`);
  return {fondos, creditos: [], cobertura: {conFoto: 0, total: indices.length, pixelArt: completas}};
};
