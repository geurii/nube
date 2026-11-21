// Subida a YouTube: sube el video y lo deja PROGRAMADO (privado con fecha; YouTube lo publica solo a esa hora).
// Horarios (hora de República Dominicana, UTC-4): Shorts a las 00:00 y 12:00; videos largos a las 18:00.
// Desde el 2 nov 2026 Google ya no exige auditoría para publicar (developers.google.com/youtube/data/revision_history).
// Secretos: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN. Variable: ID (por ejemplo oficina-bloop).
import fs from 'node:fs';
import path from 'node:path';
import {avisarTelefono} from './aviso.mjs';

const {YT_CLIENT_ID, YT_CLIENT_SECRET, ID} = process.env;
const CANAL = process.env.CANAL || 'lqns';
// Cada canal puede tener su propio YouTube: YT_REFRESH_TOKEN_<CANAL> (el de un canal nuevo) o, si no, YT_REFRESH_TOKEN.
const YT_REFRESH_TOKEN = process.env.YT_REFRESH_TOKEN_CANAL || process.env.YT_REFRESH_TOKEN;
// Próxima hora libre: al menos 40 min en el futuro. Las horas locales (UTC-4) pasadas a UTC.
const proximoHorario = (formato) => {
  const horasUtc = formato === 'largo' ? [22] : [4, 16];
  const ahora = Date.now() + 40 * 60000;
  for (let d = 0; d < 3; d++) {
    for (const h of horasUtc) {
      const t = new Date(ahora); t.setUTCDate(t.getUTCDate() + d); t.setUTCHours(h, 0, 0, 0);
      if (t.getTime() >= ahora) return t;
    }
  }
  return new Date(ahora + 3600000);
};
// Modo de publicación (agentes/publicacion.json): "ahora" = público de inmediato; "programado" = privado con fecha y YouTube lo publica a su hora.
const MODO = (() => { try { return JSON.parse(fs.readFileSync(path.join('agentes', 'publicacion.json'), 'utf8')).modo; } catch { return 'programado'; } })();
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

if (!ID) { console.log('Sin video que subir.'); process.exit(0); }
if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !YT_REFRESH_TOKEN) {
  avisar('permiso', 'Necesito tu permiso: conectar YouTube', `El video "${ID}" está listo pero faltan los secretos de YouTube de este canal.`);
  marcar(`Video "${ID}" listo, pero falta conectar YouTube para este canal: crea YT_CLIENT_ID, YT_CLIENT_SECRET y YT_REFRESH_TOKEN (o YT_REFRESH_TOKEN_<CANAL>) como secretos del repositorio. JEFA: un video que no se sube no existe.`);
  console.log('Faltan los secretos de YouTube. Se omite la subida.');
  process.exit(0);
}

try {
  const guion = JSON.parse(fs.readFileSync(path.join('guion', 'serie', `${ID}.json`), 'utf8'));
  const archivo = path.join('out', 'serie', `${ID}.mp4`);
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
      snippet: {title: guion.publicacion.titulo.slice(0, 100), description: guion.publicacion.descripcion.slice(0, 4900), categoryId: '27', defaultLanguage: 'es'},
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
  avisar('reporte', 'Video subido a YouTube', '"' + guion.titulo + '" quedó ' + cuando + ': https://youtu.be/' + video.id);
  console.log('Subido (' + MODO + '): https://youtu.be/' + video.id);
} catch (e) {
  marcar(`No pude subir "${ID}": ${String(e.message ?? e).slice(0, 220)}`);
  if (/invalid_grant|401|403/.test(String(e.message))) avisar('permiso', 'Necesito tu permiso: reconectar YouTube', `YouTube rechazó la autorización (${String(e.message).slice(0, 120)}). Hay que volver a sacar el token con scripts/token-youtube.mjs y pegarlo en YT_REFRESH_TOKEN.`);
  else avisar('alerta', 'No pude subir un video', `No pude subir "${ID}": ${String(e.message ?? e).slice(0, 160)}`);
  console.error('ERROR al subir:', e.message ?? e);
  process.exit(1);
}
