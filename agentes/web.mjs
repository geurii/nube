// INTERNET PARA TODOS LOS AGENTES: una sola vez por ciclo se reúne lo que dice la web de HOY sobre el tema (resúmenes de otras páginas y los títulos de YouTube
// con más vistas) y se les entrega a todos como un bloque corto delante de sus instrucciones. Así cada puesto (guionista, editor, verificador, titulista,
// críticos, pintores, Jules...) trabaja con datos frescos y no solo con Wikipedia. Todo es gratis y sin llave. Nunca lanza: si no hay red, devuelve ''.
import fs from 'node:fs';
import path from 'node:path';
import {buscarVideos} from './radar.mjs';
import {leerPreferencias} from './ideas.mjs';

const MAX_BLOQUE = 950;
const corto = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Títulos de los videos de YouTube con más vistas este mes sobre el tema. */
export const titulosVirales = async (tema, max = 5) => {
  try {
    const lista = await buscarVideos(String(tema), 4, false);
    return lista.filter((v) => v.vistas >= 3000 && v.titulo).sort((a, b) => b.vistas - a.vistas).slice(0, max)
      .map((v) => ({titulo: corto(v.titulo, 90), vistas: v.vistas, dias: v.dias === null ? null : Math.round(v.dias), canal: corto(v.canal, 30)}));
  } catch { return []; }
};

/** Texto compacto (máx. ~950 caracteres) para anteponer a las instrucciones de cada agente. */
export const armarBloqueWeb = ({tema, resumenes = [], titulos = [], radarTexto = ''}) => {
  const partes = [];
  if (resumenes.length) partes.push(`Lo que dicen otras páginas sobre "${tema}": ${resumenes.slice(0, 3).map((r) => `(${r.host}) ${corto(r.texto, 130)}`).join(' | ')}`);
  if (titulos.length) partes.push(`Videos de YouTube con más vistas este mes sobre el tema: ${titulos.slice(0, 4).map((t) => `"${t.titulo}" (${t.vistas.toLocaleString('en-US')} vistas)`).join(' | ')}`);
  if (radarTexto) partes.push(`Canales chicos que están explotando en el nicho: ${corto(radarTexto, 260)}`);
  if (!partes.length) return '';
  return corto(`INTERNET (datos de hoy; úsalos solo como apoyo para contrastar y aprender de lo que pega; no copies contenido ni inventes más allá de ellos): ${partes.join('. ')}`, MAX_BLOQUE);
};

export const guardarWeb = (canal, datos) => {
  try {
    const dir = path.join('oficina-salida', canal);
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'web.json'), JSON.stringify({fecha: new Date().toISOString(), ...datos}, null, 2));
  } catch { /* sin carpeta */ }
};

/** Para los scripts que no son la Oficina (Jules, ayuda mutua, funciones, conciencia): lee el bloque del último ciclo si es de hace menos de 2 días. */
export const leerBloqueWeb = (canal = 'lqns') => {
  let web = '';
  try {
    const w = JSON.parse(fs.readFileSync(path.join('oficina-salida', canal, 'web.json'), 'utf8'));
    if (Date.now() - Date.parse(w.fecha) <= 2 * 86400000) web = String(w.bloque ?? '');
  } catch { /* sin web.json */ }
  // además de internet, todos ven lo que el dueño aprobó y rechazó
  return [web, leerPreferencias(canal)].filter(Boolean).join(' ');
};
