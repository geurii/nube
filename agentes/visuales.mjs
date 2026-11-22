// IMÁGENES DE UN VIDEO, DE CERO: fotos reales de internet por escena (pixeladas a pantalla completa por el motor) + los dos pintores añadiendo ambiente.
// Lo usan la oficina (video nuevo) y la REEDICIÓN (rehacer un video que no funcionó). Nunca recicla: borra lo anterior del mismo video y no repite fotos de otros videos.
import fs from 'node:fs';
import path from 'node:path';
import {pintarEscenas} from './pintor.mjs';
import {reunirFotos, creditosDe} from './fotos.mjs';
import {mirarFoto, textoDeVista} from './ojos.mjs';
import {reunirInspiracion} from './inspiracion.mjs';

/** Borra pintados y fotos anteriores de este video (para generar de cero). */
export const limpiarVisualesDe = (slug) => {
  for (const carpeta of ['pintados', 'referencias']) {
    const dir = path.resolve('public', carpeta);
    try { for (const f of fs.readdirSync(dir)) if (f.startsWith(`${slug}-`)) fs.rmSync(path.join(dir, f), {force: true}); } catch { /* no había */ }
  }
};

/**
 * Devuelve {fondos: {indice: ['pintado:id', ...]}, creditos, cobertura: {conFoto, total}}.
 * `llamar(mensajes, maxTokens)` devuelve JSON. `nota(texto)` va al informe.
 */
export const crearVisuales = async ({llamar, escenas, slug, tema, key = process.env.GEMINI_API_KEY, canal = 'lqns', nota = () => {}, tiempoOjosMs = 120000}) => {
  limpiarVisualesDe(slug);
  const indices = escenas.map((_, i) => i);
  const referencias = await reunirFotos({llamar, escenas, indices, slug, tema, canal, nota});
  const conFoto = Object.keys(referencias).length;
  nota(`Fotos reales de internet: ${conFoto} de ${indices.length} escenas (${Object.values(referencias).reduce((s, r) => s + r.fotos.length, 0)} fotos). ${Object.values(referencias).slice(0, 8).map((r) => `${r.fotos[0].titulo.slice(0, 40)} (${r.fotos[0].licencia})`).join('; ')}`);

  // Gemini mira SOLO la foto principal de cada escena: si no tiene que ver con la frase, se descarta (y se prueba con la segunda, si hay)
  let ideas = [];
  try {
    const hasta = Date.now() + tiempoOjosMs;
    let seguidos = 0;
    let vistas = 0;
    for (const [i, ref] of Object.entries(referencias)) {
      if (seguidos >= 2 || Date.now() > hasta - 8000) { nota('(Gemini no revisó el resto de las fotos: fallos seguidos o se acabó el tiempo asignado; pasan sin revisión.)'); break; }
      let g = await mirarFoto({ruta: path.resolve('public', 'referencias', ref.fotos[0].archivo), key, frase: escenas[Number(i)]?.texto, maxIntentos: 2, hasta});
      if (g.vista && g.vista.relevante === false) {
        nota(`(Foto de la escena ${i} "${ref.fotos[0].titulo}" descartada: Gemini vio que no muestra lo que dice la frase.)`);
        try { fs.rmSync(path.resolve('public', 'referencias', ref.fotos[0].archivo), {force: true}); } catch { /* ya no está */ }
        ref.fotos.shift();
        if (ref.fotos.length) g = await mirarFoto({ruta: path.resolve('public', 'referencias', ref.fotos[0].archivo), key, frase: escenas[Number(i)]?.texto, maxIntentos: 1, hasta});
        if (!ref.fotos.length || (g.vista && g.vista.relevante === false)) { for (const f of ref.fotos) try { fs.rmSync(path.resolve('public', 'referencias', f.archivo), {force: true}); } catch { /* ya no está */ } delete referencias[i]; seguidos = 0; continue; }
      }
      if (g.vista) { ref.vista = textoDeVista(g.vista); vistas++; seguidos = 0; } else { seguidos++; nota(`(Gemini no pudo mirar la foto de la escena ${i}: ${String(g.error).slice(0, 200)})`); }
    }
    if (vistas) nota(`Gemini miró ${vistas} fotos principales.`);
    ideas = await reunirInspiracion({tema, key, limiteMs: 60000, nota});
  } catch (e) { nota('(Revisión de fotos o ideas de estilo no disponible: ' + String(e.message ?? e).slice(0, 100) + ')'); }

  const p = await pintarEscenas({llamar, escenas, indices, slug, tema, nota, referencias, ideas});
  const fondos = {};
  for (const [i, lista] of Object.entries(p)) fondos[Number(i)] = lista;
  const total = Object.keys(referencias).length;
  nota(`Imágenes: ${total} de ${indices.length} escenas con foto real pixelada; ${Object.keys(fondos).length} escenas dibujadas por los pintores (ambiente o, sin foto, la escena completa).`);
  return {fondos, creditos: creditosDe(referencias), cobertura: {conFoto: total, total: indices.length}};
};
