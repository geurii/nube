// Subida a YouTube (SIN PROBAR: necesita claves que solo tú puedes crear). Sube el video como PRIVADO.
// Google deja privados los videos subidos por una app sin auditoría (videos.insert, proyectos creados después del 28 de julio de 2020):
// publicarlos (o programarlos) lo haces tú en Studio, o consigues la auditoría de Google.
// Secretos: YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN. Variable: ID (por ejemplo oficina-bloop).
import fs from 'node:fs';
import path from 'node:path';

const {YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, ID} = process.env;
const ESTADO = path.join('oficina-salida', 'estado.json');
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
  marcar(`Video "${ID}" listo, pero falta conectar YouTube: crea YT_CLIENT_ID, YT_CLIENT_SECRET y YT_REFRESH_TOKEN como secretos del repositorio. JEFA: un video que no se sube no existe.`);
  console.log('Faltan los secretos de YouTube. Se omite la subida.');
  process.exit(0);
}

try {
  const guion = JSON.parse(fs.readFileSync(path.join('guion', 'serie', `${ID}.json`), 'utf8'));
  const archivo = path.join('out', 'serie', `${ID}.mp4`);
  const bytes = fs.readFileSync(archivo);

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
      status: {privacyStatus: 'private', selfDeclaredMadeForKids: false},
    }),
  });
  if (!inicio.ok) throw new Error(`YouTube no aceptó empezar la subida (${inicio.status}): ${(await inicio.text()).slice(0, 300)}`);
  const destino = inicio.headers.get('location');
  if (!destino) throw new Error('YouTube no devolvió dónde subir el archivo.');

  const subida = await fetch(destino, {method: 'PUT', headers: {'Content-Type': 'video/mp4', 'Content-Length': String(bytes.length)}, body: bytes});
  if (!subida.ok) throw new Error(`La subida falló (${subida.status}): ${(await subida.text()).slice(0, 300)}`);
  const video = await subida.json();
  marcar(`Subió "${guion.titulo}" como PRIVADO: https://youtu.be/${video.id}. Google exige auditoría para publicarlo solo; publícalo tú en Studio.`, 'libre');
  console.log(`Subido como privado: https://youtu.be/${video.id}`);
} catch (e) {
  marcar(`No pude subir "${ID}": ${String(e.message ?? e).slice(0, 220)}`);
  console.error('ERROR al subir:', e.message ?? e);
  process.exit(1);
}
