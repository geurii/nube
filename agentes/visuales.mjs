// Visuales del canal: pixel art del SUJETO REAL de cada escena.
// Cada plano se dibuja con los pintores y, cuando existe, se le pone de fondo la foto real del objeto, lugar o
// suceso que la frase nombra (Wikimedia Commons / Openverse / NASA, solo licencias libres), leida como pixeles
// y dibujada en bloques: el resultado es pixel art, pero se ve LA COSA de la que habla la voz.
import fs from 'node:fs';
import path from 'node:path';
import {pintarEscenas} from './pintor.mjs';
import {reunirFotos, creditosDe} from './fotos.mjs';

/** Limpia los cuadros anteriores del mismo video. */
export const limpiarVisualesDe = (slug) => {
  for (const carpeta of ['pintados', 'referencias']) {
    const dir = path.resolve('public', carpeta);
    try { for (const f of fs.readdirSync(dir)) if (f.startsWith(`${slug}-`)) fs.rmSync(path.join(dir, f), {force: true}); } catch { /* carpeta aún no creada */ }
  }
};

/** Mete la foto real como capa de fondo del cuadro ya pintado. Devuelve true si la pudo poner. */
const ponerFotoDeFondo = (nombre, archivo) => {
  const id = String(nombre).replace(/^pintado:/, '').replace(/[^a-z0-9-]/gi, '');
  const ruta = path.resolve('public', 'pintados', `${id}.json`);
  try {
    const cuadro = JSON.parse(fs.readFileSync(ruta, 'utf8'));
    if (!cuadro || !Array.isArray(cuadro.capas)) return false;
    if (cuadro.capas.some((c) => c?.t === 'foto')) return true;
    // a pantalla completa, detrás de todo lo pintado; "pixel" es el tamaño del bloque (3 = pixel art marcado)
    cuadro.capas.unshift({t: 'foto', archivo, x: 0.5, y: 0.5, w: 1, h: 1, pixel: 3});
    fs.writeFileSync(ruta, `${JSON.stringify(cuadro, null, 2)}\n`);
    return true;
  } catch { return false; }
};

/** Genera cada plano en pixel art y le pone de fondo la foto real del sujeto cuando se encuentra. */
export const crearVisuales = async ({llamar, escenas, slug, tema, canal = 'lqns', nota = () => {}}) => {
  limpiarVisualesDe(slug);
  const indices = escenas.map((_, i) => i);
  const pintados = await pintarEscenas({llamar, escenas, indices, slug, tema, nota});
  const fondos = {};
  for (const [i, lista] of Object.entries(pintados)) fondos[Number(i)] = lista;
  const faltantes = indices.filter((i) => !fondos[i]);
  if (faltantes.length) throw new Error(`Los pintores no generaron pixel art para las escenas: ${faltantes.join(', ')}.`);
  const completas = Object.keys(fondos).length;

  // Fotos reales del sujeto: si fallan, el video sigue con el pixel art dibujado (nunca rompe el render).
  let porEscena = {};
  try { porEscena = await reunirFotos({llamar, escenas, indices, slug, tema, canal, nota}); }
  catch (e) { nota(`(Sin fotos de referencia: ${String(e?.message ?? e).slice(0, 100)})`); }

  let conFoto = 0;
  for (const i of indices) {
    const fotos = porEscena?.[i]?.fotos ?? [];
    if (!fotos.length) continue;
    const lista = fondos[i] ?? [];
    let puestas = 0;
    for (let k = 0; k < lista.length; k++) {
      if (ponerFotoDeFondo(lista[k], fotos[k % fotos.length].archivo)) puestas++;
    }
    if (puestas) conFoto++;
  }

  const sinFoto = indices.length - conFoto;
  nota(`Pixel art: ${completas}/${indices.length} escenas dibujadas. Con foto real del sujeto de fondo: ${conFoto}/${indices.length}${sinFoto ? ` (${sinFoto} quedaron solo con lo dibujado)` : ''}.`);
  return {fondos, creditos: creditosDe(porEscena), cobertura: {conFoto, total: indices.length, pixelArt: completas}};
};
