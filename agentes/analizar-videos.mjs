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

/** Extrae de forma segura el JSON embebido en la página de YouTube. */
const objetoDespuesDe = (html, marcador) => {
  const pos = html.indexOf(marcador);
  if (pos < 0) return null;
  const inicio = html.indexOf('{', pos + marcador.length);
  if (inicio < 0) return null;
  let profundidad = 0, cadena = false, escape = false;
  for (let i = inicio; i < html.length; i++) {
    const ch = html[i];
    if (cadena) {
      if (escape) escape = false;
      else if (ch === '\\') escape = true;
      else if (ch === '"') cadena = false;
      continue;
    }
    if (ch === '"') cadena = true;
    else if (ch === '{') profundidad++;
    else if (ch === '}' ) {
      profundidad--;
      if (profundidad === 0) {
        try { return JSON.parse(html.slice(inicio, i + 1)); } catch { return null; }
      }
    }
  }
  return null;
};

const decodificarHtml = (valor) => String(valor ?? '')
  .replace(/<br\s*\/?>/gi, ' ')
  .replace(/<[^>]*>/g, ' ')
  .replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'")
  .replace(/&lt;/g, '<').replace(/&gt;/g, '>')
  .replace(/&#(\d+);/g, (_, n) => { try { return String.fromCodePoint(Number(n)); } catch { return ''; } })
  .replace(/&#x([0-9a-f]+);/gi, (_, n) => { try { return String.fromCodePoint(parseInt(n, 16)); } catch { return ''; } })
  .replace(/\s+/g, ' ').trim();

const tiempoDeSegundos = (n) => {
  const s = Math.max(0, Math.floor(Number(n) || 0));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
};

/** Convierte subtítulos XML públicos de YouTube en líneas con marca de tiempo. */
export const parsearTranscripcion = (contenido) => {
  const fuente = String(contenido ?? '').replace(/^\uFEFF/, '').trim();
  const resultado = [];
  const atributo = (attrs, nombre) => {
    const m = new RegExp('(?:^|\\s)' + nombre + '="([^"]*)"').exec(attrs);
    return m ? Number(m[1]) : 0;
  };
  if (fuente.startsWith('{')) {
    try {
      const json = JSON.parse(fuente);
      for (const evento of json.events ?? []) {
        const segundo = Number(evento.tStartMs ?? 0) / 1000;
        const texto = decodificarHtml((evento.segs ?? []).map((s) => s.utf8 ?? '').join(''));
        if (texto) resultado.push({segundo, tiempo: tiempoDeSegundos(segundo), texto});
      }
      if (resultado.length) return resultado;
    } catch { /* probar formatos alternativos */ }
  }
  if (/WEBVTT/i.test(fuente.slice(0, 40))) {
    for (const bloque of fuente.split(/\n\s*\n/)) {
      const m = /(?:(\d{2}):)?(\d{2}):(\d{2})[.,](\d{3})\s+-->/.exec(bloque);
      if (!m) continue;
      const segundo = Number(m[1] ?? 0) * 3600 + Number(m[2]) * 60 + Number(m[3]) + Number(m[4]) / 1000;
      const cuerpo = bloque.slice(m.index + m[0].length).replace(/^\s*(?:(?:\d{2}:)?\d{2}:\d{2}[.,]\d{3})\s*/, '');
      const texto = decodificarHtml(cuerpo.replace(/<\/?[a-z][^>]*>/gi, ' '));
      if (texto) resultado.push({segundo, tiempo: tiempoDeSegundos(segundo), texto});
    }
    if (resultado.length) return resultado;
  }
  for (const m of fuente.matchAll(/<text\b([^>]*)>([\s\S]*?)<\/text>/gi)) {
    const inicio = atributo(m[1], 'start');
    const texto = decodificarHtml(m[2]);
    if (texto) resultado.push({segundo: inicio, tiempo: tiempoDeSegundos(inicio), texto});
  }
  if (!resultado.length) for (const m of fuente.matchAll(/<p\b([^>]*)>([\s\S]*?)<\/p>/gi)) {
    const inicio = atributo(m[1], 't') / 1000;
    const texto = decodificarHtml(m[2]);
    if (texto) resultado.push({segundo: inicio, tiempo: tiempoDeSegundos(inicio), texto});
  }
  return resultado;
};

/** Obtiene subtítulos que YouTube expone públicamente; nunca descarga ni reutiliza el video o su audio. */
export const extraerTranscripcionYoutube = async (playerResponse) => {
  const pistas = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks ?? [];
  if (!pistas.length) return null;
  const ordenadas = [...pistas].sort((a, b) => {
    const preferencia = (x) => {
      const idioma = String(x.languageCode ?? '').toLowerCase();
      return (idioma.startsWith('es') ? 0 : idioma.startsWith('en') ? 1 : 3) + (x.kind === 'asr' ? 1 : 0);
    };
    return preferencia(a) - preferencia(b);
  });
  for (const pista of ordenadas.slice(0, 8)) {
    try {
      const urls = [pista.baseUrl];
      try { const json3 = new URL(pista.baseUrl); json3.searchParams.set('fmt', 'json3'); urls.push(json3.toString()); } catch {}
      try { const vtt = new URL(pista.baseUrl); vtt.searchParams.set('fmt', 'vtt'); urls.push(vtt.toString()); } catch {}
      let cues = [];
      for (const url of urls) {
        for (let intento = 0; intento < 2 && !cues.length; intento++) {
          try {
            const r = await fetch(url, {headers: {'User-Agent': 'Mozilla/5.0', 'Accept-Language': 'en-US,en;q=0.9'}, signal: AbortSignal.timeout(15000)});
            if (!r.ok) continue;
            cues = parsearTranscripcion(await r.text());
          } catch { if (intento === 0) await new Promise((resolve) => setTimeout(resolve, 700)); }
        }
        if (cues.length) break;
      }
      if (cues.length < 8) continue;
      const texto = cues.map((x) => '[' + x.tiempo + '] ' + x.texto).join('\n').slice(0, 18000);
      if (texto.length < 350) continue;
      return {texto, idioma: pista.languageCode ?? 'desconocido', automatica: pista.kind === 'asr', fragmentos: cues.length};
    } catch { /* intenta la siguiente pista disponible */ }
  }
  return null;
};

/** Datos públicos del video: oEmbed + vistas, duración, descripción y, cuando existe, subtítulos públicos. */
export const datosDeVideo = async (id) => {
  const d = {id, url: 'https://www.youtube.com/watch?v=' + id};
  try {
    const r = await fetch('https://www.youtube.com/oembed?url=' + encodeURIComponent(d.url) + '&format=json', {signal: AbortSignal.timeout(12000)});
    if (r.ok) { const j = await r.json(); d.titulo = j.title; d.canal = j.author_name; }
  } catch { /* se intenta con la página */ }
  try {
    const headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124 Safari/537.36', 'Accept-Language': 'en-US,en;q=0.9', Cookie: 'CONSENT=YES+1'};
    let html = '';
    let player = null;
    // La página /watch puede entregar una pantalla de consentimiento o limitarse; probar también el reproductor embebido.
    for (const pagina of [d.url, 'https://www.youtube.com/embed/' + id + '?hl=en']) {
      for (let intento = 0; intento < 2 && !player; intento++) {
        try {
          const r = await fetch(pagina, {headers, signal: AbortSignal.timeout(18000)});
          if (!r.ok) {
            if ([429, 500, 502, 503, 504].includes(r.status) && intento === 0) {
              await new Promise((resolve) => setTimeout(resolve, r.status === 429 ? 2500 : 900));
              continue;
            }
            break;
          }
          html = await r.text();
          player = objetoDespuesDe(html, 'ytInitialPlayerResponse =')
            ?? objetoDespuesDe(html, '"ytInitialPlayerResponse":');
          if (player) break;
          if (intento === 0) await new Promise((resolve) => setTimeout(resolve, 500));
        } catch (error) {
          if (intento === 1) d.errorLectura = String(error.message ?? error).slice(0, 100);
        }
      }
      if (player) break;
    }
    const v = player?.videoDetails ?? {};
    d.titulo = d.titulo ?? v.title;
    d.canal = d.canal ?? v.author;
    if (v.viewCount) d.vistas = Number(v.viewCount);
    if (v.lengthSeconds) d.segundos = Number(v.lengthSeconds);
    d.descripcion = corto(v.shortDescription, 500);
    d.palabrasClave = (v.keywords ?? []).slice(0, 12);
    const f = /"publishDate":"([^"]+)"/.exec(html);
    if (f) d.publicado = f[1];
    const likes = /"label":"([\d.,]+[KMkm]?) likes"/.exec(html);
    if (likes) d.likes = likes[1];
    if (player) d.subtitulos = await extraerTranscripcionYoutube(player);
    if (d.subtitulos) {
      d.transcripcion = d.subtitulos.texto;
      d.idiomaTranscripcion = d.subtitulos.idioma;
      d.transcripcionAutomatica = d.subtitulos.automatica;
      d.fragmentosTranscripcion = d.subtitulos.fragmentos;
    }
  } catch (e) { d.errorLectura = String(e.message ?? e).slice(0, 100); }
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

const texto = (d) => '[' + (d.plataforma ?? 'youtube') + '] ' + (d.titulo ? '"' + d.titulo + '"' : 'título sin dato')
  + ' · canal ' + (d.canal ?? 'sin dato')
  + ' · ' + (d.vistas !== undefined ? d.vistas.toLocaleString('en-US') + ' vistas' : 'vistas sin dato')
  + ' · duración ' + (d.segundos !== undefined ? d.segundos + ' s' : 'sin dato')
  + ' · publicado ' + (d.publicado ? String(d.publicado).slice(0, 10) : 'sin dato')
  + '. Descripción: ' + (d.descripcion || 'sin dato')
  + '. Transcripción: ' + (d.transcripcion ? d.transcripcion.slice(0, 14000) : 'no disponible; no afirmar conocer escenas ni narración');

/** Prompt reutilizable para desmontar la estructura de una referencia sin copiar su contenido. */
export const mensajesDeDesglose = (datos, formato = 'largo') => [
  {role: 'system', content: 'Eres analista audiovisual especializado en retención. Analizas una transcripción pública con marcas de tiempo y metadatos reales. Extraes solo la arquitectura narrativa abstracta. Nunca copies frases, chistes, ejemplos, datos únicos, secuencia factual exacta, escenas, imágenes, música ni montaje reconocible. No atribuyas a la imagen algo que la transcripción no demuestra. Distingue observación de inferencia. Devuelve SOLO JSON válido.'},
  {role: 'user', content: 'Desmonta esta referencia de YouTube para adaptar SU ESTRUCTURA a un documental faceless original de ' + (formato === 'largo' ? '8–10 minutos' : 'menos de 60 segundos') + ' sobre un tema investigado de forma independiente.\n\nMETADATOS: título=' + (datos.titulo ?? 'sin dato') + '; canal=' + (datos.canal ?? 'sin dato') + '; duración=' + (datos.segundos ?? 'sin dato') + ' segundos; vistas=' + (datos.vistas ?? 'sin dato') + '; idioma de subtítulos=' + (datos.idiomaTranscripcion ?? 'sin dato') + '; subtítulos=' + (datos.transcripcionAutomatica ? 'automáticos' : 'manuales') + '.\n\nTRANSCRIPCIÓN CON TIEMPOS:\n' + String(datos.transcripcion ?? '').slice(0, 16000) + '\n\nDevuelve: {"gancho":{"tramo":"mm:ss-mm:ss","mecanismo":"...","promesa":"..."}, "desglose":[{"tramo":"mm:ss-mm:ss","funcion":"gancho|contexto|escalada|giro|revelacion|cierre","tecnica":"mecanismo abstracto, no contenido","ritmo":"...","retencion":"qué mantiene la curiosidad, no una cifra inventada"}], "patron_de_giros":"...", "tipo_de_revelacion":"...", "cierre":"...", "formula_abstracta":"plantilla reutilizable sin tema ni frases del original", "elementos_que_no_deben_copiarse":["..."], "confianza":"alta|media|baja"}.\n\nMáximo 10 bloques. Usa los tiempos de la transcripción; no inventes segmentos que no puedas ubicar. Si no hay evidencia suficiente, dilo en confianza y reduce bloques.'},
];

export const analizar = async (datos, nota) => {
  const r = await chatAlternativo([
    {role: 'system', content: 'Eres un analista audiovisual riguroso. Respondes en español, SOLO JSON. Separa lo observado de las inferencias. La transcripción permite analizar la estructura real; sin ella, no afirmes conocer escenas ni montaje.'},
    {role: 'user', content: 'El dueño del canal faceless "Lo Que No Sabías" pegó estos videos que le gustan' + (nota ? ' y dice: "' + nota + '"' : '') + ':\n' + datos.map((d, i) => (i + 1) + '. ' + texto(d)).join('\n') + '\n\nPara CADA video devuelve {"id":"...","porQuePega":"apoyado en datos disponibles","hook":"mecanismo observado o inferido","estructura":"desglose temporal de hasta 8 bloques, basado en transcripción cuando esté disponible","formula":"fórmula abstracta reutilizable, sin copiar el relato","adaptacion":"cómo aplicarla a un tema factual distinto y original","confianza":"alta|media|baja","transcripcionDisponible":true|false}. Devuelve {"analisis":[...],"formulaComun":"patrones estructurales comunes, no hechos del video"}.'},
  ], {maxTokens: 4500, json: true, temperatura: 0.3});
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
