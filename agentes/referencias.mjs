// Referencias de internet para los dos pintores: busca en Wikimedia Commons fotos LIBRES (dominio público o CC0, sin atribución obligatoria),
// las baja en tamaño pequeño a public/referencias/ y el motor de pixel art las convierte a pixelado (capa "foto").
// Nunca tumba el ciclo: si algo falla (sin red, sin resultados) devuelve {} y los pintores trabajan como siempre.
import fs from 'node:fs';
import path from 'node:path';

const API = 'https://commons.wikimedia.org/w/api.php';
const UA = 'FabricaDeVideos/1.0 (referencias de pixel art)';
const LICENCIA_OK = /^(public domain|pd[- ]|cc0|cc[- ]?zero)/i;
// Fotos que NO sirven de referencia visual: retratos, gráficos, espectrogramas, mapas, logos, portadas, esquemas, carteles, texturas...
const TITULO_NO = /portrait|headshot|\bbust\b|logo|flag|coat of arms|diagram|\bmap\b|signature|stamp|banknote|screenshot|spectrogram|spectrum|waveform|chart|graph|plot|schematic|infographic|poster|cover|icon|sprite|vector|texture|pattern|figure|table|\bscan\b|\.svg|\.gif|\.pdf|\.tif/i;
const MAX_BYTES = 600 * 1024;

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
// Commons y Openverse limitan las peticiones (error 429): se espera lo que pidan (máx. 15 s) y se reintenta hasta 3 veces.
const pedir = async (url, tiempo = 20000) => {
  let r;
  for (let i = 1; i <= 3; i++) {
    r = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(tiempo)});
    if (![429, 503].includes(r.status) || i === 3) return r;
    const pide = Number(r.headers.get('retry-after'));
    await dormir(Math.min(15000, (Number.isFinite(pide) && pide > 0 ? pide : 4 * i) * 1000));
  }
  return r;
};

/** Busca UNA foto libre para la consulta (en inglés). Devuelve {url, titulo, licencia, pagina} o null. */
export const buscarFotoLibre = async (consulta) => {
  const q = new URLSearchParams({
    action: 'query', format: 'json', generator: 'search', gsrnamespace: '6', gsrlimit: '12',
    gsrsearch: `${consulta} filetype:bitmap`, prop: 'imageinfo', iiprop: 'url|extmetadata|size|mime', iiurlwidth: '640',
  });
  const r = await pedir(`${API}?${q}`);
  if (!r.ok) return null;
  const j = await r.json();
  const paginas = Object.values(j.query?.pages ?? {}).sort((a, b) => (a.index ?? 0) - (b.index ?? 0));
  for (const p of paginas) {
    const i = p.imageinfo?.[0];
    if (!i?.thumburl || !/^image\/(jpeg|png)$/.test(i.mime ?? '')) continue;
    const lic = String(i.extmetadata?.LicenseShortName?.value ?? '');
    if (!LICENCIA_OK.test(lic)) continue;
    if (TITULO_NO.test(p.title ?? '')) continue;
    if ((i.width ?? 0) < 500 || (i.height ?? 0) < 300) continue;
    return {url: i.thumburl, titulo: String(p.title).replace(/^File:/, ''), licencia: lic, pagina: i.descriptionurl};
  }
  return null;
};

/** Respaldo cuando Commons no tiene nada: Openverse (gratis, sin llave) filtrado a dominio público y CC0. */
export const buscarEnOpenverse = async (consulta) => {
  const q = new URLSearchParams({q: consulta, page_size: '12', license: 'cc0,pdm'});
  const r = await pedir(`https://api.openverse.org/v1/images/?${q}`);
  if (!r.ok) return null;
  for (const x of (await r.json()).results ?? []) {
    if (!x.thumbnail || TITULO_NO.test(x.title ?? '') || /portrait|retrato/i.test(x.tags?.map?.((t) => t.name).join(' ') ?? '')) continue;
    if ((x.width ?? 0) < 500 || (x.height ?? 0) < 300) continue;
    return {url: x.thumbnail, titulo: String(x.title ?? 'sin título').slice(0, 100), licencia: String(x.license ?? '').toUpperCase() === 'PDM' ? 'Public domain' : 'CC0', pagina: x.foreign_landing_url};
  }
  return null;
};

const descargar = async (url, destino) => {
  const r = await pedir(url, 30000);
  if (!r.ok) throw new Error('descarga ' + r.status);
  const buf = Buffer.from(await r.arrayBuffer());
  if (buf.length < 3000 || buf.length > MAX_BYTES) throw new Error('tamaño raro: ' + buf.length);
  const magia = buf.subarray(0, 4).toString('hex');
  if (!(magia.startsWith('ffd8ff') || magia === '89504e47')) throw new Error('no es una imagen');
  fs.writeFileSync(destino, buf);
};

/**
 * Para cada escena pide al modelo una búsqueda en inglés y baja una foto libre.
 * Devuelve {indice: {archivo: "slug-N.jpg", titulo, licencia, pagina}}.
 */
export const reunirReferencias = async ({llamar, escenas, indices, slug, tema, nota = () => {}}) => {
  const salida = {};
  try {
    const lista = indices.map((i) => `${i}. ${String(escenas[i].texto).slice(0, 220)}`).join('\n');
    const r = await llamar([
      {role: 'system', content: 'Eres un documentalista que busca fotos de archivo. Responde SOLO con JSON.'},
      {role: 'user', content: `Tema del video: "${tema}".\nPara cada escena da una búsqueda CORTA EN INGLÉS (2 a 5 palabras) que encuentre en Wikimedia Commons una foto o grabado histórico/real del OBJETO o LUGAR que se menciona (nada de retratos de personas, mapas ni logos). Si la escena es solo una pregunta o una opinión y no hay nada concreto que fotografiar, usa "q": "".\n\nESCENAS:\n${lista}\n\nDevuelve {"consultas": [{"indice": N, "q": "..."}]}`},
    ], 700);
    const dir = path.resolve('public', 'referencias');
    fs.mkdirSync(dir, {recursive: true});
    const usadas = new Set();
    const tope = Date.now() + 120000; // tope duro de tiempo para buscar y bajar todas las fotos
    for (const c of (Array.isArray(r?.consultas) ? r.consultas : []).slice(0, 12)) {
      const i = Number(c.indice);
      const q = String(c.q ?? '').trim().slice(0, 80);
      if (!indices.includes(i) || q.length < 3) continue;
      if (Date.now() > tope) { nota('(Referencias: se acabó el tiempo asignado (2 min); el resto de escenas va sin foto.)'); break; }
      await dormir(1200); // sin ráfagas: Commons limita las peticiones seguidas
      // Se prueba Commons y, si no hay foto o la descarga falla, Openverse
      for (const buscar of [buscarFotoLibre, buscarEnOpenverse]) {
        try {
          const f = await buscar(q);
          if (!f || usadas.has(f.url)) continue;
          const archivo = `${slug}-${i}.jpg`;
          await descargar(f.url, path.join(dir, archivo));
          usadas.add(f.url);
          salida[i] = {archivo, titulo: f.titulo, licencia: f.licencia, pagina: f.pagina};
          break;
        } catch (e) { nota(`(Referencia de la escena ${i}: ${String(e.message ?? e).slice(0, 80)})`); }
      }
    }
  } catch (e) { nota(`(Sin referencias de internet: ${String(e.message ?? e).slice(0, 100)})`); }
  return salida;
};
