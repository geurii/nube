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

const ANCHO_PIXEL = 270;   // ancho del arte antes de ampliar (270 x2 = 540, el lienzo exacto del motor)
const COLORES = 48;        // tamano de la paleta
const SEGUNDOS_POR_PLANO = 3;
const ESPERA_MS = 47000;   // Pollinations deja 1 imagen cada 45 s por IP
const ESTILO = 'pixel art scene, detailed 16-bit game background, dithering, dark outlines, moody cinematic lighting, period-accurate, no modern objects, no text, no watermark, no letters';

const guionPath = path.join('guion', 'serie', `${id}.json`);
const guion = JSON.parse(fs.readFileSync(guionPath, 'utf8'));
// El guion no guarda que objeto lleva cada escena: se saca de la lista de temas del lote.
const contenidos = JSON.parse(fs.readFileSync('agentes/lote-30-contenidos.json', 'utf8'));
const tema = (contenidos.topics ?? []).find((t) => `lqns-${t.slug}` === id);
const anclaDe = (i) => String(tema?.scenes?.[i]?.anchor ?? '');
const dir = path.join('public', 'referencias');          // de aqui las carga el motor
const dirCuadros = path.join('public', 'pintados');
fs.mkdirSync(dirCuadros, {recursive: true});
fs.mkdirSync(dir, {recursive: true});

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

/** El lote exige diez visuales por escena para sostener escenas largas sin repetir imagen. */
const PLANOS_POR_ESCENA = 10;   // lo que exige el control del lote
const IMAGENES_POR_ESCENA = 3;  // menos descargas = menos riesgo de quedarse sin fotos
const PLANOS_POR_IMAGEN = 4;    // cada foto rinde cuatro planos: otro encuadre y otra animacion
const planosDe = () => IMAGENES_POR_ESCENA;

/** Pide a la IA de texto una descripcion EN INGLES de lo que se ve en cada plano. */
const describir = async (escenas) => {
  const lista = escenas.map((e, i) => `${i}. [${anclaDe(i) || 'escena'}] ${String(e.texto ?? '').slice(0, 220)}`).join('\n');
  const bruto = await chatAlternativo([
    {role: 'system', content: 'Eres director de arte de un canal de misterio. Describes imagenes concretas, en ingles, para generar pixel art. Cada descripcion DEBE fijar la epoca y el lugar del hecho (por ejemplo "1900 scottish island", "1917 canadian harbour"), porque si no el generador mete objetos modernos donde no van. Respondes SOLO con JSON.'},
    {role: 'user', content: `Tema: "${guion.titulo}".\n\nPara CADA escena da ${IMAGENES_POR_ESCENA} descripciones DISTINTAS en ingles (8 a 16 palabras) de lo que se ve: el objeto, lugar o suceso que la frase nombra, desde angulos y momentos diferentes. EMPIEZA CADA UNA por el ano y el lugar del hecho. Concreto y fotografiable: nada abstracto, ningun texto en la imagen, ninguna persona reconocible, ningun nombre propio de persona, y ningun objeto que no existiera en esa epoca.\n\nESCENAS:\n${lista}\n\nDevuelve {"escenas":[{"indice":N,"vistas":["...","..."]}]}`},
  ], {maxTokens: 2200, json: true});
  // chatAlternativo devuelve {texto, proveedor, modelo}: hay que PARSEAR el texto.
  // (Antes se leia r.escenas directamente y siempre salia vacio: por eso decia '0/5 escenas'.)
  if (!bruto?.texto) throw new Error('la IA de texto no devolvio nada');
  const a = bruto.texto.indexOf('{'), b = bruto.texto.lastIndexOf('}');
  const r = JSON.parse(bruto.texto.slice(a, b + 1));
  console.log(`  (descripciones de ${bruto.proveedor}/${bruto.modelo})`);
  const out = {};
  for (const e of (Array.isArray(r?.escenas) ? r.escenas : [])) {
    const i = Number(e.indice);
    const v = (Array.isArray(e.vistas) ? e.vistas : []).map((x) => String(x ?? '').trim()).filter((x) => x.length > 8);
    if (v.length) out[i] = v;
  }
  return out;
};

/** Descarga la imagen generada. Devuelve true si llego un JPEG de verdad. */
const bajar = async (prompt, destino, consultaLibre = '') => {
  const url = `https://image.pollinations.ai/prompt/${encodeURIComponent(prompt)}?width=704&height=1248&nologo=true&seed=${Math.floor(Math.random() * 999999)}`;
  for (let intento = 1; intento <= 4; intento++) {
    try {
      const r = await fetch(url, {signal: AbortSignal.timeout(180000)});
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const buf = Buffer.from(await r.arrayBuffer());
      if (buf.length < 8000 || buf[0] !== 0xff || buf[1] !== 0xd8) throw new Error('no es JPEG (' + buf.length + ' bytes)');
      fs.writeFileSync(destino, buf);
      return true;
    } catch (e) {
      console.log(`    intento ${intento}/4: ${String(e.message ?? e).slice(0, 70)}`);
      if (intento < 4) await dormir(ESPERA_MS);
    }
  }
  // Openverse se probo como respaldo y devuelve cartas y documentos con texto:
  // no sirve para estas escenas. Si el generador falla, la escena toma prestada
  // una foto de otra escena del mismo video (ver el RELLENO de mas abajo).
  return false;
};

/** Convierte a pixel art con Pillow. Se probo contra FFmpeg y FFmpeg dejaba grano; Pillow sale limpio. */
/** Respaldo cuando el generador falla: una foto REAL de dominio publico o CC0 (Openverse).
 *  Las normas del canal permiten solo estas licencias; el pixel art se hace igual despues. */
const bajarLibre = async (consulta, destino) => {
  const limpia = String(consulta).replace(/[^a-zA-Z0-9 ,.-]/g, ' ').trim().slice(0, 90);
  const url = `https://api.openverse.org/v1/images/?q=${encodeURIComponent(limpia)}&license=cc0,pdm&page_size=8&format=json`;
  try {
    const r = await fetch(url, {headers: {'User-Agent': 'lqns/1.0'}, signal: AbortSignal.timeout(60000)});
    if (!r.ok) throw new Error('HTTP ' + r.status);
    const j = await r.json();
    for (const it of (j.results ?? [])) {
      const u = it.url;
      if (!u) continue;
      try {
        const f = await fetch(u, {headers: {'User-Agent': 'lqns/1.0'}, signal: AbortSignal.timeout(90000)});
        if (!f.ok) continue;
        const buf = Buffer.from(await f.arrayBuffer());
        const jpeg = buf[0] === 0xff && buf[1] === 0xd8;
        const png = buf[0] === 0x89 && buf[1] === 0x50;
        if (buf.length < 8000 || !(jpeg || png)) continue;
        fs.writeFileSync(destino, buf);
        console.log(`    respaldo libre: ${String(it.title ?? '').slice(0, 40)} (${it.license})`);
        return true;
      } catch { /* siguiente resultado */ }
    }
  } catch (e) { console.log('    respaldo libre fallo: ' + String(e.message ?? e).slice(0, 60)); }
  return false;
};

const aPixelArt = (entrada, salida) => {
  const r = spawnSync('python3', ['scripts/a_pixel_art.py', entrada, salida, String(ANCHO_PIXEL), String(COLORES), '540', '960'], {encoding: 'utf8', timeout: 120000});
  if (r.status !== 0 || !fs.existsSync(salida)) { console.log('    pixel art: ' + String(r.stderr ?? r.error?.message ?? '').slice(0, 140)); return false; }
  return true;
};

/** El cuadro: la imagen del sujeto de fondo y, encima, capas que el motor mueve solas.
 *  Asi el plano no es una foto con zoom: tiene niebla que deriva, polvo que flota,
 *  estrellas que titilan y, donde toca, olas y rayos. */
const escribirCuadro = (nombre, i, k, escena, variante = 0, archivoBase = null) => {
  const t = String(escena.texto ?? '').toLowerCase();
  const mar = /mar|olas|oceano|barco|agua|costa|puerto|isla|hundi|naufrag/.test(t);
  const fuego = /fuego|incendio|explos|lava|volcan|arde|llama|quem/.test(t);
  const noche = /noche|oscur|madrugada|estrella|cielo/.test(t);
  // La imagen no se queda quieta: se mueve por dentro segun lo que muestra la escena.
  //  onda = vaiven de las filas de abajo (agua, lava, multitud)
  //  cielo = arrastre de las filas de arriba (nubes, humo)
  //  latido = la luz sube y baja, como una lampara o un fuego vivo
  const capas = [{
    t: 'foto', archivo: archivoBase ?? `${String(nombre).replace(/-b$/, '')}.png`, pan: true, pixel: 1,
    onda: (mar ? 0.62 : fuego ? 0.70 : 0.78) - variante * 0.04,
    ondaFuerza: (mar ? 4.5 : fuego ? 3 : 1.8) * (variante ? 1.3 : 1),
    cielo: 0.45,
    cieloFuerza: (fuego ? 3.2 : 2.2) * (variante ? 1.25 : 1),
    latido: (fuego ? 0.11 : noche ? 0.06 : 0.035) * (variante ? 1.4 : 1),
    // la variante entra mas cerca y por el otro lado: mismo sujeto, otro plano
    zoom: [1, 1.22, 1.12, 1.3, 1.18, 1.26][variante % 6],
    x0: [0, 0.06, -0.05, 0.1, -0.08, 0.03][variante % 6],
    x1: [1, 1.06, 0.95, 1.1, 0.92, 1.03][variante % 6],
    y0: [0, 0.04, 0.07, -0.05, 0.02, -0.07][variante % 6],
    y1: [1, 1.04, 1.07, 0.95, 1.02, 0.93][variante % 6],
  }];
  if (noche || !fuego) capas.push({t: 'estrellas', n: 26 + k * 4, hasta: 0.5, semilla: i * 7 + k, color: '#dfe7f4'});
  capas.push({t: 'particulas', n: 16 + k * 3, tipo: fuego ? 'brasas' : 'polvo', semilla: i * 13 + k, color: fuego ? '#ffb347' : '#cfd8e6'});
  // Nada de olas ni rayos dibujados encima: la imagen ya trae su mar y su fuego, y una ola
  // de bloques sobre una escena detallada se ve como un parche. Solo ambiente que no tapa.
  if (mar) capas.push({t: 'particulas', n: 10 + k * 2, tipo: 'polvo', y: 0.82, semilla: i * 17 + k, color: '#bcd4e8'});
  capas.push({t: 'niebla', y: 0.93, alpha: 0.22, semilla: i * 3 + k, color: '#0b1020'});
  const cuadro = {cielo: ['#0a0f1c', '#1b2740', '#3c567a'], capas};
  fs.writeFileSync(path.join(dirCuadros, `${nombre}.json`), JSON.stringify(cuadro));
};

if (guion.personaje && guion.personaje.visible !== false) { guion.personaje.visible = false; }
const escenas = guion.escenas ?? [];
console.log(`Imagenes de escena para ${id}: ${escenas.length} escenas.`);

/** Respaldo: si la IA de texto no contesta, se arma el prompt con el objeto de la escena en ingles
 *  mas el tema, que es mil veces mejor que mandarle la frase en espanol al generador. */
const EN = {barco:'old sailing ship at sea',avion:'vintage propeller airplane in flight',zepelin:'giant airship zeppelin in the sky',
 ciudad:'old city skyline at night',radar:'vintage radar screen in a dark control room',volcan:'erupting volcano with ash column',
 televisor:'old television set glowing in a dark room',radio:'vintage radio receiver on a wooden desk',puente:'long suspension bridge over water',
 tornado:'huge tornado over flat farmland',fosil:'fossil skull on a museum table',edificio:'old stone building at dusk',
 submarino:'submarine on dark ocean surface',esfera:'perfectly round stone sphere in the jungle',dodecaedro:'small bronze twelve-sided roman object',
 periodico:'old newspaper front page on a table',bomba:'old aerial bomb resting on the seabed',faro:'stone lighthouse on a rocky coast',
 paracaidas:'open parachute in a night sky',sonar:'sonar console with green display',telegrafo:'telegraph key and wires in an office',
 fuego:'buildings burning at night',satelite:'satellite above the earth',moneda:'old coin on dark cloth',explosion:'huge explosion over a harbour',
 tsunami:'giant wave about to hit a coast',ovni:'strange lights hovering over a forest',hielo:'ships trapped in arctic pack ice',
 vaca:'cow in a wooden barn at night',pergamino:'old handwritten document on a desk',aurora:'green aurora over telegraph poles',
 libro:'old leather book open on a table',cartas:'old letters scattered on a desk',tren:'steam locomotive on the tracks'};
const respaldo = (escena, k, idx) => {
  const obj = EN[anclaDe(idx)] ?? 'mysterious historical scene';
  const momento = ['wide establishing shot','close detail shot','low angle shot','from the water','at dusk','at night under moonlight','in heavy fog','in a storm','from above','silhouetted against the sky'][k % 10];
  return `${obj}, ${momento}, ${guion.titulo}`;
};

let vistas = {};
try { vistas = await describir(escenas); console.log(`  descripciones de la IA: ${Object.keys(vistas).length}/${escenas.length} escenas`); }
catch (e) { console.log('  sin descripciones de la IA (' + String(e.message ?? e).slice(0, 80) + '); se usa el respaldo en ingles'); }

/** Una sola foto rinde varios planos: mismo sujeto, otro encuadre y otra animacion. */
const planosDeFoto = (nombre, i, k, escena, fondos) => {
  const sufijos = ['', '-b', '-c', '-d', '-e', '-f'];
  for (let v = 0; v < PLANOS_POR_IMAGEN; v++) {
    const n2 = `${nombre}${sufijos[v]}`;
    escribirCuadro(n2, i, k, escena, v, `${nombre}.png`);
    fondos.push(`pintado:${n2}`);
  }
};

let hechas = 0, fallidas = 0, primera = true;
const catalogo = [];   // toda imagen que SI existe, para que ninguna escena se quede sin foto
const pendientes = [];  // escenas que no completaron sus planos
for (let i = 0; i < escenas.length; i++) {
  const escena = escenas[i];
  const n = planosDe(escena);
  const base = (vistas[i] && vistas[i].length ? vistas[i] : null);
  const fondos = [];
  for (let k = 0; k < n; k++) {
    const nombre = `${id}-${i}-${k + 1}`;
    const crudo = path.join(dir, `${nombre}.src.jpg`);
    const final = path.join(dir, `${nombre}.png`);
    if (fs.existsSync(final)) {
      catalogo.push({archivo: `${nombre}.png`, escena: i});
      planosDeFoto(nombre, i, k, escena, fondos);
      continue;
    }
    if (!primera) await dormir(ESPERA_MS);
    primera = false;
    const vista = base ? base[k % base.length] : respaldo(escena, k, i);
    console.log(`  escena ${i + 1}, plano ${k + 1}/${n}: ${vista.slice(0, 70)}`);
    if (await bajar(`${ESTILO}, ${vista}`, crudo, vista) && aPixelArt(crudo, final)) {
      fs.rmSync(crudo, {force: true});
      catalogo.push({archivo: `${nombre}.png`, escena: i});
      planosDeFoto(nombre, i, k, escena, fondos);
      hechas++;
    } else { fallidas++; }
  }
  // Solo se cambian los fondos si hay imagenes suficientes para esta escena; si no, se deja lo que habia.
  if (fondos.length >= PLANOS_POR_ESCENA) escena.fondo = fondos.slice(0, PLANOS_POR_ESCENA);
  else { pendientes.push({i, escena, fondos}); console.log(`  escena ${i + 1}: ${fondos.length}/${PLANOS_POR_ESCENA} planos; se completara con fotos de otras escenas`); }
}

// RELLENO: ninguna escena vuelve al fondo dibujado. Si le faltan planos se le prestan
// fotos reales de las escenas vecinas, cada una con otro encuadre y otra animacion.
if (pendientes.length && catalogo.length) {
  for (const {i, escena, fondos} of pendientes) {
    const cerca = [...catalogo].sort((a, b) => Math.abs(a.escena - i) - Math.abs(b.escena - i));
    let v = 0;
    while (fondos.length < PLANOS_POR_ESCENA && v < cerca.length * 6) {
      const foto = cerca[v % cerca.length];
      const nombre = `${id}-${i}-r${v + 1}`;
      escribirCuadro(nombre, i, v, escena, v % 6, foto.archivo);
      fondos.push(`pintado:${nombre}`);
      v++;
    }
    if (fondos.length >= PLANOS_POR_ESCENA) {
      escena.fondo = fondos.slice(0, PLANOS_POR_ESCENA);
      console.log(`  escena ${i + 1}: completada con fotos prestadas (sin fondos dibujados)`);
    }
  }
}

fs.writeFileSync(guionPath, JSON.stringify(guion, null, 2) + '\n');
console.log(`Imagenes listas: ${hechas}. Fallidas: ${fallidas}.`);
if (hechas === 0) { console.error('No se genero ninguna imagen: el Short se renderiza con los fondos de antes.'); }
