// npm run render
// Lee guion/guion.json (+ guion/palabras.json si existe), elige la música según la
// plataforma, comprueba la estructura hook / revelación / veredicto y genera el MP4.
//
// Opciones:
//   npm run render -- --plataforma youtube      (misma historia, música para YouTube)
//   npm run render -- --salida out/mi-video.mp4
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {bundle} from '@remotion/bundler';
import {ensureBrowser, renderMedia, selectComposition} from '@remotion/renderer';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcion = (nombre) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 ? args[i + 1] : undefined;
};

const leerJson = (ruta, porDefecto) =>
  fs.existsSync(ruta) ? JSON.parse(fs.readFileSync(ruta, 'utf8')) : porDefecto;

// --guion guion/serie/s1.json  (por defecto guion/guion.json)
const rutaGuion = path.resolve(raiz, opcion('guion') ?? path.join('guion', 'guion.json'));
const rutaPalabras = rutaGuion.endsWith(`${path.sep}guion.json`) ? path.join(path.dirname(rutaGuion), 'palabras.json') : rutaGuion.replace(/\.json$/, '.palabras.json');
const guion = leerJson(rutaGuion);
if (!guion) {
  console.error('No existe guion/guion.json');
  process.exit(1);
}
const palabras = leerJson(rutaPalabras, []);
if (!['short', 'largo'].includes(guion.formato)) throw new Error(`Formato inválido: ${guion.formato}`);
// El formato manda: el Short siempre es vertical y el largo siempre horizontal.
guion.orientacion = guion.formato === 'short' ? 'vertical' : 'horizontal';
if (opcion('plataforma')) guion.plataforma = opcion('plataforma');

const existeEnPublic = (rel) => rel && fs.existsSync(path.join(raiz, 'public', rel));

// --- Comprobaciones de archivos -------------------------------------------
const avisos = [];
const errores = [];

if (!existeEnPublic(guion.audio)) {
  errores.push(`Falta la narración: public/${guion.audio}. Grábala o genera una de prueba con: npm run voz`);
}

// Música según plataforma (-20 dB). TikTok/Instagram: tu pista (Kerosene o Transgender).
// YouTube: pista libre de derechos (Kerosene se bloquea).
const MUSICA_POR_PLATAFORMA = {
  tiktok: 'musica/tiktok.mp3',
  instagram: 'musica/tiktok.mp3',
  youtube: 'musica/youtube.mp3',
};
let musica = guion.musica || MUSICA_POR_PLATAFORMA[guion.plataforma] || null;
if (musica && !existeEnPublic(musica)) {
  avisos.push(
    `No encontré la música public/${musica}. El video se renderiza SIN música. ` +
      (guion.plataforma === 'youtube'
        ? 'Pon una pista libre de derechos en public/musica/youtube.mp3.'
        : 'Pon Kerosene o Transgender (Crystal Castles) en public/musica/tiktok.mp3.'),
  );
  musica = null;
}

for (const e of guion.escenas) {
  const lista = Array.isArray(e.fondo) ? e.fondo : [e.fondo];
  for (const f of lista) {
    if (/\.(mp4|webm|mov|m4v|jpe?g|png|webp|gif|avif)$/i.test(f) && !existeEnPublic(f)) {
      errores.push(`Falta el fondo public/${f} (escena "${e.texto.slice(0, 40)}...")`);
    }
  }
}

// Personaje: si hay un PNG transparente en public/personaje/personaje.png se usa ese.
guion.personaje = guion.personaje ?? {};
if (!guion.personaje.imagen && existeEnPublic('personaje/personaje.png')) {
  guion.personaje.imagen = 'personaje/personaje.png';
}
if (guion.personaje.imagen && !existeEnPublic(guion.personaje.imagen)) {
  avisos.push(`No encontré el personaje public/${guion.personaje.imagen}; uso el dibujado.`);
  guion.personaje.imagen = null;
}
if (palabras.length === 0) {
  avisos.push('guion/palabras.json está vacío: los tiempos de las palabras se estiman. Para tiempos exactos usa npm run voz.');
}

if (errores.length) {
  errores.forEach((e) => console.error('ERROR:', e));
  process.exit(1);
}

// --- Bundle + metadatos ----------------------------------------------------
const slug = guion.titulo
  .toLowerCase()
  .normalize('NFD')
  .replace(/[̀-ͯ]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/^-|-$/g, '');
// Prueba rápida: npm run render -- --prueba 0-8   (renderiza solo del segundo 0 al 8)
const prueba = opcion('prueba')?.split('-').map(Number);
const salida = path.resolve(
  raiz,
  opcion('salida') ??
    path.join('out', `${slug}-${guion.plataforma}${prueba ? `-prueba-${prueba[0]}-${prueba[1]}s` : ''}.mp4`),
);
fs.mkdirSync(path.dirname(salida), {recursive: true});

console.log(`\nLo Que No Sabías · "${guion.titulo}" · ${guion.formato} · ${guion.plataforma}`);

// --- Chrome ----------------------------------------------------------------
// Remotion descarga su propio Chrome en node_modules/.remotion. En Windows, si la
// ruta del proyecto es muy larga (>260 caracteres en total) Chrome no arranca, así
// que lo copiamos a una ruta corta y usamos esa copia.
let browserExecutable;
if (process.platform === 'win32') {
  const chromeLargo = path.join(
    raiz, 'node_modules', '.remotion', 'chrome-headless-shell', 'win64',
    'chrome-headless-shell-win64', 'chrome-headless-shell.exe',
  );
  if (chromeLargo.length > 240) {
    const corto = path.join(process.env.LOCALAPPDATA || raiz, 'lqns-chrome');
    const exeCorto = path.join(corto, 'chrome-headless-shell.exe');
    if (!fs.existsSync(exeCorto)) {
      if (!fs.existsSync(chromeLargo)) {
        console.log('Descargando Chrome para Remotion (solo la primera vez)...');
        await ensureBrowser();
      }
      console.log('La ruta del proyecto es muy larga: copiando Chrome a', corto);
      fs.cpSync(path.dirname(chromeLargo), corto, {recursive: true});
    }
    browserExecutable = exeCorto;
  }
}

console.log('Empaquetando...');
const serveUrl = await bundle({
  entryPoint: path.join(raiz, 'src', 'index.ts'),
  publicDir: path.join(raiz, 'public'),
});

const inputProps = {guion, palabras, musica};
// Largo = horizontal 16:9 (1920x1080). Shorts = vertical 9:16 (1080x1920).
const horizontal = guion.orientacion === 'horizontal';
const composition = await selectComposition({
  serveUrl,
  id: guion.composicion === 'ninos' ? (horizontal ? 'ColoresNinosLargo' : 'ColoresNinos') : horizontal ? 'LargoHorizontal' : 'LoQueNoSabias',
  inputProps,
  browserExecutable,
  timeoutInMilliseconds: 120000,
});
const tiempos = composition.props.tiempos;
const total = tiempos.duracionTotal;
if (guion.formato === 'short' && total > 65) throw new Error(`PUBLICACIÓN BLOQUEADA: Short de ${total.toFixed(1)} s; el máximo es 65 s.`);
if (guion.formato === 'largo' && total < 480) throw new Error(`PUBLICACIÓN BLOQUEADA: video largo de ${total.toFixed(1)} s; el mínimo es 480 s (8 minutos).`);

// --- Comprobación de estructura -------------------------------------------
const pct = (s) => `${Math.round((s / total) * 100)}%`;
console.log(`\nDuración: ${total.toFixed(1)} s  (${composition.durationInFrames} frames a ${composition.fps} fps)`);
console.log('Escenas:');
for (const e of tiempos.escenas) {
  console.log(
    `  ${String(e.inicio.toFixed(1)).padStart(5)}s → ${String(e.fin.toFixed(1)).padStart(5)}s  ${pct(e.inicio).padStart(4)}  ${e.tipo.padEnd(10)} ${(Array.isArray(e.fondo) ? `${e.fondo.length} fondos` : e.fondo).padEnd(22)} ${e.texto.slice(0, 48)}${e.texto.length > 48 ? '…' : ''}`,
  );
}

const primera = tiempos.escenas[0];
if (guion.composicion === 'ninos') {
  // Shorts infantiles: otra estructura (gancho visual < 3 s, el color se revela, cierre corto)
  const h = primera.palabras;
  if (h.length && h[h.length - 1].fin > 3.5) avisos.push(`El gancho termina en ${h[h.length - 1].fin.toFixed(1)} s; en niños debe caber en ~3 s.`);
  if (total < 15 || total > 40) avisos.push(`Duración ${total.toFixed(1)} s: los Shorts de colores que funcionan duran 17-37 s.`);
} else {
if (primera.tipo !== 'hook') avisos.push('La primera escena debería ser tipo "hook".');
const hook = tiempos.escenas.find((e) => e.tipo === 'hook');
if (hook && hook.palabras.length && hook.palabras[hook.palabras.length - 1].fin > 4.5) {
  avisos.push(`El hook termina en ${hook.palabras[hook.palabras.length - 1].fin.toFixed(1)} s; debería caber en los primeros 3-4 s. Acorta la primera frase.`);
}
const revelacion = tiempos.escenas.find((e) => e.tipo === 'revelacion');
if (!revelacion) avisos.push('No hay ninguna escena tipo "revelacion".');
else {
  const p = revelacion.inicio / total;
  if (p < 0.65 || p > 0.75) avisos.push(`La revelación empieza al ${Math.round(p * 100)}% (ideal 65-75%). Mueve texto entre historia y revelación.`);
}
const veredicto = tiempos.escenas.find((e) => e.tipo === 'veredicto');
if (!veredicto) avisos.push('No hay ninguna escena tipo "veredicto" (¿Estafador o genio?).');
else {
  const restante = total - veredicto.inicio;
  if (restante < 10 || restante > 15) avisos.push(`El veredicto dura ${restante.toFixed(1)} s (ideal 10-15 s finales).`);
}
}
if (guion.formato === 'short' && total > 65) avisos.push(`Un Short debe durar máximo 65 s y este dura ${total.toFixed(1)} s.`);

if (avisos.length) {
  console.log('\nAvisos:');
  avisos.forEach((a) => console.log('  ⚠ ' + a));
}

// --- Render ----------------------------------------------------------------
// Con poca RAM (menos de 8 GB) usamos una sola pestaña de Chrome: más lento pero estable.
// Se puede forzar con: npm run render -- --concurrencia 4
// Calidad: se renderiza a la MITAD de resolución (540x960 o 960x540) y se amplía 2x sin suavizar:
// pixel real pero con el doble de nitidez que antes (antes era 1/4). Se puede cambiar: --escala 1
const ESCALA_PIXEL = Number(opcion('escala') ?? 0.5);
const bajo = path.join(path.dirname(salida), '.bajo-res.mp4');
const ramGb = os.totalmem() / 1024 ** 3;
const concurrency = opcion('concurrencia') ? Number(opcion('concurrencia')) : ramGb < 8 ? 1 : null;
console.log(`\nRenderizando → ${path.relative(raiz, salida)}  (RAM ${ramGb.toFixed(0)} GB, hilos: ${concurrency ?? 'auto'})`);
let ultimo = -1;
await renderMedia({
  composition,
  serveUrl,
  codec: 'h264',
  // Calidad alta: fotogramas JPEG al 100 %, color estándar de video (bt709, limitado)
  // y compresión casi sin pérdida. El valor anterior (JPEG 80, crf 18, rango completo)
  // era lo que hacía ver la imagen blanda y distorsionada.
  // PIXEL REAL: se renderiza a 1/4 de resolución (270x480) y después se amplía 4x sin
  // suavizar (vecino más cercano) a 1080x1920. Así TODO (fondos, personaje, subtítulos)
  // queda en pixeles de verdad. Además renderiza mucho más rápido.
  scale: ESCALA_PIXEL,
  imageFormat: 'png',
  pixelFormat: 'yuv420p',
  colorSpace: 'bt709',
  crf: 10,
  x264Preset: 'medium',
  audioBitrate: '256k',
  audioCodec: 'aac',
  outputLocation: bajo,
  inputProps,
  browserExecutable,
  concurrency,
  frameRange: prueba
    ? [Math.round(prueba[0] * composition.fps), Math.min(composition.durationInFrames - 1, Math.round(prueba[1] * composition.fps))]
    : null,
  offthreadVideoCacheSizeInBytes: 64 * 1024 * 1024,
  timeoutInMilliseconds: 120000,
  onProgress: ({progress}) => {
    const p = Math.floor(progress * 100);
    if (p !== ultimo && p % 10 === 0) {
      ultimo = p;
      process.stdout.write(`  ${p}%\n`);
    }
  },
});

// Ampliación 4x sin suavizado → 1080x1920 (se queda el audio tal cual)
console.log('Ampliando a 1080x1920 en pixel real...');
const ffmpegSistema = spawnSync('ffmpeg', ['-version']).status === 0;
let ffmpegExe = 'ffmpeg';
if (!ffmpegSistema) {
  const dirR = path.join(raiz, 'node_modules', '@remotion');
  const comp = fs.readdirSync(dirR).find((d) => d.startsWith('compositor-'));
  ffmpegExe = path.join(dirR, comp, process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg');
}
const amp = spawnSync(
  ffmpegExe,
  ['-y', '-loglevel', 'error', '-i', bajo, '-vf', `scale=${horizontal ? '1920:1080' : '1080:1920'}:flags=neighbor,format=yuv420p`, '-c:v', 'libx264', '-crf', '12', '-preset', 'medium', '-colorspace', 'bt709', '-color_primaries', 'bt709', '-color_trc', 'bt709', '-c:a', 'copy', '-movflags', '+faststart', salida],
  {encoding: 'utf8'},
);
if (amp.status !== 0) {
  console.error(amp.stderr);
  process.exit(1);
}
fs.rmSync(bajo, {force: true});
console.log(`\n✔ Listo: ${salida}`);
