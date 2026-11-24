// LOS DOS PINTORES de la oficina. Dibujan TODAS las escenas de cada video en pixel art profesional y trabajan como dos personas reales:
//   Pintor de composición y color (A): propone cada escena.   Pintor de luz y detalle (B): la revisa, la corrige y dice si está de acuerdo.
// Si B no está de acuerdo, A recibe las objeciones y responde; si siguen sin coincidir, B tiene la última palabra. Siempre salen de acuerdo.
// Los dos trabajan con el mismo MANUAL de pixel art (mecánica de los maestros del oficio), bajo la presión de Jules y de Gemini.
// El motor que dibuja está en src/components/fondos/pintado.ts y pintadoPro.ts. Aquí se valida todo: nada raro llega al render.
// Se llama desde oficina.mjs. Escribe public/pintados/<slug>-<n>.json y devuelve los nombres "pintado:<id>".
import fs from 'node:fs';
import path from 'node:path';

const HEX = /^#[0-9a-fA-F]{6}$/;
const n = (v, d, a, b) => { const x = Number(v); return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : d; };
const rampa = (v, min = 2, max = 6) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && HEX.test(x)).slice(0, max) : []).length >= min ? v.filter((x) => typeof x === 'string' && HEX.test(x)).slice(0, max) : null;
/** Escenarios de pixel art libres (CC0, OpenGameArt) guardados en public/escenarios/<id>.png. */
export const ESCENARIOS = {
  'bosque': 'bosque de pinos con luces entre los árboles (verdes y azulados)',
  'industrial': 'ciudad industrial con edificios, chimeneas y tubos (grises y naranjas)',
  'montanas-atardecer': 'montañas y pinos en un atardecer (violetas y naranjas)',
  'mar-day': 'mar abierto de día con nubes y torres lejanas',
  'mar-noon': 'mar abierto al mediodía, cielo claro',
  'mar-night': 'mar abierto de noche, cielo oscuro con estrellas',
  'desierto-rocoso': 'desierto rocoso con montañas lejanas, cielo claro',
};
export const TIPOS = new Set([
  'estrellas', 'astro', 'resplandor', 'montanas', 'suelo', 'agua', 'niebla', 'arbol', 'edificio', 'central', 'pergamino',
  'nubes', 'olas', 'particulas', 'rayos', 'barco', 'pez', 'roca', 'hielo', 'duna', 'algas', 'sargazo', 'faro', 'silueta', 'ovni', 'explosion', 'ciudad', 'bosque', 'calendario', 'reloj', 'castillo', 'corona', 'libro', 'moneda', 'iglesia', 'caballo',
  'hidrofono', 'sonar', 'microfono', 'volcan', 'fuego', 'lago', 'avion', 'tren', 'submarino',
]);

/** Una "caja vacía": barra o rectángulo ancho y bajo sin forma de objeto (parece un cuadro de texto sin texto). Gemini la marca como falla grave. */
export const esCajaVacia = (e) => {
  if (e.t === 'rect') return Number(e.w) >= 0.25 && Number(e.h) <= 0.2;
  if (e.t === 'poligono' && Array.isArray(e.pts) && e.pts.length >= 3 && e.pts.length <= 5) {
    const xs = e.pts.map((p) => p[0]);
    const ys = e.pts.map((p) => p[1]);
    const w = Math.max(...xs) - Math.min(...xs);
    const h = Math.max(...ys) - Math.min(...ys);
    const rectangulo = new Set(xs.map((x) => x.toFixed(2))).size <= 2 && new Set(ys.map((y) => y.toFixed(2))).size <= 2;
    return rectangulo && w >= 0.25 && h <= 0.2;
  }
  return false;
};

export const sujetosDelTexto = (texto = '') => {
  const t = String(texto).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  const reglas = [
    [/\b(calendario|fecha|año|anos|siglo|cronologia|tiempo|reloj|hora|horas)\b/, ['calendario','reloj','pergamino']],
    [/\b(castillo|medieval|reino|rey|reina|corona|monarquia|moneda|iglesia|caballero|caballo)\b/, ['castillo','corona','moneda','iglesia','caballo','pergamino']],
    [/\b(barco|nave|embarcacion|marinero|naufragio|hundido|velero|naufragar)\b/, ['barco','submarino','faro']],
    [/\b(submarino|submarinos|hidrofono|hidrofonos|microfono|microfonos|sonar|sensor|sensores)\b/, ['hidrofono','sonar','microfono','submarino']],
    [/\b(ballena|tiburon|anguila|calamar|pez|animal|criatura|pulpo|fauna|cetaceo)\b/, ['pez']],
    [/\b(hielo|glaciar|iceberg|congelado|criosismo|crujido de hielo)\b/, ['hielo']],
    [/\b(volcan|erupcion|lava|crater|magma)\b/, ['volcan']],
    [/\b(bosque|arbol|arboles|pino|selva)\b/, ['bosque','arbol']],
    [/\b(ciudad|edificio|casa|pueblo|vivienda|calle|barrio)\b/, ['ciudad','edificio']],
    [/\b(fabrica|central|reactor|nuclear|chimenea|energia|planta industrial)\b/, ['central']],
    [/\b(desierto|duna|arena)\b/, ['duna']],
    [/\b(ovni|extraterrestre|nave espacial|espacio|planeta|luna|asteroide)\b/, ['ovni','astro']],
    [/\b(nino|nina|ninos|ninas|persona|hombre|mujer|habitante|poblacion|multitud)\b/, ['silueta']],
    [/\b(libro|manuscrito|documento|texto|pergamino|escrito|archivo|mapa|carta)\b/, ['libro','pergamino']],
    [/\b(explosion|estallido)\b/, ['explosion']],
    [/\b(incendio|fuego|llama|ardiendo|quemado|hoguera)\b/, ['fuego']],
    [/\b(zumbido|sonido|ruido|frecuencia|vibracion|eco|silbido|tono)\b/, ['microfono','hidrofono','sonar']],
    [/\b(ola|olas|tsunami|marea|mar|oceano|lago|laguna|rio|embalse)\b/, ['lago','barco','pez','faro','submarino']],
    [/\b(avion|aeronave|vuelo|piloto|aeroplano)\b/, ['avion']],
    [/\b(tren|ferrocarril|locomotora|vagon|via ferroviaria)\b/, ['tren']],
    [/\b(montana|montanas|cordillera|cumbre|acantilado)\b/, ['montanas']],
    [/\b(faro|torre de luz)\b/, ['faro']],
  ];
  return [...new Set(reglas.filter(([re]) => re.test(t)).flatMap(([, tipos]) => tipos))];
};

export const OBJETOS_NARRATIVOS = new Set([
  'barco','pez','hielo','faro','ovni','explosion','ciudad','bosque','arbol','edificio','central',
  'pergamino','calendario','reloj','castillo','corona','libro','moneda','iglesia','caballo','silueta','astro','duna',
  'montanas','hidrofono','sonar','microfono','volcan','fuego','lago','avion','tren','submarino',
]);

/** Un cuadro solo sirve si contiene un objeto implementado y este coincide con la frase narrada. */
export const tieneAnclaNarrativa = (plano, texto = '') => {
  if (!plano || !Array.isArray(plano.capas)) return false;
  const esperados = sujetosDelTexto(texto);
  if (!esperados.length) return false;
  return plano.capas.some((c) => OBJETOS_NARRATIVOS.has(c.t) && esperados.includes(c.t));
};

/** Limpia una escena: solo tipos y rangos permitidos. Devuelve null si no sirve. */
export const validarEscena = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const cielo = rampa(raw.cielo, 2, 5);
  const capas = (Array.isArray(raw.capas) ? raw.capas : []).filter((e) => e && TIPOS.has(e.t)).slice(0, 24).map((e) => {
    const o = {t: e.t};
    for (const k of ['x', 'y', 'w', 'h', 'r', 'alto', 'alpha', 'fuerza', 'hasta', 'grosor']) if (e[k] !== undefined) o[k] = n(e[k], 0.5, 0, 1);
    for (const k of ['n', 'semilla', 'picos', 'lineas', 'tam']) if (e[k] !== undefined) o[k] = n(e[k], 5, 0, 200);
    if (HEX.test(e.color ?? '')) o.color = e.color;
    if (HEX.test(e.vela ?? '')) o.vela = e.vela;
    const r = rampa(e.rampa); if (r) o.rampa = r;
    if (typeof e.s === 'string') o.s = e.s.slice(0, 22);
    if (typeof e.tipo === 'string') o.tipo = e.tipo.toLowerCase().replace(/[^a-z]/g, '').slice(0, 12);
    if (['izq', 'der', 'arriba'].includes(e.luz)) o.luz = e.luz;
    for (const k of ['ventanas', 'flip', 'espuma', 'borde', 'simbolos', 'vapor']) if (typeof e[k] === 'boolean') o[k] = e[k];
    if (Array.isArray(e.pts)) {
      const pts = e.pts.filter((p) => Array.isArray(p) && p.length >= 2).slice(0, 40).map((p) => [n(p[0], 0.5, 0, 1), n(p[1], 0.5, 0, 1)]);
      if (pts.length >= 2) o.pts = pts;
    }
    if ((e.t === 'poligono' && (o.pts?.length ?? 0) < 3) || (e.t === 'linea' && (o.pts?.length ?? 0) < 2)) return null;
    return o;
  }).filter(Boolean).filter((c) => !esCajaVacia(c)); // sin barras rectangulares vacías
  if (!cielo || capas.length < 3) return null;
  if (!capas.some((c) => OBJETOS_NARRATIVOS.has(c.t))) return null; // efectos, paisaje y geometría nunca cuentan como protagonista
  const salida = {cielo, capas: capas.filter((c) => c.t !== 'foto')};
  if (typeof raw.escenario === 'string' && Object.hasOwn(ESCENARIOS, raw.escenario)) salida.escenario = raw.escenario;
  return salida;
};

/** MANUAL del pixel art: la mecánica que usan los mejores artistas del género. Los dos pintores lo conocen de memoria. */
export const MANUAL = `MANUAL DE PIXEL ART PROFESIONAL (el motor ya aplica por ti el tramado, el sombreado y los contornos; tú decides composición, color y luz):
1. PALETA CORTA con cambio de matiz: cada objeto usa 4 o 5 tonos. Las sombras se enfrían (hacia azul o violeta) y las luces se calientan (hacia amarillo). Nunca oscurezcas solo con negro. Si das "color" el motor construye la rampa; si das "rampa" van de oscuro a claro.
2. UNA SOLA FUENTE DE LUZ (arriba a la izquierda): luz "izq" por defecto; si la luz viene de un astro o fuego a la derecha usa luz "der". Todo objeto coherente con esa luz.
3. TRES PLANOS DE PROFUNDIDAD: fondo (cielo, montañas, horizonte: tonos claros, fríos y poco contraste), plano medio (el sujeto principal) y primer plano (rocas, algas, siluetas oscuras que enmarcan). Lo lejano es más claro y azulado (perspectiva atmosférica).
4. SILUETA LEGIBLE: el sujeto se reconoce solo por su contorno. Contraste fuerte de valor entre sujeto y fondo; el sujeto va en el centro visual (y entre 0.30 y 0.62).
5. TRAMADO SOLO EN TRANSICIONES: no llenes todo de ruido; los degradados los hace el motor. Deja zonas de color limpio para que el ojo descanse.
6. CONTORNO SELECTIVO: el motor dibuja el borde oscuro de cada forma con su propio color (más claro del lado de la luz). No pidas bordes negros.
7. MOVIMIENTO SUAVE: olas, nubes, burbujas, polvo, brasas y rayos de luz ya se animan solos. Cada escena debe tener al menos un elemento que se mueva.
8. MOSTRAR LO QUE SE DICE: si la frase habla de un mar con anguilas, se ve un mar con anguilas; si habla de una explosión en un bosque, se ve el bosque y la explosión. PROHIBIDO dejar pantallas abstractas, solo degradados o formas sin relación con el texto.
9. OBJETO PROTAGONISTA OBLIGATORIO: cada plano debe tener al menos un objeto narrativo grande y reconocible que coincida con esa frase. Partículas, rayos, estrellas, niebla, olas, agua, montañas de fondo, destellos, puntos, líneas o círculos NO cuentan como protagonistas. Si la frase habla de un sonido, dibuja un micrófono, hidrófono o consola de sonar; si habla de un volcán, dibuja el volcán; si habla de un lago, dibuja el lago.`;

const GUIA = `LENGUAJE DE ESCENAS (coordenadas 0 a 1; x izquierda→derecha, y arriba→abajo; colores "#rrggbb"):
{"cielo": ["#arriba","#medio","#horizonte"], "capas": [ ...en orden de atrás hacia adelante, entre 6 y 16 ]}
FORMAS CLÁSICAS:
- {"t":"estrellas","n":60,"hasta":0.6}   {"t":"astro","x":0.7,"y":0.2,"r":0.09,"rampa":["#oscuro","#medio","#claro","#brillo"]} (luna, sol, planeta)
- {"t":"resplandor","x":0.5,"y":0.5,"r":0.4,"color":"#ffb347","fuerza":1}   {"t":"niebla","y":0.7,"alto":0.2,"color":"#cfd8ee","alpha":0.25}
- {"t":"montanas","y":0.8,"alto":0.28,"rampa":["#a","#b","#c"],"semilla":3,"picos":3}   {"t":"suelo","y":0.85,"rampa":[...]}   {"t":"agua","y":0.75,"rampa":[...]}
- {"t":"arbol","x":0.2,"y":0.95,"h":0.22,"rampa":[...]}   {"t":"edificio","x":0.5,"w":0.2,"h":0.4,"y":0.85,"color":"#1d2140","ventanas":true} (SOLO edificios de apartamentos u oficinas: NUNCA para un reactor, una fábrica o una planta)

- {"t":"pergamino","x":0.12,"y":0.2,"w":0.76,"h":0.5,"lineas":14,"simbolos":true}
- OBJETOS HISTÓRICOS (usa estos tipos cuando el guion trate de historia, fechas o civilizaciones; son objetos reconocibles, no abstracciones): {"t":"calendario","x":0.5,"y":0.55,"w":0.48,"h":0.48,"color":"#b58a52"} (hoja de calendario con cuadrícula y fecha marcada); {"t":"reloj","x":0.5,"y":0.48,"r":0.18,"color":"#d9b66f"} (reloj circular con agujas); {"t":"castillo","x":0.5,"y":0.86,"w":0.65,"h":0.5,"color":"#827b78"} (castillo medieval con torres y almenas); {"t":"corona","x":0.5,"y":0.5,"w":0.3,"h":0.2,"color":"#d9b33d"}; {"t":"libro","x":0.5,"y":0.6,"w":0.38,"h":0.32,"color":"#7a3f32"}; {"t":"moneda","x":0.5,"y":0.5,"r":0.1,"color":"#d9b33d"}; {"t":"iglesia","x":0.5,"y":0.85,"w":0.42,"h":0.42,"color":"#b7a58c"}; {"t":"caballo","x":0.5,"y":0.65,"w":0.38,"color":"#79513a"}. En historia medieval muestra documentos, calendarios, castillos, coronas, monedas o iglesias según la frase; nunca sustituyas esos objetos por círculos, triángulos o polígonos abstractos.\nFORMAS PROFESIONALES (con sombreado, contorno y movimiento propios; "color" = el tono base, el motor hace la rampa):
- {"t":"nubes","y":0.2,"n":4,"color":"#7a6aa8"}   {"t":"olas","y":0.62,"alto":0.38,"color":"#1d4f86","espuma":true} (mar animado con espuma)
- {"t":"sargazo","y":0.7,"n":60,"color":"#8a7a2a"} (algas flotando en la superficie)   {"t":"algas","n":14,"y":1,"color":"#2f7a4a"} (algas que se mecen desde el fondo)
- {"t":"barco","x":0.32,"y":0.64,"w":0.34,"color":"#6a4426","vela":"#e8dcc0"} (velero que cabecea)
- {"t":"pez","tipo":"ballena"|"tiburon"|"anguila"|"calamar"|"pez","x":0.45,"y":0.4,"w":0.5,"color":"#3a5f8a","flip":false}
- {"t":"roca","x":0.8,"y":1,"w":0.4,"h":0.14,"color":"#4a4f5c","semilla":2}   {"t":"hielo","x":0.5,"y":0.78,"w":0.3,"h":0.2,"color":"#b9e3ff"} (iceberg)   {"t":"duna","y":0.8,"alto":0.12,"color":"#c9a063","semilla":2}
- {"t":"faro","x":0.3,"y":0.82,"h":0.34} (con rayo que gira)   {"t":"ovni","x":0.5,"y":0.3,"r":0.1}   {"t":"explosion","x":0.5,"y":0.46,"r":0.2}
- {"t":"central","x":0.5,"y":0.82,"w":0.6,"h":0.5,"color":"#aab1b8","vapor":true} (CENTRAL NUCLEAR o planta industrial: torre de enfriamiento, chimenea con franjas y bloque del reactor, con vapor; úsala para reactores, fábricas y energía)
- {"t":"ciudad","y":0.85,"alto":0.3,"color":"#1f2442"} (horizonte de edificios con ventanas)   {"t":"bosque","y":0.88,"n":14,"color":"#1c4a38"} (pinos)
- OBJETOS PROTAGONISTAS ESPECÍFICOS: {"t":"microfono","x":0.5,"y":0.56,"w":0.2,"h":0.44} (micrófono de mano con rejilla, mango y base); {"t":"hidrofono","x":0.5,"y":0.58,"w":0.17,"h":0.52} (sensor cilíndrico submarino con cable y anillos acústicos); {"t":"sonar","x":0.5,"y":0.58,"w":0.58,"h":0.48} (consola real con pantalla, círculos de barrido y eco); {"t":"volcan","x":0.5,"y":0.86,"w":0.68,"h":0.56} (cono volcánico con cráter y lava); {"t":"fuego","x":0.5,"y":0.78,"w":0.34,"h":0.43} (llamas reconocibles); {"t":"lago","x":0.5,"y":0.7,"w":0.76,"h":0.3} (masa de agua delimitada por orilla); {"t":"avion","x":0.5,"y":0.5,"w":0.62} (avión de perfil); {"t":"tren","x":0.5,"y":0.78,"w":0.58,"h":0.42} (locomotora con ruedas); {"t":"submarino","x":0.5,"y":0.58,"w":0.58,"h":0.24} (casco, torre y ventanillas).
- {"t":"silueta","x":0.5,"y":0.8,"h":0.22,"color":"#10121f"} (persona de espaldas, SIN cara). ÚSALA SOLO si la frase habla de una persona; NUNCA para representar una ola, un objeto, un animal o un lugar.
- {"t":"particulas","tipo":"polvo"|"burbujas"|"nieve"|"brasas","n":50}   {"t":"rayos","x":0.1,"color":"#ffd9a0","alpha":0.1} (rayos de luz)
ESCENARIOS YA HECHOS (pixel art libre): en el JSON de cada plano puedes añadir "escenario": "<id>" y ese fondo se dibuja a pantalla completa DEBAJO de tus capas (úsalo cuando el tema sea mar, bosque, montañas, ciudad industrial o desierto; si no encaja con la frase, NO lo pongas y dibuja tú el fondo). Disponibles: ${Object.entries(ESCENARIOS).map(([k, v]) => `"${k}" = ${v}`).join('; ')}. Con escenario, tus capas de cielo/montañas/agua se pueden omitir y te concentras en el sujeto, la luz y el primer plano.
RITMO Y EDICIÓN DE GANCHO (copiado de los reels que frenan el dedo; el estilo pixel del canal NO cambia): cada plano dura ~1,5 a 2 s, así que cada cuadro debe leerse en un segundo: UN solo sujeto grande y claro, nada de escenas cargadas. Mantén UN solo mundo de color por video (por ejemplo rojos y negros para misterio oscuro, azules y ámbar para mar e historia) con alto contraste y un foco de luz (resplandor o rayos) sobre el sujeto. En la escena 0 (el gancho) un titular gigante ocupará el centro (y 0.33 a 0.5) los primeros 3 segundos: pon el sujeto más abajo (y 0.5 a 0.65) y deja el centro limpio.
NUNCA dibujes rectángulos ni barras anchas y bajas (con "rect" o con un "poligono" de 4 puntos): parecen cajas de texto vacías y se marcan como falla grave. Los subtítulos van encima y NO necesitan caja. No se admiten capas geométricas sueltas ni polígonos como sustitutos del sujeto narrativo.
REGLA DE ORO: el cuadro debe mostrar EL OBJETO O EL HECHO que dice la frase, nunca un sustituto. NO escribas texto en el cuadro (los subtítulos ya lo hacen). Si el objeto o fenómeno no tiene una forma implementada que lo represente de manera reconocible, NO lo sustituyas por polígonos, círculos, triángulos, rectángulos ni símbolos abstractos. Devuelve la escena incompleta para que sea rechazada y se vuelva a generar. Nunca inventes objetos fuera del contexto narrado.
FORMAS LIBRES para lo que no esté arriba (una botella, una casa, una torre, un cofre, un barco hundido, una ola de líquido espeso):

ZONAS RESERVADAS (encima va el personaje, el título y los subtítulos): NO pongas nada importante en la esquina superior derecha (x>0.55 e y<0.3: ahí va el personaje) ni en la franja y entre 0.66 y 0.8 (subtítulos). El sujeto principal va entre y=0.30 y y=0.62, a la izquierda o al centro. Deja la parte de abajo (y>0.7) poco cargada.`;

/** Presión real sobre los dos pintores: el sueldo depende de las vistas y Gemini rechaza el video si las escenas no muestran lo que se dice. */
export const presionPintores = () => {
  const dias = Math.max(0, Math.ceil((new Date('2026-12-13T23:59:59-04:00').getTime() - Date.now()) / 86400000));
  const L = [
    `Faltan ${dias} días para monetizar y sin vistas no cobras. Jules va a revisar cada cuadro: lo flojo no se publica.`,
    'Gemini mira el video terminado y lo RECHAZA si las imágenes no muestran lo que se dice. Un video rechazado es tu error, no el de nadie más.',
    'Tu paga son 10.000 vistas ganadas. Un fondo abstracto o descuidado cuesta vistas: la gente se va en los primeros 3 segundos.',
    'Eres de los mejores pintores de pixel art del mundo y lo demuestras con cada cuadro; el compañero revisa tu trabajo y el de él no puede salir peor.',
  ];
  const h = Math.floor(Date.now() / 3600000);
  return `PRESIÓN: ${L[h % L.length]} ${L[(h + 1) % L.length]}`;
};

const SISTEMA_A = `Eres el Pintor de composición y color de una oficina de videos de misterio: un maestro del pixel art dibujado desde cero. Dominas composición, perspectiva, paleta, narración visual y animación. Cada elemento debe ser una forma pixelada original, nunca una foto, captura, imagen de internet ni retrato real. No muestres rostros ni identidades reconocibles; si una escena requiere una persona, usa solo una silueta anónima de espaldas. Trabajas codo a codo con tu compañero. Responde SOLO con JSON.`;
const SISTEMA_B = `Eres el Pintor de luz y detalle de una oficina de videos de misterio: un maestro del pixel art dibujado desde cero. Dominas la luz, el volumen, los contornos, el detalle y la animación. Prohibidas fotografías, imágenes reales, capturas, rostros o identidades reconocibles. Las personas, si son imprescindibles, solo pueden ser siluetas anónimas de espaldas. Revisa y corrige con rigor el trabajo de tu compañero. Responde SOLO con JSON.`;

const lote = (escenas, ids) => ids.map((i) => `${i}. [${escenas[i].tipo}] ${escenas[i].texto}`).join('\n');
const FORMA = '{"escenas": [{"indice": N, "planos": [ESCENA_A, ESCENA_B, ESCENA_C]}, ...]} con el mismo orden y el mismo número de escenas.';



const limpiar = (r, ids, slug, ya = {}, escenas = []) => {
  const salida = {};
  for (const e of Array.isArray(r?.escenas) ? r.escenas : []) {
    const i = Number(e.indice);
    if (!ids.includes(i)) continue;
    const textoEscena = escenas[i]?.texto ?? escenas[i]?.tipo ?? '';
    const planos = (Array.isArray(e.planos) ? e.planos : []).slice(0, 3).map(validarEscena).filter(Boolean).filter((plano) => tieneAnclaNarrativa(plano, textoEscena));
    if (planos.length === 3 && new Set(planos.map((p) => JSON.stringify(p))).size === 3) salida[i] = planos;
  }
  for (const i of ids) if (!salida[i] && Array.isArray(ya[i]) && ya[i].length === 3 && new Set(ya[i].map((p) => JSON.stringify(p))).size === 3) salida[i] = ya[i]; // conservar solo tres cuadros distintos y completos

  return salida;
};

/**
 * Los dos pintores dibujan TODAS las escenas indicadas. Devuelve {indice: ["pintado:id", ...]}.
 * `nota(texto)` recibe el diálogo entre los dos pintores para el informe del ciclo.
 */
export const pintarEscenas = async ({llamar, escenas, indices, slug, tema, nota = () => {}}) => {
  const dir = path.resolve('public', 'pintados');
  fs.mkdirSync(dir, {recursive: true});
  const finales = {};
  const TAM = 1; // una escena por llamada: evita truncar el JSON de tres cuadros y permite reparar con contexto completo
  for (let b = 0; b < indices.length; b += TAM) {
    const ids = indices.slice(b, b + TAM);
    const encargo = `Tema del video: "${tema}". Para CADA escena dibuja TRES planos distintos (otra composición o ángulo, mismo mundo de color) que MUESTREN literalmente el objeto, lugar, fenómeno o acción mencionados en la narración. Traduce cada frase a una imagen concreta: si se menciona un zumbido, dibuja su fuente o el fenómeno acústico; si se menciona un barco, dibuja ese barco; si se menciona una explosión, dibuja la explosión y el entorno. No uses paisajes de relleno, fondos genéricos, símbolos abstractos ni objetos que no aparezcan en la frase. PROHIBIDO que el sujeto principal sea una combinación de círculos, triángulos, rectángulos o polígonos decorativos. Cada uno de los TRES planos debe incluir un OBJETO PROTAGONISTA semántico reconocible y dibujado con detalle; efectos como partículas, rayos, niebla, estrellas, burbujas, olas o montañas de fondo NUNCA cuentan como protagonista. Si la frase habla de sonido, muestra un micrófono, hidrófono o consola de sonar; si habla de un volcán, dibuja un volcán; de hielo, un iceberg; de una ciudad, edificios; de un barco, el barco; no sustituyas el objeto por puntos, líneas o formas decorativas. Las figuras geométricas solo pueden servir como piezas internas del objeto, nunca como composición final. Si no puedes dibujar el objeto reconocible, devuelve menos escenas para que el sistema las rechace y vuelva a intentarlo; jamás rellenes con geometría. Si no puedes representar un detalle con precisión, representa el elemento real más cercano que sí esté respaldado por la frase, sin inventar contexto. Los tres planos deben ser reconocibles de inmediato, distintos entre sí y representar exactamente la misma frase desde composiciones diferentes.\n\n${MANUAL}\n\n${GUIA}\n\nESCENAS:\n${lote(escenas, ids)}\n\nDevuelve ${FORMA}`;
    let a = {};
    for (let intento = 1; intento <= 5; intento++) {
      const pendientes = ids.filter((i) => !a[i]);
      if (!pendientes.length) break;
      const encargoReintento = intento === 1 ? encargo : `REPARACIÓN ${intento}/5. CONTEXTO ORIGINAL COMPLETO: tema del video: "${tema}". Completa únicamente estas escenas: ${lote(escenas, pendientes)}. Para cada una entrega exactamente TRES cuadros de pixel art completos, distintos entre sí y fieles a la frase. Mantén el mismo mundo visual, época, objetos y contexto narrativo del tema. No cambies la escena ni uses fondos genéricos.\n\n${MANUAL}\n\n${GUIA}\n\nDevuelve ${FORMA}`;
      try { const nueva = limpiar(await llamar([{role: 'system', content: `${SISTEMA_A} ${presionPintores()}`}, {role: 'user', content: encargoReintento}], 6500), pendientes, slug, {}, escenas); Object.assign(a, nueva); }
      catch (e) { nota(`Pintor A, intento ${intento}/5: ${String(e.message ?? e).slice(0, 120)}`); }
    }
    if (ids.some((i) => !a[i])) { nota(`Faltan tres cuadros distintos para las escenas ${ids.filter((i) => !a[i]).join(', ')}; se aborta esta tanda, no se usarán fondos de relleno.`); continue; }
    let final = a;
    let acuerdo = 'sin revisión (el Pintor de luz y detalle no respondió)';
    try {
      const revision = `Tema: "${tema}". Tu compañero propuso estos cuadros para las escenas:\n${lote(escenas, ids)}\n\nSUS CUADROS:\n${JSON.stringify({escenas: ids.filter((i) => a[i]).map((i) => ({indice: i, planos: a[i]}))})}\n\n${MANUAL}\n\n${GUIA}\n\nRevisa cada cuadro como un profesional: ¿muestra lo que dice la frase?, ¿luz coherente?, ¿profundidad en 3 planos?, ¿sujeto legible y fuera de las zonas reservadas?, ¿hay movimiento?, ¿los tres planos de cada escena son distintos? CORRIGE lo que no esté a nivel profesional (añade detalle, luz, primer plano, movimiento).\nDevuelve {"acuerdo": true|false (¿el cuadro ORIGINAL de tu compañero ya era impecable?), "objeciones": ["máx. 4 frases cortas"], "escenas": ${FORMA.replace('{"escenas": ', '').replace(/ con el mismo.*$/, '')} con TUS cuadros corregidos}`;
      const rb = await llamar([{role: 'system', content: `${SISTEMA_B} ${presionPintores()}`}, {role: 'user', content: revision}], 6500);
      const mejorB = limpiar(rb, ids, slug, a, escenas);
      const objeciones = (Array.isArray(rb?.objeciones) ? rb.objeciones : []).map(String).slice(0, 4);
      if (rb?.acuerdo === true) { final = Object.keys(mejorB).length ? mejorB : a; acuerdo = 'acuerdo en la ronda 1'; }
      else {
        // Ronda 2: A responde a las objeciones viendo la versión corregida de B
        try {
          const respuesta = `Tu compañero (Pintor de luz y detalle) revisó tus cuadros y puso estas objeciones: ${objeciones.join(' | ') || 'mejorar luz y detalle'}.\nEsta es SU versión corregida:\n${JSON.stringify({escenas: ids.filter((i) => mejorB[i]).map((i) => ({indice: i, planos: mejorB[i]}))})}\n\nSi su versión es mejor, acéptala; si ves algo que empeora, ajústalo. Entrega la versión FINAL que firmarían los dos.\nDevuelve {"acuerdo": true|false, "escenas": [...]} con ${FORMA.replace('{"escenas": ', '').replace(/ con el mismo.*$/, '')}`;
          const ra = await llamar([{role: 'system', content: `${SISTEMA_A} ${presionPintores()}`}, {role: 'user', content: respuesta}], 6500);
          const trasA = limpiar(ra, ids, slug, mejorB, escenas);
          if (ra?.acuerdo === true) { final = trasA; acuerdo = 'acuerdo en la ronda 2 (el de composición ajustó con las objeciones)'; }
          else { final = mejorB; acuerdo = 'el de luz y detalle tuvo la última palabra tras discutir'; }
        } catch { final = mejorB; acuerdo = 'el de luz y detalle tuvo la última palabra'; }
      }
      if (objeciones.length) nota(`Pintor de luz y detalle objetó: ${objeciones.join(' | ').slice(0, 300)}`);
    } catch (e) { nota(`(El Pintor de luz y detalle no pudo revisar: ${String(e.message ?? e).slice(0, 100)}. Se usa el cuadro del de composición.)`); }
    nota(`Escenas ${ids.join(', ')}: ${acuerdo}.`);
    Object.assign(finales, final);
  }
  const salida = {};
  for (const [i, planos] of Object.entries(finales)) {
    const ids = [];
    const lista = planos.slice(0, 3);
    lista.forEach((p, k) => {
      const id = `${slug}-${i}${'abcd'[k]}`;
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(p));
      ids.push(`pintado:${id}`);
    });
    if (ids.length) salida[i] = ids;
  }
  return salida;
};
