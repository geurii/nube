// Producción: toma el primer guion APROBADO que aún no tiene video, le pone la voz (msedge-tts) y lo renderiza con el sistema del canal.
// Corre en GitHub Actions después de la Oficina (ver produccion.yml). Deja el estado para los personajes 3D.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';

const SAL = 'oficina-salida';
const PRODUCIDOS = path.join(SAL, 'producidos.json');
const ESTADO = path.join(SAL, 'estado.json');
const leer = (ruta, porDefecto) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return porDefecto; } };
const salida = (clave, valor) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}\n`); };

const marcar = (cambios) => {
  const e = leer(ESTADO, {agentes: {}, historial: [], totales: {}});
  e.agentes = {...(e.agentes ?? {}), ...cambios};
  e.actualizado = new Date().toISOString();
  fs.writeFileSync(ESTADO, JSON.stringify(e, null, 2));
};

fs.mkdirSync(SAL, {recursive: true});
const producidos = leer(PRODUCIDOS, []);
const pendientes = fs.existsSync(SAL)
  ? fs.readdirSync(SAL)
      .filter((f) => /^guion-.+\.json$/.test(f))
      .map((f) => ({f, slug: f.replace(/^guion-|\.json$/g, ''), g: leer(path.join(SAL, f), null), t: fs.statSync(path.join(SAL, f)).mtimeMs}))
      .filter((x) => x.g && x.g.estado === 'aprobado' && !producidos.includes(x.slug))
      .sort((a, b) => a.t - b.t)
  : [];

if (!pendientes.length) {
  console.log('No hay guiones aprobados sin producir. Nada que hacer.');
  salida('id', '');
  process.exit(0);
}

const {slug, g} = pendientes[0];
const id = `oficina-${slug}`;
console.log(`Produciendo ${id}: "${g.titulo}" (${g.formato})`);
fs.mkdirSync(path.join('guion', 'serie'), {recursive: true});
fs.writeFileSync(path.join('guion', 'serie', `${id}.json`), JSON.stringify({...g, audio: `audio/${id}.wav`}, null, 2));

// lote.mjs: voz (msedge-tts) + render + versión liviana. La voz sale de guion.voz.
const r = spawnSync('node', ['scripts/lote.mjs', id, '--forzar'], {stdio: 'inherit'});
const mp4 = path.join('out', 'serie', `${id}.mp4`);
if (r.status !== 0 || !fs.existsSync(mp4)) {
  marcar({
    'Locutor': {estado: 'esperando_decision', actividad: 'hablando', tarea: `No pudo grabar o renderizar "${g.titulo}". Revisa el registro de la corrida "Produccion" en GitHub. JEFA: sin video no hay canal.`},
    'Técnico de render': {estado: 'esperando_decision', actividad: 'pensando', tarea: `Falló el render de "${g.titulo}". JEFA: quiero la causa y el arreglo.`},
  });
  salida('id', '');
  console.error('Falló la producción.');
  process.exit(1);
}

const mb = (fs.statSync(mp4).size / 1024 / 1024).toFixed(0);
fs.writeFileSync(PRODUCIDOS, JSON.stringify([...producidos, slug], null, 2));
marcar({
  'Locutor': {estado: 'libre', actividad: 'hablando', tarea: `Grabó la voz de "${g.titulo}".`},
  'Técnico de render': {estado: 'libre', actividad: 'escribiendo', tarea: `Renderizó "${g.titulo}" (${mb} MB). Está en Actions, artefacto "video-${id}".`},
  'Publicador': {estado: 'esperando_decision', actividad: 'pensando', tarea: `Tiene un video listo: "${g.titulo}". Falta subirlo a YouTube (necesita tu conexión; ver subir.mjs).`},
});
salida('id', id);
console.log(`Producción terminada: ${mp4} (${mb} MB)`);
