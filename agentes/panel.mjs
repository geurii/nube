// REVISIÓN TÉCNICA DEL VIDEO TERMINADO (después del render). Gemini MIRA y ESCUCHA el video y solo lo frena si tiene fallas GRAVES de IMAGEN o SONIDO:
// subtítulos tapados o cortados, audio ausente o ininteligible, imagen negra/congelada/rota, o imágenes sin relación alguna con lo que se dice.
// El gusto del público (los 8 espectadores) ya se juzgó ANTES, sobre el guion, en agentes/panel-guion.mjs (paso 2 de la Oficina), para no gastar render en vano.
// Variables: ID (por ejemplo lqns-bloop), CANAL, GEMINI_API_KEY. Salida del flujo: aprobado=true|false.
// Si Gemini no puede revisar (error, cuota o sin clave), NO bloquea: el video pasa y se avisa.
import fs from 'node:fs';
import path from 'node:path';
import {revisarVideo} from './video-gemini.mjs';
import {avisarTelefono} from './aviso.mjs';

const ID = process.env.ID;
const CANAL = (process.env.CANAL || 'lqns').trim();
const RAIZ = path.resolve('oficina-salida');
const carpeta = path.join(RAIZ, CANAL);
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const salida = (v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `aprobado=${v}\n`); };

const notificar = (tipo, titulo, texto) => {
  avisarTelefono(tipo, titulo, texto);
  try {
    const ruta = path.join(RAIZ, 'notificaciones.json');
    const lista = leer(ruta, []);
    lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal: CANAL, tipo, titulo, texto});
    fs.writeFileSync(ruta, JSON.stringify(lista.slice(0, 80), null, 2));
  } catch { /* sin notificaciones */ }
};

/** Decisión técnica: solo fallas graves de imagen o sonido que ve Gemini. Función pura (se prueba aparte). */
export const decidirTecnico = (gem) => {
  if (!gem) return {aprobado: true, motivos: []};
  const motivos = [];
  if (gem.subtitulos?.tapados_o_cortados === true) motivos.push('subtítulos tapados o cortados');
  for (const d of Array.isArray(gem.defectos_graves) ? gem.defectos_graves : []) motivos.push(String(d).slice(0, 200));
  return {aprobado: motivos.length === 0, motivos};
};

export const principal = async () => {
  if (!ID) { console.log('Sin video que revisar.'); salida('false'); return; }
  const guion = leer(path.join('guion', 'serie', `${ID}.json`), null);
  if (!guion) {
    console.log('No encuentro el guion del video: se deja pasar.');
    notificar('alerta', 'La revisión técnica no pudo trabajar', `No encontré el guion de "${ID}". El video pasó sin revisión técnica.`);
    salida('true');
    return;
  }
  const titulo = guion.publicacion?.titulo ?? guion.titulo;
  const ruta = ['out/serie/' + ID + '-subida.mp4', 'out/serie/' + ID + '.mp4'].find((p) => fs.existsSync(p));
  const g = await revisarVideo({ruta, key: process.env.GEMINI_API_KEY, contexto: 'Título: ' + titulo + '.'});
  const gem = g.revision ? {modelo: g.modelo, ...g.revision} : null;
  if (!gem) {
    console.warn('Gemini no pudo revisar el video:', g.error);
    notificar('alerta', 'Gemini no pudo mirar el video', `${String(g.error ?? '').slice(0, 220)} El video pasa sin revisión de imagen y sonido.`);
    fs.writeFileSync(path.join(carpeta, `panel-${ID}.json`), JSON.stringify({fecha: new Date().toISOString(), id: ID, modo: 'tecnico', aprobado: true, resumen: 'Gemini no pudo revisar; pasó sin revisión técnica.', gemini: null}, null, 2));
    salida('true');
    return;
  }
  const {aprobado, motivos} = decidirTecnico(gem);
  const resumen = `Gemini (${gem.modelo}) lo vio y lo oyó: imagen ${gem.imagen?.nota ?? '?'}/10, audio ${gem.audio?.nota ?? '?'}/10, ${aprobado ? 'sin fallas graves de imagen ni sonido' : 'FALLAS GRAVES: ' + motivos.join(' / ')}.`;
  fs.mkdirSync(carpeta, {recursive: true});
  fs.writeFileSync(path.join(carpeta, `panel-${ID}.json`), JSON.stringify({fecha: new Date().toISOString(), id: ID, modo: 'tecnico', aprobado, resumen, motivos, gemini: gem}, null, 2));
  if (!aprobado) {
    try { // el Pintor y el equipo aprenden de estas fallas en los ciclos siguientes
      const rutaApr = path.join(carpeta, 'aprendizajes.json');
      fs.writeFileSync(rutaApr, JSON.stringify([{fecha: new Date().toISOString(), video: guion.titulo, mejora: 'Arreglar las fallas de imagen o sonido que vio Gemini.', quejas: motivos.slice(0, 3)}, ...leer(rutaApr, [])].slice(0, 12), null, 2));
    } catch { /* sin aprendizajes */ }
    notificar('alerta', `Fallas graves de imagen o sonido: ${guion.titulo}`, `${resumen} No se sube.`);
  } else {
    notificar('reporte', `Revisión técnica aprobada: ${guion.titulo}`, resumen);
  }
  console.log(`Revisión técnica: ${aprobado ? 'APROBADO' : 'RECHAZADO'}. ${resumen}`);
  salida(aprobado ? 'true' : 'false');
};

if (path.basename(String(process.argv[1] ?? '')) === 'panel.mjs') {
  principal().catch((e) => {
    console.warn('La revisión técnica falló:', e.message, '— se deja pasar el video.');
    notificar('alerta', 'La revisión técnica falló', `No pudo revisar "${ID}" (${String(e.message).slice(0, 120)}). El video pasó sin revisión técnica.`);
    salida('true');
  }).finally(() => process.exit(0));
}
