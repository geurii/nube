// Contador de vistas: lee el feed público de YouTube del PROPIO canal (sin clave) y guarda las vistas reales de sus últimos videos.
// De aquí sale el "bono" de la oficina: la paga de los 30 puestos depende de las vistas ganadas. Si algo falla, no detiene a la oficina.
// Variable: CANAL (por defecto lqns). Deja oficina-salida/<canal>/vistas.json
import fs from 'node:fs';
import path from 'node:path';

const CANAL_ID = (process.env.CANAL || 'lqns').trim();
const CONFIG = (JSON.parse(fs.readFileSync(path.join('agentes', 'canales-propios.json'), 'utf8')).canales ?? []).find((c) => c.id === CANAL_ID);
const SALIDA = path.resolve('oficina-salida', CANAL_ID);
const RUTA = path.join(SALIDA, 'vistas.json');
const UA = 'Mozilla/5.0 (compatible; OficinaVideos/1.0)';
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const previo = leer(RUTA, {});

try {
  if (!CONFIG) throw new Error('canal desconocido');
  fs.mkdirSync(SALIDA, {recursive: true});
  let canalId = previo.canalId || CONFIG.canalId;
  if (!canalId && CONFIG.enlaceCanal) {
    const html = await (await fetch(CONFIG.enlaceCanal, {headers: {'User-Agent': UA, 'Accept-Language': 'es'}, signal: AbortSignal.timeout(30000)})).text();
    canalId = /channel\/(UC[\w-]{22})/.exec(html)?.[1] || /"(?:channelId|externalId)":"(UC[\w-]{22})"/.exec(html)?.[1];
  }
  if (!canalId) throw new Error('no pude averiguar el identificador del canal (agrega "canalId" en canales-propios.json)');
  const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${canalId}`, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(30000)});
  if (!r.ok) throw new Error(`feed ${r.status}`);
  const xml = await r.text();
  const videos = [...xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)].map((m) => ({
    id: /<yt:videoId>([^<]+)</.exec(m[1])?.[1],
    titulo: (/<title>([^<]*)</.exec(m[1])?.[1] ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'"),
    publicado: /<published>([^<]+)</.exec(m[1])?.[1],
    vistas: Number(/<media:statistics views="(\d+)"/.exec(m[1])?.[1] ?? 0),
  }));
  const total = videos.reduce((s, v) => s + v.vistas, 0);
  const antes = typeof previo.total === 'number' ? previo.total : total;
  const historia = [...(previo.historia ?? []), {fecha: new Date().toISOString(), total}].slice(-60);
  const nuevo = {fecha: new Date().toISOString(), canalId, total, ganadasDesdeElUltimoCiclo: Math.max(0, total - antes), videos: videos.slice(0, 15), historia};
  fs.writeFileSync(RUTA, JSON.stringify(nuevo, null, 2));
  console.log(`Vistas de ${CANAL_ID}: ${total} en ${videos.length} videos (+${nuevo.ganadasDesdeElUltimoCiclo} desde el último ciclo).`);
} catch (e) {
  console.warn('El Contador de vistas no pudo leer el canal:', e.message);
  try { fs.writeFileSync(RUTA, JSON.stringify({...previo, error: String(e.message).slice(0, 160), fechaError: new Date().toISOString()}, null, 2)); } catch { /* sin carpeta */ }
}
