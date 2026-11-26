// Subida a YouTube: sube el video y lo deja PROGRAMADO (privado con fecha; YouTube lo publica solo a esa hora).
// Horarios: Shorts cada 3 horas y videos largos cada 12 horas (los slots del workflow están expresados en UTC).
// Desde el 2 nov 2026 Google ya no exige auditoría para publicar (developers.google.com/youtube/data/revision_history).
// Secretos: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN. Variable: ID (por ejemplo oficina-bloop).
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {avisarTelefono} from './aviso.mjs';
import {registrarSubida} from './subidos.mjs';
import {proximoHorario} from './horarios.mjs';
import {sinEnlaces} from './sin-enlaces.mjs';

const {ID} = process.env;
const salida = (clave, valor) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${String(valor).replace(/[\r\n]/g, ' ')}\n`); };
const YT_CLIENT_ID = (process.env.YT_CLIENT_ID || '').trim();
const YT_CLIENT_SECRET = (process.env.YT_CLIENT_SECRET || '').trim();
const CANAL = process.env.CANAL || 'lqns';
// Cada canal puede tener su propio YouTube: YT_REFRESH_TOKEN_<CANAL> (el de un canal nuevo) o, si no, YT_REFRESH_TOKEN.
const YT_REFRESH_TOKEN = (process.env.YT_REFRESH_TOKEN_CANAL || process.env.YT_REFRESH_TOKEN || '').trim();
// Próxima hora libre: al menos 40 min en el futuro. Las horas locales (UTC-4) pasadas a UTC.
// Modo de publicación (agentes/publicacion.json): "ahora" = público de inmediato; "programado" = privado con fecha y YouTube lo publica a su hora.
const MODO_CONFIG = (() => { try { return JSON.parse(fs.readFileSync(path.join('agentes', 'publicacion.json'), 'utf8')).modo; } catch { return 'programado'; } })();
const MODO = process.env.PUBLICACION_LOTE === '1' ? 'ahora' : MODO_CONFIG;
const ESTADO = path.join('oficina-salida', CANAL, 'estado.json');
const avisar = (tipo, titulo, texto) => {
  avisarTelefono(tipo === 'reporte' ? 'subido' : tipo, titulo, texto);
  try {
    const ruta = path.join('oficina-salida', 'notificaciones.json');
    const lista = fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : [];
    lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal: CANAL, tipo, titulo, texto});
    fs.writeFileSync(ruta, JSON.stringify(lista.slice(0, 80), null, 2));
  } catch { /* sin notificaciones */ }
};
const marcar = (texto, estado = 'esperando_decision') => {
  try {
    const e = JSON.parse(fs.readFileSync(ESTADO, 'utf8'));
    e.agentes = {...(e.agentes ?? {}), Publicador: {estado, actividad: 'pensando', tarea: texto}};
    e.actualizado = new Date().toISOString();
    fs.writeFileSync(ESTADO, JSON.stringify(e, null, 2));
  } catch { /* sin estado */ }
};

if (!ID) { console.log('Sin video que subir.'); salida('subido', 'false'); salida('motivo', 'sin_id'); process.exit(0); }
// En el lote 30, una subida ya confirmada en YouTube es idempotente: permite reintentar otras redes sin duplicar el Short.
if (process.env.PUBLICACION_LOTE === '1') {
  const slugLote = ID.replace(new RegExp('^' + CANAL + '-'), '');
  const rutaLote = path.join('oficina-salida', CANAL, 'producidos.json');
  let listLote = [];
  try { listLote = JSON.parse(fs.readFileSync(rutaLote, 'utf8')); } catch {}
  if (Array.isArray(listLote) && listLote.some((x) => String(x).toLowerCase() === slugLote.toLowerCase())) {
    console.log('YouTube ya confirmó este video del lote; no se vuelve a subir.');
    salida('subido', 'true'); salida('video_id', 'ya-confirmado'); salida('ya_existia', 'true');
    process.exit(0);
  }
}
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
  avisar('alerta', 'Publicación bloqueada: falta conectar YouTube', `El video "${ID}" está listo, pero faltan credenciales OAuth de YouTube. No requiere aprobación creativa: requiere configurar la conexión una sola vez.`);
  marcar(`Video "${ID}" listo, pero falta conectar YouTube para este canal: crea YT_CLIENT_ID, YT_CLIENT_SECRET y YT_REFRESH_TOKEN (o YT_REFRESH_TOKEN_<CANAL>) como secretos del repositorio. JEFA: un video que no se sube no existe.`);
  console.log('Faltan los secretos de YouTube. Se omite la subida.');
  salida('subido', 'false'); salida('motivo', 'credenciales_ausentes');
  process.exit(0);
}

try {
  const rutaGuion = path.join('guion', 'serie', `${ID}.json`);
  // Compatibilidad: el render del lote puede dejar un sufijo literal "\\n" tras el JSON.
  const contenidoGuion = fs.readFileSync(rutaGuion, 'utf8').replace(/\\\\n\\s*$/, '');
  const guion = JSON.parse(contenidoGuion);
  const claveEditorial = (x) => String(x ?? '').toLowerCase().normalize('NFD').replace(/[\\u0300-\\u036f]/g, '').replace(/[^a-z0-9]+/g, '');
  if (process.env.MODO_PRUEBA !== '1' && [ID, guion.titulo, guion.publicacion?.titulo].some((x) => /(bloop|lituya)/.test(claveEditorial(x)))) {
    throw new Error('SUBIDA BLOQUEADA: Bloop/The Bloop y Lituya Bay están excluidos permanentemente; no se pueden repetir con otro título.');
  }
  const archivo = path.join('out', 'serie', `${ID}.mp4`);
  const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration:stream=codec_type,width,height', '-of', 'json', archivo], {encoding: 'utf8'});
  if (probe.status !== 0) throw new Error(`No pude verificar el MP4 antes de subirlo: ${probe.stderr || probe.error}`);
  const meta = JSON.parse(probe.stdout);
  const duracion = Number(meta.format?.duration);
  const videoStream = (meta.streams ?? []).find((x) => x.codec_type === 'video');
  if (!videoStream || !Number.isFinite(duracion)) throw new Error('El MP4 no contiene metadatos de video válidos.');
  if (guion.formato === 'short' && (duracion > 180 || Math.abs(videoStream.width / videoStream.height - 9 / 16) > 0.01)) throw new Error(`SUBIDA BLOQUEADA: Short debe ser 9:16 vertical y durar máximo 180 s; detectado ${videoStream.width}x${videoStream.height}, ${duracion.toFixed(1)} s.`);
  if (guion.formato === 'largo' && (duracion < 480 || Math.abs(videoStream.width / videoStream.height - 16 / 9) > 0.01)) throw new Error(`SUBIDA BLOQUEADA: largo debe ser 16:9 horizontal y durar mínimo 8 minutos; detectado ${videoStream.width}x${videoStream.height}, ${duracion.toFixed(1)} s.`);
  if (!['short', 'largo'].includes(guion.formato)) throw new Error(`Formato desconocido: ${guion.formato}`);
  const bytes = fs.readFileSync(archivo);
  const programado = proximoHorario(guion.formato);

  const tokenRespuesta = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: {'Content-Type': 'application/x-www-form-urlencoded'},
    body: new URLSearchParams({client_id: YT_CLIENT_ID, client_secret: YT_CLIENT_SECRET, refresh_token: YT_REFRESH_TOKEN, grant_type: 'refresh_token'}),
  });
  if (!tokenRespuesta.ok) throw new Error(`Google no dio el permiso (${tokenRespuesta.status}): ${(await tokenRespuesta.text()).slice(0, 200)}`);
  const {access_token: token} = await tokenRespuesta.json();

  const inicio = await fetch('https://www.googleapis.com/upload/youtube/v3/videos?uploadType=resumable&part=snippet,status', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Length': String(bytes.length),
      'X-Upload-Content-Type': 'video/mp4',
    },
    body: JSON.stringify({
      snippet: {title: guion.publicacion.titulo.slice(0, 100), description: sinEnlaces(guion.publicacion.descripcion).slice(0, 4900), categoryId: '27', defaultLanguage: 'es'},
      status: MODO === 'ahora' ? {privacyStatus: 'public', selfDeclaredMadeForKids: false} : {privacyStatus: 'private', publishAt: programado.toISOString(), selfDeclaredMadeForKids: false},
    }),
  });
  if (!inicio.ok) throw new Error(`YouTube no aceptó empezar la subida (${inicio.status}): ${(await inicio.text()).slice(0, 300)}`);
  const destino = inicio.headers.get('location');
  if (!destino) throw new Error('YouTube no devolvió dónde subir el archivo.');

  const subida = await fetch(destino, {method: 'PUT', headers: {'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length)}, body: bytes});
  if (!subida.ok) throw new Error(`La subida falló (${subida.status}): ${(await subida.text()).slice(0, 300)}`);
  const video = await subida.json();
  const cuando = MODO === 'ahora' ? 'PÚBLICO ahora mismo' : 'PROGRAMADO para ' + programado.toLocaleString('es-DO', {timeZone: 'America/Santo_Domingo'}) + ' (hora RD)';
  marcar('Subió "' + guion.titulo + '" y quedó ' + cuando + ': https://youtu.be/' + video.id, 'libre');
  // La marca de producido se escribe SOLO tras la confirmación real de YouTube.
  try {
    const rutaProducidos = path.join('oficina-salida', CANAL, 'producidos.json');
    const listaProducidos = fs.existsSync(rutaProducidos) ? JSON.parse(fs.readFileSync(rutaProducidos, 'utf8')) : [];
    const slug = ID.replace(new RegExp('^' + CANAL + '-'), '');
    if (!listaProducidos.includes(slug)) fs.writeFileSync(rutaProducidos, JSON.stringify([...listaProducidos, slug], null, 2));
  } catch (e) { console.log('YouTube confirmó la subida, pero no pude actualizar producidos.json: ' + String(e.message ?? e).slice(0, 120)); }
  try { const total = registrarSubida({canal: CANAL, id: video.id, titulo: guion.titulo}); console.log('Videos subidos en total: ' + total); } catch { /* el contador no debe tumbar la subida */ }
  avisar('reporte', 'Video subido a YouTube', '"' + guion.titulo + '" quedó ' + cuando + ': https://youtu.be/' + video.id);
  console.log('Subido (' + MODO + '): https://youtu.be/' + video.id);
  salida('subido', 'true'); salida('video_id', video.id); salida('url', `https://youtu.be/${video.id}`);
} catch (e) {
  marcar(`No pude subir "${ID}": ${String(e.message ?? e).slice(0, 220)}`);
  if (/invalid_grant|401|403/.test(String(e.message))) avisar('permiso', 'Necesito tu permiso: reconectar YouTube', `YouTube rechazó la autorización (${String(e.message).slice(0, 120)}). Hay que volver a sacar el token con scripts/token-youtube.mjs y pegarlo en YT_REFRESH_TOKEN.`);
  else avisar('alerta', 'No pude subir un video', `No pude subir "${ID}": ${String(e.message ?? e).slice(0, 160)}`);
  console.error('ERROR al subir:', e.message ?? e);
  salida('subido', 'false'); salida('motivo', String(e.message ?? e).slice(0, 180));
  process.exit(1);
}
