// COMPROBADOR DE LLAVES: prueba de verdad cada llave guardada en GitHub (IA, Windsor, Buffer, YouTube, GitHub de videos, ntfy) con una petición pequeña
// y de solo lectura, y guarda el resultado en oficina-salida/llaves.json (la oficina 3D lo muestra). NUNCA imprime ni guarda las llaves.
import fs from 'node:fs';
import path from 'node:path';
import {probarProveedor} from './llm.mjs';

const env = (n) => (process.env[n] ?? '').trim();
const quitar = (t) => { let s = String(t ?? ''); for (const k of Object.values(process.env)) if (k && k.length >= 8 && s.includes(k)) s = s.split(k).join('***'); return s.replace(/\s+/g, ' ').slice(0, 160); };

const pedir = async (url, opt = {}) => {
  const t0 = Date.now();
  const r = await fetch(url, {...opt, signal: AbortSignal.timeout(25000)});
  return {r, ms: Date.now() - t0};
};
const probar = async (id, nombre, secretos, fn) => {
  const faltan = secretos.filter((s) => !env(s));
  if (faltan.length) return {id, nombre, secretos, estado: 'sin-llave', detalle: `Falta guardar en GitHub: ${faltan.join(', ')}`};
  try {
    const x = await fn();
    return {id, nombre, secretos, estado: x.ok ? 'ok' : 'error', detalle: x.detalle, ms: x.ms};
  } catch (e) { return {id, nombre, secretos, estado: 'error', detalle: quitar(e.message ?? e)}; }
};
const http = (texto) => (r, ms, ok = [200]) => ({ok: ok.includes(r.status), ms, detalle: ok.includes(r.status) ? `responde (${(ms / 1000).toFixed(1)} s)` : `${texto}: error ${r.status}`});
const bearer = (nombre, url, secreto) => async () => {
  const {r, ms} = await pedir(url, {headers: {Authorization: `Bearer ${env(secreto)}`}});
  return http(nombre)(r, ms);
};

const repoVideos = (() => { try { return JSON.parse(fs.readFileSync(path.join('agentes', 'canales-propios.json'), 'utf8')).canales.find((c) => c.id === 'lqns')?.facebook?.repo ?? ''; } catch { return ''; } })();

// [id, nombre, proveedor de agentes/llm.mjs, secretos]
const IA = [
  ['groq', 'Groq', 'Groq', ['GROQ_API_KEY']], ['gemini', 'Google Gemini', 'Gemini', ['GEMINI_API_KEY']], ['openrouter', 'OpenRouter (modelos gratis)', 'OpenRouter', ['OPENROUTER_API_KEY']],
  ['cerebras', 'Cerebras', 'Cerebras', ['CEREBRAS_API_KEY']], ['mistral', 'Mistral', 'Mistral', ['MISTRAL_API_KEY']], ['sambanova', 'SambaNova', 'SambaNova', ['SAMBANOVA_API_KEY']],
  ['nvidia', 'NVIDIA NIM', 'NVIDIA NIM', ['NVIDIA_API_KEY']], ['cohere', 'Cohere', 'Cohere', ['COHERE_API_KEY']], ['zai', 'Z.ai (GLM)', 'Z.ai (GLM)', ['ZAI_API_KEY']],
  ['ollama', 'Ollama Cloud', 'Ollama Cloud', ['OLLAMA_API_KEY']], ['llm7', 'LLM7', 'LLM7', ['LLM7_API_KEY']], ['requesty', 'Requesty (modelos gratis)', 'Requesty', ['REQUESTY_API_KEY']],
  ['pollinations', 'Pollinations (sin cuenta)', 'Pollinations', ['POLLINATIONS_API_KEY']], ['ovh', 'OVHcloud (sin cuenta)', 'OVHcloud', ['OVH_API_KEY']],
];
const resultados = await Promise.all([
  ...IA.map(([id, nombre, proveedor, secretos]) => (async () => {
    try { const x = await probarProveedor(proveedor); return {id, nombre, secretos, estado: x.estado, detalle: x.detalle, ms: x.ms}; }
    catch (e) { return {id, nombre, secretos, estado: 'error', detalle: quitar(e.message ?? e)}; }
  })()),
  probar('windsor', 'Windsor (Facebook e Instagram)', ['WINDSOR_API_KEY'], async () => {
    const {r, ms} = await pedir(`https://connectors.windsor.ai/facebook_organic/actions?api_key=${encodeURIComponent(env('WINDSOR_API_KEY'))}`);
    return http('Windsor')(r, ms);
  }),
  probar('buffer', 'Buffer (TikTok)', ['BUFFER_API_KEY'], async () => {
    const {r, ms} = await pedir('https://api.buffer.com', {method: 'POST', headers: {Authorization: `Bearer ${env('BUFFER_API_KEY')}`, 'Content-Type': 'application/json'}, body: JSON.stringify({query: 'query GetOrganizations { account { organizations { id } } }'})});
    const j = await r.json().catch(() => ({}));
    const n = j?.data?.account?.organizations?.length ?? 0;
    return {ok: r.ok && !j?.errors && n > 0, ms, detalle: r.ok && !j?.errors && n > 0 ? `responde (${n} organización)` : `Buffer: error ${r.status}${j?.errors ? ' · ' + quitar(j.errors[0]?.message) : ''}`};
  }),
  probar('youtube', 'YouTube', ['YT_CLIENT_ID', 'YT_CLIENT_SECRET', 'YT_REFRESH_TOKEN'], async () => {
    const {r, ms} = await pedir('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({client_id: env('YT_CLIENT_ID'), client_secret: env('YT_CLIENT_SECRET'), refresh_token: env('YT_REFRESH_TOKEN'), grant_type: 'refresh_token'})});
    const j = await r.json().catch(() => ({}));
    return {ok: r.ok && !!j.access_token, ms, detalle: r.ok && j.access_token ? `conectado (${(ms / 1000).toFixed(1)} s)` : `YouTube: ${quitar(j.error_description || j.error || r.status)}${/invalid_grant/.test(j.error ?? '') ? ' (la autorización venció: hay que volver a conectar YouTube)' : ''}`};
  }),
  probar('videos', 'GitHub de videos (Facebook/Instagram/TikTok)', ['FB_VIDEOS_TOKEN'], async () => {
    const {r, ms} = await pedir(`https://api.github.com/repos/${repoVideos || 'geurii/oficina-videos-legal'}`, {headers: {Authorization: `Bearer ${env('FB_VIDEOS_TOKEN')}`, Accept: 'application/vnd.github+json', 'User-Agent': 'FabricaDeVideos'}});
    const j = await r.json().catch(() => ({}));
    const puede = j?.permissions?.push === true;
    return {ok: r.ok && puede, ms, detalle: !r.ok ? `GitHub: error ${r.status} (llave inválida o sin acceso al repositorio)` : puede ? `puede escribir en ${j.full_name}` : `la llave puede ver ${j.full_name} pero NO escribir en él`};
  }),
  probar('ntfy', 'Avisos al teléfono (ntfy)', ['NTFY_TOPIC'], async () => {
    const ok = /^[\w-]{6,64}$/.test(env('NTFY_TOPIC'));
    return {ok, detalle: ok ? 'el tema tiene formato válido' : 'el tema no tiene un formato válido (6 a 64 letras, números, - o _)'};
  }),
]);

fs.mkdirSync('oficina-salida', {recursive: true});
fs.writeFileSync(path.join('oficina-salida', 'llaves.json'), JSON.stringify({fecha: new Date().toISOString(), resultados}, null, 2));
for (const x of resultados) console.log(`${x.estado === 'ok' ? '✔' : x.estado === 'sin-llave' ? '○' : '✘'} ${x.nombre}: ${x.detalle}`);
