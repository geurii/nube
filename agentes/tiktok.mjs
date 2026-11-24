// Publicar en TikTok con la API de BUFFER (GraphQL, https://api.buffer.com). Windsor no puede publicar en TikTok (sin acciones de escritura), Buffer sí.
// Todo según la documentación oficial de Buffer (developers.buffer.com): clave en "Authorization: Bearer", consulta de organizaciones, consulta de canales
// (service = tiktok), mutación createPost con video por enlace público (Buffer no recibe archivos). Se publica YA (shareNow) en modo automático.
// Nunca lanza hacia afuera: devuelve el resultado o lanza un Error con un mensaje claro que el llamador captura.
import {sinEnlaces} from './sin-enlaces.mjs';

const API = 'https://api.buffer.com';
const dormir = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const quitarClave = (t, clave) => String(t ?? '').split(clave).join('***');

/** Texto de TikTok: título + primer párrafo corto + los 5 hashtags (Buffer limita a 5 hashtags; sin la lista de fuentes, que en TikTok no sirve). */
export const textoTikTok = (guion) => {
  const p = guion?.publicacion ?? {};
  const titulo = String(p.titulo ?? guion?.titulo ?? '').trim();
  const desc = sinEnlaces(p.descripcion ?? '');
  const hashtags = [...new Set(desc.match(/#[\p{L}\p{N}_]+/gu) ?? [])].slice(0, 5);
  const primer = desc.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#') && !/^(Fuentes|Más historias)/i.test(l) && !/^https?:/i.test(l)) ?? '';
  const sinHashtags = primer.replace(/#[\p{L}\p{N}_]+/gu, '').trim();
  // Buffer permite hasta 2.200 caracteres en TikTok cuando el post lleva video.
  const base = [titulo.slice(0, 150), sinHashtags, hashtags.join(' ')].filter(Boolean).join(' ').replace(/\s+/g, ' ').trim();
  return base.slice(0, 2200);
};

const graphql = async (apiKey, query, variables) => {
  const r = await fetch(API, {
    method: 'POST', signal: AbortSignal.timeout(60000),
    headers: {Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json'},
    body: JSON.stringify(variables ? {query, variables} : {query}),
  });
  if (r.status === 429) throw new Error(`Buffer pidió esperar (límite de uso): reintenta en ${r.headers.get('retry-after') ?? 'unos minutos'} s`);
  const texto = await r.text();
  let json = null;
  try { json = JSON.parse(texto); } catch { /* no es JSON */ }
  if (r.status === 401) throw new Error('Buffer no aceptó la clave (401). Revisa BUFFER_API_KEY.');
  if (!json) throw new Error(`Buffer respondió algo que no es JSON (${r.status}): ${quitarClave(texto, apiKey).slice(0, 150)}`);
  const e = json.errors?.[0];
  if (e) throw new Error(`Buffer: ${e.extensions?.code ? e.extensions.code + ' · ' : ''}${String(e.message).slice(0, 200)}`);
  return json.data;
};

/** Busca el canal de TikTok conectado en Buffer (el primero que no esté desconectado ni bloqueado, o el que se llame como `nombre`). */
export const buscarCanalTikTok = async (apiKey, nombre = '') => {
  const d = await graphql(apiKey, 'query GetOrganizations { account { organizations { id name } } }');
  const orgs = d?.account?.organizations ?? [];
  if (!orgs.length) throw new Error('Buffer: la cuenta no tiene ninguna organización.');
  for (const org of orgs) {
    const c = await graphql(apiKey, `query GetChannels { channels(input: { organizationId: ${JSON.stringify(org.id)} }) { id name displayName service type isDisconnected isLocked } }`);
    const tiktoks = (c?.channels ?? []).filter((x) => String(x.service).toLowerCase() === 'tiktok');
    if (!tiktoks.length) continue;
    const buenos = tiktoks.filter((x) => !x.isDisconnected && !x.isLocked);
    if (!buenos.length) throw new Error(`Buffer: el canal de TikTok está ${tiktoks[0].isDisconnected ? 'desconectado' : 'bloqueado'}. Vuelve a conectarlo en Buffer.`);
    return (nombre && buenos.find((x) => [x.name, x.displayName].some((n) => String(n).toLowerCase() === nombre.toLowerCase()))) || buenos[0];
  }
  throw new Error('Buffer: no hay ningún canal de TikTok conectado. Conéctalo en publish.buffer.com.');
};

const MUTACION = 'mutation CreatePost($input: CreatePostInput!) { createPost(input: $input) { ... on PostActionSuccess { post { id status sentAt externalLink error { message } } } ... on MutationError { message } } }';

/** Crea la publicación (reintenta con needsApproval:false si la API lo exige) y devuelve el resultado de createPost. */
const crear = async (apiKey, entrada) => {
  let d;
  try {
    d = await graphql(apiKey, MUTACION, {input: entrada});
  } catch (e) {
    if (!/needsApproval/i.test(String(e.message))) throw e;
    d = await graphql(apiKey, MUTACION, {input: {...entrada, needsApproval: false}}); // según la documentación puede ser obligatorio
  }
  let res = d?.createPost;
  if (res && !res.post?.id && /needsApproval/i.test(String(res.message ?? ''))) {
    res = (await graphql(apiKey, MUTACION, {input: {...entrada, needsApproval: false}}))?.createPost;
  }
  if (!res?.post?.id) throw new Error(`Buffer no publicó el video: ${String(res?.message ?? 'respuesta sin detalle').slice(0, 200)}`);
  return res;
};

/** Espera a que Buffer confirme el estado final de publicación; un ID de post por sí solo no significa que TikTok ya lo publicó. */
export const esperarEnvioTikTok = async (apiKey, postId, maxIntentos = 18) => {
  let ultimo = null;
  for (let i = 0; i < maxIntentos; i++) {
    const d = await graphql(apiKey, `query GetPostStatus { post(input: {id: ${JSON.stringify(postId)}}) { id status sentAt externalLink error { message } } }`);
    ultimo = d?.post;
    if (!ultimo) throw new Error('Buffer no devolvió el estado del post de TikTok.');
    if (ultimo.status === 'sent') return ultimo;
    if (ultimo.status === 'error') throw new Error(`TikTok rechazó la publicación: ${String(ultimo.error?.message ?? 'error sin detalle').slice(0,180)}`);
    await dormir(10000);
  }
  throw new Error(`Buffer aceptó el video, pero no confirmó que TikTok lo publicara tras 3 minutos (estado: ${ultimo?.status ?? 'desconocido'}). No se marca como publicado.`);
};

/**
 * Publica el video en TikTok. modo "cola" (por defecto): Buffer lo pone en el SIGUIENTE ESPACIO LIBRE de tu calendario de publicación (un video por día);
 * modo "ahora": se publica de inmediato. `ia` = declarar que el contenido es generado por IA (TikTok lo pide para contenido realista).
 */
export const publicarEnTikTok = async ({apiKey, url, texto, ia = false, canal = '', modo = 'cola'}) => {
  const ch = await buscarCanalTikTok(apiKey, canal);
  const base = {text: texto, channelId: ch.id, schedulingType: 'automatic', assets: [{video: {url}}], metadata: {tiktok: {isAiGenerated: Boolean(ia)}}};
  let programado = modo === 'ahora' ? 'ahora' : 'cola';
  let res;
  try {
    res = await crear(apiKey, {...base, mode: modo === 'ahora' ? 'shareNow' : 'addToQueue'});
  } catch (e) {
    // si el canal no tiene calendario de publicación (sin espacios), se publica ahora en vez de perder el video
    if (modo === 'ahora' || !/schedule|slot|queue|calendar|horario|espacio/i.test(String(e.message))) throw e;
    res = await crear(apiKey, {...base, mode: 'shareNow'});
    programado = 'ahora (el canal no tiene calendario)';
  }
  const nombre = ch.displayName ?? ch.name;
  if (modo === 'ahora') {
    const enviado = await esperarEnvioTikTok(apiKey, res.post.id);
    return {id: res.post.id, canal: nombre, programado: 'ahora', estado: enviado.status, externalLink: enviado.externalLink ?? '', texto: JSON.stringify({id: res.post.id, canal: nombre, programado: 'ahora', status: enviado.status, externalLink: enviado.externalLink ?? ''}).slice(0, 300)};
  }
  return {id: res.post.id, canal: nombre, programado, texto: JSON.stringify({id: res.post.id, canal: nombre, programado}).slice(0, 300)};
};
