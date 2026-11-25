// RADAR DE CANALES POR EXPLOTAR: en vez de elegir el tema solo desde Wikipedia, busca en YouTube (datos públicos, sin llave ni créditos)
// los videos de este mes con más vistas en el nicho, descubre sus canales, lee sus suscriptores y se queda con los canales CHICOS que explotaron
// (muchas vistas para su tamaño). Deja oficina-salida/<canal>/radar.json, que lee la Oficina para elegir tema (solo el TEMA; nunca se copia contenido).
// Nunca lanza: si YouTube bloquea o falla, conserva el radar anterior. Variables: CANAL (por defecto lqns).
import fs from 'node:fs';
import path from 'node:path';
import {datosDeVideo} from './analizar-videos.mjs';

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CABECERAS = {'User-Agent': UA, 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1; SOCS=CAI', Connection: 'close'};
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const pedir = async (url, opts = {}) => {
  let ultimo;
  const {timeoutMs, signal: señalOriginal, ...base} = opts;
  for (let intento = 0; intento < 4; intento++) {
    try {
      // Crear un timeout nuevo en cada intento: no reutilizar una señal que pudo vencer durante el backoff.
      const signal = timeoutMs ? AbortSignal.timeout(timeoutMs) : (intento === 0 ? señalOriginal : undefined);
      const r = await fetch(url, {...base, ...(signal ? {signal} : {})});
      if (r.status !== 429 || intento === 3) return r;
      const retry = Number(r.headers.get('retry-after'));
      const espera = Number.isFinite(retry) && retry > 0 ? retry * 1000 : [5000, 10000, 20000][intento];
      console.warn(`YouTube 429: pausa de ${Math.round(espera / 1000)} s antes de reintentar.`);
      await dormir(espera);
    } catch (e) {
      ultimo = e;
      if (intento === 3) throw e;
      await dormir(2500 * (intento + 1));
    }
  }
  throw ultimo ?? new Error('YouTube no respondió después de los reintentos.');
}; // Reintenta 429 con backoff y respeta Retry-After
const leer = (ruta, d) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return d; } };

// Búsqueda multilingüe: no limitar el descubrimiento a creadores anglófonos.
export const CONSULTAS_POR_DEFECTO = [
  'unsolved mystery explained', 'true strange history story', 'mysterious discovery explained',
  '歴史 ミステリー 不思議な出来事 解説', '未解決事件 奇妙な歴史 雑学',
  '历史 未解之谜 奇闻真实故事', '离奇历史事件 真相揭秘',
  'misterios sin resolver historia extraña', 'historias reales sorprendentes misterio',
  'mystère historique inexpliqué histoire vraie', 'mistério histórico história real surpreendente',
  '기묘한 역사 미스터리 실화', 'غموض تاريخي قصة حقيقية غريبة',
];

/** Filtro de búsqueda de YouTube (protobuf en base64): orden por vistas, publicado este mes (4) o esta semana (3), solo videos. */
export const filtroBusqueda = (fecha = 4, corto = false) => encodeURIComponent(Buffer.from(corto
  ? [0x08, 0x03, 0x12, 0x06, 0x08, fecha, 0x10, 0x01, 0x18, 0x01] // orden por vistas + fecha + videos de menos de 4 minutos
  : [0x08, 0x03, 0x12, 0x04, 0x08, fecha, 0x10, 0x01]).toString('base64'));

const recorrer = (o, f) => { if (Array.isArray(o)) o.forEach((x) => recorrer(x, f)); else if (o && typeof o === 'object') { f(o); Object.values(o).forEach((x) => recorrer(x, f)); } };

export const numeroDe = (txt) => {
  const m = /([\d][\d.,]*)\s*([KMB]?)/i.exec(String(txt ?? ''));
  if (!m) return null;
  const n = Number(m[1].replace(/,/g, ''));
  if (!Number.isFinite(n)) return null;
  return Math.round(n * ({K: 1e3, M: 1e6, B: 1e9}[m[2].toUpperCase()] ?? 1));
};
export const diasDe = (txt) => {
  const m = /(\d+)\s*(hour|day|week|month|year|h|d|w|mo|y)/i.exec(String(txt ?? ''));
  if (!m) return null;
  const n = Number(m[1]);
  const u = m[2].toLowerCase();
  if (u.startsWith('h')) return n / 24;
  if (u.startsWith('d')) return n;
  if (u.startsWith('w')) return n * 7;
  if (u.startsWith('mo')) return n * 30;
  return n * 365;
};
export const segundosDe = (txt) => String(txt ?? '').split(':').reverse().reduce((t, p, i) => t + (Number(p) || 0) * 60 ** i, 0);
const esIngles = (t) => { const s = String(t ?? ''); return s.length > 5 && !/[Ѐ-῿⺀-퟿-￿]/.test(s) && (s.match(/[ -~]/g) ?? []).length / s.length > 0.85; };

/** Videos que salen para una consulta (con canal, vistas, antigüedad y duración). */
export const buscarVideos = async (consulta, fecha = 4, corto = false) => {
  const r = await pedir(`https://www.youtube.com/results?search_query=${encodeURIComponent(consulta)}&sp=${filtroBusqueda(fecha, corto)}&hl=en&gl=US`, {headers: CABECERAS, timeoutMs: 25000});
  if (!r.ok) throw new Error('YouTube ' + r.status);
  const html = await r.text();
  const m = /var ytInitialData = (\{[\s\S]*?\});<\/script>/.exec(html);
  if (!m) throw new Error('YouTube no devolvió resultados (¿bloqueo o página de consentimiento?)');
  const salida = [];
  recorrer(JSON.parse(m[1]), (o) => {
    const v = o.videoRenderer;
    if (!v?.videoId) return;
    const canalId = v.ownerText?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId;
    salida.push({
      id: v.videoId, canalId, canal: v.ownerText?.runs?.[0]?.text, titulo: v.title?.runs?.[0]?.text ?? '',
      vistas: numeroDe(v.viewCountText?.simpleText), dias: diasDe(v.publishedTimeText?.simpleText), segundos: segundosDe(v.lengthText?.simpleText),
    });
  });
  return salida.filter((v) => v.canalId && v.vistas !== null);
};

/** Suscriptores y cantidad de videos de un canal (página pública). */
export const datosDeCanal = async (canalId) => {
  const r = await pedir(`https://www.youtube.com/channel/${canalId}`, {headers: CABECERAS, signal: AbortSignal.timeout(25000)});
  if (!r.ok) return null;
  const html = await r.text();
  const subs = /"content":"([\d.,]+[KMB]?) subscribers"/.exec(html)?.[1];
  const videos = /"content":"([\d,]+) videos"/.exec(html)?.[1];
  let joined = /"joinedDateText":\s*\{\s*"content":"([^"]+)"/.exec(html)?.[1]
    ?? /"joinedDateText":\s*\{\s*"simpleText":"([^"]+)"/.exec(html)?.[1]
    ?? /Joined\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/.exec(html)?.[1];
  if (!joined) {
    const about = await pedir(`https://www.youtube.com/channel/${canalId}/about?hl=en`, {headers: CABECERAS, timeoutMs: 20000}).catch(() => null);
    if (about?.ok) {
      const ah = await about.text();
      joined = /"joinedDateText":\s*\{\s*"content":"([^"]+)"/.exec(ah)?.[1]
        ?? /"joinedDateText":\s*\{\s*"simpleText":"([^"]+)"/.exec(ah)?.[1]
        ?? /Joined\s+([A-Z][a-z]+\s+\d{1,2},\s+\d{4})/.exec(ah)?.[1];
    }
  }
  const fechaAlta = joined ? Date.parse(joined.replace(/^Joined\s+/i, '').replace(/\s+$/, '')) : NaN;
  if (!subs || !Number.isFinite(fechaAlta)) return null;
  return {suscriptores: numeroDe(subs), videos: videos ? numeroDe(videos) : null, fechaAlta: new Date(fechaAlta).toISOString(), diasCanal: Math.max(0, (Date.now() - fechaAlta) / 86400000)};
};

/** Feed público del canal (RSS, sin clave): sus últimos 15 videos con las vistas de cada uno. */
export const feedDeCanal = async (canalId) => {
  const r = await pedir(`https://www.youtube.com/feeds/videos.xml?channel_id=${canalId}`, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(20000)});
  if (!r.ok) return [];
  const xml = await r.text();
  return [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => {
    const e = m[1];
    const publicado = /<published>([^<]+)</.exec(e)?.[1];
    return {
      id: /<yt:videoId>([^<]+)</.exec(e)?.[1],
      titulo: (/<title>([^<]*)</.exec(e)?.[1] ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
      vistas: Number(/<media:statistics views="(\d+)"/.exec(e)?.[1] ?? NaN),
      dias: publicado ? (Date.now() - Date.parse(publicado)) / 86400000 : null,
    };
  }).filter((v) => v.id && Number.isFinite(v.vistas));
};


/**
 * Referencias de formato largo para estudiar la estructura de documentales del nicho.
 * No depende del radar de canales nuevos: incluye creadores establecidos y búsquedas de todo el historial.
 */
export const CONSULTAS_LARGAS_POR_DEFECTO = [
  'misterios sin resolver documental completo',
  'fenómenos inexplicables investigación documental historia real',
  'misterios históricos documental investigación completa',
  'casos extraños reales narración documental',
  'misterios del mundo explicación documental',
  'Expressy misterios documental',
  'XpressTV misterios documental',
];

export const esReferenciaLarga = (video) => {
  const segundos = Number(video?.segundos);
  return Number.isFinite(segundos) && segundos >= 480 && segundos <= 3600;
};

export const buscarReferenciasLargas = async ({
  nicho = '',
  canales = [],
  maxResultados = 14,
  limiteMs = 110000,
  nota = () => {},
} = {}) => {
  // Búsqueda deliberadamente pequeña y secuencial: 17 peticiones simultáneas provocaban HTTP 429.
  const consultas = [
    'misterios sin resolver documental completo',
    'fenómenos inexplicables investigación documental historia real',
    'misterios históricos documental investigación completa',
    'Expressy misterios documental',
    'XpressTV misterios documental',
    'MrBallen mystery documentary',
    'The Why Files mystery documentary',
    ...(nicho ? [`${nicho} documental investigación completa`] : []),
  ];
  const hasta = Date.now() + limiteMs;
  const candidatos = new Map();
  for (const q of consultas) {
    if (Date.now() >= hasta - 25000) break;
    try {
      const lista = await buscarVideos(q, 0, false);
      for (const v of lista) {
        if (!v?.id || !esReferenciaLarga(v)) continue;
        const previo = candidatos.get(v.id);
        if (!previo || Number(v.vistas ?? 0) > Number(previo.vistas ?? 0)) candidatos.set(v.id, v);
      }
      nota(`Búsqueda larga completada: ${q}`);
    } catch (e) {
      nota(`Búsqueda larga falló (${q}): ${String(e.message ?? e).slice(0, 100)}`);
      if (/429/.test(String(e.message))) await dormir(12000);
    }
    await dormir(1800);
  }
  const lista = [...candidatos.values()]
    .sort((a, b) => Number(b.vistas ?? 0) - Number(a.vistas ?? 0))
    .slice(0, Math.max(10, Math.min(20, maxResultados * 2)));
  const detalles = [];
  // Las páginas de video también se leen de una en una para no volver a disparar el limitador.
  for (const video of lista) {
    if (Date.now() >= hasta - 5000 || detalles.length >= maxResultados) break;
    try {
      const d = await datosDeVideo(video.id);
      const segundos = Number(d.segundos ?? video.segundos);
      if (!esReferenciaLarga({segundos}) || String(d.transcripcion ?? '').trim().length < 1800) continue;
      detalles.push({
        ...video,
        ...d,
        id: video.id,
        url: d.url || `https://www.youtube.com/watch?v=${video.id}`,
        titulo: d.titulo || video.titulo,
        canal: d.canal || video.canal,
        vistas: d.vistas ?? video.vistas,
        segundos,
        caracteresTranscripcion: String(d.transcripcion).length,
      });
      nota(`Referencia documental válida: ${d.titulo || video.titulo} (${segundos}s; ${String(d.transcripcion).length} caracteres de transcripción).`);
    } catch (e) {
      nota(`No se pudo leer la referencia ${video.id}: ${String(e.message ?? e).slice(0, 100)}`);
    }
    await dormir(900);
  }
  return detalles.sort((a, b) => Number(b.vistas ?? 0) - Number(a.vistas ?? 0)).slice(0, maxResultados);
};

const mediana = (xs) => { const s = [...xs].sort((a, b) => a - b); return s.length ? s[Math.floor(s.length / 2)] : 0; };

/** ¿Este canal tiene un video que EXPLOTÓ? Devuelve el video y cuánto se salió de lo normal del canal, o null. */
export const detectarExplosion = (videos, {minVistas = 5000, maxDias = 90, veces = 5} = {}) => {
  const recientes = videos.filter((v) => v.dias !== null && v.dias <= maxDias);
  if (recientes.length < 3) return null;
  const normal = Math.max(mediana(videos.map((v) => v.vistas)), 50);
  const mejor = [...recientes].sort((a, b) => b.vistas - a.vistas)[0];
  if (mejor.vistas < minVistas || mejor.vistas / normal < veces) return null;
  return {video: mejor, normal, veces: Math.round(mejor.vistas / normal)};
};

/** Canales chicos que explotaron: pocas suscripciones, un video con muchas vistas recientes (y que se salió de lo normal del canal). */
export const puntuar = (video, c, veces) => {
  const ratio = video.vistas / Math.max(c.suscriptores, 1000);
  const frescura = video.dias === null ? 0.5 : Math.max(0.2, 1 - video.dias / 60);
  return Math.round(Math.min(ratio, 200) * frescura * Math.min(veces, 50)) / 100;
};

/** Hace `trabajo(x)` para cada elemento con N a la vez. */
const enParalelo = async (lista, n, trabajo) => {
  let i = 0;
  await Promise.all(Array.from({length: n}, async () => { while (i < lista.length) { const x = lista[i++]; try { await trabajo(x); } catch { /* un elemento que falla no detiene al resto */ } } }));
};

export const construirRadar = async ({consultas = CONSULTAS_POR_DEFECTO, maxSubs = 300000, minVistas = 15000, limiteMs = 170000, nota = () => {}} = {}) => {
  const hasta = Date.now() + limiteMs;
  // 1) Descubrir canales del nicho: búsquedas de videos cortos recientes (esta semana y este mes) y la búsqueda normal
  const canalesVistos = new Map();
  const variantes = [[3, true], [4, true], [4, false]];
  for (const q of consultas) {
    for (const [fecha, corto] of variantes) {
      if (Date.now() > hasta - 100000) break;
      try {
        const lista = await buscarVideos(q + (corto ? ' #shorts' : ''), fecha, corto);
        for (const v of lista) if (!canalesVistos.has(v.canalId)) canalesVistos.set(v.canalId, v.canal);
      } catch (e) { nota(`(Radar: la búsqueda "${q}" falló: ${String(e.message ?? e).slice(0, 80)})`); }
      await dormir(2500);
    }
  }
  // 2) Mirar el feed de cada canal descubierto y quedarse con los que tienen un video que explotó
  const explotaron = [];
  await enParalelo([...canalesVistos.entries()].slice(0, 90), 4, async ([id, nombre]) => {
    if (Date.now() > hasta - 25000) return;
    const videos = await feedDeCanal(id);
    const e = detectarExplosion(videos, {minVistas});
    if (e) explotaron.push({id, nombre, ...e}); // cualquier idioma
  });
  // 3) Solo los chicos: leer sus suscriptores
  const canales = [];
  await enParalelo(explotaron.sort((a, b) => b.video.vistas - a.video.vistas).slice(0, 25), 3, async (x) => {
    if (Date.now() > hasta) return;
    const c = await datosDeCanal(x.id);
    if (!c || c.suscriptores > maxSubs || c.diasCanal > 90) return;
    canales.push({
      id: x.id, nombre: x.nombre, suscriptores: c.suscriptores, videosDelCanal: c.videos, fechaAlta: c.fechaAlta, diasCanal: Math.round(c.diasCanal), veces: x.veces,
      mejor: {id: x.video.id, titulo: x.video.titulo, vistas: x.video.vistas, hace: Math.round(x.video.dias), url: `https://youtube.com/watch?v=${x.video.id}`},
      puntaje: puntuar(x.video, c, x.veces),
    });
  });
  canales.sort((a, b) => b.puntaje - a.puntaje);
  return {fecha: new Date().toISOString(), criterio: 'canales creados hace 90 días o menos; videos publicados hace 90 días o menos; rendimiento mínimo 5x la mediana del canal', consultas, canalesRevisados: canalesVistos.size, explotaron: explotaron.length, canales: canales.slice(0, 15), videosVirales: canales.slice(0, 15).map(c => ({canal:c.nombre, canalId:c.id, diasCanal:c.diasCanal, suscriptores:c.suscriptores, titulo:c.mejor.titulo, vistas:c.mejor.vistas, hace:c.mejor.hace, veces:c.veces, url:c.mejor.url, idiomaDetectado:'multilingüe'}))};
};

/** Texto corto para meter en el encargo del Director de contenido. */
export const textoDeRadar = (radar, max = 8) => (radar?.canales ?? []).slice(0, max)
  .map((c) => `"${c.mejor.titulo}" (${c.mejor.vistas.toLocaleString('en-US')} vistas en ${c.mejor.hace ?? "?"} días; canal creado hace ${c.diasCanal} días, ${c.veces}x su rendimiento habitual; ${c.suscriptores.toLocaleString('en-US')} suscriptores)`).join(' | ');

const principal = async () => {
  const CANAL = (process.env.CANAL || 'lqns').trim();
  const config = (leer(path.join('agentes', 'canales-propios.json'), {canales: []}).canales ?? []).find((c) => c.id === CANAL);
  const dir = path.join('oficina-salida', CANAL);
  fs.mkdirSync(dir, {recursive: true});
  const ruta = path.join(dir, 'radar.json');
  const notas = [];
  const previo = leer(ruta, null);
  if (previo?.fecha && Array.isArray(previo.referenciasLargas) && previo.referenciasLargas.length > 0 && Date.now() - Date.parse(previo.fecha) < 12 * 3600 * 1000 && !process.env.RADAR_FORZAR) {
    console.log('Radar reciente (menos de 12 horas): no se repite para ahorrar minutos.');
    return;
  }
  const esLargo = process.env.FORMATO === 'largo';
  // En formato largo se omite el radar de canales nuevos: sus decenas de búsquedas consumían
  // el presupuesto y disparaban el limitador antes de encontrar documentales.
  const radar = esLargo
    ? {fecha: new Date().toISOString(), consultas: CONSULTAS_LARGAS_POR_DEFECTO, canalesRevisados: 0, explotaron: 0, canales: []}
    : await construirRadar({consultas: config?.radar?.consultas ?? CONSULTAS_POR_DEFECTO, minVistas: 5000, maxSubs: 300000, limiteMs: 170000, nota: (t) => { notas.push(t); console.log(t); }});
  const referenciasLargas = await buscarReferenciasLargas({nicho: config?.nicho ?? '', canales: config?.vigilar ?? [], maxResultados: 10, limiteMs: esLargo ? 260000 : 105000, nota: (t) => { notas.push(t); console.log(t); }});
  radar.referenciasLargas = referenciasLargas.map(({id, url, titulo, canal, vistas, segundos, caracteresTranscripcion, idiomaTranscripcion}) => ({id, url, titulo, canal, vistas, segundos, caracteresTranscripcion, idiomaTranscripcion}));
  if (!radar.canales.length && !radar.referenciasLargas.length) {
    console.log('Radar sin referencias largas con subtítulos suficientes; se conserva el anterior.', notas.join(' '));
    return;
  }
  fs.writeFileSync(ruta, JSON.stringify(radar, null, 2));
  console.log(`Radar listo: ${radar.canales.length} canales chicos que explotaron (de ${radar.canalesRevisados} canales revisados, ${radar.explotaron} con un video que explotó).`);
  for (const c of radar.canales.slice(0, 5)) console.log(` - ${c.nombre} (${c.suscriptores} subs): ${c.mejor.titulo.slice(0, 60)} · ${c.mejor.vistas} vistas`);
};

if (path.basename(String(process.argv[1] ?? '')) === 'radar.mjs') {
  principal().catch((e) => console.log('Radar no disponible:', String(e.message ?? e).slice(0, 120))).finally(() => process.exit(0));
}
