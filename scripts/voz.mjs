// npm run voz
// Genera la narración con una voz NEURAL MASCULINA en español (nada de voz robótica) y
// escribe guion/palabras.json con el instante exacto de cada palabra para el karaoke.
//
// Cómo funciona:
//  1. Cada escena del guion se sintetiza por separado (voz neural de Microsoft Edge).
//  2. Se unen con pausas (más largas antes de la revelación y del veredicto).
//  3. ffmpeg le da calidez de locutor: graves suaves, compresión y volumen estándar.
//
// Opciones:
//   npm run voz -- --voz es-MX-JorgeNeural      (otras: es-ES-AlvaroNeural, es-US-AlonsoNeural,
//                                                es-CO-GonzaloNeural, es-AR-TomasNeural)
//   npm run voz -- --velocidad -8               (porcentaje; negativo = más lento y sensual)
//   npm run voz -- --tono -6                    (Hz; negativo = más grave)
//
// Nota: el texto del guion se envía al servicio de voz de Microsoft Edge para sintetizarlo.
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawnSync} from 'node:child_process';
import {MsEdgeTTS, OUTPUT_FORMAT} from 'msedge-tts';

const raiz = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const opcion = (nombre, porDefecto) => {
  const i = args.indexOf(`--${nombre}`);
  return i >= 0 && args[i + 1] !== undefined ? args[i + 1] : porDefecto;
};

let VOZ = opcion('voz', 'es-MX-JorgeNeural');
let VELOCIDAD = Number(opcion('velocidad', '0')); // % (en Shorts largos de 60 s no bajar de 0)
let TONO = Number(opcion('tono', '-6')); // Hz
let PAUSA = 0.35; // segundos entre escenas
let PAUSA_DRAMATICA = 0.8; // antes de revelación y veredicto

// --- ffmpeg (el que trae Remotion) ------------------------------------------------
const buscarFfmpeg = () => {
  const dir = path.join(raiz, 'node_modules', '@remotion');
  const comp = fs.readdirSync(dir).find((d) => d.startsWith('compositor-'));
  if (!comp) throw new Error('No encuentro ffmpeg de Remotion. Ejecuta npm install.');
  const exe = process.platform === 'win32' ? 'ffmpeg.exe' : 'ffmpeg';
  return path.join(dir, comp, exe);
};
// Preferimos el ffmpeg completo del sistema (trae ecualizador y compresor para la voz).
// Si no está instalado, usamos el de Remotion, que solo tiene un procesado básico.
const ffmpegSistemaOk = spawnSync('ffmpeg', ['-version'], {encoding: 'utf8'}).status === 0;
const FFMPEG = ffmpegSistemaOk ? 'ffmpeg' : buscarFfmpeg();
if (!ffmpegSistemaOk) console.warn('Aviso: sin ffmpeg completo; la voz se procesa de forma básica.');
const ffmpeg = (argumentos) => {
  const r = spawnSync(FFMPEG, ['-y', '-hide_banner', ...argumentos], {encoding: 'utf8'});
  return r;
};
const duracionDe = (ruta) => {
  const r = spawnSync(FFMPEG, ['-hide_banner', '-i', ruta], {encoding: 'utf8'});
  const m = /Duration:\s*(\d+):(\d+):(\d+\.\d+)/.exec(r.stderr);
  if (!m) throw new Error(`No pude medir la duración de ${ruta}`);
  return Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]);
};

// --- guion ------------------------------------------------------------------------
// --guion guion/serie/s1.json  (por defecto guion/guion.json). Los tiempos van a <guion>.palabras.json
const rutaGuion = path.resolve(raiz, opcion('guion', path.join('guion', 'guion.json')));
const rutaPalabras = rutaGuion.endsWith(`${path.sep}guion.json`) ? path.join(path.dirname(rutaGuion), 'palabras.json') : rutaGuion.replace(/\.json$/, '.palabras.json');
const guion = JSON.parse(fs.readFileSync(rutaGuion, 'utf8'));
// Videos infantiles (composicion "ninos"): voz alegre y clara, ritmo vivo, pausas cortas.
// El guion puede traer "voz", "tono" y "velocidad"; lo que se pase por consola manda.
const ES_NINOS = guion.composicion === 'ninos';
if (guion.voz && !args.includes('--voz')) VOZ = guion.voz;
if (guion.tono !== undefined && !args.includes('--tono')) TONO = Number(guion.tono);
if (guion.velocidad !== undefined && !args.includes('--velocidad')) VELOCIDAD = Number(guion.velocidad);
if (ES_NINOS) {
  PAUSA = 0.18;
  PAUSA_DRAMATICA = 0.3;
}
const wavSalida = path.join(raiz, 'public', guion.audio);
if (!/\.wav$/i.test(wavSalida)) {
  console.error(`El campo "audio" del guion debe terminar en .wav (ahora es ${guion.audio}).`);
  process.exit(1);
}
fs.mkdirSync(path.dirname(wavSalida), {recursive: true});
const tmp = path.join(raiz, 'out', '.voz');
fs.rmSync(tmp, {recursive: true, force: true});
fs.mkdirSync(tmp, {recursive: true});

const escaparXml = (s) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const leerChunk = (c) => (typeof c === 'string' ? c : Buffer.from(c).toString('utf8'));

/** Sintetiza un texto y devuelve {mp3, palabras:[{texto, inicio, fin}]} */
const sintetizar = async (texto, destino, intento = 1) => {
  try {
    const tts = new MsEdgeTTS();
    await tts.setMetadata(VOZ, OUTPUT_FORMAT.AUDIO_24KHZ_96KBITRATE_MONO_MP3, {
      wordBoundaryEnabled: true,
    });
    const {audioStream, metadataStream} = tts.toStream(escaparXml(texto), {
      rate: `${VELOCIDAD >= 0 ? '+' : ''}${VELOCIDAD}%`,
      pitch: `${TONO >= 0 ? '+' : ''}${TONO}Hz`,
    });
    const audio = [];
    const palabras = [];
    if (metadataStream) {
      metadataStream.on('data', (c) => {
        try {
          const j = JSON.parse(leerChunk(c));
          for (const m of j.Metadata ?? []) {
            if (m.Type === 'WordBoundary') {
              palabras.push({
                texto: m.Data.text.Text,
                inicio: m.Data.Offset / 1e7,
                fin: (m.Data.Offset + m.Data.Duration) / 1e7,
              });
            }
          }
        } catch {
          /* fragmento incompleto: se ignora */
        }
      });
    }
    await new Promise((resolve, reject) => {
      audioStream.on('data', (c) => audio.push(Buffer.from(c)));
      audioStream.on('error', reject);
      audioStream.on('close', resolve);
    });
    const buf = Buffer.concat(audio);
    if (buf.length < 2000) throw new Error('audio vacío');
    fs.writeFileSync(destino, buf);
    return {mp3: destino, palabras};
  } catch (e) {
    if (intento >= 3) throw e;
    console.warn(`  reintentando (${intento}/3): ${e.message}`);
    await new Promise((r) => setTimeout(r, 1500 * intento));
    return sintetizar(texto, destino, intento + 1);
  }
};

console.log(`Voz: ${VOZ} · velocidad ${VELOCIDAD}% · tono ${TONO} Hz`);
const escenas = [];
for (let i = 0; i < guion.escenas.length; i++) {
  const e = guion.escenas[i];
  process.stdout.write(`  escena ${i + 1}/${guion.escenas.length}... `);
  const r = await sintetizar(e.texto, path.join(tmp, `e${i}.mp3`));
  const dur = duracionDe(r.mp3);
  escenas.push({...r, dur, escena: i, tipo: e.tipo, texto: e.texto});
  console.log(`${dur.toFixed(1)} s, ${r.palabras.length} palabras`);
}

// --- unir con pausas ---------------------------------------------------------------
const entradas = [];
const filtros = [];
let n = 0;
let cursor = 0;
const inicios = [];
escenas.forEach((s, i) => {
  if (i > 0) {
    const gap = s.tipo === 'revelacion' || s.tipo === 'veredicto' ? PAUSA_DRAMATICA : PAUSA;
    entradas.push('-f', 'lavfi', '-t', String(gap), '-i', 'anullsrc=r=24000:cl=mono');
    filtros.push(`[${n}:a]aresample=24000[a${n}]`);
    n++;
    cursor += gap;
  }
  entradas.push('-i', s.mp3);
  filtros.push(`[${n}:a]aresample=24000,aformat=channel_layouts=mono[a${n}]`);
  n++;
  inicios.push(cursor);
  cursor += s.dur;
});
const concat = Array.from({length: n}, (_, k) => `[a${k}]`).join('') + `concat=n=${n}:v=0:a=1[crudo]`;

// Calidez de locutor: graves, un poco de aire, compresión suave y volumen estándar.
const cadena = ES_NINOS
  ? 'highpass=f=90,' +
    'equalizer=f=3200:t=q:w=1.2:g=2,' +
    'equalizer=f=7500:t=q:w=1.0:g=1.5,' +
    'acompressor=threshold=-18dB:ratio=3:attack=6:release=100:makeup=3,' +
    'loudnorm=I=-14:TP=-1.5:LRA=7,' +
    'aresample=48000'
  : (ffmpegSistemaOk
    ? 'highpass=f=60,' +
      'equalizer=f=105:t=q:w=1.1:g=3.5,' +
      'equalizer=f=250:t=q:w=1.0:g=1.2,' +
      'equalizer=f=3200:t=q:w=1.2:g=-1.5,' +
      'equalizer=f=9000:t=q:w=1.0:g=1.5,' +
      'acompressor=threshold=-20dB:ratio=3:attack=8:release=120:makeup=3,' +
      'aecho=in_gain=0.85:out_gain=0.9:delays=45:decays=0.08,'
    : '') +
  'loudnorm=I=-15:TP=-1.5:LRA=7,' +
  'aresample=48000';

const r = ffmpeg([
  ...entradas,
  '-filter_complex',
  `${filtros.join(';')};${concat};[crudo]${cadena}[final]`,
  '-map',
  '[final]',
  '-ac',
  '1',
  wavSalida,
]);
if (r.status !== 0) {
  console.error(r.stderr);
  console.error('No se pudo unir la narración.');
  process.exit(1);
}
const duracionTotal = duracionDe(wavSalida);

// --- tiempos por palabra -----------------------------------------------------------
// loudnorm no cambia la duración; la posición de cada palabra = inicio de su escena + offset.
const palabras = [];
let sinMapear = 0;
escenas.forEach((s, i) => {
  let pos = 0;
  for (const p of s.palabras) {
    const idx = s.texto.indexOf(p.texto, pos);
    if (idx < 0) {
      sinMapear++;
      continue;
    }
    pos = idx + p.texto.length;
    palabras.push({
      escena: i,
      desdeChar: idx,
      hastaChar: idx + p.texto.length,
      inicio: Math.round((inicios[i] + p.inicio) * 1000) / 1000,
      fin: Math.round((inicios[i] + Math.min(p.fin, s.dur)) * 1000) / 1000,
    });
  }
});
fs.writeFileSync(rutaPalabras, JSON.stringify(palabras, null, 2), 'utf8');

console.log(`\nAudio: public/${guion.audio} (${duracionTotal.toFixed(1)} s)`);
console.log(`Tiempos: guion/palabras.json (${palabras.length} palabras alineadas${sinMapear ? `, ${sinMapear} sin mapear` : ''})`);
if (guion.formato === 'short' && duracionTotal > 60) {
  console.warn(`Aviso: es un Short y la narración dura ${duracionTotal.toFixed(1)} s (máximo 60). Acorta el guion o sube --velocidad.`);
}

// Cierra el proceso aunque queden conexiones de red abiertas (evita que el lote se cuelgue).
process.exit(0);
