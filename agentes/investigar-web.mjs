// Segunda fuente de investigación que NO es Wikipedia: DuckDuckGo (gratis, sin llave ni cuenta).
// Trae los resúmenes de los primeros resultados de la web para contrastar fechas y cifras con Wikipedia.
// Nunca tumba el ciclo: si falla, devuelve [] y la oficina sigue solo con Wikipedia.
const UA = 'Mozilla/5.0 (compatible; FabricaDeVideos/1.0)';
const SIN_WIKI = /(^|\.)(wikipedia|wikimedia|wikiwand|dbpedia|wikidata)\./i;

const limpiar = (h) => String(h ?? '')
  .replace(/<[^>]+>/g, '')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/\s+/g, ' ').trim();

/** Convierte el enlace de redirección de DuckDuckGo en la dirección real. */
const destino = (href) => {
  try {
    const u = href.startsWith('//') ? 'https:' + href : href;
    const real = new URL(u).searchParams.get('uddg');
    return real ? decodeURIComponent(real) : u;
  } catch { return null; }
};

/** Devuelve {resultados: [{titulo, url, texto}]} (hasta `max`) para la consulta. */
export const buscarEnLaWeb = async (consulta, max = 6) => {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(consulta)}`, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(25000)});
  if (!r.ok) throw new Error('buscador ' + r.status);
  const html = await r.text();
  const salida = [];
  const re = /class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g;
  for (const m of html.matchAll(re)) {
    const url = destino(m[1]);
    if (!url || !/^https?:/.test(url)) continue;
    let host = '';
    try { host = new URL(url).hostname; } catch { continue; }
    if (SIN_WIKI.test(host)) continue;
    const texto = limpiar(m[3]);
    if (texto.length < 60) continue;
    salida.push({titulo: limpiar(m[2]).slice(0, 120), url, texto: texto.slice(0, 380), host: host.replace(/^www\./, '')});
    if (salida.length >= max) break;
  }
  return salida;
};

/** Fuentes de apoyo con el mismo formato que las de Wikipedia, marcadas con `apoyo: true`. */
export const investigarEnLaWeb = async (tema, {max = 5} = {}) => {
  try {
    const r = await buscarEnLaWeb(`${tema}`, max);
    return r.map((x) => ({idioma: 'web', titulo: `${x.host}: ${x.titulo}`, url: x.url, texto: x.texto, apoyo: true}));
  } catch { return []; }
};
