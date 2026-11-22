// ENCARGOS DEL DUEÑO desde el Estudio: investigar un tema, buscar ideas nuevas, criticar los videos u otro encargo. Todo con IA gratis y SOLO con datos reales
// (Wikipedia, YouTube, las cifras del canal). Pedido: oficina-salida/<canal>/encargo-pedido.json {id, tipo, texto}. Resultado: encargos.json (lista, máx. 20).
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {chatAlternativo} from './llm.mjs';
import {datosDelCanal} from './estrategia.mjs';
import {titulosVirales} from './web.mjs';

const CANAL = process.env.CANAL || 'lqns';
const dir = path.join('oficina-salida', CANAL);
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const corto = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
const lista = (x, n = 8, c = 300) => (Array.isArray(x) ? x : []).map((i) => corto(typeof i === 'string' ? i : Object.values(i ?? {}).join(' — '), c)).filter(Boolean).slice(0, n);

const pedirJson = async (system, user, max = 2500) => {
  for (let k = 1; k <= 3; k++) {
    const r = await chatAlternativo([{role: 'system', content: `${system} Respondes en español, sin tecnicismos y SOLO con JSON válido. Nunca inventas datos: lo que no esté en los datos dados, lo marcas "sin dato".`}, {role: 'user', content: user}], {maxTokens: max, json: true, temperatura: 0.4});
    if (r) { try { const t = r.texto; return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1)); } catch { /* otra vez */ } }
  }
  throw new Error('Ningún modelo de IA devolvió JSON válido.');
};

const wiki = async (lang, consulta) => {
  const q = new URLSearchParams({action: 'query', format: 'json', generator: 'search', gsrsearch: consulta, gsrlimit: '3', prop: 'extracts', exintro: '1', explaintext: '1', exchars: '900'});
  const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?${q}`, {headers: {'User-Agent': 'FabricaDeVideos/1.0 (encargos)'}, signal: AbortSignal.timeout(15000)});
  if (!r.ok) return [];
  return Object.values((await r.json()).query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).filter((p) => p.extract).map((p) => ({fuente: `Wikipedia (${lang}): ${p.title}`, url: `https://${lang}.wikipedia.org/wiki/${encodeURIComponent(String(p.title).replace(/ /g, '_'))}`, texto: corto(p.extract, 900)}));
};

export const investigar = async (tema) => {
  const [es, en, yt] = await Promise.all([wiki('es', tema).catch(() => []), wiki('en', tema).catch(() => []), titulosVirales(tema, 4).catch(() => [])]);
  const fuentes = [...en, ...es].slice(0, 5);
  if (!fuentes.length) return {titulo: `Investigación: ${tema}`, secciones: [], problemas: ['No encontré fuentes en Wikipedia sobre ese tema. Prueba con otro nombre (en inglés suele funcionar mejor).']};
  const j = await pedirJson('Eres un investigador riguroso de un equipo de videos de misterio (Iris, Lía y Tomás: uno investiga, otro hace de abogado del diablo, otro verifica).',
    `Tema: "${tema}".\nFUENTES (única base permitida):\n${fuentes.map((f, i) => `${i + 1}. ${f.fuente}: ${f.texto}`).join('\n')}\n${yt.length ? `Videos de YouTube sobre el tema este mes: ${yt.map((v) => `"${v.titulo}" ${v.vistas} vistas`).join(' | ')}\n` : ''}\nDevuelve {"confirmado": ["hechos que las FUENTES confirman, con cifras exactas de ellas"], "dudoso": ["lo que es debatido, sin pruebas o que podría estar exagerado"], "angulos": ["3 ángulos de video con gancho, sin inventar hechos"], "peligros": ["errores comunes que los videos virales cometen sobre este tema"]}`);
  return {
    titulo: `Investigación: ${tema}`,
    secciones: [
      {titulo: 'Confirmado', items: lista(j.confirmado)}, {titulo: 'Dudoso', items: lista(j.dudoso)}, {titulo: 'Ángulos de video', items: lista(j.angulos)}, {titulo: 'Cuidado con', items: lista(j.peligros)},
      {titulo: 'Fuentes leídas', items: fuentes.map((f) => `${f.fuente} — ${f.url}`)},
    ].filter((s) => s.items.length),
  };
};

export const criticar = async () => {
  const datos = datosDelCanal(dir);
  const j = await pedirJson('Eres Camila (imagen), Renata y Emilio (guion y ritmo), críticos de un canal faceless de misterio en YouTube. Das consejos concretos y accionables.',
    `DATOS REALES DEL CANAL:\n${datos}\n\nCrítica por favor. Devuelve {"queFunciona": ["máx. 4, apoyado en cifras"], "queFalla": ["máx. 5, apoyado en cifras (retención, vista media, vistas)"], "consejos": ["máx. 6 consejos concretos y distintos para los próximos videos: gancho, ritmo, visuales sin cara, título, miniatura"], "videoPorVideo": ["un consejo breve para cada video con cifras en los datos (máx. 6)"]}`, 3000);
  return {titulo: 'Crítica de tus videos', secciones: [{titulo: 'Lo que funciona', items: lista(j.queFunciona)}, {titulo: 'Lo que falla', items: lista(j.queFalla)}, {titulo: 'Consejos concretos', items: lista(j.consejos)}, {titulo: 'Video por video', items: lista(j.videoPorVideo)}].filter((s) => s.items.length)};
};

export const encargoLibre = async (texto) => {
  const datos = datosDelCanal(dir);
  const j = await pedirJson('Eres el equipo de un canal faceless de misterio en YouTube (guionistas, titulistas, editores). Cumples el encargo del dueño con propuestas concretas.',
    `ENCARGO DEL DUEÑO: "${texto}"\n\nDATOS REALES DEL CANAL:\n${datos}\n\nDevuelve {"titulo": "título corto de lo que entregas", "resultado": ["entrega concreta, máx. 8 elementos"], "notas": ["máx. 3 avisos o supuestos"]}`, 2500);
  return {titulo: corto(j.titulo, 90) || 'Encargo', secciones: [{titulo: 'Resultado', items: lista(j.resultado)}, {titulo: 'Notas', items: lista(j.notas)}].filter((s) => s.items.length)};
};

export const ideasNuevas = () => {
  execFileSync(process.execPath, ['agentes/estrategia.mjs'], {stdio: 'inherit', env: process.env, timeout: 600000});
  const e = leer(path.join(dir, 'estrategia.json'), {ideas: []});
  return {titulo: `Ideas nuevas (${e.ideas?.length ?? 0})`, secciones: [{titulo: 'Las mejores', items: (e.ideas ?? []).slice(0, 8).map((i) => `${i.titulo} — ${i.hook} (estimada ${i.puntuacion}/10)`)}, {titulo: 'Dónde verlas todas', items: ['Todas están en el botón «Ideas» de la casa 3D (responde Sí / No) y en oficina-salida/lqns/estrategia.md con guion y miniatura.']}]};
};

if (path.basename(String(process.argv[1] ?? '')) === 'encargo.mjs') {
  const pedido = leer(path.join(dir, 'encargo-pedido.json'), null);
  const rutaR = path.join(dir, 'encargos.json');
  const previos = leer(rutaR, []);
  if (!pedido?.id || previos.some((x) => x.id === pedido.id)) { console.log('Sin encargo nuevo.'); process.exit(0); }
  const reg = {id: pedido.id, tipo: pedido.tipo, texto: corto(pedido.texto, 300), fecha: pedido.fecha, hecho: true};
  try {
    reg.resultado = pedido.tipo === 'investigar' ? await investigar(corto(pedido.texto, 120)) : pedido.tipo === 'critica' ? await criticar() : pedido.tipo === 'ideas' ? ideasNuevas() : await encargoLibre(corto(pedido.texto, 300));
  } catch (e) {
    reg.resultado = {titulo: 'No se pudo completar', secciones: [], problemas: [String(e.message ?? e).slice(0, 200)]};
  }
  fs.writeFileSync(rutaR, JSON.stringify([reg, ...previos].slice(0, 20), null, 2));
  console.log(`Encargo "${pedido.tipo}" listo: ${reg.resultado.titulo}`);
}
