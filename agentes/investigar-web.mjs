// Investigación web general: ninguna fuente institucional es requisito. Se recupera el contenido de páginas reales; Wikipedia se excluye como fuente única.
const UA = 'Mozilla/5.0 (compatible; FabricaDeVideos/2.0; educational research)';
export const FUENTES_INSTITUCIONALES = [
  {id:'smithsonian',nombre:'Smithsonian Institution',dominio:'si.edu'},
  {id:'nasa',nombre:'NASA',dominio:'nasa.gov'},
  {id:'national-archives',nombre:'US National Archives',dominio:'archives.gov'},
  {id:'library-of-congress',nombre:'Library of Congress',dominio:'loc.gov'},
  {id:'noaa',nombre:'NOAA',dominio:'noaa.gov'},
  {id:'usgs',nombre:'US Geological Survey',dominio:'usgs.gov'},
  {id:'pubmed',nombre:'PubMed / NCBI',dominio:'pubmed.ncbi.nlm.nih.gov'},
  {id:'unesco',nombre:'UNESCO',dominio:'unesco.org'},
];
const SIN_WIKI = /(^|\.)(wikipedia|wikimedia|wikiwand|dbpedia|wikidata)\./i;
const limpiar = (h) => String(h ?? '')
  .replace(/<script[\s\S]*?<\/script>|<style[\s\S]*?<\/style>/gi,' ')
  .replace(/<[^>]+>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&nbsp;/g, ' ')
  .replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n)))
  .replace(/\s+/g, ' ').trim();
const hostDe = (url) => { try { return new URL(url).hostname.toLowerCase().replace(/^www\./,''); } catch { return ''; } };
const pertenece = (url, dominio) => { const h=hostDe(url); return h===dominio || h.endsWith('.'+dominio); };
const destino = (href) => {
  try { const u = href.startsWith('//') ? 'https:' + href : href; const real = new URL(u).searchParams.get('uddg'); return real ? decodeURIComponent(real) : u; }
  catch { return null; }
};
const buscarDuckDuckGo = async (consulta, max = 6) => {
  const r = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(consulta)}`, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(25000)});
  if (!r.ok) throw new Error('buscador ' + r.status);
  const html = await r.text(), salida = [];
  // No asumir el orden de class/href ni que result__snippet sea un <a>:
  // DuckDuckGo cambia el marcado entre variantes y puede omitir el snippet.
  const enlaces = [...html.matchAll(/<a\b(?=[^>]*\bclass=["'][^"']*\bresult__a\b[^"']*["'])[^>]*>/gi)];
  for (let i = 0; i < enlaces.length; i++) {
    const inicio = enlaces[i].index;
    const etiqueta = enlaces[i][0];
    const href = /\bhref=["']([^"']+)["']/i.exec(etiqueta)?.[1];
    const cierre = html.indexOf('</a>', inicio + etiqueta.length);
    if (!href || cierre < 0) continue;
    const url = destino(href);
    if (!url || !/^https?:/.test(url) || SIN_WIKI.test(hostDe(url))) continue;
    const titulo = limpiar(html.slice(inicio + etiqueta.length, cierre));
    const siguiente = enlaces[i + 1]?.index ?? html.length;
    const bloque = html.slice(cierre + 4, siguiente);
    const sm = /<([a-z][\w:-]*)\b(?=[^>]*\bclass=["'][^"']*\bresult__snippet\b[^"']*["'])[^>]*>([\s\S]*?)<\/\1>/i.exec(bloque);
    const texto = limpiar(sm?.[2] ?? '');
    // El snippet es opcional: la página institucional real se consulta después.
    if (!titulo) continue;
    salida.push({titulo:titulo.slice(0,160),url,texto:texto.slice(0,500),host:hostDe(url)});
    if (salida.length >= max) break;
  }
  return salida;
};

// Buscador alternativo: DuckDuckGo puede limitar IPs de GitHub Actions (429/403).
// Bing se consulta de forma independiente para que una caída del primero no agote la selección editorial.
const buscarBing = async (consulta, max = 6) => {
  const r = await fetch(`https://www.bing.com/search?q=${encodeURIComponent(consulta)}&count=10&setlang=es`, {
    headers: {'User-Agent': UA, 'Accept-Language': 'es,en;q=0.8'},
    signal: AbortSignal.timeout(25000),
  });
  if (!r.ok) throw new Error('Bing ' + r.status);
  const html = await r.text();
  const salida = [];
  for (const m of html.matchAll(/<li[^>]*class=["'][^"']*b_algo[^"']*["'][^>]*>([\\s\\S]*?)<\\/li>/gi)) {
    const bloque = m[1];
    const href = /<h2[^>]*>\\s*<a[^>]*href=["']([^"']+)["']/i.exec(bloque)?.[1];
    const titulo = limpiar(/<h2[^>]*>([\\s\\S]*?)<\\/h2>/i.exec(bloque)?.[1] ?? '');
    const texto = limpiar(/<p[^>]*>([\\s\\S]*?)<\\/p>/i.exec(bloque)?.[1] ?? '');
    if (!href || !/^https?:\\/\\//i.test(href) || SIN_WIKI.test(hostDe(href)) || !titulo) continue;
    salida.push({titulo:titulo.slice(0,160),url:href,texto:texto.slice(0,500),host:hostDe(href)});
    if (salida.length >= max) break;
  }
  return salida;
};
export const buscarEnLaWeb = async (consulta, max = 6) => {
  const errores = [];
  for (const buscador of [buscarDuckDuckGo, buscarBing]) {
    try {
      const resultados = await buscador(consulta, max);
      if (resultados.length) return resultados;
      errores.push('sin resultados');
    } catch (e) { errores.push(String(e.message ?? e)); }
  }
  throw new Error(`Buscadores no disponibles: ${errores.join('; ')}`);
};

const extraerPagina = (html) => {
  const title=/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1] ?? '';
  const desc=/<meta[^>]+(?:name|property)=["'](?:description|og:description)["'][^>]+content=["']([^"']+)/i.exec(html)?.[1] ?? '';
  const parrafos=[...html.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi)].map(m=>limpiar(m[1])).filter(x=>x.length>45);
  const texto=[limpiar(desc),...parrafos].filter(Boolean).join(' ').replace(/\s+/g,' ').trim();
  return {titulo:limpiar(title).slice(0,180),texto:texto.slice(0,5200)};
};
const leerFuenteGeneral = async (resultado) => {
  try {
    const r = await fetch(resultado.url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(18000), redirect: 'follow'});
    if (!r.ok) return null;
    const pagina = extraerPagina(await r.text());
    if (pagina.texto.length < 220) return null;
    const dominio = hostDe(resultado.url);
    return {idioma: 'web', tipo: 'fuente_consultada', institucion: dominio, dominio, titulo: pagina.titulo || resultado.titulo, url: resultado.url, texto: pagina.texto, apoyo: false};
  } catch { return null; }
};
const leerFuente = async (resultado, institucion) => {
  try {
    const r=await fetch(resultado.url,{headers:{'User-Agent':UA},signal:AbortSignal.timeout(18000),redirect:'follow'});
    if(!r.ok) return null;
    const html=await r.text(), pagina=extraerPagina(html);
    if(pagina.texto.length<220) return null;
    return {idioma:'institucional',tipo:'fuente_primaria_o_institucional',institucion:institucion.nombre,dominio:institucion.dominio,titulo:pagina.titulo||resultado.titulo,url:resultado.url,texto:pagina.texto,apoyo:false};
  } catch { return null; }
};
/** Busca primero en toda la web, sin exigir dominios institucionales; si no hay páginas legibles, intenta organismos oficiales como respaldo. */
export const investigarEnLaWeb = async (tema,{maxPorFuente=2}={}) => {
  let paginas = [];
  try {
    const resultados = await buscarEnLaWeb(tema, Math.max(4, maxPorFuente * 3));
    paginas = (await Promise.all(resultados.map(leerFuenteGeneral))).filter(Boolean);
  } catch { /* se intenta el respaldo institucional */ }
  if (!paginas.length) {
    const grupos = await Promise.all(FUENTES_INSTITUCIONALES.map(async inst => {
      try {
        const resultados = await buscarEnLaWeb(`site:${inst.dominio} ${tema}`, maxPorFuente);
        const validos = resultados.filter(x => pertenece(x.url, inst.dominio)).slice(0, maxPorFuente);
        return (await Promise.all(validos.map(x => leerFuente(x, inst)))).filter(Boolean);
      } catch { return []; }
    }));
    paginas = grupos.flat();
  }
  const vistos = new Set();
  return paginas.filter(f => { const k = f.url.split('#')[0]; if (vistos.has(k)) return false; vistos.add(k); return true; });
};
/** Descubre temas desde los ocho dominios oficiales, no desde Wikipedia. */
export const descubrirTemasEnFuentes = async (consulta,max=16) => {
  const grupos=await Promise.all(FUENTES_INSTITUCIONALES.map(async inst=>{
    try { return (await buscarEnLaWeb(`site:${inst.dominio} ${consulta}`,3)).filter(x=>pertenece(x.url,inst.dominio)).map(x=>x.titulo.replace(/ \| .*$/,'').trim()).filter(Boolean); }
    catch { return []; }
  }));
  return [...new Set(grupos.flat())].slice(0,max);
};
