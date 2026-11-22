// Producción: toma el primer guion APROBADO (de cualquier canal) que aún no tiene video, le pone la voz (msedge-tts)
// y lo renderiza con el sistema del canal. Corre en GitHub Actions después de la Oficina (ver produccion.yml).
// Deja el estado y una notificación para la oficina 3D. Salidas del flujo: id (para el artefacto) y canal.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {avisarTelefono} from './aviso.mjs';

const RAIZ = 'oficina-salida';
const leer = (ruta, porDefecto) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return porDefecto; } };
const salida = (clave, valor) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}\n`); };
const config = leer(path.join('agentes', 'canales-propios.json'), {canales: []}).canales ?? [];
const nombreDe = (canal) => config.find((c) => c.id === canal)?.nombre ?? canal;

const marcar = (canal, cambios) => {
  const ruta = path.join(RAIZ, canal, 'estado.json');
  const e = leer(ruta, {agentes: {}, historial: [], totales: {}});
  e.agentes = {...(e.agentes ?? {}), ...cambios};
  e.actualizado = new Date().toISOString();
  fs.writeFileSync(ruta, JSON.stringify(e, null, 2));
};
const notificar = (canal, tipo, titulo, texto) => {
  avisarTelefono(tipo, titulo, texto);
  const ruta = path.join(RAIZ, 'notificaciones.json');
  const lista = leer(ruta, []);
  lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal, canalNombre: nombreDe(canal), tipo, titulo, texto});
  fs.writeFileSync(ruta, JSON.stringify(lista.slice(0, 80), null, 2));
};

fs.mkdirSync(RAIZ, {recursive: true});
/** "the-bloop" y "bloop" son el mismo tema: no se produce dos veces. */
const claveTema = (x) => String(x).toLowerCase().replace(/^the[-_ ]+/, '').replace(/[^a-z0-9]+/g, '');
const pendientes = fs.readdirSync(RAIZ, {withFileTypes: true})
  .filter((d) => d.isDirectory() && d.name !== 'pedidos')
  .flatMap((d) => {
    const producidos = leer(path.join(RAIZ, d.name, 'producidos.json'), []);
    return fs.readdirSync(path.join(RAIZ, d.name))
      .filter((f) => /^guion-.+\.json$/.test(f))
      .map((f) => ({canal: d.name, slug: f.replace(/^guion-|\.json$/g, ''), g: leer(path.join(RAIZ, d.name, f), null), t: fs.statSync(path.join(RAIZ, d.name, f)).mtimeMs, producidos}))
      .filter((x) => x.g && x.g.estado === 'aprobado' && !x.producidos.some((p) => claveTema(p) === claveTema(x.slug)));
  })
  // por fecha de creación del guion (en GitHub Actions la fecha del archivo es la del checkout y no sirve para ordenar)
  .sort((a, b) => (Date.parse(a.g.creado) || a.t) - (Date.parse(b.g.creado) || b.t));

if (!pendientes.length) {
  console.log('No hay guiones aprobados sin producir. Nada que hacer.');
  salida('id', '');
  salida('canal', '');
  process.exit(0);
}

const {canal, slug, g, producidos} = pendientes[0];
const id = `${canal}-${slug}`;
console.log(`Produciendo ${id}: "${g.titulo}" (${g.formato}) del canal ${nombreDe(canal)}`);
fs.mkdirSync(path.join('guion', 'serie'), {recursive: true});
fs.writeFileSync(path.join('guion', 'serie', `${id}.json`), JSON.stringify({...g, audio: `audio/${id}.wav`}, null, 2));

// lote.mjs: voz (msedge-tts) + render + versión liviana. La voz sale de guion.voz (cada canal tiene la suya).
const r = spawnSync('node', ['scripts/lote.mjs', id, '--forzar'], {stdio: 'inherit'});
const mp4 = path.join('out', 'serie', `${id}.mp4`);
if (r.status !== 0 || !fs.existsSync(mp4)) {
  marcar(canal, {
    'Locutor': {estado: 'esperando_decision', actividad: 'hablando', tarea: `No pudo grabar o renderizar "${g.titulo}". Revisa la corrida "Produccion" en GitHub. JEFA: sin video no hay canal.`},
    'Técnico de render': {estado: 'esperando_decision', actividad: 'pensando', tarea: `Falló el render de "${g.titulo}". JEFA: quiero la causa y el arreglo.`},
  });
  notificar(canal, 'alerta', 'Falló la producción', `No se pudo producir "${g.titulo}". Revisa la corrida "Produccion" en GitHub (Actions).`);
  salida('id', '');
  salida('canal', '');
  console.error('Falló la producción.');
  process.exit(1);
}

const mb = (fs.statSync(mp4).size / 1024 / 1024).toFixed(0);
fs.writeFileSync(path.join(RAIZ, canal, 'producidos.json'), JSON.stringify([...producidos, slug], null, 2));
marcar(canal, {
  'Locutor': {estado: 'libre', actividad: 'hablando', tarea: `Grabó la voz de "${g.titulo}".`},
  'Técnico de render': {estado: 'libre', actividad: 'escribiendo', tarea: `Renderizó "${g.titulo}" (${mb} MB). Está en Actions, artefacto "video-${id}".`},
  'Publicador': {estado: 'esperando_decision', actividad: 'pensando', tarea: `Tiene un video listo: "${g.titulo}". Falta subirlo a YouTube (necesita tu conexión; ver subir.mjs).`},
});
notificar(canal, 'listo', `Video listo: ${g.titulo}`, `Se renderizó "${g.titulo}" para ${nombreDe(canal)} (${mb} MB). Descárgalo en GitHub > Actions > Produccion > artefacto "video-${id}". Falta subirlo a YouTube.`);
salida('id', id);
salida('canal', canal);
console.log(`Producción terminada: ${mp4} (${mb} MB)`);
