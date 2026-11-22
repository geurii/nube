// MODO MANUAL (opcional, apagado por defecto): con él encendido, el guion aprobado por el equipo NO pasa solo a voz y render:
// queda "esperando-visto-bueno" hasta que el dueño responda (Me gusta, seguir / Pedir cambios / Descartar). Apagado, todo sigue automático como siempre.
// El estado vive en oficina-salida/<canal>/manual.json: {activo, acciones: [{id, slug, accion, nota, fecha}], aplicadas: [id]}
import fs from 'node:fs';
import path from 'node:path';

export const ESTADO_ESPERA = 'esperando-visto-bueno';
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };

export const rutaManual = (canal, raiz = 'oficina-salida') => path.join(raiz, canal, 'manual.json');
export const leerManual = (canal, raiz = 'oficina-salida') => {
  const m = leer(rutaManual(canal, raiz), {});
  return {activo: m.activo === true, acciones: Array.isArray(m.acciones) ? m.acciones : [], aplicadas: Array.isArray(m.aplicadas) ? m.aplicadas : []};
};

/** Guiones que esperan el visto bueno del dueño: [{slug, titulo, formato}] */
export const pendientesDeVistoBueno = (canal, raiz = 'oficina-salida') => {
  const dir = path.join(raiz, canal);
  let archivos = [];
  try { archivos = fs.readdirSync(dir).filter((f) => /^guion-.+\.json$/.test(f)); } catch { return []; }
  return archivos.map((f) => ({f, g: leer(path.join(dir, f), null)})).filter((x) => x.g?.estado === ESTADO_ESPERA)
    .map((x) => ({slug: x.f.replace(/^guion-|\.json$/g, ''), titulo: String(x.g.titulo ?? ''), formato: x.g.formato ?? 'short'}));
};
