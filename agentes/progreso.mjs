// Barra de progreso REAL del próximo video. Uso: node agentes/progreso.mjs <porcentaje> "<etapa>" [tema]   (CANAL por defecto lqns)
// Escribe oficina-salida/<canal>/progreso.json; los flujos lo suben a GitHub en cada etapa y la oficina 3D lo muestra.
import fs from 'node:fs';
import path from 'node:path';

const canal = (process.env.CANAL || 'lqns').trim();
const [pct, etapa, ...tema] = process.argv.slice(2);
const carpeta = path.resolve('oficina-salida', canal);
fs.mkdirSync(carpeta, {recursive: true});
const ruta = path.join(carpeta, 'progreso.json');
let previo = {};
try { previo = JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { /* primera vez */ }
fs.writeFileSync(ruta, JSON.stringify({
  porcentaje: Math.max(0, Math.min(100, Number(pct) || 0)),
  etapa: String(etapa ?? '').slice(0, 80),
  tema: tema.join(' ').slice(0, 120) || previo.tema || '',
  actualizado: new Date().toISOString(),
}, null, 2));
console.log(`Progreso: ${pct}% · ${etapa}`);
