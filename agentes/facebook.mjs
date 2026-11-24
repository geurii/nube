// Publica el video recién producido en la página de Facebook del canal usando la API de WINDSOR (connectors.windsor.ai), sin pasar por ninguna IA:
// corre solo en GitHub Actions, así que funciona aunque no haya ninguna sesión de Claude abierta.
// Facebook descarga el video desde una dirección PÚBLICA, así que primero se sube una copia a un repositorio público de videos (solo MP4 de videos ya publicados).
// Secretos (los pone el dueño en GitHub): WINDSOR_API_KEY (Windsor > Team management > API Access) y FB_VIDEOS_TOKEN (token de GitHub con permiso de escritura SOLO en el repo de videos).
// Variables: ID (ej. lqns-mary-celeste), CANAL. Sin secretos o sin cuenta de Facebook configurada, no hace nada y no falla.
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {execFileSync, spawnSync} from 'node:child_process';
import {avisarTelefono} from './aviso.mjs';
import {publicarEnTikTok, textoTikTok} from './tiktok.mjs';
import {sinEnlaces} from './sin-enlaces.mjs';

const leer = (ruta, d) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return d; } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const MAX_ARCHIVOS = 15; // en el repo de videos se conservan los últimos 15 (Facebook ya los descargó)
const MAX_COMPLETO_MB = 60; // shorts: por encima se usa la copia liviana; largos TikTok admiten hasta 220 MB

const quitarClaves = (texto, ...claves) => claves.filter(Boolean).reduce((t, k) => t.split(k).join('***'), String(texto ?? ''));

/** Elige el MP4: el completo si pesa poco; si no, la versión liviana (540x960, el mínimo que acepta Facebook). */
export const elegirArchivo = (id, carpeta = path.join('out', 'serie'), maxMb = MAX_COMPLETO_MB) => {
  const completo = path.join(carpeta, `${id}.mp4`);
  const liviano = path.join(carpeta, `${id}-subida.mp4`);
  if (fs.existsSync(completo) && fs.statSync(completo).size <= maxMb * 1024 * 1024) return completo;
  if (fs.existsSync(liviano)) return liviano;
  return null;
};

/** Texto de la publicación: título + descripción del guion (ya trae fuentes y los 5 hashtags). */
export const textoDePublicacion = (guion) => {
  const p = guion?.publicacion ?? {};
  return sinEnlaces(`${p.titulo ?? guion?.titulo ?? ''}\n\n${p.descripcion ?? ''}`).slice(0, 2000);
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
/** Sube el MP4 con git (clone + push con el token): aguanta archivos de hasta 100 MB, que la API de contenidos de GitHub rechaza ("file too large"). */
const subirConGit = ({token, repo, archivo, nombre}) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'videos-publicos-'));
  const cab = 'AUTHORIZATION: basic ' + Buffer.from(`x-access-token:${token}`).toString('base64');
  const git = (...a) => execFileSync('git', ['-c', `http.extraheader=${cab}`, ...a], {cwd: dir, stdio: 'pipe', timeout: 600000, encoding: 'utf8'});
  try {
    git('clone', '--depth', '1', `https://github.com/${repo}.git`, '.');
    fs.mkdirSync(path.join(dir, 'v'), {recursive: true});
    fs.copyFileSync(archivo, path.join(dir, 'v', nombre));
    git('config', 'user.name', 'github-actions');
    git('config', 'user.email', 'actions@users.noreply.github.com');
    git('add', `v/${nombre}`);
    git('commit', '-q', '-m', `Video ${nombre}`);
    git('push', '-q', 'origin', 'HEAD');
    return git('rev-parse', '--abbrev-ref', 'HEAD').trim() || 'main';
  } finally { try { fs.rmSync(dir, {recursive: true, force: true}); } catch { /* ya no está */ } }
};

export const subirAlRepoPublico = async ({token, repo, archivo, nombre}) => {
  try { // primero con git (sin el límite de la API); si falla, se prueba la API de contenidos
    const rama = subirConGit({token, repo, archivo, nombre});
    const url = `https://raw.githubusercontent.com/${repo}/${rama}/v/${nombre}`;
    for (let i = 0; i < 10; i++) {
      try { const h = await fetch(url, {method: 'HEAD', signal: AbortSignal.timeout(15000)}); if (h.ok) return {url, ruta: `v/${nombre}`}; } catch { /* aún no */ }
      await dormir(3000);
    }
    throw new Error('el video se subió con git pero su dirección pública no responde todavía');
  } catch (eGit) {
    console.log('Redes: subida con git falló (' + quitarClaves(String(eGit.stderr ?? eGit.message ?? eGit), token).replace(/\s+/g, ' ').slice(0, 160) + '); pruebo con la API de GitHub.');
    return subirPorApi({token, repo, archivo, nombre});
  }
};

const subirPorApi = async ({token, repo, archivo, nombre}) => {
  const ruta = `/repos/${repo}/contents/v/${nombre}`;
  const contenido = fs.readFileSync(archivo).toString('base64');
  let r;
  for (let intento = 1; intento <= 3; intento++) { // errores temporales de GitHub (403 por tiempo, 5xx): se reintenta
    r = await gh(token, 'PUT', ruta, {message: `Video ${nombre}`, content: contenido});
    if (![403, 500, 502, 503, 504].includes(r.status) || intento === 3) break;
    await dormir(8000 * intento);
  }
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

/** Alojamiento primario compatible con runners de GitHub Actions: Beacon usa URL prefirmada para archivos >4 MB. */
export const subirABeacon = async ({archivo, nombre}) => {
  const bytes = fs.readFileSync(archivo);
  const hash = (await import('node:crypto')).createHash('sha256').update(bytes).digest('hex');
  const registro = await fetch('https://beacon.host/v1/sites', {
    method: 'POST', headers: {'Content-Type': 'application/json'},
    body: JSON.stringify({files: [{path: nombre, size: bytes.length, contentType: 'video/mp4', hash: `sha256:${hash}`}]}),
    signal: AbortSignal.timeout(60000),
  });
  const rj = await registro.json().catch(() => ({}));
  if (!registro.ok) throw new Error(`Beacon registro HTTP ${registro.status}: ${JSON.stringify(rj).slice(0,180)}`);
  const pending = rj.uploads?.pending?.[0];
  const finalizeUrl = rj.version?.finalizeUrl;
  const claimToken = rj.claimToken;
  if (!pending?.uploadUrl || !finalizeUrl || !claimToken) throw new Error('Beacon no devolvió URL de carga/finalización');
  const put = await fetch(pending.uploadUrl, {method: 'PUT', headers: {'Content-Type': 'video/mp4'}, body: bytes, signal: AbortSignal.timeout(300000)});
  if (!put.ok) throw new Error(`Beacon carga HTTP ${put.status}: ${(await put.text()).slice(0,120)}`);
  const finUrl = finalizeUrl.startsWith('http') ? finalizeUrl : `https://beacon.host${finalizeUrl}`;
  const fin = await fetch(finUrl, {method: 'POST', headers: {'X-Claim-Token': claimToken}, signal: AbortSignal.timeout(60000)});
  const fj = await fin.json().catch(() => ({}));
  if (!fin.ok) throw new Error(`Beacon finalización HTTP ${fin.status}: ${JSON.stringify(fj).slice(0,160)}`);
  const url = fj.fileUrls?.[0] ?? fj.files?.[0]?.url ?? (fj.site?.url ? `${fj.site.url.replace(/\/$/,'')}/${encodeURIComponent(nombre)}` : '');
  if (!url) throw new Error('Beacon finalizó pero no devolvió enlace directo del MP4');
  const head = await fetch(url, {method: 'HEAD', signal: AbortSignal.timeout(30000)});
  if (!head.ok) throw new Error(`Beacon enlace directo HTTP ${head.status}`);
  console.log(`Redes: MP4 alojado en Beacon (${(bytes.length/1048576).toFixed(1)} MB; enlace temporal 24 h).`);
  return {url, ruta: null};
};

/** Sin token de GitHub: sube el MP4 a Litterbox (archivos temporales gratis, sin cuenta; se borra solo a las 24 h) y devuelve su enlace público directo. */
export const subirATemporal = async ({archivo, nombre}) => {
  // Primario: Beacon usa carga directa prefirmada y acepta runners de CI; sin credenciales GitHub ni API keys.
  try { return await subirABeacon({archivo, nombre}); }
  catch (e) { console.log('Redes: Beacon no respondió (' + String(e.message ?? e).slice(0, 140) + '); pruebo TempFile.org.'); }
  // Segundo respaldo: TempFile.org.
  try {
    const fd = new FormData();
    fd.append('expiryHours', '48');
    fd.append('files', new Blob([fs.readFileSync(archivo)], {type: 'video/mp4'}), nombre);
    const r = await fetch('https://tempfile.org/api/upload/local', {method: 'POST', body: fd, signal: AbortSignal.timeout(300000)});
    const j = await r.json().catch(() => ({}));
    const item = j.files?.[0];
    if (!r.ok || !j.success || !item?.id) throw new Error(j.error || `TempFile.org respondió HTTP ${r.status}`);
    const url = `https://tempfile.org/${item.id}/download`;
    const h = await fetch(url, {method: 'HEAD', signal: AbortSignal.timeout(30000)});
    if (!h.ok) throw new Error(`TempFile.org creó el archivo, pero el enlace directo respondió ${h.status}`);
    console.log(`Redes: video alojado temporalmente en TempFile.org (${(Number(item.size || 0) / 1048576).toFixed(1)} MB, expira en 48 h).`);
    return {url, ruta: null};
  } catch (e) {
    console.log('Redes: TempFile.org no respondió (' + String(e.message ?? e).slice(0, 140) + '); pruebo Litterbox.');
  }
  // Segundo respaldo anterior, por si TempFile.org está temporalmente caído.
  const fd = new FormData();
  fd.append('reqtype', 'fileupload');
  fd.append('time', '72h');
  fd.append('fileToUpload', new Blob([fs.readFileSync(archivo)], {type: 'video/mp4'}), nombre);
  const r = await fetch('https://litterbox.catbox.moe/resources/internals/api.php', {method: 'POST', body: fd, signal: AbortSignal.timeout(300000)});
  const url = (await r.text()).trim();
  if (!r.ok || !/^https:\/\/litter\.catbox\.moe\/[\w.-]+\.mp4$/.test(url)) throw new Error(`los alojamientos temporales fallaron (Litterbox HTTP ${r.status}): ${url.slice(0, 120)}`);
  for (let i = 0; i < 10; i++) {
    try { const h = await fetch(url, {method: 'HEAD', signal: AbortSignal.timeout(15000)}); if (h.ok) return {url, ruta: null}; } catch { /* aún no */ }
    await dormir(3000);
  }
  throw new Error('el video se subió pero su enlace temporal no responde todavía');
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
  const guion = leer(path.join('guion', 'serie', `${ID}.json`), null);
  if (!guion) { console.log('Redes: no encuentro el guion del video. Se omite.'); return {omitido: 'sin guion'}; }
  const largo = guion.formato === 'largo';
  if (!apiKey && !bufferKey) { console.log('Redes: faltan WINDSOR_API_KEY y BUFFER_API_KEY.'); if (largo) process.exitCode = 1; return {omitido: 'sin configurar'}; }
  if (largo && !bufferKey) { console.error('Falta BUFFER_API_KEY: no se puede enviar el largo a TikTok.'); process.exitCode = 1; return {omitido:'sin Buffer'}; }
  // Los largos se envían exclusivamente a TikTok por Buffer; Facebook/Instagram reciben solo Shorts/Reels.
  const dir = path.join('oficina-salida', CANAL);
  fs.mkdirSync(dir, {recursive: true});
  const texto = textoDePublicacion(guion);
  const titulo = String(guion.publicacion?.titulo ?? guion.titulo ?? '');

  // qué destinos tienen cuenta configurada y todavía no tienen este video
  const pendientes = [];
  for (const d of destinos({largo, cfg: cfgCanal, env: process.env})) {
    if (largo && d.nombre !== 'TikTok') { console.log(`${d.nombre}: se omite; este ciclo largo está destinado solo a TikTok.`); continue; }
    const registro = leer(path.join(dir, d.archivoRegistro), {total: 0, posts: [], archivos: []});
    if (d.tipo !== 'buffer' && !apiKey) { console.log(`${d.nombre}: se omite (falta WINDSOR_API_KEY).`); continue; }
    // TikTok: nunca se descarta por tener publicaciones programadas. Buffer añade cada video al siguiente espacio libre de la cola.
    if (!d.cuenta) { console.log(`${d.nombre}: se omite (no hay cuenta conectada en la configuración).`); continue; }
    if (registro.posts.some((p) => p.id === ID)) { console.log(`${d.nombre}: este video ya se publicó. No se repite.`); continue; }
    pendientes.push({...d, registro});
  }
  if (!pendientes.length) { if (largo) { console.error('No hay canal TikTok conectado en Buffer o el video ya fue enviado.'); process.exitCode = 1; } return {omitido: 'nada pendiente'}; }

  // cualquier fallo ANTES de publicar (sin MP4, no se pudo comprimir o subir la copia pública) avisa al teléfono: antes se omitía en silencio
  const alertar = (msg) => {
    console.log('Redes: ' + msg);
    try {
      avisarTelefono('alerta', largo ? 'No se pudo enviar el largo a TikTok' : 'No se pudo publicar en Facebook, Instagram ni TikTok', `"${titulo.slice(0, 40)}": ${msg.slice(0, 260)}`);
      const rutaN = path.join('oficina-salida', 'notificaciones.json');
      const lista = leer(rutaN, []);
      lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal: CANAL, tipo: 'alerta', titulo: largo ? 'No se pudo enviar el largo a TikTok' : 'No se pudo publicar en las redes', texto: `"${titulo.slice(0, 80)}": ${msg.slice(0, 220)}`});
      fs.writeFileSync(rutaN, JSON.stringify(lista.slice(0, 80), null, 2));
    } catch { /* el aviso no debe fallar */ }
  };
  let archivo = elegirArchivo(ID, path.join('out', 'serie'), largo ? 220 : MAX_COMPLETO_MB);
  if (!archivo) { // no hay copia liviana: se crea una con ffmpeg a partir del MP4 completo
    const completo = path.join('out', 'serie', `${ID}.mp4`);
    if (fs.existsSync(completo)) {
      try {
        const liviano = path.join('out', 'serie', `${ID}-subida.mp4`);
        execFileSync('ffmpeg', ['-y', '-i', completo, '-vf', 'scale=-2:1280:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-crf', '27', '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', liviano], {stdio: 'ignore', timeout: 900000});
        archivo = elegirArchivo(ID, path.join('out', 'serie'), largo ? 220 : MAX_COMPLETO_MB);
      } catch (e) { alertar(`no pude crear la copia liviana del video (${String(e.message ?? e).slice(0, 100)}).`); return {omitido: 'sin copia liviana'}; }
    }
  }
  if (!archivo) { alertar(`no encuentro el MP4 del video (${ID}) en out/serie.`); return {omitido: 'sin mp4'}; }
  // Buffer admite TikTok de 3 s a 10 min, 1 GB y 23-60 fps. Los largos de esta ruta deben durar al menos 8 min.
  if (largo) {
    const p = spawnSync('ffprobe', ['-v','error','-show_entries','format=duration:stream=codec_type,width,height,avg_frame_rate','-of','json',archivo], {encoding:'utf8',timeout:60000});
    if (p.status !== 0) { alertar('no pude verificar los metadatos del largo antes de enviarlo a TikTok.'); return {omitido:'metadatos inválidos'}; }
    const m = JSON.parse(p.stdout);
    const v = (m.streams ?? []).find(x => x.codec_type === 'video');
    const seg = Number(m.format?.duration);
    const fpsPartes = String(v?.avg_frame_rate ?? '0/1').split('/').map(Number);
    const fps = fpsPartes[1] ? fpsPartes[0] / fpsPartes[1] : fpsPartes[0];
    const bytes = fs.statSync(archivo).size;
    if (!v || !Number.isFinite(seg) || seg < 480 || seg > 600 || v.width < 360 || v.height < 360 || !Number.isFinite(fps) || fps < 23 || fps > 60 || bytes > 1024 * 1024 * 1024) {
      alertar(`TikTok rechazará el largo por sus límites: duración ${Number.isFinite(seg) ? seg.toFixed(1) : 'desconocida'} s (480–600), resolución ${v?.width ?? '?'}x${v?.height ?? '?'}, ${fps.toFixed(1)} fps, ${(bytes/1048576).toFixed(1)} MB.`);
      return {omitido:'fuera de especificación TikTok'};
    }
  }
  // Shorts: se comprimen a ~20 MB. Los largos se conservan con calidad hasta 220 MB para alojarlos y enviarlos a Buffer.
  let notaVideo = '';
  try {
    const MAX_MB = largo ? 220 : 20;
    if (fs.statSync(archivo).size > MAX_MB * 1024 * 1024) {
      const seg = Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=nw=1:nk=1', archivo], {encoding: 'utf8', timeout: 60000}).trim()) || 60;
      const kbps = Math.max(300, Math.floor((MAX_MB * 8192 * 0.85) / seg) - 96);
      const reducido = path.join(path.dirname(archivo), `${ID}-redes.mp4`);
      execFileSync('ffmpeg', ['-y', '-i', archivo, '-vf', 'scale=-2:1280:force_original_aspect_ratio=decrease,scale=trunc(iw/2)*2:trunc(ih/2)*2', '-c:v', 'libx264', '-b:v', `${kbps}k`, '-maxrate', `${Math.round(kbps * 1.25)}k`, '-bufsize', `${kbps * 2}k`, '-preset', 'veryfast', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', reducido], {stdio: 'ignore', timeout: 900000});
      if (fs.existsSync(reducido) && fs.statSync(reducido).size < fs.statSync(archivo).size) { console.log(`Redes: video reducido a ${(fs.statSync(reducido).size / 1048576).toFixed(1)} MB.`); archivo = reducido; }
    }
  } catch (e) { notaVideo = ' [no pude reducirlo: ' + String(e.message ?? e).slice(0, 80) + ']'; console.log('Redes: no pude reducir el video' + notaVideo + '; se intenta con el original.'); }
  if (largo && fs.statSync(archivo).size > 220 * 1024 * 1024) { alertar('el MP4 largo supera 220 MB y no se pudo comprimir al tamaño seguro para el alojamiento temporal de Buffer.'); return {omitido:'largo demasiado pesado'}; }
  // con token de GitHub y repo público: se guarda ahí (permanente, últimos 15); si no, archivo temporal de 72 h sin ninguna clave
  let usaRepo = Boolean(token && repo);
  let pub;
  const limpio = (e) => quitarClaves(String(e.message ?? e), apiKey, token, bufferKey).replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 140);
  let motivoRepo = usaRepo ? '' : (token ? 'falta configurar el repositorio público de videos' : 'falta el secreto FB_VIDEOS_TOKEN');
  try {
    pub = usaRepo ? await subirAlRepoPublico({token, repo, archivo, nombre: `${ID}.mp4`}) : await subirATemporal({archivo, nombre: `${ID}.mp4`});
  } catch (e) {
    if (usaRepo) motivoRepo = `el repositorio público "${repo}" no aceptó el video: ${limpio(e)}`;
    console.log('Redes: la copia pública falló (' + limpio(e) + '); pruebo con el archivo temporal.');
    usaRepo = false;
    try { pub = await subirATemporal({archivo, nombre: `${ID}.mp4`}); }
    catch (e2) { alertar(`${motivoRepo || 'sin repositorio público'}; y el servicio temporal bloqueó a GitHub (${limpio(e2)}). Archivo enviado: ${(fs.statSync(archivo).size / 1048576).toFixed(1)} MB${notaVideo}.`); return {omitido: 'sin alojamiento'}; }
  }

  const resultados = {};
  let archivosRepo = null;
  for (const d of pendientes) {
    try { // un destino que falla no impide el otro
      const resp = d.tipo === 'buffer'
        ? await publicarEnTikTok({apiKey: bufferKey, url: pub.url, texto: textoTikTok(guion), ia: cfgCanal.tiktok?.ia === true, canal: String(cfgCanal.tiktok?.canal ?? ''), modo: largo ? 'ahora' : (cfgCanal.tiktok?.modo === 'ahora' ? 'ahora' : 'cola')})
        : await publicarConWindsor({apiKey, conector: d.conector, cuenta: d.cuenta, accion: d.accion, params: d.params(pub.url, texto, titulo)});
      d.registro.posts.unshift({id: ID, titulo: titulo.slice(0, 140), fecha: new Date().toISOString(), accion: d.accion, programado: resp.programado, alojamiento: usaRepo ? 'repositorio' : 'temporal-72h', video_url: pub.url, respuesta: resp.texto.slice(0, 300)});
      d.registro.posts = d.registro.posts.slice(0, 200);
      d.registro.total = d.registro.posts.length;
      if (usaRepo && archivosRepo === null) archivosRepo = await limpiarViejos({token, repo, archivos: [...(d.registro.archivos ?? []), pub.ruta]});
      if (usaRepo) d.registro.archivos = archivosRepo;
      fs.writeFileSync(path.join(dir, d.archivoRegistro), JSON.stringify(d.registro, null, 2));
      const esBuffer = d.tipo === 'buffer';
      const estadoPublicacion = esBuffer && resp.estado === 'sent' ? 'publicado en TikTok' : esBuffer && resp.programado !== 'ahora' ? 'añadido a la cola de Buffer' : esBuffer ? 'enviado a Buffer para publicación inmediata' : 'publicado';
      console.log(`${d.nombre}: ${estadoPublicacion} en "${CANAL}" (${d.registro.total} en total).`);
      try { avisarTelefono('subido', esBuffer ? (resp.estado === 'sent' ? 'Video publicado en TikTok' : largo ? 'Largo enviado a TikTok' : 'Video enviado a Buffer') : `Video publicado en ${d.nombre}`, `"${titulo.slice(0, 100)}" ${estadoPublicacion}.`); } catch { /* el aviso no debe fallar */ }
      resultados[d.nombre] = esBuffer ? (resp.programado === 'ahora' ? 'enviado-ahora' : 'encolado') : 'publicado';
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
  if (largo && resultados.TikTok === 'enviado-ahora') {
    // El tema ya fue enviado a Buffer; evita que Producción vuelva a elegir este mismo guion para el segundo largo.
    try {
      const rutaProducidos = path.join(dir, 'producidos.json');
      const lista = leer(rutaProducidos, []);
      const slug = ID.replace(new RegExp('^' + CANAL + '-'), '');
      if (!lista.some((x) => String(x).toLowerCase() === slug.toLowerCase())) fs.writeFileSync(rutaProducidos, JSON.stringify([...lista, slug], null, 2));
    } catch (e) { console.log('TikTok aceptó el largo, pero no pude marcar el tema como enviado: ' + String(e.message ?? e).slice(0,120)); }
  }
  if (largo && resultados.TikTok !== 'enviado-ahora') { console.error('El largo no fue aceptado por Buffer para publicación inmediata en TikTok.'); process.exitCode = 1; }
  return {publicado: Object.values(resultados).some((x) => ['publicado','enviado-ahora'].includes(x)), resultados};
};

if (path.basename(String(process.argv[1] ?? '')) === 'facebook.mjs') {
  principal().catch((e) => { console.log('Publicación en redes falló:', quitarClaves(String(e.message ?? e), process.env.WINDSOR_API_KEY, process.env.FB_VIDEOS_TOKEN, process.env.BUFFER_API_KEY).slice(0, 300)); process.exitCode = 1; });
}
