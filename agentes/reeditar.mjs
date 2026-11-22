// REEDICIÓN: rehace desde cero las IMÁGENES de un video ya escrito (mismo guion y misma voz) con fotos reales pixeladas de cada escena.
// Uso: SLUG=chernobyl-disaster CANAL=lqns node agentes/reeditar.mjs
// Después lo deja "aprobado" y fuera de producidos.json para que Producción lo renderice y lo suba a todas las redes.
import fs from 'node:fs';
import path from 'node:path';
import {chatAlternativo} from './llm.mjs';
import {crearVisuales} from './visuales.mjs';
import {ganchoDe} from './titular.mjs';

const CANAL = process.env.CANAL || 'lqns';
const SLUG = String(process.env.SLUG || '').trim();
const SALIDA = path.join('oficina-salida', CANAL);
if (!/^[a-z0-9-]+$/.test(SLUG)) { console.error('Falta SLUG válido (ej: chernobyl-disaster)'); process.exit(1); }
const rutaGuion = path.join(SALIDA, `guion-${SLUG}.json`);
if (!fs.existsSync(rutaGuion)) { console.error('No existe ' + rutaGuion); process.exit(1); }

const extraer = (t) => { const a = t.indexOf('{'), b = t.lastIndexOf('}'); return JSON.parse(t.slice(a, b + 1)); };
const llamar = async (mensajes, max) => {
  for (let k = 1; k <= 3; k++) {
    const r = await chatAlternativo(mensajes, {maxTokens: max, json: true});
    if (r) { try { return extraer(r.texto); } catch { /* se pide otra vez */ } }
  }
  throw new Error('Ningún modelo de IA devolvió JSON válido.');
};

const guion = JSON.parse(fs.readFileSync(rutaGuion, 'utf8'));
const informe = [`# Reedición de ${SLUG}`];
const nota = (t) => { informe.push(t); console.log(t); };
const escenas = guion.escenas.map(({fondo, ...e}) => e);

const v = await crearVisuales({llamar, escenas, slug: SLUG, tema: String(guion.titulo ?? SLUG).replace(/[^\p{L}\p{N} ]/gu, ' ').trim(), canal: CANAL, nota});
if (!Object.keys(v.fondos).length) { console.error('No se pudo generar ninguna imagen: no se toca el guion.'); process.exit(1); }

guion.escenas = guion.escenas.map((e, i) => ({...e, fondo: v.fondos[i] ?? ['pixelmisterio']}));
guion.ganchoTexto = ganchoDe(guion.escenas[0]?.texto);
guion.estado = 'aprobado';
guion.creado = new Date().toISOString();
guion.reeditado = {fecha: guion.creado, fotos: v.cobertura};
if (v.creditos && guion.publicacion?.descripcion && !guion.publicacion.descripcion.includes(v.creditos)) guion.publicacion.descripcion += `\n\n${v.creditos}`;
fs.writeFileSync(rutaGuion, JSON.stringify(guion, null, 2));

const rutaProd = path.join(SALIDA, 'producidos.json');
try { fs.writeFileSync(rutaProd, JSON.stringify(JSON.parse(fs.readFileSync(rutaProd, 'utf8')).filter((s) => s !== SLUG), null, 2)); } catch { /* sin lista */ }
fs.writeFileSync(path.join(SALIDA, `informe-${SLUG}-reedicion.md`), informe.join('\n'));
console.log(`Reedición lista: ${v.cobertura.conFoto}/${v.cobertura.total} escenas con foto real.`);
