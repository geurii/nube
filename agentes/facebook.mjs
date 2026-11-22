// Publica el video recién producido en la página de Facebook del canal usando la API de WINDSOR (connectors.windsor.ai), sin pasar por ninguna IA:
// corre solo en GitHub Actions, así que funciona aunque no haya ninguna sesión de Claude abierta.
// Facebook descarga el video desde una dirección PÚBLICA, así que primero se sube una copia a un repositorio público de videos (solo MP4 de videos ya publicados).
// Secretos (los pone el dueño en GitHub): WINDSOR_API_KEY (Windsor > Team management > API Access) y FB_VIDEOS_TOKEN (token de GitHub con permiso de escritura SOLO en el repo de videos).
// Variables: ID (ej. lqns-mary-celeste), CANAL. Sin secretos o sin cuenta de Facebook configurada, no hace nada y no falla.
import fs from 'node:fs';
import path from 'node:path';
import {avisarTelefono} from './aviso.mjs';

const leer = (ruta, d) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return d; } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const WINDSOR = 'https://connectors.windsor.ai/facebook_organic/actions';
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
export const publicarConWindsor = async ({apiKey, cuenta, accion, params}) => {
  const r = await fetch(`${WINDSOR}?api_key=${encodeURIComponent(apiKey)}`, {
    method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({account: cuenta, action: accion, params}), signal: AbortSignal.timeout(120000),
  });
  const texto = quitarClaves(await r.text(), apiKey).slice(0, 600);
  let json = null;
  try { json = JSON.parse(texto); } catch { /* texto plano */ }
  const fallo = !r.ok || json?.error || json?.success === false || /"error"/i.test(texto);
  if (fallo) throw new Error(`Windsor respondió ${r.status}: ${texto.slice(0, 300)}`);
  return {status: r.status, texto, json};
};

export const principal = async () => {
  const ID = (process.env.ID ?? '').trim();
  const CANAL = (process.env.CANAL || 'lqns').trim();
  const apiKey = (process.env.WINDSOR_API_KEY ?? '').trim();
  const token = (process.env.FB_VIDEOS_TOKEN ?? '').trim();
  const cfg = (leer(path.join('agentes', 'canales-propios.json'), {canales: []}).canales ?? []).find((c) => c.id === CANAL)?.facebook ?? {};
  const cuenta = (process.env.FB_PAGE_ACCOUNT || cfg.cuenta || '').trim();
  const repo = (process.env.FB_VIDEOS_REPO || cfg.repo || '').trim();
  if (!ID) { console.log('Facebook: falta el id del video (ID). Se omite.'); return {omitido: 'sin id'}; }
  if (!apiKey || !token || !cuenta || !repo) {
    console.log(`Facebook: se omite (falta ${[!apiKey && 'WINDSOR_API_KEY', !token && 'FB_VIDEOS_TOKEN', !cuenta && 'la cuenta de la página', !repo && 'el repositorio de videos'].filter(Boolean).join(', ')}).`);
    return {omitido: 'sin configurar'};
  }
  const guion = leer(path.join('guion', 'serie', `${ID}.json`), null);
  if (!guion) { console.log('Facebook: no encuentro el guion del video. Se omite.'); return {omitido: 'sin guion'}; }
  const dir = path.join('oficina-salida', CANAL);
  fs.mkdirSync(dir, {recursive: true});
  const rutaRegistro = path.join(dir, 'facebook.json');
  const registro = leer(rutaRegistro, {total: 0, posts: [], archivos: []});
  if (registro.posts.some((p) => p.id === ID)) { console.log('Facebook: este video ya se publicó. No se repite.'); return {omitido: 'ya publicado'}; }
  const archivo = elegirArchivo(ID);
  if (!archivo) { console.log('Facebook: no encuentro el MP4 del video. Se omite.'); return {omitido: 'sin mp4'}; }

  const largo = guion.formato === 'largo';
  const texto = textoDePublicacion(guion);
  const pub = await subirAlRepoPublico({token, repo, archivo, nombre: `${ID}.mp4`});
  const params = largo ? {video_url: pub.url, title: String(guion.publicacion?.titulo ?? guion.titulo ?? '').slice(0, 100), description: texto} : {video_url: pub.url, description: texto};
  const resp = await publicarConWindsor({apiKey, cuenta, accion: largo ? 'create_video_post' : 'create_reel', params});

  registro.posts.unshift({id: ID, titulo: String(guion.publicacion?.titulo ?? guion.titulo ?? '').slice(0, 140), fecha: new Date().toISOString(), formato: largo ? 'largo' : 'reel', video_url: pub.url, respuesta: resp.texto.slice(0, 300)});
  registro.archivos = await limpiarViejos({token, repo, archivos: [...(registro.archivos ?? []), pub.ruta]});
  registro.total = registro.posts.length;
  registro.posts = registro.posts.slice(0, 200);
  fs.writeFileSync(rutaRegistro, JSON.stringify(registro, null, 2));
  console.log(`Facebook: ${largo ? 'video' : 'Reel'} publicado en la página de "${CANAL}" (${registro.total} en total).`);
  try { avisarTelefono('subido', 'Video publicado en Facebook', `"${String(guion.publicacion?.titulo ?? guion.titulo).slice(0, 100)}" ya está en tu página de Facebook (Windsor).`); } catch { /* el aviso no debe fallar */ }
  return {publicado: true};
};

if (path.basename(String(process.argv[1] ?? '')) === 'facebook.mjs') {
  principal().catch((e) => { console.log('Facebook no se pudo publicar:', quitarClaves(String(e.message ?? e), process.env.WINDSOR_API_KEY, process.env.FB_VIDEOS_TOKEN).slice(0, 300)); }).finally(() => process.exit(0));
}
