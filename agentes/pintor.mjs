// Pintor de imágenes: para las escenas que no tienen un fondo en el catálogo, Groq escribe una descripción de escena (cielo, astros,
// montañas, agua, edificios, pergaminos…) en un lenguaje simple y el motor de pixel art de Remotion la dibuja (src/components/fondos/pintado.ts).
// Cada escena recibe 2 planos distintos para que el fondo cambie cada pocos segundos. Valida todo: nada raro llega al render.
// Se llama desde oficina.mjs. Escribe public/pintados/<slug>-<n>.json y devuelve los nombres "pintado:<id>".
import fs from 'node:fs';
import path from 'node:path';

const HEX = /^#[0-9a-fA-F]{6}$/;
const n = (v, d, a, b) => { const x = Number(v); return Number.isFinite(x) ? Math.min(b, Math.max(a, x)) : d; };
const rampa = (v, min = 2, max = 6) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string' && HEX.test(x)).slice(0, max) : []).length >= min ? v.filter((x) => typeof x === 'string' && HEX.test(x)).slice(0, max) : null;
const TIPOS = new Set(['estrellas', 'astro', 'resplandor', 'montanas', 'suelo', 'agua', 'niebla', 'arbol', 'edificio', 'circulo', 'rect', 'pergamino', 'texto']);

/** Limpia una escena: solo tipos y rangos permitidos. Devuelve null si no sirve. */
export const validarEscena = (raw) => {
  if (!raw || typeof raw !== 'object') return null;
  const cielo = rampa(raw.cielo, 2, 5);
  const capas = (Array.isArray(raw.capas) ? raw.capas : []).filter((e) => e && TIPOS.has(e.t)).slice(0, 20).map((e) => {
    const o = {t: e.t};
    for (const k of ['x', 'y', 'w', 'h', 'r', 'alto', 'alpha', 'fuerza', 'hasta']) if (e[k] !== undefined) o[k] = n(e[k], 0.5, 0, 1);
    for (const k of ['n', 'semilla', 'picos', 'lineas', 'tam']) if (e[k] !== undefined) o[k] = n(e[k], 5, 0, 200);
    if (HEX.test(e.color ?? '')) o.color = e.color;
    const r = rampa(e.rampa); if (r) o.rampa = r;
    if (typeof e.s === 'string') o.s = e.s.slice(0, 22);
    if (typeof e.ventanas === 'boolean') o.ventanas = e.ventanas;
    return o;
  });
  if (!cielo || capas.length < 3) return null;
  return {cielo, capas};
};

const GUIA = `LENGUAJE DE ESCENAS (coordenadas 0 a 1; x izquierda→derecha, y arriba→abajo; colores "#rrggbb"):
{"cielo": ["#arriba","#medio","#horizonte"], "capas": [ ...en orden de atrás hacia adelante ]}
Tipos de capa:
- {"t":"estrellas","n":60,"hasta":0.6}
- {"t":"astro","x":0.7,"y":0.2,"r":0.09,"rampa":["#oscuro","#medio","#claro","#brillo"]}  (luna, sol, planeta)
- {"t":"resplandor","x":0.5,"y":0.5,"r":0.4,"color":"#ffb347","fuerza":1}
- {"t":"montanas","y":0.8,"alto":0.28,"rampa":["#a","#b","#c"],"semilla":3,"picos":3}
- {"t":"suelo","y":0.85,"rampa":["#a","#b","#c"]}   {"t":"agua","y":0.75,"rampa":["#a","#b","#c"]}
- {"t":"niebla","y":0.7,"alto":0.2,"color":"#cfd8ee","alpha":0.25}
- {"t":"arbol","x":0.2,"y":0.95,"h":0.22,"rampa":["#a","#b","#c"]}
- {"t":"edificio","x":0.5,"w":0.2,"h":0.4,"y":0.85,"color":"#1d2140","ventanas":true}
- {"t":"circulo","x":0.5,"y":0.5,"r":0.08,"rampa":[...]} (esfera sombreada: globo, ojo, objeto redondo)
- {"t":"rect","x":0.3,"y":0.5,"w":0.2,"h":0.1,"color":"#5a4a3a"}
- {"t":"pergamino","x":0.12,"y":0.2,"w":0.76,"h":0.5,"lineas":14,"simbolos":true}  (manuscrito, mapa, documento)
- {"t":"texto","s":"MÁX 22 LETRAS","x":0.5,"y":0.1,"tam":22,"color":"#ffd27a"}  (una cifra o palabra clave grande)
ZONAS RESERVADAS (el video pone encima el personaje, el título y los subtítulos): NO pongas nada importante en la esquina superior derecha (x>0.55 e y<0.3: ahí va el personaje) ni en la franja y entre 0.66 y 0.8 (subtítulos). La figura principal va entre y=0.3 y y=0.62, y el texto grande en y entre 0.32 y 0.55.
Reglas: entre 6 y 14 capas; paleta coherente de 4 a 6 colores por escena; contraste fuerte entre figura y fondo; deja la parte de abajo (y>0.7) poco cargada.`;

/** Pinta las escenas sin imagen. Devuelve un arreglo (por escena) con la lista de fondos o null si la escena no se pintó. */
export const pintarEscenas = async ({llamar, escenas, indices, slug, tema}) => {
  const dir = path.resolve('public', 'pintados');
  fs.mkdirSync(dir, {recursive: true});
  const lista = indices.map((i) => `${i}. [${escenas[i].tipo}] ${escenas[i].texto}`).join('\n');
  const r = await llamar([
    {role: 'system', content: 'Eres el Pintor de una oficina de videos de misterio. Tienes cinco maestrías en arte y diseño: pixel art, composición, color y luz. Dibujas escenas dramáticas y claras que muestran lo que se dice. Sin personas reales ni caras. Responde SOLO con JSON.'},
    {role: 'user', content: `Tema del video: "${tema}". Para CADA escena de abajo dibuja DOS planos distintos (distinta composición o ángulo, mismo mundo de color) que muestren visualmente lo que se dice.\n\n${GUIA}\n\nESCENAS:\n${lista}\n\nDevuelve {"escenas": [{"indice": N, "planos": [ESCENA_A, ESCENA_B]}, ...]} con el mismo orden.`},
  ], 6000);
  const salida = {};
  for (const e of Array.isArray(r?.escenas) ? r.escenas : []) {
    const i = Number(e.indice);
    if (!indices.includes(i)) continue;
    const ids = [];
    (Array.isArray(e.planos) ? e.planos : []).slice(0, 2).forEach((p, k) => {
      const v = validarEscena(p);
      if (!v) return;
      const id = `${slug}-${i}${'ab'[k]}`;
      fs.writeFileSync(path.join(dir, `${id}.json`), JSON.stringify(v));
      ids.push(`pintado:${id}`);
    });
    if (ids.length) salida[i] = ids;
  }
  return salida;
};
