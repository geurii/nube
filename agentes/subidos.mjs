// Contador PERMANENTE de videos subidos a YouTube por la oficina (no depende de las notificaciones, que se recortan).
// Se guarda en oficina-salida/<canal>/subidos.json: {total, videos: [{id, titulo, fecha, url}]}. Lo escribe subir.mjs al subir un video;
// lo leen la oficina 3D (contador en pantalla), Jules, los puestos y el encadenado (meta de 2 videos al día).
import fs from 'node:fs';
import path from 'node:path';

export const rutaSubidos = (canal = 'lqns') => path.join('oficina-salida', canal, 'subidos.json');

export const leerSubidos = (canal = 'lqns') => {
  try {
    const j = JSON.parse(fs.readFileSync(rutaSubidos(canal), 'utf8'));
    const videos = Array.isArray(j.videos) ? j.videos : [];
    return {total: videos.length, videos};
  } catch { return {total: 0, videos: []}; }
};

/** Anota un video recién subido (sin repetir el mismo id). Devuelve el total nuevo. */
export const registrarSubida = ({canal = 'lqns', id, titulo, fecha = new Date().toISOString()}) => {
  const actual = leerSubidos(canal);
  if (!id) return actual.total;
  if (!actual.videos.some((v) => v.id === id)) actual.videos.unshift({id, titulo: String(titulo ?? '').slice(0, 140), fecha, url: `https://youtu.be/${id}`});
  fs.mkdirSync(path.dirname(rutaSubidos(canal)), {recursive: true});
  fs.writeFileSync(rutaSubidos(canal), JSON.stringify({total: actual.videos.length, videos: actual.videos.slice(0, 500)}, null, 2));
  return actual.videos.length;
};
