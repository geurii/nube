// Analítica real del canal (YouTube Analytics API): suscriptores, horas vistas, retención por video y avance hacia la monetización.
// Necesita que el token tenga los permisos youtube.readonly y yt-analytics.readonly (se sacan con scripts/token-youtube.mjs) y que la
// "YouTube Analytics API" esté activada en Google Cloud. Si falta algo, NO se detiene: deja el motivo en analitica.json (y el Vigilante avisa).
// Resultado: oficina-salida/<canal>/analitica.json. Variables: CANAL, YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN.
import fs from 'node:fs';
import path from 'node:path';

const CANAL = (process.env.CANAL || 'lqns').trim();
const {YT_CLIENT_ID, YT_CLIENT_SECRET} = process.env;
const REFRESH = process.env.YT_REFRESH_TOKEN_CANAL || process.env.YT_REFRESH_TOKEN;
const carpeta = path.resolve('oficina-salida', CANAL);
const RUTA = path.join(carpeta, 'analitica.json');
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const previo = leer(RUTA, {});
const guardarError = (motivo) => { try { fs.mkdirSync(carpeta, {recursive: true}); fs.writeFileSync(RUTA, JSON.stringify({...previo, error: String(motivo).slice(0, 220), fechaError: new Date().toISOString()}, null, 2)); } catch { /* sin carpeta */ } console.warn('Analítica no disponible:', motivo); process.exit(0); };

if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !REFRESH) guardarError('faltan los secretos de YouTube');
const tk = await fetch('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: REFRESH, grant_type: 'refresh_token'}), signal: AbortSignal.timeout(30000)}).catch(() => null);
if (!tk?.ok) guardarError(`el token de YouTube no sirvió (${tk?.status ?? 'sin red'})`);
const token = (await tk.json()).access_token;
const H = {Authorization: `Bearer ${token}`};
const dia = (d) => new Date(Date.now() - d * 86400000).toISOString().slice(0, 10);
const informe = async (params) => {
  const r = await fetch(`https://youtubeanalytics.googleapis.com/v2/reports?ids=channel==MINE&${new URLSearchParams(params)}`, {headers: H, signal: AbortSignal.timeout(30000)});
  if (!r.ok) throw new Error(`analítica ${r.status}: ${(await r.text()).slice(0, 160)}`);
  const j = await r.json();
  const cols = (j.columnHeaders ?? []).map((c) => c.name);
  return (j.rows ?? []).map((fila) => Object.fromEntries(cols.map((c, i) => [c, fila[i]])));
};

try {
  // Suscriptores totales (API de datos)
  const ch = await fetch('https://www.googleapis.com/youtube/v3/channels?part=statistics&mine=true', {headers: H, signal: AbortSignal.timeout(30000)});
  const chj = ch.ok ? await ch.json() : null;
  const est = chj?.items?.[0]?.statistics;
  const subs = est && !est.hiddenSubscriberCount ? Number(est.subscriberCount) : null;

  const [r28] = await informe({startDate: dia(28), endDate: dia(0), metrics: 'views,estimatedMinutesWatched,averageViewDuration,averageViewPercentage,subscribersGained,subscribersLost'});
  const [r365] = await informe({startDate: dia(365), endDate: dia(0), metrics: 'estimatedMinutesWatched,views'});
  let tipos = [];
  try { tipos = await informe({startDate: dia(90), endDate: dia(0), metrics: 'views,estimatedMinutesWatched', dimensions: 'creatorContentType'}); } catch { /* algunos canales no lo permiten */ }
  const vistasShorts90 = Number(tipos.find((t) => /SHORT/i.test(t.creatorContentType))?.views ?? 0);
  const porVideo = (await informe({startDate: dia(90), endDate: dia(0), metrics: 'views,averageViewPercentage,averageViewDuration,estimatedMinutesWatched,subscribersGained', dimensions: 'video', sort: '-views', maxResults: '15'}))
    .map((v) => ({id: v.video, vistas: v.views, retencionPct: Math.round(v.averageViewPercentage * 10) / 10, duracionMediaSeg: Math.round(v.averageViewDuration), minutos: v.estimatedMinutesWatched, suscriptoresGanados: v.subscribersGained}));
  const horas365 = Math.round(((r365?.estimatedMinutesWatched ?? 0) / 60) * 10) / 10;
  const meta = {suscriptores: subs, faltanSuscriptores: subs === null ? null : Math.max(0, 1000 - subs), horas12Meses: horas365, faltanHoras: Math.max(0, Math.round((4000 - horas365) * 10) / 10), vistasShorts90, faltanVistasShorts: Math.max(0, 10_000_000 - vistasShorts90), requisitos: '1.000 suscriptores y (4.000 horas en 12 meses o 10 millones de vistas de Shorts en 90 días)'};
  fs.mkdirSync(carpeta, {recursive: true});
  fs.writeFileSync(RUTA, JSON.stringify({fecha: new Date().toISOString(), ultimos28Dias: r28 ?? {}, meta, porVideo}, null, 2));
  console.log(`Analítica: ${subs ?? '?'} suscriptores, ${horas365} h en 12 meses, ${vistasShorts90} vistas de Shorts en 90 días.`);
} catch (e) { guardarError(e.message); }
process.exit(0);
