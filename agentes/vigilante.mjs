// Vigilante: revisa cada pocas horas que TODO siga funcionando y avisa (campana + teléfono) SOLO cuando hay un problema nuevo.
// Revisa: permiso de YouTube (que el token no haya vencido), permiso de analítica, claves de Groq y Gemini, corridas fallidas en GitHub
// y que el canal haya publicado en las últimas 36 horas. No repite el mismo aviso en 20 horas. Nunca imprime claves.
import fs from 'node:fs';
import path from 'node:path';
import {avisarTelefono} from './aviso.mjs';

const RAIZ = path.resolve('oficina-salida');
const RUTA_ESTADO = path.join(RAIZ, 'vigilante.json');
const RUTA_NOTIS = path.join(RAIZ, 'notificaciones.json');
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const estado = leer(RUTA_ESTADO, {alertas: {}});
const hallazgos = [];
const ok = [];
const lim = (t) => String(t).slice(0, 180);
const pedir = async (url, init = {}) => { try { return await fetch(url, {signal: AbortSignal.timeout(30000), ...init}); } catch (e) { return {ok: false, status: 0, text: async () => String(e.message), json: async () => ({})}; } };

// 1) YouTube: ¿el token sigue vivo? ¿tiene permiso de analítica?
const {GROQ_API_KEY, GEMINI_API_KEY, GITHUB_TOKEN, GITHUB_REPOSITORY} = process.env;
const YT_CLIENT_ID = (process.env.YT_CLIENT_ID || '').trim();
const YT_CLIENT_SECRET = (process.env.YT_CLIENT_SECRET || '').trim();
const YT_REFRESH_TOKEN = (process.env.YT_REFRESH_TOKEN || '').trim();
let tokenAcceso = null;
if (YT_CLIENT_ID && YT_CLIENT_SECRET && YT_REFRESH_TOKEN) {
  const r = await pedir('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token'})});
  if (r.ok) { tokenAcceso = (await r.json()).access_token; ok.push('YouTube conectado'); }
  else {
    const t = await r.text();
    globalThis.__diag = ('Diagnóstico (longitudes, sin valores): id=' + YT_CLIENT_ID.length + ' (esperado 72), secreto=' + YT_CLIENT_SECRET.length + ' (35), token=' + YT_REFRESH_TOKEN.length + ' (127). Espacios o saltos: id=' + /\s/.test(YT_CLIENT_ID) + ' secreto=' + /\s/.test(YT_CLIENT_SECRET) + ' token=' + /\s/.test(YT_REFRESH_TOKEN) + '. id termina en: ' + YT_CLIENT_ID.slice(-12));
    console.log(globalThis.__diag);
    hallazgos.push({clave: 'youtube-token', tipo: 'permiso', titulo: 'Reconectar YouTube', texto: /invalid_grant/.test(t)
      ? 'El permiso de YouTube venció o fue revocado. Si la app de Google sigue en "Prueba", se vence cada 7 días: ponla en "Producción" y vuelve a sacar el token con scripts/token-youtube.mjs.'
      : `YouTube no dio acceso (${r.status}): ${lim(t)}`});
  }
} else hallazgos.push({clave: 'youtube-secretos', tipo: 'permiso', titulo: 'Faltan los secretos de YouTube', texto: 'Faltan YT_CLIENT_ID, YT_CLIENT_SECRET o YT_REFRESH_TOKEN en los secretos de GitHub.'});

if (tokenAcceso) {
  const f = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
  const a = await pedir(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&startDate=${f(7)}&endDate=${f(0)}&metrics=views`, {headers: {Authorization: `Bearer ${tokenAcceso}`}});
  if (a.ok) ok.push('analítica autorizada');
  else {
    const t = await a.text();
    hallazgos.push({clave: 'analitica', tipo: 'permiso', titulo: 'Autorizar la analítica de YouTube', texto: /insufficient|scope|403|disabled|not been used/i.test(t) || a.status === 403
      ? 'Falta el permiso de analítica (o la API no está activada). Activa "YouTube Analytics API" en Google Cloud y vuelve a correr scripts/token-youtube.mjs; luego actualiza YT_REFRESH_TOKEN.'
      : `La analítica respondió ${a.status}: ${lim(t)}`});
  }
}

// 2) Groq y Gemini
if (GROQ_API_KEY) { const r = await pedir('https://api.groq.com/openai/v1/models', {headers: {Authorization: `Bearer ${GROQ_API_KEY}`}}); r.ok ? ok.push('Groq responde') : hallazgos.push({clave: 'groq', tipo: 'alerta', titulo: 'Groq no responde', texto: `La clave de Groq falló (${r.status}). Sin Groq no hay guiones ni críticos.`}); }
if (GEMINI_API_KEY) { const r = await pedir('https://generativelanguage.googleapis.com/v1beta/models', {headers: {'x-goog-api-key': GEMINI_API_KEY}}); r.ok ? ok.push('Gemini responde') : hallazgos.push({clave: 'gemini', tipo: 'alerta', titulo: 'Gemini no responde', texto: `La clave de Gemini falló (${r.status}). Sin ella la voz usa Edge y nadie mira los videos.`}); }

// 3) Corridas fallidas en GitHub (últimas 24 h)
if (GITHUB_TOKEN && GITHUB_REPOSITORY) {
  const r = await pedir(`https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/runs?per_page=40`, {headers: {Authorization: `Bearer ${GITHUB_TOKEN}`, Accept: 'application/vnd.github+json'}});
  if (r.ok) {
    const corridas = ((await r.json()).workflow_runs ?? []).filter((x) => Date.now() - new Date(x.created_at).getTime() < 24 * 3600 * 1000 && x.name !== 'Vigilante');
    const fallidas = corridas.filter((x) => x.conclusion === 'failure');
    const por = {};
    for (const x of fallidas) (por[x.name] = por[x.name] ?? []).push(x);
    for (const [nombre, lista] of Object.entries(por)) {
      const ultima = corridas.find((x) => x.name === nombre);
      if (ultima?.conclusion === 'failure') hallazgos.push({clave: `corrida-${nombre}`, tipo: 'alerta', titulo: `Falló "${nombre}" en GitHub`, texto: `${lista.length} corrida(s) fallida(s) en 24 h; la última: ${ultima.html_url}`});
    }
    if (!fallidas.length) ok.push('sin corridas fallidas en 24 h');
  }
}

// 4) ¿Se publicó algo en las últimas 36 horas?
const vistas = leer(path.join(RAIZ, 'lqns', 'vistas.json'), null);
const ultimo = vistas?.videos?.map((v) => new Date(v.publicado).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];
if (ultimo && Date.now() - ultimo > 36 * 3600 * 1000) hallazgos.push({clave: 'sin-publicar', tipo: 'alerta', titulo: 'Llevan más de 36 horas sin publicar', texto: `El último video público salió hace ${Math.round((Date.now() - ultimo) / 3600000)} horas. La meta exige constancia.`});
else if (ultimo) ok.push('hay publicaciones recientes');

// Avisos nuevos (sin repetir el mismo en 20 horas) y limpieza de los que ya se arreglaron
const claves = new Set(hallazgos.map((h) => h.clave));
for (const k of Object.keys(estado.alertas)) if (!claves.has(k)) delete estado.alertas[k];
const nuevas = [];
for (const h of hallazgos) {
  const antes = estado.alertas[h.clave] ? new Date(estado.alertas[h.clave]).getTime() : 0;
  if (Date.now() - antes < 20 * 3600 * 1000) continue;
  estado.alertas[h.clave] = new Date().toISOString();
  nuevas.push(h);
}
if (nuevas.length) {
  const lista = leer(RUTA_NOTIS, []);
  for (const h of nuevas) {
    lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal: 'lqns', canalNombre: 'Vigilante', tipo: h.tipo, titulo: h.titulo, texto: h.texto});
    avisarTelefono(h.tipo, h.titulo, h.texto);
  }
  fs.mkdirSync(RAIZ, {recursive: true});
  fs.writeFileSync(RUTA_NOTIS, JSON.stringify(lista.slice(0, 80), null, 2));
}
fs.writeFileSync(RUTA_ESTADO, JSON.stringify({...estado, diagnostico: globalThis.__diag, fecha: new Date().toISOString(), ok, problemas: hallazgos.map((h) => h.titulo)}, null, 2));
console.log('Vigilante. Bien:', ok.join(', ') || 'nada'); console.log('Problemas:', hallazgos.length ? hallazgos.map((h) => h.titulo).join(' | ') : 'ninguno');
process.exit(0);
