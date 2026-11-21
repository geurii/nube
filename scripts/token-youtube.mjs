// Saca el "token de renovación" de YouTube para un canal. Se corre UNA vez por canal, en tu PC.
// Uso: node scripts/token-youtube.mjs [ruta-del-client_secret.json]
// Si no pasas la ruta, busca el client_secret*.json más reciente en Descargas.
// Las claves NO se muestran en pantalla: se guardan en un archivo en el Escritorio para que las pegues tú en GitHub.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import crypto from 'node:crypto';
import {execFile} from 'node:child_process';

const descargas = path.join(os.homedir(), 'Downloads');
let ruta = process.argv[2];
if (!ruta) {
  const candidatos = fs.readdirSync(descargas).filter((f) => /^client_secret.*\.json$/i.test(f))
    .map((f) => ({f, t: fs.statSync(path.join(descargas, f)).mtimeMs})).sort((a, b) => b.t - a.t);
  if (!candidatos.length) { console.error('No encontré client_secret*.json en Descargas. Pasa la ruta como argumento.'); process.exit(1); }
  ruta = path.join(descargas, candidatos[0].f);
}
const cred = JSON.parse(fs.readFileSync(ruta, 'utf8'));
const c = cred.installed;
if (!c?.client_id || !c?.client_secret) { console.error('Ese JSON no es de una "App de escritorio".'); process.exit(1); }

const estado = crypto.randomBytes(16).toString('hex');
const servidor = http.createServer();
await new Promise((r) => servidor.listen(0, '127.0.0.1', r));
const redirect = `http://127.0.0.1:${servidor.address().port}`;
const url = 'https://accounts.google.com/o/oauth2/v2/auth?' + new URLSearchParams({
  client_id: c.client_id, redirect_uri: redirect, response_type: 'code', access_type: 'offline', prompt: 'consent',
  scope: 'https://www.googleapis.com/auth/youtube.upload https://www.googleapis.com/auth/youtube.readonly https://www.googleapis.com/auth/yt-analytics.readonly', state: estado,
});
console.log('Se abre el navegador. Elige la cuenta DUEÑA DEL CANAL y acepta. (Si no se abre, copia este enlace)\n' + url + '\n');
execFile('cmd', ['/c', 'start', '', url.replace(/&/g, '^&')], () => {});

const code = await new Promise((resolve, reject) => {
  const t = setTimeout(() => reject(new Error('Pasaron 5 minutos sin respuesta.')), 300000);
  servidor.on('request', (req, res) => {
    const q = new URL(req.url, redirect).searchParams;
    if (!q.get('code') && !q.get('error')) { res.end(); return; }
    res.setHeader('content-type', 'text/html; charset=utf-8');
    if (q.get('state') !== estado || q.get('error')) { res.end('Algo falló. Cierra esta pestaña y vuelve a intentarlo.'); clearTimeout(t); reject(new Error(q.get('error') || 'estado distinto')); return; }
    res.end('Listo. Ya puedes cerrar esta pestaña y volver a Claude.');
    clearTimeout(t); resolve(q.get('code'));
  });
});
servidor.close();

const r = await fetch('https://oauth2.googleapis.com/token', {
  method: 'POST', headers: {'content-type': 'application/x-www-form-urlencoded'},
  body: new URLSearchParams({code, client_id: c.client_id, client_secret: c.client_secret, redirect_uri: redirect, grant_type: 'authorization_code'}),
});
const j = await r.json();
if (!j.refresh_token) { console.error('Google no devolvió el token:', j.error_description || j.error || 'sin detalle'); process.exit(1); }

const escritorios = [path.join(os.homedir(), 'OneDrive', 'Desktop'), path.join(os.homedir(), 'Desktop')];
const escritorio = escritorios.find((d) => fs.existsSync(d)) || os.homedir();
const salida = path.join(escritorio, 'claves-youtube-BORRAR-DESPUES.txt');
fs.writeFileSync(salida,
  `Pega cada valor en GitHub > nube > Settings > Secrets and variables > Actions > New repository secret\n\n` +
  `YT_CLIENT_ID\n${c.client_id}\n\nYT_CLIENT_SECRET\n${c.client_secret}\n\nYT_REFRESH_TOKEN\n${j.refresh_token}\n\n` +
  `Cuando los hayas pegado, BORRA este archivo y el client_secret*.json de Descargas.\n`);
console.log('Listo. Las claves quedaron en el Escritorio: ' + salida + '\n(no se muestran aquí por seguridad)');
