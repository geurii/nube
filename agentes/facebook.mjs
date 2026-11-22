// Publica el video recién producido en la página de Facebook del canal usando la API de WINDSOR (connectors.windsor.ai), sin pasar por ninguna IA:
// corre solo en GitHub Actions, así que funciona aunque no haya ninguna sesión de Claude abierta.
// Facebook descarga el video desde una dirección PÚBLICA, así que primero se sube una copia a un repositorio público de videos (solo MP4 de videos ya publicados).
// Secretos (los pone el dueño en GitHub): WINDSOR_API_KEY (Windsor > Team management > API Access) y FB_VIDEOS_TOKEN (token de GitHub con permiso de escritura SOLO en el repo de videos).
// Variables: ID (ej. lqns-mary-celeste), CANAL. Sin secretos o sin cuenta de Facebook configurada, no hace nada y no falla.
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {avisarTelefono} from './aviso.mjs';
import {publicarEnTikTok, textoTikTok} from './tiktok.mjs';

const leer = (ruta, d) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return d; } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_ARCHIVOS = 15; // en el repo de videos se conservan los últimos 15 (Facebook ya los descargó)
const MAX_COMPLETO_MB = 60; // por encima de esto se sube la versión liviana

const quitarClaves = (texto, ...claves) => claves.filter(Boolean).reduce((t, k) => t.split(k).join('***'), String(texto ?? ''));

/** Elige el MP4: el completo si pesa poco; si no, la versión liviana (540x960, el mínimo que acepta Facebook). */
export const elegirArchivo = (id, carpeta = path.join('out', 'serie')) => {
  const completo = path.join(carpeta, `${id}.mp4`);
  const liviano = path.join(carpeta, `${id}-subida.mp4`);
  if (fs.existsSync(completo) && fs.statSync(completo).size <= MAX_COMPLETO_MB * 1024 * 1024) return completo;
  if (fs.existsSync(liviano)) return liviano;
  return null;
};

/** Texto de la publicación: título + descripción del guion (ya trae fuentes y los 5 hashtags). */
export const textoDePublicacion = (guion) => {
  const p = guion?.publicacion ?? {};
  return `${p.titulo ?? guion?.titulo ?? ''}\n\n${p.descripcion ?? ''}`.trim().slice(0, 2000);
};

const gh = async (token, metodo, ruta, cuerpo) => {
  const r = await fetch(`https://api.github.com${ruta}`, {
    method: metodo, signal: AbortSignal.timeout(120000),
    headers: {Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'User-Agent': 'FabricaDeVideos', ...(cuerpo ? {'Content-Type': 'application/json'} : {})},
    body: cuerpo ? JSON.stringify(cuerpo) : undefined,
  });
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* no es JSON */ }
  return {status: r.status, json, texto};
};

/** Sube el MP4 al repo público de videos y devuelve la dirección pública directa del archivo. */
export const subirAlRepoPublico = async ({token, repo, archivo, nombre}) => {
  const ruta = `/repos/${repo}/contents/v/${nombre}`;
  const contenido = fs.readFileSync(archivo).toString('base64');
  let r = await gh(token, 'PUT', ruta, {message: `Video ${nombre}`, content: contenido});
  if (r.status === 422) { // ya existía (reintento): se reemplaza con su sha
    const previo = await gh(token, 'GET', ruta);
    if (previo.json?.sha) r = await gh(token, 'PUT', ruta, {message: `Video ${nombre} (reemplazo)`, content: contenido, sha: previo.json.sha});
  }
  if (![200, 201].includes(r.status)) throw new Error(`no pude subir el video al repositorio público (${r.status}): ${quitarClaves(r.texto, token).slice(0, 200)}`);
  const url = r.json?.content?.download_url ?? `https://raw.githubusercontent.com/${repo}/main/v/${nombre}`;
  // se espera a que la dirección responda (Facebook la descarga enseguida)
  for (let i = 0; i < 10; i++) {
    try { const h = await fetch(url, {method: 'HEAD', signal: AbortSignal.timeout(15000)}); if (h.ok) return {url, ruta: `v/${nombre}`}; } catch { /* aún no */ }
    await dormir(3000);
  }
  throw new Error('el video se subió pero su dirección pública no responde todavía');
};

/** Sin token de GitHub: sube el MP4 a Litterbox (archivos temporales gratis, sin cuenta; se borra solo a las 24 h) y devuelve su enlace público directo. */
export const subirATemporal = async ({archivo, nombre}) => {
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('time', '72h'); // 72 h: Buffer descarga el video cuando llega la hora del calendario (hasta ~2 días después)
  fd.append('fileToUpload', new Blob([fs.readFileSync(archivo)], {type: 'video/mp4'}), nombre);
  const r = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {method: 'POST', body: fd, signal: AbortSignal.timeout(300000)});
  const url = (await r.text()).trim();
  if (!r.ok || !/^https:\/\/litter\.catbox\.moe\/[\w.-]+\.mp4$/.test(url)) throw new Error(`el servicio de archivos temporales no devolvió un enlace válido (${r.status}): ${url.slice(0, 120)}`);
  for (let i = 0; i < 10; i++) {
    try { const h = await fetch(url, {method: 'HEAD', signal: AbortSignal.timeout(15000)}); if (h.ok) return {url, ruta: null}; } catch { /* aún no */ }
    await dormir(3000);
  }
  throw new Error('el video se subió pero su enlace no responde todavía');
};

/** Borra los archivos más viejos del repo de videos para que no crezca sin fin. Nunca lanza. */
const limpiarViejos = async ({token, repo, archivos}) => {
  const quedan = [...archivos];
  while (quedan.length > MAX_ARCHIVOS) {
    const vieja = quedan.shift();
    try {
      const info = await gh(token, 'GET', `/repos/${repo}/contents/${vieja}`);
      if (info.json?.sha) await gh(token, 'DELETE', `/repos/${repo}/contents/${vieja}`, {message: `Quitar ${vieja}`, sha: info.json.sha});
    } catch { /* si no se pudo borrar, no pasa nada */ }
  }
  return quedan;
};

/** Pide a Windsor publicar el video en la página. Devuelve la respuesta de Windsor (sin la clave). */
export const publicarConWindsor = async ({apiKey, conector = 'facebook_organic', cuenta, accion, params}) => {
  const r = await fetch(`https://connectors.windsor.ai/${conector}/actions?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({account: cuenta, action: accion, params}), signal: AbortSignal.timeout(120000),
  });
  const texto = quitarClaves(await r.text(), apiKey).slice(0, 600);
  let json = null;
  try { json = JSON.parse(texto); } catch { /* texto plano */ }
  const fallo = !r.ok || json?.error || json?.success === false || /"error"/i.test(texto);
  if (fallo) throw new Error(`Windsor respondió ${r.status}: ${texto.slice(0, 300)}`);
  return {status: r.status, texto, json};
};

/** Destinos de publicación en Windsor. Facebook y Instagram reciben el MISMO video (se sube una sola vez). */
const destinos = ({largo, cfg, env}) => [
  {
    nombre: 'Facebook', conector: 'facebook_organic', archivoRegistro: 'facebook.json',
    cuenta: (env.FB_PAGE_ACCOUNT || cfg.facebook?.cuenta || '').trim(),
    accion: largo ? 'create_video_post' : 'create_reel',
    params: (url, texto, titulo) => (largo ? {video_url: url, title: titulo.slice(0, 100), description: texto} : {video_url: url, description: texto}),
  },
  {
    nombre: 'Instagram', conector: 'instagram', archivoRegistro: 'instagram.json',
    cuenta: (env.IG_ACCOUNT || cfg.instagram?.cuenta || '').trim(),
    accion: 'create_video_post', // Instagram publica todo video de feed como Reel
    params: (url, texto) => ({video_url: url, caption: texto.slice(0, 2200)}),
  },
  {
    // TikTok: Windsor no puede publicar en TikTok; se usa la API de Buffer (clave BUFFER_API_KEY). Sin clave, se omite.
    nombre: 'TikTok', tipo: 'buffer', archivoRegistro: 'tiktok.json', accion: 'createPost',
    cuenta: (env.BUFFER_API_KEY || '').trim() ? 'buffer' : '',
  },
];

export const principal = async () => {
  const ID = (process.env.ID ?? '').trim();
  const CANAL = (process.env.CANAL || 'lqns').trim();
  const apiKey = (process.env.WINDSOR_API_KEY ?? '').trim();
  const token = (process.env.FB_VIDEOS_TOKEN ?? '').trim();
  const bufferKey = (process.env.BUFFER_API_KEY ?? '').trim();
  const cfgCanal = (leer(path.join('agentes', 'canales-propios.json'), {canales: []}).canales ?? []).find((c) => c.id === CANAL) ?? {};
  const repo = (process.env.FB_VIDEOS_REPO || cfgCanal.facebook?.repo || '').trim();
  if (!ID) { console.log('Redes: falta el id del video (ID). Se omite.'); return {omitido: 'sin id'}; }
  if (!apiKey && !bufferKey) { console.log('Redes: se omite (faltan WINDSOR_API_KEY y BUFFER_API_KEY).'); return {omitido: 'sin configurar'}; }
  const guion = leer(path.join('guion', 'serie', `${ID}.json`), null);
  if (!guion) { console.log('Redes: no encuentro el guion del video. Se omite.'); return {omitido: 'sin guion'}; }
  const largo = guion.formato === 'largo';
  if (largo) { console.log('Redes: los videos largos NO se publican en Facebook, Instagram ni TikTok (solo YouTube).'); return {omitido: 'largo'}; }
  const dir = path.join('oficina-salida', CANAL);
  fs.mkdirSync(dir, {recursive: true});
  const texto = textoDePublicacion(guion);
  const titulo = String(guion.publicacion?.titulo ?? guion.titulo ?? '');

  // qué destinos tienen cuenta configurada y todavía no tienen este video
  const pendientes = [];
  for (const d of destinos({largo, cfg: cfgCanal, env: process.env})) {
    const registro = leer(path.join(dir, d.archivoRegistro), {total: 0, posts: [], archivos: []});
    if (d.tipo !== 'buffer' && !apiKey) { console.log(`${d.nombre}: se omite (falta WINDSOR_API_KEY).`); continue; }
    if (d.tipo === 'buffer' && d.cuenta) { // TikTok: cada video llena un día (un video por día en el calendario de Buffer)
      const porDia = Math.max(1, Number(process.env.TIKTOK_POR_DIA || cfgCanal.tiktok?.porDia || 1));
      const recientes = registro.posts.filter((p) => Date.now() - Date.parse(p.fecha) < 22 * 3600 * 1000).length;
      if (recientes >= porDia) { console.log(`TikTok: ya hay ${recientes} video(s) en el calendario de las últimas 22 horas (un video por día). Este no se envía a TikTok.`); continue; }
    }
    if (!d.cuenta) { console.log(`${d.nombre}: se omite (no hay cuenta conectada en la configuración).`); continue; }
    if (registro.posts.some((p) => p.id === ID)) { console.log(`${d.nombre}: este video ya se publicó. No se repite.`); continue; }
    pendientes.push({...d, registro});
  }
  if (!pendientes.length) return {omitido: 'nada pendiente'};

  // cualquier fallo ANTES de publicar (sin MP4, no se pudo comprimir o subir la copia pública) avisa al teléfono: antes se omitía en silencio
  const alertar = (msg) => {
    console.log('Redes: ' + msg);
    try {
      avisarTelefono('alerta', 'No se pudo publicar en Facebook, Instagram ni TikTok', `"${titulo.slice(0, 80)}": ${msg.slice(0, 220)}`);
      const rutaN = path.join('oficina-salida', 'notificaciones.json');
      const lista = leer(rutaN, []);
      lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal: CANAL, tipo: 'alerta', titulo: 'No se pudo publicar en las redes', texto: `"${titulo.slice(0, 80)}": ${msg.slice(0, 220)}`});
      fs.writeFileSync(rutaN, JSON.stringify(lista.slice(0, 80), null, 2));
    } catch { /* el aviso no debe fallar */ }
  };
  let archivo = elegirArchivo(ID);
  if (!archivo) { // no hay copia liviana: se crea una con ffmpeg a partir del MP4 completo
    const completo = path.join('out', 'serie', `${ID}.mp4`);
    if (fs.existsSync(completo)) {
      try {
        const liviano = path.join('out', 'serie', `${ID}-subida.mp4`);
        execFileSync('ffmpeg', ['-y', '-i', completo, '-vf', 'scale=-2:1280:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-crf', '27', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', liviano], {stdio: 'ignore', timeout: 900000});
        archivo = elegirArchivo(ID);
      } catch (e) { alertar(`no pude crear la copia liviana del video (${String(e.message ?? e).slice(0, 100)}).`); return {omitido: 'sin copia liviana'}; }
    }
  }
  if (!archivo) { alertar(`no encuentro el MP4 del video (${ID}) en out/serie.`); return {omitido: 'sin mp4'}; }
  // con token de GitHub y repo público: se guarda ahí (permanente, últimos 15); si no, archivo temporal de 72 h sin ninguna clave
  let usaRepo = Boolean(token && repo);
  let pub;
  const limpio = (e) => quitarClaves(String(e.message ?? e), apiKey, token, bufferKey).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  let motivoRepo = usaRepo ? '' : (token ? 'falta configurar el repositorio público de videos' : 'falta el secreto FB_VIDEOS_TOKEN');
  try {
    pub = usaRepo ? await subirAlRepoPublico({token, repo, archivo, nombre: `${ID}.mp4`}) : await subirATemporal({archivo, nombre: `${ID}.mp4`});
  } catch (e) {
    motivoRepo = usaRepo ? `el repositorio público "${repo}" no aceptó el video: ${limpio(e)}` : '';
    console.log('Redes: la copia pública falló (' + limpio(e) + '); pruebo con el archivo temporal.');
    usaRepo = false;
    try { pub = await subirATemporal({archivo, nombre: `${ID}.mp4`}); }
    catch (e2) { alertar(`${motivoRepo || 'sin repositorio público'}; y el servicio temporal bloqueó a GitHub (${limpio(e2)}).`); return {omitido: 'sin alojamiento'}; }
  }

  const resultados = {};
  let archivosRepo = null;
  for (const d of pendientes) {
    try { // un destino que falla no impide el otro
      const resp = d.tipo === 'buffer'
        ? await publicarEnTikTok({apiKey: bufferKey, url: pub.url, texto: textoTikTok(guion), ia: cfgCanal.tiktok?.ia === true, canal: String(cfgCanal.tiktok?.canal ?? ''), modo: cfgCanal.tiktok?.modo === 'ahora' ? 'ahora' : 'cola'})
        : await publicarConWindsor({apiKey, conector: d.conector, cuenta: d.cuenta, accion: d.accion, params: d.params(pub.url, texto, titulo)});
      d.registro.posts.unshift({id: ID, titulo: titulo.slice(0, 140), fecha: new Date().toISOString(), accion: d.accion, programado: resp.programado, alojamiento: usaRepo ? 'repositorio' : 'temporal-72h', video_url: pub.url, respuesta: resp.texto.slice(0, 300)});
      d.registro.posts = d.registro.posts.slice(0, 200);
      d.registro.total = d.registro.posts.length;
      if (usaRepo && archivosRepo === null) archivosRepo = await limpiarViejos({token, repo, archivos: [...(d.registro.archivos ?? []), pub.ruta]});
      if (usaRepo) d.registro.archivos = archivosRepo;
      fs.writeFileSync(path.join(dir, d.archivoRegistro), JSON.stringify(d.registro, null, 2));
      console.log(`${d.nombre}: ${d.accion === 'create_reel' || d.conector === 'instagram' ? 'Reel' : 'video'} publicado en "${CANAL}" (${d.registro.total} en total).`);
      try { avisarTelefono('subido', `Video publicado en ${d.nombre}`, `"${titulo.slice(0, 100)}" ya está en tu ${d.nombre} (Windsor).`); } catch { /* el aviso no debe fallar */ }
      resultados[d.nombre] = 'publicado';
    } catch (e) {
      const msg = quitarClaves(String(e.message ?? e), apiKey, token, bufferKey).slice(0, 300);
      console.log(`${d.nombre}: no se pudo publicar: ${msg}`);
      // se avisa al teléfono y a la campana: el video SÍ salió en YouTube; esa red se puede subir a mano si se quiere
      try {
        avisarTelefono('alerta', `No se pudo publicar en ${d.nombre}`, `"${titulo.slice(0, 80)}": ${msg.slice(0, 200)}`);
        const rutaN = path.join('oficina-salida', 'notificaciones.json');
        const lista = leer(rutaN, []);
        lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal: CANAL, tipo: 'alerta', titulo: `No se pudo publicar en ${d.nombre}`, texto: `"${titulo.slice(0, 80)}": ${msg.slice(0, 200)}`});
        fs.writeFileSync(rutaN, JSON.stringify(lista.slice(0, 80), null, 2));
      } catch { /* el aviso no debe fallar */ }
      resultados[d.nombre] = 'error: ' + msg.slice(0, 120);
    }
  }
  return {publicado: Object.values(resultados).some((x) => x === 'publicado'), resultados};
};

if (path.basename(String(process.argv[1] ?? '')) === 'facebook.mjs') {
  principal().catch((e) => { console.log('Facebook no se pudo publicar:', quitarClaves(String(e.message ?? e), process.env.WINDSOR_API_KEY, process.env.FB_VIDEOS_TOKEN, process.env.BUFFER_API_KEY).slice(0, 300)); }).finally(() => process.exit(0));
}
