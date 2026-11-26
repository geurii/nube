// npm run lote            → voz + render + versión <10 MB de TODA la serie (guion/serie/*.json)
// npm run lote -- serie-s1 serie-s2     → solo esos
// Añade --forzar para rehacer lo que ya existe.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const forzar = args.includes('--forzar');
const sinVoz = args.includes('--sin-voz'); // en la nube: la voz ya viene hecha desde la laptop
const dirSerie = path.join(raiz, 'guion', 'serie');
const todos = fs.readdirSync(dirSerie).filter((f) => /\.json$/.test(f) && !/palabras/.test(f)).map((f) => f.replace(/\.json$/, '')).sort();
const ids = args.filter((a) => !a.startsWith('--')).length ? args.filter((a) => !a.startsWith('--')) : todos;
const salida = path.join(raiz, 'out', 'serie');
fs.mkdirSync(salida, {recursive: true});

const correr = (script, extra) => {
  // El supervisor termina también Chrome/FFmpeg y demás procesos descendientes si se atascan.
  const r = spawnSync(process.execPath, ['scripts/ejecutar-hijo.mjs', path.join('scripts', script), ...extra], {
    cwd: raiz, stdio: 'inherit', timeout: 31 * 60 * 1000, killSignal: 'SIGKILL',
  });
  if (r.error || r.status !== 0) throw new Error(`${script} falló: ${r.error?.message ?? r.signal ?? r.status}`);
};
const duracion = (ruta) => {
  const r = spawnSync('ffmpeg', ['-hide_banner', '-i', ruta], {encoding: 'utf8', timeout: 60000});
  const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(r.stderr ?? '');
  if (r.error || r.status === null || !m) throw new Error(`No se pudo medir la duración de ${ruta}: ${r.error?.message ?? 'ffmpeg sin duración'}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
};

// Reduce el MP4 a menos de 9,4 MB (límite de subida de 10 MB) ajustando la tasa de bits.
const comprimir = (entrada, destino, maxMB = 9.4, reducir = false, horizontal = false) => {
  const dur = duracion(entrada);
  let kbps = Math.floor((maxMB * 8 * 1024 * 1024) / dur / 1000) - 100;
  // Videos largos: 540x960 con píxeles nítidos para que quepan en 10 MB sin perder nitidez.
  const filtro = reducir ? ['-vf', `scale=${horizontal ? '960:540' : '540:960'}:flags=neighbor,format=yuv420p`] : [];
  for (let i = 0; i < 4; i++) {
    const r = spawnSync('ffmpeg', ['-y', '-loglevel', 'error', '-i', entrada, ...filtro, '-c:v', 'libx264', '-preset', 'medium', '-b:v', `${kbps}k`, '-maxrate', `${Math.floor(kbps * 1.25)}k`, '-bufsize', `${kbps * 2}k`, '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart', destino], {encoding: 'utf8', timeout: 5 * 60 * 1000, killSignal: 'SIGKILL'});
    if (r.error || r.status !== 0) throw new Error(r.stderr || r.error?.message || 'FFmpeg terminó sin éxito');
    const mb = fs.statSync(destino).size / 1024 / 1024;
    console.log(`  compresión ${kbps} kbps → ${mb.toFixed(2)} MB`);
    if (mb <= maxMB + 0.3) return mb;
    kbps = Math.floor(kbps * 0.85);
  }
  return fs.statSync(destino).size / 1024 / 1024;
};

for (const id of ids) {
  const guion = path.join('guion', 'serie', `${id}.json`);
  const mp4 = path.join(salida, `${id}.mp4`);
  const ligero = path.join(salida, `${id}-subida.mp4`);
  console.log(`\n===== ${id} =====`);
  const datos = JSON.parse(fs.readFileSync(path.join(raiz, guion), 'utf8'));
  const audio = path.join(raiz, 'public', datos.audio);
  if (sinVoz) {
    if (!fs.existsSync(audio)) throw new Error(`Falta la voz ${datos.audio}: genérala en tu laptop con npm run voz`);
  } else if (forzar || !fs.existsSync(audio)) correr('voz.mjs', ['--guion', guion]);
  if (forzar || !fs.existsSync(mp4)) correr('render.mjs', ['--guion', guion, '--salida', mp4, '--escala', '1']);
  if (forzar || !fs.existsSync(ligero)) {
    const mb = comprimir(mp4, ligero, 9.4, datos.formato === 'largo', datos.orientacion === 'horizontal');
    console.log(`  ✔ ${path.relative(raiz, ligero)} (${mb.toFixed(2)} MB)`);
  }
}
console.log('\nLote terminado.');
