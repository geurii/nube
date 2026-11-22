// LECCIONES DEL EQUIPO: memoria que NO se pierde. Críticas, resultados reales de los videos, análisis de videos que le gustan al dueño y los cambios que él pide
// quedan aquí (oficina-salida/<canal>/lecciones.json) y TODOS los agentes de la oficina las leen antes de trabajar (se inyectan en su contexto).
// Las del dueño pesan más. Se evitan repetidas y se guardan hasta 40.
import fs from 'node:fs';
import path from 'node:path';

const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const norm = (t) => String(t ?? '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim().slice(0, 120);
const PESO = {dueno: 4, critica: 3, resultados: 2, analisis: 2, panel: 1};
export const ETIQUETA = {dueno: 'pedido del dueño', critica: 'crítica', resultados: 'resultado real', analisis: 'video que le gusta al dueño', panel: 'panel'};
const MAX = 40;

export const rutaLecciones = (canal, raiz = 'oficina-salida') => path.join(raiz, canal, 'lecciones.json');
export const leerLecciones = (canal, raiz = 'oficina-salida') => {
  const l = leer(rutaLecciones(canal, raiz), []);
  return Array.isArray(l) ? l.filter((x) => x?.texto) : [];
};

/** items: [{texto, fuente, video?}]. Devuelve cuántas lecciones nuevas se guardaron. */
export const agregarLecciones = (canal, items, raiz = 'oficina-salida') => {
  const actuales = leerLecciones(canal, raiz);
  const vistas = new Set(actuales.map((x) => norm(x.texto)));
  const nuevas = [];
  for (const i of items ?? []) {
    const texto = String(i?.texto ?? '').replace(/\s+/g, ' ').trim().slice(0, 320);
    if (texto.length < 12 || vistas.has(norm(texto))) continue;
    vistas.add(norm(texto));
    nuevas.push({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5), fecha: new Date().toISOString(), fuente: PESO[i.fuente] ? i.fuente : 'critica', texto, ...(i.video ? {video: String(i.video).slice(0, 80)} : {})});
  }
  if (!nuevas.length) return 0;
  fs.mkdirSync(path.join(raiz, canal), {recursive: true});
  fs.writeFileSync(rutaLecciones(canal, raiz), JSON.stringify([...nuevas, ...actuales].slice(0, MAX), null, 2));
  return nuevas.length;
};

/** Bloque para el contexto de TODOS los agentes: las lecciones más importantes y recientes (las del dueño primero). */
export const textoDeLecciones = (canal, max = 7, raiz = 'oficina-salida') => {
  const l = [...leerLecciones(canal, raiz)].sort((a, b) => (PESO[b.fuente] ?? 0) - (PESO[a.fuente] ?? 0) || Date.parse(b.fecha) - Date.parse(a.fecha)).slice(0, max);
  if (!l.length) return '';
  return `LECCIONES QUE EL EQUIPO YA APRENDIÓ (críticas, resultados reales y pedidos del dueño; son OBLIGATORIAS: el nuevo guion debe corregir esto, no repetir los errores): ${l.map((x, i) => `(${i + 1}) [${ETIQUETA[x.fuente] ?? x.fuente}] ${x.texto}`).join(' ')}`;
};
