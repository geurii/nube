// Calcula qué videos YA subidos a YouTube todavía no están en Facebook, Instagram o TikTok (los largos NO van a esas redes).
// Imprime los nombres separados por espacio. Máximo 3 intentos por video (para no gastar minutos ni llenar de avisos); solo videos de los últimos 12 días
// (el MP4 se guarda 14 días en GitHub). Uso: CANAL=lqns node agentes/redes-pendientes.mjs [--contar]  (--contar suma un intento a cada video listado)
import fs from 'node:fs';
import path from 'node:path';

const CANAL = process.env.CANAL || 'lqns';
const dir = path.join('oficina-salida', CANAL);
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const subidos = leer(path.join(dir, 'subidos.json'), {videos: []}).videos ?? [];
const registros = ['facebook', 'instagram', 'tiktok'].map((r) => leer(path.join(dir, `${r}.json`), {posts: []}).posts ?? []);
const intentosRuta = path.join(dir, 'redes-intentos.json');
const intentos = leer(intentosRuta, {});
const norm = (t) => String(t ?? '').trim().toLowerCase();
const titulosSubidos = new Map(subidos.map((v) => [norm(v.titulo), Date.parse(v.fecha)]));
const pendientes = [];
for (const f of fs.existsSync(path.join('guion', 'serie')) ? fs.readdirSync(path.join('guion', 'serie')) : []) {
  const m = /^(lqns-.+)\.json$/.exec(f);
  if (!m || f.endsWith('.palabras.json')) continue;
  const id = m[1];
  const g = leer(path.join('guion', 'serie', f), null);
  if (!g || g.formato === 'largo') continue; // los videos largos NO van a Facebook, Instagram ni TikTok
  const fecha = titulosSubidos.get(norm(g.publicacion?.titulo ?? g.titulo));
  if (!fecha || Date.now() - fecha > 12 * 86400000) continue; // no está en YouTube o ya venció su MP4
  if (registros.every((posts) => posts.some((p) => p.id === id))) continue; // ya está en las tres redes
  if ((intentos[id] ?? 0) >= 3) continue;
  pendientes.push(id.replace(/^lqns-/, ''));
}
if (process.argv.includes('--contar') && pendientes.length) {
  for (const s of pendientes) intentos[`lqns-${s}`] = (intentos[`lqns-${s}`] ?? 0) + 1;
  fs.writeFileSync(intentosRuta, JSON.stringify(intentos, null, 2));
}
console.log(pendientes.join(' '));
