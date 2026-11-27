// IMAGENES DE ESCENA EN PIXEL ART
// Para un Short del lote: por cada plano de cada escena genera una imagen del sujeto real
// (Pollinations, gratis y sin llave), la convierte a pixel art de verdad con FFmpeg
// (reduccion por area -> paleta de 48 colores -> ampliacion a 1080x1920 sin suavizar)
// y la deja en public/generados/. Despues reescribe los fondos del guion para que el
// render use esas imagenes, que el motor ya mueve con zoom y paneo lentos.
//
//   node scripts/imagenes-lote.mjs lqns-flannan-faro-desaparecido
//
// Si una imagen no se puede generar, esa escena conserva el fondo que ya tenia: nunca rompe el render.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {chatAlternativo} from '../agentes/llm.mjs';

const id = process.argv[2];
if (!id) throw new Error('Falta el id del Short. Ejemplo: node scripts/imagenes-lote.mjs lqns-flannan-faro-desaparecido');

const ANCHO_PIXEL = 288;   // ancho del lienzo de pixel art antes de ampliar
const COLORES = 48;        // tamano de la paleta
const SEGUNDOS_POR_PLANO = 3;
const ESPERA_MS = 47000;   // Pollinations deja 1 imagen cada 45 s por IP
const ESTILO = 'pixel art scene, detailed 16-bit game background, dithering, dark outlines, moody cinematic lighting, period-accurate, no modern objects, no text, no watermark, no letters';

const guionPath = path.join('guion', 'serie', `${id}.json`);
const guion = JSON.parse(fs.readFileSync(guionPath, 'utf8'));
const dir = path.join('public', 'generados');
fs.mkdirSync(dir, {recursive: true});

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** Cuantos planos necesita cada escena para no repetir imagen (una cada 3 s). */
const planosDe = (escena) => {
  const seg = Number(escena.duracion ?? 0) || Math.max(6, String(escena.texto ?? '').split(/\s+/).length / 2.3);
  return Math.max(2, Math.ceil(seg / SEGUNDOS_POR_PLANO));
};

/** Pide a la IA de texto una descripcion EN INGLES de lo que se ve en cada plano. */
const describir = async (escenas) => {
  const lista = escenas.map((e, i) => `${i}. [${e.anchor ?? 'escena'}] ${String(e.texto ?? '').slice(0, 220)}`).join('\n');
  const r = await chatAlternativo([
    {role: 'system', content: 'Eres director de arte de un canal de misterio. Describes imagenes concretas, en ingles, para generar pixel art. Cada descripcion DEBE fijar la epoca y el lugar del hecho (por ejemplo "1900 scottish island", "1917 canadian harbour"), porque si no el generador mete objetos modernos donde no van. Respondes SOLO con JSON.'},
    {role: 'user', content: `Tema: "${guion.titulo}".\n\nPara CADA escena da ${8} descripciones DISTINTAS en ingles (8 a 16 palabras) de lo que se ve: el objeto, lugar o suceso que la frase nombra, desde angulos y momentos diferentes. EMPIEZA CADA UNA por el ano y el lugar del hecho. Concreto y fotografiable: nada abstracto, ningun texto en la imagen, ninguna persona reconocible, ningun nombre propio de persona, y ningun objeto que no existiera en esa epoca.\n\nESCENAS:\n${lista}\n\nDevuelve {"escenas":[{"indice":N,"vistas":["...","..."]}]}`},
  ], {maxTokens: 2200, json: true});
  const out = {};
  for (const e of (Array.isArray(r?.escenas) ? r.escenas : [])) {
    const i = Number(e.indice);
    const v = (Array.isArray(e.vistas) ? e.vistas : []).map((x) => String(x ?? '').trim()).filter((x) => x.length > 8);
    if (v.length) out[i] = v;
  }
  return out;
};

/** Descarga la imagen generada. Devuelve true si llego un JPEG de verdad. */
const bajar = async (prompt, destino) => {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=704&height=1248&nologo=true`;
  for (let intento = 1; intento <= 3; intento++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(180000)});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 8000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('no es JPEG (' + buf.length + ' bytes)');
      fs.writeFileSync(destino, buf);
      return true;
    } catch (e) {
      console.log(`    intento ${intento}/3: ${String(e.message ?? e).slice(0, 70)}`);
      if (intento < 3) await dormir(ESPERA_MS);
    }
  }
  return false;
};

/** Convierte a pixel art con Pillow. Se probo contra FFmpeg y FFmpeg dejaba grano; Pillow sale limpio. */
const aPixelArt = (entrada, salida) => {
  const r = spawnSync('python3', ['scripts/a_pixel_art.py', entrada, salida, String(ANCHO_PIXEL), String(COLORES)], {encoding: 'utf8', timeout: 120000});
  if (r.status !== 0 || !fs.existsSync(salida)) { console.log('    pixel art: ' + String(r.stderr ?? r.error?.message ?? '').slice(0, 140)); return false; }
  return true;
};

const escenas = guion.escenas ?? [];
console.log(`Imagenes de escena para ${id}: ${escenas.length} escenas.`);

let vistas = {};
try { vistas = await describir(escenas); console.log(`  descripciones de la IA: ${Object.keys(vistas).length}/${escenas.length} escenas`); }
catch (e) { console.log('  sin descripciones de la IA (' + String(e.message ?? e).slice(0, 80) + '); se usa el texto de la escena'); }

let hechas = 0, fallidas = 0, primera = true;
for (let i = 0; i < escenas.length; i++) {
  const escena = escenas[i];
  const n = planosDe(escena);
  const base = (vistas[i] && vistas[i].length ? vistas[i] : [String(escena.texto ?? '').slice(0, 120)]);
  const fondos = [];
  for (let k = 0; k < n; k++) {
    const nombre = `${id}-${i}-${k + 1}`;
    const crudo = path.join(dir, `${nombre}.src.jpg`);
    const final = path.join(dir, `${nombre}.png`);
    if (fs.existsSync(final)) { fondos.push(`generados/${nombre}.png`); continue; }
    if (!primera) await dormir(ESPERA_MS);
    primera = false;
    const vista = base[k % base.length];
    console.log(`  escena ${i + 1}, plano ${k + 1}/${n}: ${vista.slice(0, 70)}`);
    if (await bajar(`${ESTILO}, ${vista}`, crudo) && aPixelArt(crudo, final)) {
      fs.rmSync(crudo, {force: true});
      fondos.push(`generados/${nombre}.png`);
      hechas++;
    } else { fallidas++; }
  }
  // Solo se cambian los fondos si hay imagenes suficientes para esta escena; si no, se deja lo que habia.
  if (fondos.length >= n) escena.fondo = fondos;
  else console.log(`  escena ${i + 1}: ${fondos.length}/${n} imagenes; conserva sus fondos anteriores`);
}

fs.writeFileSync(guionPath, JSON.stringify(guion, null, 2) + '\n');
console.log(`Imagenes listas: ${hechas}. Fallidas: ${fallidas}.`);
if (hechas === 0) { console.error('No se genero ninguna imagen: el Short se renderiza con los fondos de antes.'); }
