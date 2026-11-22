// IDEAS DE ESTILO para los pintores: busca en OpenGameArt (gratis, sin llave) ejemplos de pixel art con licencia CC0 parecidos al tema
// y Gemini los MIRA y cuenta qué hacen bien (composición, paleta, recursos). Las imágenes NO se copian ni se guardan en el repositorio:
// solo se usan sus descripciones como inspiración. Nunca lanza: si algo falla devuelve [] y los pintores trabajan como siempre.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {mirarFoto, textoDeVista} from './ojos.mjs';

const UA = 'Mozilla/5.0 (compatible; FabricaDeVideos/1.0)';
const BUSQUEDA = 'https://opengameart.org/art-search-advanced?field_art_type_tid%5B%5D=9&field_art_licenses_tid%5B%5D=4&sort_by=count&sort_order=DESC&keys=';
const MAX_BYTES = 700 * 1024;
const NO_PAGINA = /^(faq|cc0|cc-by|cc-by-sa|gpl|oga-by|license)/i;

const pedir = (url, ms = 20000) => fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(ms)});

/** Páginas de OpenGameArt (slug, título) que salen para la búsqueda, ya filtradas a CC0 y a 2D. */
export const buscarPaquetes = async (consulta, max = 6) => {
  const r = await pedir(BUSQUEDA + encodeURIComponent(consulta));
  if (!r.ok) return [];
  const html = await r.text();
  const vistos = new Set();
  const salida = [];
  for (const m of html.matchAll(/href="\/content\/([a-z0-9-]+)"[^>]*>([^<]+)</gi)) {
    if (NO_PAGINA.test(m[1]) || vistos.has(m[1])) continue;
    vistos.add(m[1]);
    salida.push({slug: m[1], titulo: m[2].replace(/&amp;/g, '&').replace(/&quot;/g, '"').slice(0, 80)});
    if (salida.length >= max) break;
  }
  return salida;
};

/** Abre la página del paquete, confirma que dice CC0 y baja su imagen de vista previa (png/jpg) a un archivo temporal. */
export const bajarVistaPrevia = async (slug, carpeta) => {
  const r = await pedir(`https://opengameart.org/content/${slug}`);
  if (!r.ok) return null;
  const html = await r.text();
  const licencia = html.split('field-name-field-art-licenses')[1]?.slice(0, 700) ?? '';
  if (!/CC0/.test(licencia)) return null; // sin CC0 confirmado, no se usa
  const og = /property="og:image"\s+content="([^"]+)"/.exec(html)?.[1] ?? /content="([^"]+)"\s+property="og:image"/.exec(html)?.[1];
  if (!og || !/^https:\/\/opengameart\.org\/sites\/default\/files\//.test(og)) return null;
  const img = await pedir(og, 30000);
  if (!img.ok) return null;
  const buf = Buffer.from(await img.arrayBuffer());
  if (buf.length < 2000 || buf.length > MAX_BYTES) return null;
  const magia = buf.subarray(0, 4).toString('hex');
  if (!(magia.startsWith('ffd8ff') || magia === '89504e47')) return null; // gif u otros: no
  const ruta = path.join(carpeta, `${slug}.${magia === '89504e47' ? 'png' : 'jpg'}`);
  fs.writeFileSync(ruta, buf);
  return ruta;
};

/**
 * Devuelve hasta `cuantas` ideas de estilo (texto) para meter en el encargo de los pintores.
 * `consultas`: búsquedas en orden (la última, genérica, siempre da resultados).
 */
export const reunirInspiracion = async ({tema, key, consultas = null, cuantas = 2, limiteMs = 110000, nota = () => {}}) => {
  const ideas = [];
  const hasta = Date.now() + limiteMs; // tope duro de tiempo: la oficina nunca espera más que esto
  if (!key) return ideas;
  let carpeta = null;
  try {
    carpeta = fs.mkdtempSync(path.join(os.tmpdir(), 'inspiracion-'));
    const palabras = String(tema ?? '').replace(/[^\p{L}\p{N} ]/gu, ' ').split(/\s+/).filter((p) => p.length > 3).slice(0, 3);
    const lista = consultas ?? [`${palabras.join(' ')} background`.trim(), 'pixel art background', 'pixel art landscape'].filter((c) => c.length > 5);
    const usados = new Set();
    for (const q of lista) {
      if (ideas.length >= cuantas || Date.now() > hasta - 15000) break;
      let paquetes = [];
      try { paquetes = await buscarPaquetes(q); } catch { continue; }
      for (const p of paquetes) {
        if (ideas.length >= cuantas || Date.now() > hasta - 15000) break;
        if (usados.has(p.slug)) continue;
        usados.add(p.slug);
        try {
          const ruta = await bajarVistaPrevia(p.slug, carpeta);
          if (!ruta) continue;
          const g = await mirarFoto({ruta, key, frase: tema, modo: 'estilo', maxIntentos: 1, hasta});
          if (g.vista) ideas.push({paquete: p.titulo, url: `https://opengameart.org/content/${p.slug}`, texto: textoDeVista(g.vista)});
          else nota(`(Gemini no pudo mirar el ejemplo "${p.titulo}": ${String(g.error).slice(0, 100)})`);
        } catch (e) { nota(`(Ejemplo "${p.titulo}": ${String(e.message ?? e).slice(0, 80)})`); }
      }
    }
  } catch (e) { nota(`(Sin ideas de estilo: ${String(e.message ?? e).slice(0, 100)})`); }
  finally { try { if (carpeta) fs.rmSync(carpeta, {recursive: true, force: true}); } catch { /* temporal */ } }
  return ideas;
};
