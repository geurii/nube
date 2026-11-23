import fs from 'node:fs';
import path from 'node:path';
import {revisarVideo} from './video-gemini.mjs';
import {avisarTelefono} from './aviso.mjs';

const ID = (process.env.ID || '').trim();
const CANAL = (process.env.CANAL || 'lqns').trim();
const RAIZ = path.resolve('oficina-salida');
const carpeta = path.join(RAIZ, CANAL);

const leer = (ruta, defecto) => {
  try {
    return JSON.parse(fs.readFileSync(ruta, 'utf8'));
  } catch {
    return defecto;
  }
};

const salida = (valor) => {
  if (process.env.GITHUB_OUTPUT) {
    fs.appendFileSync(process.env.GITHUB_OUTPUT, `aprobado=${valor}\n`);
  }
};

const notificar = (tipo, titulo, texto) => {
  try {
    const resultado = avisarTelefono(tipo, titulo, texto);
    if (resultado && typeof resultado.catch === 'function') {
      resultado.catch(error => console.warn('Error notificando:', error.message));
    }
  } catch (error) {
    console.warn('Error enviando notificacion:', error.message);
  }

  try {
    fs.mkdirSync(RAIZ, {recursive: true});
    const archivo = path.join(RAIZ, 'notificaciones.json');
    const lista = leer(archivo, []);
    lista.unshift({
      fecha: new Date().toISOString(),
      canal: CANAL,
      tipo,
      titulo,
      texto
    });
    fs.writeFileSync(archivo, JSON.stringify(lista.slice(0, 80), null, 2));
  } catch (error) {
    console.warn('Error guardando notificacion:', error.message);
  }
};

export const decidirTecnico = (revision) => {
  if (!revision || typeof revision !== 'object') {
    return {aprobado: false, motivos: ['Revision invalida']};
  }

  if (
    !revision.audio ||
    !revision.imagen ||
    !revision.subtitulos ||
    !Array.isArray(revision.defectos_graves)
  ) {
    return {aprobado: false, motivos: ['Revision tecnica incompleta']};
  }

  const motivos = [];

  if (
    revision.subtitulos.tapados_o_cortados === true ||
    revision.subtitulos.legibles === false
  ) {
    motivos.push('Subtitulos tapados, cortados o ilegibles');
  }

  if (revision.audio.ausente === true) {
    motivos.push('Audio ausente');
  }

  if (
    revision.imagen.negra === true ||
    revision.imagen.congelada === true
  ) {
    motivos.push('Imagen negra o congelada');
  }

  for (const defecto of revision.defectos_graves) {
    const texto = String(defecto).trim();
    if (texto) motivos.push(texto.slice(0, 200));
  }

  return {aprobado: motivos.length === 0, motivos};
};

const guardar = (datos) => {
  fs.mkdirSync(carpeta, {recursive: true});
  fs.writeFileSync(
    path.join(carpeta, `panel-${ID || 'sin-id'}.json`),
    JSON.stringify(datos, null, 2)
  );
};

export const principal = async () => {
  if (!ID) {
    console.error('Falta ID. Publicacion bloqueada.');
    salida('false');
    return;
  }

  const guion = leer(path.join('guion', 'serie', `${ID}.json`), null);

  if (!guion) {
    const motivo = 'No se encontro el guion.';
    guardar({
      fecha: new Date().toISOString(),
      id: ID,
      aprobado: false,
      resumen: motivo,
      motivos: [motivo]
    });
    notificar('alerta', 'Revision bloqueada', motivo);
    salida('false');
    return;
  }

  const titulo = guion.publicacion?.titulo ?? guion.titulo ?? ID;

  const ruta = [
    path.join('out', 'serie', `${ID}-subida.mp4`),
    path.join('out', 'serie', `${ID}.mp4`)
  ].find(archivo => fs.existsSync(archivo));

  if (!ruta) {
    const motivo = 'No se encontro el video terminado.';
    guardar({
      fecha: new Date().toISOString(),
      id: ID,
      aprobado: false,
      resumen: motivo,
      motivos: [motivo]
    });
    notificar('alerta', 'Video no encontrado', `${titulo}: ${motivo}`);
    salida('false');
    return;
  }

  let resultado;

  try {
    resultado = await revisarVideo({
      ruta,
      contexto: `Titulo: ${titulo}.`
    });
  } catch (error) {
    resultado = {error: error.message};
  }

  if (!resultado || resultado.error || !resultado.revision) {
    const motivo = `Revision fallida: ${String(resultado?.error ?? 'respuesta vacia').slice(0, 220)}`;

    guardar({
      fecha: new Date().toISOString(),
      id: ID,
      aprobado: false,
      resumen: motivo,
      motivos: [motivo],
      revision: null
    });

    notificar('alerta', 'Revision tecnica fallida', `${titulo}. ${motivo} No se publicara.`);
    salida('false');
    return;
  }

  const revision = {
    modelo: resultado.modelo,
    ...resultado.revision
  };

  const decision = decidirTecnico(revision);
  const aprobado = decision.aprobado;
  const motivos = decision.motivos;

  const resumen = aprobado
    ? 'Sin defectos graves detectados.'
    : `Defectos detectados: ${motivos.join(' / ')}`;

  guardar({
    fecha: new Date().toISOString(),
    id: ID,
    modo: 'tecnico',
    aprobado,
    resumen,
    motivos,
    revision
  });

  if (!aprobado) {
    notificar('alerta', `Video rechazado: ${titulo}`, `${resumen}. No se publicara.`);
  } else {
    notificar('reporte', `Revision aprobada: ${titulo}`, resumen);
  }

  console.log(`${aprobado ? 'APROBADO' : 'RECHAZADO'}: ${resumen}`);
  salida(aprobado ? 'true' : 'false');
};

if (path.basename(String(process.argv[1] ?? '')) === 'panel.mjs') {
  principal().catch(error => {
    console.error('Revision interrumpida:', error);

    try {
      guardar({
        fecha: new Date().toISOString(),
        id: ID || null,
        aprobado: false,
        resumen: 'Error inesperado. Publicacion bloqueada.',
        motivos: [String(error?.message ?? error).slice(0, 300)]
      });
    } catch (guardarError) {
      console.error('Error guardando resultado:', guardarError);
    }

    notificar('alerta', 'Revision interrumpida', 'El video no sera aprobado automaticamente.');
    salida('false');
    process.exitCode = 1;
  });
}