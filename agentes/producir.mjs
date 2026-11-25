// Producción: toma el primer guion APROBADO (de cualquier canal) que aún no tiene video, le pone la voz (msedge-tts)
// y lo renderiza con el sistema del canal. Corre en GitHub Actions después de la Oficina (ver produccion.yml).
// Deja el estado y una notificación para la oficina 3D. Salidas del flujo: id (para el artefacto) y canal.
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
import {avisarTelefono} from './aviso.mjs';
import {limpiarParaVoz} from './texto-voz.mjs';

const RAIZ = 'oficina-salida';
const leer = (ruta, porDefecto) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return porDefecto; } };
const salida = (clave, valor) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `${clave}=${valor}
`); };
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
// Interruptor de pausa: si existe agentes/PAUSA no se produce ni se sube nada (se quita el archivo para reanudar).
if (fs.existsSync(path.join('agentes', 'PAUSA'))) {
  console.log('PRODUCCION EN PAUSA (existe agentes/PAUSA). Nada que hacer.');
  salida('id', '');
  salida('canal', '');
  process.exit(0);
}
/** "the-bloop" y "bloop" son el mismo tema: no se produce dos veces. */
const claveTema = (x) => String(x).toLowerCase().replace(/^the[-_ ]+/, '').replace(/[^a-z0-9]+/g, '');
const secuencia = leer(path.join('agentes', 'secuencia-largo-short.json'), {activo: false});
const colaCompleta = fs.readdirSync(RAIZ, {withFileTypes: true})
  .filter((d) => d.isDirectory() && d.name !== 'pedidos')
  .flatMap((d) => {
    const producidos = leer(path.join(RAIZ, d.name, 'producidos.json'), []);
    return fs.readdirSync(path.join(RAIZ, d.name))
      .filter((f) => /^guion-.+\.json$/.test(f))
      .map((f) => ({canal: d.name, slug: f.replace(/^guion-|\.json$/g, ''), ruta: path.join(RAIZ, d.name, f), g: leer(path.join(RAIZ, d.name, f), null), t: fs.statSync(path.join(RAIZ, d.name, f)).mtimeMs, producidos}))
      .filter((x) => x.g && x.g.estado === 'aprobado'
         && !/(bloop|lituya)/.test(claveTema(x.slug + ' ' + (x.g.titulo ?? '')))
         && !x.producidos.some((p) => claveTema(p) === claveTema(x.slug)))
      .filter((x) => {
        const palabras = (x.g.escenas ?? []).reduce((n, e) => n + String(e.texto ?? '').trim().split(/\s+/).filter(Boolean).length, 0);
        const motivo = x.g.formato === 'largo' && (palabras < 1200 || palabras > 1350)
          ? `Video largo fuera del rango de narración: ${palabras} palabras; se requieren entre 1200 y 1350 antes de renderizar.`
          : x.g.formato === 'short' && palabras > 180
            ? `Short demasiado largo: ${palabras} palabras; máximo preventivo 180 antes de medir el MP4.`
            : '';
        if (motivo) {
          x.g.estado = 'rechazado-necesita-revision';
          x.g.errorFormato = motivo;
          fs.writeFileSync(x.ruta, JSON.stringify(x.g, null, 2));
          console.warn(`Se aparta ${x.canal}-${x.slug}: ${motivo}`);
          notificar(x.canal, 'alerta', 'Guion apartado por duración', `${x.g.titulo}: ${motivo}`);
          return false;
        }
        return true;
      });
  })
  .sort((a, b) => (Date.parse(a.g.creado) || a.t) - (Date.parse(b.g.creado) || b.t));
const formatoObjetivo = leer(path.join('agentes', 'publicacion.json'), {}).formato;
let pendientes = ['short', 'largo'].includes(formatoObjetivo) ? colaCompleta.filter((x) => x.g.formato === formatoObjetivo) : colaCompleta;
if (secuencia.activo && secuencia.fase === 'largo') {
  pendientes = colaCompleta.filter((x) => x.g.formato === 'largo').sort((a, b) => (Date.parse(b.g.creado) || b.t) - (Date.parse(a.g.creado) || a.t));
} else if (secuencia.activo && secuencia.fase === 'short-encolado') {
  const desde = Date.parse(secuencia.fechaLargoPublicado) || 0;
  pendientes = colaCompleta.filter((x) => x.g.formato === 'short' && (Date.parse(x.g.creado) || x.t) >= desde)
    .sort((a, b) => (Date.parse(b.g.creado) || b.t) - (Date.parse(a.g.creado) || a.t));
}

// En el disparo automático, producir EXCLUSIVAMENTE el guion aprobado por esa ejecución de la Oficina.
// Evita que workflow_run rescate por accidente un guion viejo (o un Bloop de una prueba anterior).
const oficinaRunId = String(process.env.OFICINA_RUN_ID ?? '').trim();
if (oficinaRunId) {
  const manifiesto = leer(path.join('oficina-salida', 'produccion-pendiente.json'), []);
  const encargo = (Array.isArray(manifiesto) ? manifiesto : []).find((x) => String(x.runId) === oficinaRunId);
  if (!encargo) {
    console.log('No hay un guion aprobado por la ejecución de Oficina ' + oficinaRunId + '; no se rescata ningún guion anterior.');
    salida('id', ''); salida('canal', '');
    process.exit(1);
  }
  pendientes = pendientes.filter((x) => x.canal === encargo.canal && x.slug === encargo.slug && x.g.formato === encargo.formato);
  if (!pendientes.length) {
    console.log('El guion del manifiesto ya no está aprobado o no supera las validaciones; no se produce.');
    salida('id', ''); salida('canal', '');
    process.exit(1);
  }
} else {
  // Disparo manual explícito: timestamp|slug|formato|canal. Nunca toma otro guion por accidente.
  let disparo = ''; try { disparo = fs.readFileSync(path.join('agentes', 'produccion.disparo'), 'utf8'); } catch {}
  const [, slugManual, formatoManual, canalManual] = String(disparo).trim().split('|');
  if (slugManual && formatoManual && canalManual) {
    pendientes = pendientes.filter((x) => x.slug === slugManual && x.g.formato === formatoManual && x.canal === canalManual);
    if (!pendientes.length) {
      const gManual = leer(path.join(RAIZ, canalManual, `guion-${slugManual}.json`), null);
      if (gManual && ['en-renderizado', 'renderizado'].includes(gManual.estado)) {
        console.log(`El guion ${slugManual} ya está ${gManual.estado}; se evita un render duplicado.`);
        salida('id', ''); salida('canal', '');
        process.exit(0);
      }
      console.error(`El disparo manual ${slugManual} no coincide con un guion aprobado y válido de ${canalManual}.`);
      salida('id', ''); salida('canal', '');
      process.exit(1);
    }
  }
}

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
if (!['short', 'largo'].includes(g.formato)) throw new Error(`Formato inválido para ${id}: ${g.formato}`);
const orientacion = g.formato === 'short' ? 'vertical' : 'horizontal';
const guionVoz = {...g, escenas: (g.escenas ?? []).map((e) => ({...e, texto: limpiarParaVoz(e.texto)}))};
fs.writeFileSync(path.join('guion', 'serie', `${id}.json`), JSON.stringify({...guionVoz, orientacion, personaje: {visible: false}, audio: `audio/${id}.wav`}, null, 2));

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

const probe = spawnSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', mp4], {encoding: 'utf8', timeout: 60000});
const duracion = Number(probe.stdout?.trim());
const formatoInvalido = !Number.isFinite(duracion) || duracion <= 0
  ? 'No se pudo medir la duración real del MP4.'
  : g.formato === 'short' && duracion > 180
    ? `Short excede 180 segundos: ${duracion.toFixed(1)} s.`
    : g.formato === 'largo' && (duracion < 480 || duracion > 600)
      ? `Video largo dura ${duracion.toFixed(1)} s; debe durar entre 480 y 600 s (8–10 minutos, compatible con TikTok y YouTube).`
      : '';
if (formatoInvalido) {
  g.estado = 'rechazado-necesita-revision';
  g.errorFormato = formatoInvalido;
  fs.writeFileSync(path.join(RAIZ, canal, `guion-${slug}.json`), JSON.stringify(g, null, 2));
  marcar(canal, {
    'Técnico de render': {estado: 'esperando_decision', actividad: 'pensando', tarea: formatoInvalido},
    'Publicador': {estado: 'esperando_decision', actividad: 'pensando', tarea: `No se sube "${g.titulo}": ${formatoInvalido}`},
  });
  notificar(canal, 'alerta', 'Video apartado por duración incorrecta', `${g.titulo}: ${formatoInvalido} No se publica en formato equivocado.`);
  salida('id', '');
  salida('canal', '');
  console.error(formatoInvalido);
  process.exit(0);
}
const dimensiones = spawnSync('ffprobe', ['-v', 'error', '-select_streams', 'v:0', '-show_entries', 'stream=width,height', '-of', 'csv=s=x:p=0', mp4], {encoding: 'utf8', timeout: 60000});
const [anchoReal, altoReal] = (dimensiones.stdout ?? '').trim().split('x').map(Number);
const anchoEsperado = g.formato === 'largo' ? 1920 : 1080;
const altoEsperado = g.formato === 'largo' ? 1080 : 1920;
if (anchoReal !== anchoEsperado || altoReal !== altoEsperado) {
  const motivo = `Resolución incorrecta: ${anchoReal}x${altoReal}; se exige ${anchoEsperado}x${altoEsperado} para ${g.formato} HD.`;
  g.estado = 'rechazado-necesita-revision';
  g.errorFormato = motivo;
  fs.writeFileSync(path.join(RAIZ, canal, `guion-${slug}.json`), JSON.stringify(g, null, 2));
  notificar(canal, 'alerta', 'Video apartado por resolución incorrecta', motivo);
  salida('id', '');
  salida('canal', '');
  console.error(motivo);
  process.exit(0);
}
console.log(`Resolución verificada: ${anchoReal}x${altoReal}.`);
const mb = (fs.statSync(mp4).size / 1024 / 1024).toFixed(0);
// NO marcar como producido aquí: renderizar no equivale a publicar.
// subir.mjs registra el slug únicamente después de que YouTube confirme la subida.
marcar(canal, {
  'Locutor': {estado: 'libre', actividad: 'hablando', tarea: `Grabó la voz de "${g.titulo}".`},
  'Técnico de render': {estado: 'libre', actividad: 'escribiendo', tarea: `Renderizó "${g.titulo}" (${mb} MB). Está en Actions, artefacto "video-${id}".`},
  'Publicador': {estado: 'libre', actividad: 'pensando', tarea: `Video renderizado: "${g.titulo}". En cola para publicación automática; todavía NO está publicado.`},
});
notificar(canal, 'listo', `Video renderizado: ${g.titulo}`, `Se renderizó "${g.titulo}" para ${nombreDe(canal)} (${mb} MB). Sigue en cola de publicación; este aviso NO significa que ya esté publicado.`);
salida('id', id);
salida('canal', canal);
salida('formato', g.formato);
console.log(`Producción terminada: ${mp4} (${mb} MB)`);
