// Aplica las respuestas del dueño en modo manual (las escribe la oficina 3D en oficina-salida/<canal>/manual.json).
// aprobar → el guion pasa a "aprobado" y se lanza Producción; descartar → se descarta; cambios → se descarta, la nota queda como lección y se repite el tema.
// Imprime líneas para el flujo de GitHub: PRODUCCION=si, REHACER=<tema>|<formato>. Nunca toca nada si no hay respuestas nuevas.
import fs from 'node:fs';
import path from 'node:path';
import {leerManual, rutaManual, ESTADO_ESPERA} from './manual.mjs';

const RAIZ = 'oficina-salida';
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const slugDe = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
const lineas = [];

let canales = [];
try { canales = fs.readdirSync(RAIZ, {withFileTypes: true}).filter((d) => d.isDirectory() && fs.existsSync(rutaManual(d.name))).map((d) => d.name); } catch { /* sin carpeta */ }

for (const canal of canales) {
  const m = leerManual(canal);
  const nuevas = m.acciones.filter((a) => a?.id && !m.aplicadas.includes(a.id));
  for (const a of nuevas) {
    const slug = String(a.slug ?? '').replace(/[^a-z0-9-]/g, '');
    const ruta = path.join(RAIZ, canal, `guion-${slug}.json`);
    const g = leer(ruta, null);
    m.aplicadas.push(a.id);
    if (!g || g.estado !== ESTADO_ESPERA) { console.log(`${canal}/${slug}: ya no espera visto bueno (${g?.estado ?? 'no existe'}); se ignora.`); continue; }
    if (a.accion === 'aprobar') {
      g.estado = 'aprobado'; g.creado = new Date().toISOString(); g.vistoBueno = {fecha: new Date().toISOString()};
      fs.writeFileSync(ruta, JSON.stringify(g, null, 2));
      const rp = path.join(RAIZ, canal, 'producidos.json');
      fs.writeFileSync(rp, JSON.stringify(leer(rp, []).filter((s) => s !== slug), null, 2));
      lineas.push('PRODUCCION=si');
      console.log(`${canal}/${slug}: APROBADO por el dueño.`);
    } else if (a.accion === 'descartar') {
      g.estado = 'descartado-por-dueno'; fs.writeFileSync(ruta, JSON.stringify(g, null, 2));
      console.log(`${canal}/${slug}: descartado por el dueño.`);
    } else if (a.accion === 'cambios') {
      const nota = String(a.nota ?? '').replace(/\s+/g, ' ').trim().slice(0, 400);
      g.estado = 'descartado-por-dueno'; g.cambiosPedidos = nota; fs.writeFileSync(ruta, JSON.stringify(g, null, 2));
      const rutaApr = path.join(RAIZ, canal, 'aprendizajes.json');
      fs.writeFileSync(rutaApr, JSON.stringify([{fecha: new Date().toISOString(), video: g.titulo, mejora: `EL DUEÑO PIDIÓ ESTOS CAMBIOS (obligatorio): ${nota}`, quejas: [nota]}, ...leer(rutaApr, [])].slice(0, 12), null, 2));
      const tema = (leer(path.join(RAIZ, canal, 'estado.json'), {}).historial ?? []).find((h) => slugDe(h.tema) === slug)?.tema;
      if (tema) lineas.push(`REHACER=${tema}|${g.formato === 'largo' ? 'largo' : 'short'}`);
      console.log(`${canal}/${slug}: cambios pedidos ("${nota}")${tema ? `; se rehace el tema "${tema}"` : '; no encontré el tema original, solo queda la lección'}.`);
    }
  }
  if (nuevas.length) fs.writeFileSync(rutaManual(canal), JSON.stringify({activo: m.activo, acciones: m.acciones.slice(-60), aplicadas: m.aplicadas.slice(-200)}, null, 2));
}
for (const l of lineas) console.log(l);
if (process.env.GITHUB_OUTPUT) for (const l of lineas) fs.appendFileSync(process.env.GITHUB_OUTPUT, l + '\n');
