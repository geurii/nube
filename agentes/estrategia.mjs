// ESTRATEGA FACELESS: analiza el canal con SUS datos reales (YouTube) y los compara con grandes canales del nicho, explica por qué falló el formato anterior,
// reformula el canal sin personaje ni cara, y entrega 30 ideas de video (título, hook, guion, miniatura, puntuación). Es la ORDEN PRINCIPAL de Jules.
// Regla: solo se usan los datos de este archivo; lo que falta se marca "sin dato". Nada se publica por esto. Salida: oficina-salida/<canal>/estrategia.json y estrategia.md
import fs from 'node:fs';
import path from 'node:path';
import {chatAlternativo} from './llm.mjs';
import {leerBloqueWeb} from './web.mjs';

const CANAL = process.env.CANAL || 'lqns';
const dir = path.join('oficina-salida', CANAL);
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const corto = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Los datos reales que se le entregan al estratega (todo sale de archivos de la oficina). */
export const datosDelCanal = (carpeta = dir) => {
  const vistas = leer(path.join(carpeta, 'vistas.json'), {videos: []});
  const an = leer(path.join(carpeta, 'analitica.json'), {});
  const formulas = leer(path.join(carpeta, 'formulas.json'), {mejores: []});
  const radar = leer(path.join(carpeta, 'radar.json'), {canales: []});
  const subidos = leer(path.join(carpeta, 'subidos.json'), {total: 0});
  const partes = [];
  partes.push(`CANAL: Lo Que No Sabías (@loquenosabias.do). Videos subidos por la fábrica: ${subidos.total ?? 'sin dato'}. Vistas totales de los últimos videos: ${vistas.total ?? 'sin dato'}.`);
  if (an.ultimos28Dias) { const u = an.ultimos28Dias; partes.push(`ÚLTIMOS 28 DÍAS (YouTube Analytics): ${u.views} vistas, ${u.estimatedMinutesWatched} minutos vistos, duración media vista ${u.averageViewDuration} s, retención media ${u.averageViewPercentage}%, +${u.subscribersGained} / -${u.subscribersLost} suscriptores.`); }
  if (an.meta) partes.push(`META: ${an.meta.suscriptores} suscriptores (faltan ${an.meta.faltanSuscriptores}); ${an.meta.horas12Meses} horas vistas en 12 meses (faltan ${an.meta.faltanHoras}); ${an.meta.vistasShorts90} vistas de Shorts en 90 días.`);
  const titulos = new Map([...(subidos.videos ?? []), ...(vistas.videos ?? [])].map((v) => [v.id, v]));
  const porVideo = (an.porVideo ?? []).slice(0, 14).map((v) => `"${corto(titulos.get(v.id)?.titulo ?? v.id, 55)}" ${v.vistas} vistas, retención ${v.retencionPct ?? 'sin dato'}%, vista media ${v.duracionMediaSeg ?? 'sin dato'} s`);
  if (porVideo.length) partes.push(`POR VIDEO (retención real): ${porVideo.join(' | ')}.`);
  else if ((vistas.videos ?? []).length) partes.push(`VISTAS POR VIDEO: ${vistas.videos.slice(0, 14).map((v) => `"${corto(v.titulo, 55)}" ${v.vistas}`).join(' | ')}.`);
  const grandes = (formulas.mejores ?? []).slice(0, 14).map((v) => `${v.canal}: "${corto(v.titulo, 80)}" ${Number(v.vistas).toLocaleString('en-US')} vistas (${Math.round(v.vistasPorHora)} por hora)`);
  if (grandes.length) partes.push(`GRANDES CANALES DEL NICHO (videos recientes, datos reales de YouTube; ${formulas.canalesLeidos ?? '?'} canales leídos): ${grandes.join(' | ')}.`);
  const chicos = (radar.canales ?? []).slice(0, 8).map((c) => `${c.nombre} (${c.suscriptores} subs): "${corto(c.mejor?.titulo, 80)}" ${c.mejor?.vistas ?? '?'} vistas`);
  if (chicos.length) partes.push(`CANALES CHICOS QUE EXPLOTARON (radar): ${chicos.join(' | ')}.`);
  return partes.join('\n');
};

const PEDIDO = `Actúa como el mejor estratega de YouTube faceless del mundo. Analiza el canal Lo Que No Sabías (@loquenosabias.do). Formato anterior: un personaje con lupa en una esquina, pixel art, hook de 0-3 s con una pregunta imposible y un número, misterio no miedo, revelación al 65-75%, veredicto "¿Estafador o genio?", CTA escrito "Mándaselo a un amigo que haría lo mismo, sígueme", 5 hashtags específicos, fuentes de videos virales en inglés de Estados Unidos. Problema: no es viral (un video llegó a 1.000 vistas en 9 horas y 12 likes; las Partes 2 y 3 no empujaron nada). El dueño decidió: formato 100% FACELESS, sin personaje, sin cara ni rostro en pantalla, solo voz en off y visuales en movimiento. Voz fija (no la cambies). Calendario ya hecho (no lo toques). No se sube nada sin aprobación del dueño salvo en automático. Reglas: usa SOLO los DATOS de abajo; si un dato no está escribe "sin dato"; no inventes cifras; no prometas viralidad (las puntuaciones son estimaciones tuyas, no promesas).`;

const llamar = async (mensajes, max) => {
  for (let k = 1; k <= 3; k++) {
    const r = await chatAlternativo(mensajes, {maxTokens: max, json: true, temperatura: 0.5});
    if (r) { try { const t = r.texto; return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { /* se pide otra vez */ } }
  }
  throw new Error('Ningún modelo de IA devolvió JSON válido.');
};

export const generarEstrategia = async ({datos, web = '', nota = console.log} = {}) => {
  const sistema = {role: 'system', content: `${web} Eres un estratega de YouTube riguroso y directo. Respondes en español, sin tecnicismos y SOLO con JSON válido. Nunca inventas datos.`};
  nota('Estratega: diagnóstico y nuevo formato...');
  const base = await llamar([sistema, {role: 'user', content: `${PEDIDO}\n\nDATOS REALES:\n${datos}\n\nDevuelve {"diagnostico": {"formato": "por qué falló el formato anterior, con las cifras de los DATOS", "hook": "...", "retencion": "...", "tema": "...", "miniatura": "...", "titulo": "..."}, "comparacion": "qué hacen distinto los grandes canales de los DATOS (títulos, tipo de tema, ritmo) y qué copiar sin copiar contenido", "nuevoFormato": ["paso 1 ...", "paso 2 ...", "... (8 a 12 pasos concretos del formato faceless: hook, visuales en movimiento sin cara, ritmo de cortes, voz en off, estructura, cierre, miniatura sin cara, título)"], "reglasDeCalidad": ["máx. 6 reglas para que ningún video tenga fondos vacíos ni quede por debajo de 8/10"]}`}], 4500);
  const ideas = [];
  const vistos = [];
  for (let lote = 1; lote <= 3; lote++) {
    nota(`Estratega: ideas ${ (lote - 1) * 10 + 1 }-${lote * 10}...`);
    const r = await llamar([sistema, {role: 'user', content: `${PEDIDO}\n\nNUEVO FORMATO (ya definido): ${JSON.stringify(base.nuevoFormato).slice(0, 1800)}\n\nDATOS REALES:\n${datos}\n\nDame ${lote === 1 ? 10 : 10} ideas de video NUEVAS (${lote}/3) sobre sucesos, objetos o lugares REALES y documentados con artículo en Wikipedia en inglés, con gancho y revelación. ${vistos.length ? `NO repitas estos: ${vistos.join(' | ')}.` : ''}\nCada idea: {"titulo": "máx. 70 letras, sin personas reales", "hook": "primera frase, empieza con 'Sabías que' y lleva una cifra concreta de los hechos (máx. 14 palabras)", "guion": "resumen en 5 frases cortas: hook, desarrollo, giro, revelación, veredicto ¿Estafador o genio?", "miniatura": "descripción de una miniatura SIN cara ni persona: un objeto/lugar grande, texto de máx. 3 palabras", "visuales": "qué se ve en movimiento (sin personas)", "temaWikipedia": "título exacto del artículo de Wikipedia en inglés", "puntuacion": número de 8 a 10 (tu estimación), "porque": "una frase con el motivo de la puntuación apoyada en los DATOS o 'sin dato'"}.\nDevuelve {"ideas": [...]}`}], 6500);
    for (const i of (Array.isArray(r.ideas) ? r.ideas : []).slice(0, 10)) {
      if (!i?.titulo || !i?.hook) continue;
      ideas.push({titulo: corto(i.titulo, 90), hook: corto(i.hook, 160), guion: corto(i.guion, 700), miniatura: corto(i.miniatura, 240), visuales: corto(i.visuales, 240), temaWikipedia: corto(i.temaWikipedia, 80), puntuacion: Math.min(10, Math.max(1, Number(i.puntuacion) || 8)), porque: corto(i.porque, 200)});
      vistos.push(corto(i.titulo, 50));
    }
  }
  return {diagnostico: base.diagnostico ?? {}, comparacion: String(base.comparacion ?? ''), nuevoFormato: Array.isArray(base.nuevoFormato) ? base.nuevoFormato.map(String) : [], reglasDeCalidad: Array.isArray(base.reglasDeCalidad) ? base.reglasDeCalidad.map(String) : [], ideas};
};

export const aMarkdown = (e) => [
  '# Estrategia faceless de Lo Que No Sabías', `_${e.fecha}_`, '',
  '## Por qué falló el formato anterior', ...Object.entries(e.diagnostico ?? {}).map(([k, v]) => `- **${k}**: ${v}`), '',
  '## Qué hacen los grandes canales', e.comparacion, '',
  '## Nuevo formato faceless, paso a paso', ...e.nuevoFormato.map((p, i) => `${i + 1}. ${p}`), '',
  '## Reglas de calidad', ...e.reglasDeCalidad.map((r) => `- ${r}`), '',
  `## ${e.ideas.length} ideas de video`, ...e.ideas.map((i, n) => `### ${n + 1}. ${i.titulo} (${i.puntuacion}/10)\n- Hook: ${i.hook}\n- Guion: ${i.guion}\n- Miniatura: ${i.miniatura}\n- Visuales: ${i.visuales}\n- Wikipedia: ${i.temaWikipedia}\n- Por qué ${i.puntuacion}: ${i.porque}`),
].join('\n');

if (path.basename(String(process.argv[1] ?? '')) === 'estrategia.mjs') {
  const datos = datosDelCanal();
  console.log('DATOS ENTREGADOS AL ESTRATEGA:\n' + datos + '\n');
  const e = {fecha: new Date().toISOString(), ...(await generarEstrategia({datos, web: leerBloqueWeb(CANAL)}))};
  if (!e.ideas.length) { console.error('El estratega no entregó ideas válidas: no se guarda nada.'); process.exit(1); }
  fs.mkdirSync(dir, {recursive: true});
  fs.writeFileSync(path.join(dir, 'estrategia.json'), JSON.stringify(e, null, 2));
  fs.writeFileSync(path.join(dir, 'estrategia.md'), aMarkdown(e));
  // ORDEN PRINCIPAL de Jules: queda en ordenes.json para que ella y el equipo la ejecuten en cada ciclo
  const rutaO = path.join(dir, 'ordenes.json');
  const orden = 'ORDEN PRINCIPAL (del dueño): ejecutar la estrategia faceless de estrategia.json: videos SIN personaje ni cara, solo voz en off y visuales en movimiento; usar las ideas aprobadas por el dueño; cada video de 8/10 o más y sin fondos vacíos; comparar siempre el canal con los grandes del nicho; no inventar datos ni prometer viralidad.';
  fs.writeFileSync(rutaO, JSON.stringify([{fecha: e.fecha, orden, nivel: 5, principal: true}, ...leer(rutaO, []).filter((o) => !o.principal)].slice(0, 10), null, 2));
  console.log(`Estrategia lista: ${e.ideas.length} ideas, ${e.nuevoFormato.length} pasos de formato.`);
}
