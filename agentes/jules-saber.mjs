// CONCIENCIA Y WIFI DE JULES.
// conciencia: un resumen REAL de cómo funciona la fábrica y de en qué está hoy (horarios, reglas del dueño, últimos ciclos, pausa, redes, decisiones).
// wifi: búsqueda en vivo sobre lo que el dueño pregunta (Wikipedia en español e inglés + YouTube). Todo gratis y sin llave; nunca lanza.
import fs from 'node:fs';
import path from 'node:path';
import {titulosVirales} from './web.mjs';

const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const corto = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Lo que Jules debe saber siempre de la fábrica (hechos fijos decididos por el dueño). */
export const HECHOS_FIJOS = [
  'CÓMO FUNCIONA LA FÁBRICA: todo corre en la nube (GitHub Actions) sin que el dueño esté. Oficina: elige tema (radar de canales chicos + Wikipedia), el Guionista escribe, el Editor lo critica, el Verificador comprueba datos, y un panel de 8 espectadores juzga el GUION; si lo rechazan se reescribe y no se gasta voz ni render.',
  'Después: voz, imágenes (fotos reales de internet pixeladas + pintores que añaden ambiente), render y revisión técnica de Gemini (solo frena fallas graves de imagen o sonido). Luego se publica solo en YouTube, Facebook, Instagram y TikTok (por Windsor y Buffer).',
  'HORARIOS: un Short nuevo cada 3 horas si hay presupuesto; un VIDEO LARGO horizontal 16:9 los días impares a las 12:23 UTC. Meta: 2 videos por día y no pasar de 1800 de los 2000 minutos gratis de GitHub al mes (se reinicia el 1 de diciembre).',
  'REGLAS DEL DUEÑO: Shorts verticales de máx. 60 s; largo 16:9 de 8 a 12 min; estilo pixel art fijo; sin nombres reales de personas; voz masculina grave; música solo en TikTok/Instagram. Meta: monetizar antes del 13 de diciembre de 2026.',
  'LO QUE NO PUEDES HACER: publicar, borrar o cambiar videos tú misma; pedir claves; prometer vistas o resultados. Sí puedes: opinar, explicar el estado real y dar UNA orden concreta al equipo.',
].join(' ');

/** Estado de hoy leído de los archivos reales de la oficina. */
export const estadoDeHoy = (canal = 'lqns', raiz = 'oficina-salida') => {
  const carpeta = path.join(raiz, canal);
  const estado = leer(path.join(carpeta, 'estado.json'), {});
  const partes = [];
  partes.push(fs.existsSync(path.join('agentes', 'PAUSA')) ? 'PRODUCCIÓN: EN PAUSA (existe agentes/PAUSA).' : 'PRODUCCIÓN: activa (sin pausa).');
  const h = (estado.historial ?? []).slice(0, 6);
  if (h.length) partes.push(`Últimos ciclos de la oficina (reales): ${h.map((x) => `${String(x.fecha).slice(5, 16)} ${x.tema} → ${x.resultado}${x.detalle ? ' (' + corto(x.detalle, 70) + ')' : ''}`).join(' | ')}.`);
  if (estado.totales) partes.push(`Totales: ${estado.totales.aprobados ?? 0} guiones aprobados, ${estado.totales.rechazados ?? 0} rechazados, ${estado.totales.errores ?? 0} errores.`);
  const producidos = leer(path.join(carpeta, 'producidos.json'), []);
  let pendientes = 0;
  try { pendientes = fs.readdirSync(carpeta).filter((f) => /^guion-.*\.json$/.test(f)).filter((f) => { const g = leer(path.join(carpeta, f), null); return g?.estado === 'aprobado' && !producidos.some((p) => f.includes(p)); }).length; } catch { /* sin carpeta */ }
  partes.push(`Videos ya producidos: ${producidos.length}. Guiones aprobados esperando render: ${pendientes}.`);
  const dec = leer(path.join(carpeta, 'decisiones.json'), {decisiones: []}).decisiones ?? [];
  if (dec.length) partes.push(`Ideas que el dueño decidió: ${dec.filter((d) => d.decision === 'si').length} sí y ${dec.filter((d) => d.decision !== 'si').length} no.`);
  const vig = leer(path.join(raiz, 'vigilante.json'), null);
  if (vig) partes.push(`Vigilante (${String(vig.fecha).slice(0, 16)}): ${vig.problemas?.length ? 'PROBLEMAS: ' + vig.problemas.map((p) => corto(p, 90)).join(' | ') : 'sin problemas'}; en orden: ${(vig.ok ?? []).slice(0, 6).join(', ')}.`);
  const reg = ['facebook', 'instagram', 'tiktok'].map((r) => { const j = leer(path.join(carpeta, r + '.json'), null); const n = Array.isArray(j) ? j.length : (j?.total ?? j?.videos?.length ?? 0); return `${r}: ${n} publicados`; });
  partes.push(`Redes (registros reales): ${reg.join(', ')}.`);
  return partes.join(' ');
};

/** WIFI: busca en internet lo que el dueño preguntó. Devuelve '' si no hay nada útil o no hay red. */
export const buscarEnVivo = async (texto, {limiteMs = 14000} = {}) => {
  const consulta = String(texto ?? '').replace(/[¿?¡!"]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 90);
  if (consulta.length < 8) return '';
  const hasta = Date.now() + limiteMs;
  const wiki = async (lang) => {
    const q = new URLSearchParams({action: 'query', format: 'json', generator: 'search', gsrsearch: consulta, gsrlimit: '2', prop: 'extracts', exintro: '1', explaintext: '1', exchars: '320'});
    const r = await fetch(`https://${lang}.wikipedia.org/w/api.php?${q}`, {headers: {'User-Agent': 'FabricaDeVideos/1.0 (consulta de Jules)'}, signal: AbortSignal.timeout(Math.max(1500, hasta - Date.now()))});
    if (!r.ok) return [];
    return Object.values((await r.json()).query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).filter((p) => p.extract).map((p) => `(Wikipedia ${lang}) ${p.title}: ${corto(p.extract, 260)}`);
  };
  const [es, en, yt] = await Promise.all([wiki('es').catch(() => []), wiki('en').catch(() => []), titulosVirales(consulta, 3).catch(() => [])]);
  const partes = [...es.slice(0, 2), ...en.slice(0, 1)];
  if (yt.length) partes.push(`YouTube (más vistos este mes sobre eso): ${yt.map((v) => `"${v.titulo}" ${v.vistas.toLocaleString('en-US')} vistas`).join(' | ')}`);
  return partes.length ? `BÚSQUEDA EN INTERNET EN VIVO sobre lo que preguntó el dueño (úsala si ayuda; si no responde su pregunta, dilo): ${partes.join(' || ')}` : '';
};
