// ANALIZAR VIDEOS QUE TE GUSTAN: el dueño pega enlaces de YouTube en el modo manual; la oficina lee los datos públicos de cada video (título, vistas, duración, canal, fecha,
// descripción) y la IA explica por qué pegó (hook, estructura, título, ritmo) y cómo adaptarlo al canal FACELESS sin copiar contenido. Solo usa datos reales leídos de la página;
// lo que no se pudo leer se marca "sin dato". Pedido: oficina-salida/<canal>/analizar-pedido.json {id, links[], nota}. Resultado: analisis-videos.json (lista, máx. 20).
import fs from 'node:fs';
import path from 'node:path';
import {chatAlternativo} from './llm.mjs';
import {agregarLecciones} from './lecciones.mjs';

const CANAL = process.env.CANAL || 'lqns';
const dir = path.join('oficina-salida', CANAL);
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const corto = (t, n) => String(t ?? '').replace(/\s+/g, ' ').trim().slice(0, n);

/** Id de video de un enlace de YouTube (watch, shorts, youtu.be, embed). null si no es válido. */
export const idDeEnlace = (url) => {
  try {
    const u = new URL(String(url).trim());
    const host = u.hostname.replace(/^www\.|^m\./, '');
    let id = null;
    if (host === 'youtu.be') id = u.pathname.slice(1).split('/')[0];
    else if (host === 'youtube.com' || host === 'music.youtube.com') {
      if (u.pathname === '/watch') id = u.searchParams.get('v');
      else { const m = /^\/(?:shorts|embed|live|v)\/([\w-]{11})/.exec(u.pathname); if (m) id = m[1]; }
    }
    return id && /^[\w-]{11}$/.test(id) ? id : null;
  } catch { return null; }
};

/** Datos públicos del video: oEmbed (título y canal) + la página (vistas, duración, fecha, descripción). */
export const datosDeVideo = async (id) => {
  const d = {id, url: `https://www.youtube.com/watch?v=${id}`};
  try {
    const r = await fetch(`https://www.youtube.com/oembed?url=${encodeURIComponent(d.url)}&format=json`, {signal: AbortSignal.timeout(15000)});
    if (r.ok) { const j = await r.json(); d.titulo = j.title; d.canal = j.author_name; }
  } catch { /* se intenta con la página */ }
  try {
    const r = await fetch(d.url, {headers: {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1'}, signal: AbortSignal.timeout(20000)});
    const html = await r.text();
    const m = /var ytInitialPlayerResponse = (\{[\s\S]*?\});\s*(?:var |<\/script>)/.exec(html);
    if (m) {
      const v = JSON.parse(m[1]).videoDetails ?? {};
      d.titulo = d.titulo ?? v.title; d.canal = d.canal ?? v.author;
      if (v.viewCount) d.vistas = Number(v.viewCount);
      if (v.lengthSeconds) d.segundos = Number(v.lengthSeconds);
      d.descripcion = corto(v.shortDescription, 500);
      d.palabrasClave = (v.keywords ?? []).slice(0, 12);
    }
    const f = /"publishDate":"([^"]+)"/.exec(html); if (f) d.publicado = f[1];
    const likes = /"label":"([\d.,]+[KMkm]?) likes"/.exec(html); if (likes) d.likes = likes[1];
  } catch { /* sin página: se queda con lo que haya */ }
  return d;
};

/** Reconoce YouTube, TikTok, Reels de Instagram y Reels de Facebook. Devuelve {plataforma, url, id?} o null. */
export const plataformaDe = (url) => {
  try {
    const u = new URL(String(url).trim());
    const host = u.hostname.replace(/^www\.|^m\.|^vm\.|^vt\./, '');
    const yt = idDeEnlace(url);
    if (yt) return {plataforma: 'youtube', url: String(url).trim(), id: yt};
    if (host === 'tiktok.com') return {plataforma: 'tiktok', url: u.href};
    if (host === 'instagram.com' && /^\/(?:[\w.]+\/)?(?:reel|reels|p|tv)\/[\w-]+/.test(u.pathname)) return {plataforma: 'instagram', url: u.href};
    if ((host === 'facebook.com' && /^\/(?:reel|watch|share\/r|share\/v)/.test(u.pathname)) || host === 'fb.watch') return {plataforma: 'facebook', url: u.href};
    return null;
  } catch { return null; }
};

const UA_NAVEGADOR = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36';
const UA_BOT = 'facebookexternalhit/1.1 (+http://www.facebook.com/externalhit_uatext.php)';
const meta = (html, prop) => {
  const a = new RegExp('<meta[^>]+(?:property|name)=["\']' + prop + '["\'][^>]+content=["\']([^"\']*)["\']', 'i').exec(html);
  const b = new RegExp('<meta[^>]+content=["\']([^"\']*)["\'][^>]+(?:property|name)=["\']' + prop + '["\']', 'i').exec(html);
  const m = a ?? b;
  return m ? m[1].replace(/&quot;/g, '"').replace(/&#39;|&#x27;/g, "'").replace(/&amp;/g, '&') : null;
};
const aNumero = (t) => { const m = /^([\d.,]+)\s*([KMkm]?)/.exec(String(t ?? '').trim()); if (!m) return undefined; const n = Number(m[1].replace(/,/g, '')); return Number.isFinite(n) ? Math.round(n * ({K: 1e3, M: 1e6}[m[2].toUpperCase()] ?? 1)) : undefined; };

/** TikTok: oEmbed (título y autor) + la página (cifras y duración). Todo lo que no se pueda leer queda "sin dato". */
export const datosDeTikTok = async (url) => {
  const d = {id: url, url, plataforma: 'tiktok'};
  try {
    const r = await fetch('https://www.tiktok.com/oembed?url=' + encodeURIComponent(url), {signal: AbortSignal.timeout(15000)});
    if (r.ok) { const j = await r.json(); d.titulo = j.title; d.canal = j.author_name; }
  } catch { /* se intenta con la página */ }
  try {
    const r = await fetch(url, {headers: {'User-Agent': UA_NAVEGADOR, 'Accept-Language': 'en-US,en;q=0.9'}, redirect: 'follow', signal: AbortSignal.timeout(20000)});
    const html = await r.text();
    const m = /<script id="__UNIVERSAL_DATA_FOR_REHYDRATION__"[^>]*>([\s\S]*?)<\/script>/.exec(html);
    if (m) {
      const it = JSON.parse(m[1])?.__DEFAULT_SCOPE__?.['webapp.video-detail']?.itemInfo?.itemStruct;
      if (it) {
        d.descripcion = corto(it.desc, 500); d.titulo = d.titulo ?? corto(it.desc, 120); d.canal = d.canal ?? it.author?.nickname;
        const e = it.stats ?? {};
        if (e.playCount !== undefined) d.vistas = Number(e.playCount);
        if (e.diggCount !== undefined) d.likes = String(e.diggCount);
        if (e.commentCount !== undefined) d.comentarios = Number(e.commentCount);
        if (e.shareCount !== undefined) d.compartidos = Number(e.shareCount);
        if (it.video?.duration) d.segundos = Number(it.video.duration);
        if (it.createTime) d.publicado = new Date(Number(it.createTime) * 1000).toISOString();
        d.palabrasClave = (it.textExtra ?? []).map((x) => x.hashtagName).filter(Boolean).slice(0, 12);
      }
    }
  } catch { /* sin página */ }
  return d;
};

/** Reels de Instagram o Facebook: solo se puede leer lo público de la tarjeta de vista previa (título, texto y a veces me gusta/comentarios). */
export const datosDeReel = async (url, plataforma) => {
  const d = {id: url, url, plataforma};
  try {
    const r = await fetch(url, {headers: {'User-Agent': UA_BOT, 'Accept-Language': 'en-US,en;q=0.9'}, redirect: 'follow', signal: AbortSignal.timeout(20000)});
    const html = await r.text();
    const titulo = meta(html, 'og:title'); const desc = meta(html, 'og:description');
    if (titulo) d.titulo = corto(titulo, 140);
    if (desc) {
      d.descripcion = corto(desc, 500);
      const likes = /([\d.,]+\s*[KMkm]?)\s+likes?/i.exec(desc); if (likes) d.likes = likes[1].trim();
      const com = /([\d.,]+\s*[KMkm]?)\s+comments?/i.exec(desc); if (com) d.comentarios = aNumero(com[1]);
      const autor = /-\s*([\w.]+)\s+on\s/i.exec(desc); if (autor) d.canal = autor[1];
    }
    const vistas = /([\d.,]+\s*[KMkm]?)\s+(?:views|plays|reproducciones)/i.exec(html.slice(0, 200000)); if (vistas) d.vistas = aNumero(vistas[1]);
  } catch { /* sin vista previa: Instagram y Facebook suelen bloquear servidores */ }
  return d;
};

/** Datos de cualquier enlace soportado. */
export const datosDeEnlace = async (p) => (p.plataforma === 'youtube' ? {...(await datosDeVideo(p.id)), plataforma: 'youtube'} : p.plataforma === 'tiktok' ? datosDeTikTok(p.url) : datosDeReel(p.url, p.plataforma));

const texto = (d) => `[${d.plataforma ?? 'youtube'}] ${d.titulo ? `"${d.titulo}"` : 'título sin dato'} · canal ${d.canal ?? 'sin dato'} · ${d.vistas !== undefined ? d.vistas.toLocaleString('en-US') + ' vistas' : 'vistas sin dato'} · duración ${d.segundos !== undefined ? d.segundos + ' s' : 'sin dato'} · publicado ${d.publicado ? String(d.publicado).slice(0, 10) : 'sin dato'}${d.likes ? ' · ' + d.likes + ' likes' : ''}${d.comentarios !== undefined ? ' · ' + d.comentarios + ' comentarios' : ''}${d.compartidos !== undefined ? ' · ' + d.compartidos + ' compartidos' : ''}. Descripción: ${d.descripcion || 'sin dato'}. Palabras clave: ${(d.palabrasClave ?? []).join(', ') || 'sin dato'}.`;

export const analizar = async (datos, nota) => {
  const r = await chatAlternativo([
    {role: 'system', content: 'Eres un analista de YouTube riguroso. Respondes en español, sin tecnicismos, SOLO con JSON válido. Usas únicamente los datos dados: lo que no está, lo marcas "sin dato"; nunca inventas cifras ni dices lo que pasa dentro del video si no lo sabes (solo infieres del título, duración, descripción y cifras, y lo aclaras). Los videos pueden ser de YouTube, TikTok, Reels de Instagram o de Facebook: cada plataforma tiene su propia lógica de alcance, no compares vistas entre plataformas como si fueran iguales.'},
    {role: 'user', content: `El dueño del canal faceless "Lo Que No Sabías" (misterio, voz en off, sin cara ni personaje) pegó estos videos (YouTube, TikTok o Reels) que le gustan${nota ? ` y dice: "${nota}"` : ''}:\n${datos.map((d, i) => `${i + 1}. ${texto(d)}`).join('\n')}\n\nPara CADA video devuelve {"id": "...", "porQuePega": "por qué funciona, apoyado en las cifras (vistas, duración, título)", "hook": "qué tipo de gancho usa el título/inicio (solo lo que se puede inferir)", "estructura": "ritmo y estructura probable según duración y tema (aclara que es inferencia)", "formula": "fórmula repetible en una frase", "adaptacion": "cómo adaptarla a nuestro canal FACELESS con un tema real distinto, sin copiar contenido", "confianza": "alta|media|baja según cuántos datos había"}. Devuelve {"analisis": [...], "formulaComun": "lo que tienen en común, en 2 frases"}.`},
  ], {maxTokens: 3500, json: true, temperatura: 0.4});
  if (!r) throw new Error('Ningún modelo de IA respondió.');
  const t = r.texto;
  return JSON.parse(t.slice(t.indexOf('{'), t.lastIndexOf('}') + 1));
};

if (path.basename(String(process.argv[1] ?? '')) === 'analizar-videos.mjs') {
  const pedido = leer(path.join(dir, 'analizar-pedido.json'), null);
  const resultadosRuta = path.join(dir, 'analisis-videos.json');
  const previos = leer(resultadosRuta, []);
  if (!pedido?.id || previos.some((x) => x.pedidoId === pedido.id)) { console.log('Sin pedido nuevo de análisis.'); process.exit(0); }
  const vistosUrl = new Set();
  const ids = (pedido.links ?? []).map(plataformaDe).filter((p) => p && !vistosUrl.has(p.url) && vistosUrl.add(p.url)).slice(0, 6);
  const invalidos = (pedido.links ?? []).length - ids.length;
  const registro = {pedidoId: pedido.id, fecha: new Date().toISOString(), nota: corto(pedido.nota, 300), videos: [], formulaComun: '', problemas: invalidos > 0 ? [`${invalidos} enlace(s) no eran de YouTube o no se entendieron.`] : []};
  if (!ids.length) registro.problemas.push('Ningún enlace válido: pega links de YouTube, TikTok, Reels de Instagram o Reels de Facebook.');
  else {
    const datos = [];
    for (const p of ids) datos.push(await datosDeEnlace(p));
    registro.videos = datos;
    for (const d of datos) if (!d.titulo && d.vistas === undefined) registro.problemas.push(`No pude leer datos públicos de ${d.url} (puede ser privado, o ${d.plataforma === 'instagram' || d.plataforma === 'facebook' ? 'Instagram y Facebook bloquean la lectura desde servidores' : 'la plataforma bloqueó la lectura'}).`);
    const leidos = datos.filter((d) => d.titulo || d.vistas !== undefined);
    if (leidos.length) {
      try {
        const a = await analizar(leidos, pedido.nota);
        registro.analisis = Array.isArray(a.analisis) ? a.analisis : [];
        registro.formulaComun = String(a.formulaComun ?? '');
        agregarLecciones(CANAL, [{texto: `Fórmula de videos que le gustan al dueño: ${registro.formulaComun}`, fuente: 'analisis'}, ...(registro.analisis ?? []).slice(0, 3).map((x) => ({texto: `Fórmula repetible: ${x.formula}`, fuente: 'analisis'}))].filter((x) => x.texto.length > 25));
        // la fórmula común queda como lección para el Guionista (obligatoria en los próximos ciclos)
        if (registro.formulaComun) {
          const rutaApr = path.join(dir, 'aprendizajes.json');
          fs.writeFileSync(rutaApr, JSON.stringify([{fecha: registro.fecha, video: 'Videos que le gustan al dueño', mejora: `FÓRMULA DE VIDEOS QUE LE GUSTAN AL DUEÑO (aplícala sin copiar contenido): ${registro.formulaComun}`, quejas: []}, ...leer(rutaApr, [])].slice(0, 12), null, 2));
        }
      } catch (e) { registro.problemas.push('El análisis con IA falló: ' + String(e.message ?? e).slice(0, 120)); }
    }
  }
  fs.writeFileSync(resultadosRuta, JSON.stringify([registro, ...previos].slice(0, 20), null, 2));
  console.log(`Análisis listo: ${registro.videos.length} video(s) leídos, ${(registro.analisis ?? []).length} analizados, ${registro.problemas.length} problema(s).`);
}
