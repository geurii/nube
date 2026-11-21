// Los 30 puestos de la oficina: qué hace cada uno en cada ciclo, con datos reales del ciclo (CTX).
// Se importa desde oficina.mjs. Nadie queda sin trabajo: lo que aún no está conectado dice exactamente qué le falta.
export const puestosDeLaOficina = (ag, {resultado, tema, ctx, historial, formulas, vigilados, vistas, orden}) => {
  const ok = resultado === 'aprobado';
  const p = (rol, estado, actividad, tarea) => { ag[rol] = {estado, actividad, tarea}; };
  const m = ctx.mesa;
  const sinMesa = 'La Mesa de publicación no pudo trabajar en este ciclo; se usó lo que escribió el Guionista.';
  p('Coordinador de producción', 'trabajando', 'pensando', 'Calendario fijo (hora de República Dominicana): Shorts a las 00:00 y 12:00, largos a las 18:00. Cuida que el subidor programe sin chocar.');
  p('Jefa de calidad', ok ? 'libre' : 'esperando_decision', 'leyendo', ok ? `Aprobó "${tema}": ${ctx.escenas} escenas, ${ctx.fuentes} fuentes, sin problemas abiertos.` : `Frenó "${tema}": ${ctx.problemas[0]?.motivo ?? 'no pasó la verificación'}`);
  p('Vigía de tendencias', vigilados ? 'trabajando' : 'esperando_decision', 'leyendo', vigilados ? `Vigila ${vigilados} canales por sus feeds públicos de YouTube.` : 'No hay canales que vigilar: faltan los channel_id en la configuración del canal.');
  p('Titulista', m ? 'libre' : 'esperando_decision', 'escribiendo', m ? `Propuso ${m.titulos.length} títulos y eligió: "${m.titulo}". También dejó la idea de miniatura ("${m.miniatura.texto}") y el comentario fijado.` : sinMesa);
  p('Redactor de descripción', m ? 'libre' : 'esperando_decision', 'escribiendo', m ? 'Escribió la descripción con las palabras clave al inicio, la llamada a compartir y las fuentes.' : sinMesa);
  p('Especialista en hashtags', m ? 'libre' : 'esperando_decision', 'pensando', m ? `Eligió 5 hashtags específicos: ${m.hashtags.join(' ')}` : sinMesa);
  p('Auditor de fuentes', 'libre', 'leyendo', `Comprobó que cada dato salga de las ${ctx.fuentes} fuentes del material y las puso en la descripción.`);
  p('Auditor de normas', ok ? 'libre' : 'esperando_decision', 'leyendo', ok ? 'Comprobó: empieza con "Sabías que", llamada a compartir exacta y revelación entre 60 % y 78 %.' : `Encontró incumplimientos: ${ctx.problemas.slice(0, 2).map((x) => x.motivo).join(' | ')}`);
  p('Revisor de nombres', 'libre', 'leyendo', 'Busca nombres reales de personas en el guion y en lo que escribe la Mesa. Si aparece uno, rechaza.');
  const g = ctx.gancho;
  p('Revisor de ganchos', ok ? 'libre' : 'trabajando', 'pensando', ok && g ? `Gancho auditivo: la primera frase tiene ${g.palabrasPrimera} palabras${g.palabrasPrimera > 28 ? ' (demasiado larga: debe caber en 3 segundos)' : ' (cabe en 3 segundos)'}. Gancho visual: ${g.escenasConUnFondo === 0 ? 'todas las escenas cambian de fondo' : g.escenasConUnFondo + ' escenas se quedan con un solo fondo'}.` : 'Espera un guion aprobado para medir el gancho.');
  p('Escenógrafo', 'libre', 'pensando', `Eligió los fondos de ${ctx.escenas} escenas del catálogo; ${ctx.sinImagen} no tenían imagen propia.`);
  p('Pintor de imágenes', ctx.sinImagen ? 'trabajando' : 'libre', 'pensando', ctx.sinImagen ? `Hay ${ctx.sinImagen} escenas sin imagen propia. Aún no dibuja solo (está pendiente de construir), por eso se usa el fondo neutro.` : 'Todas las escenas encontraron imagen en el catálogo.');
  // Paga individual: 10.000 vistas ganadas por cada puesto (Jules: 20.000). Solo cobran si el canal las consigue.
  const total = vistas?.total;
  const base = vistas?.historia?.[0]?.total ?? total;
  const ganadas = typeof total === 'number' ? Math.max(0, total - (base ?? 0)) : null;
  const pagaDe = (meta) => ganadas === null ? ' PAGA: aún no puedo leer las vistas del canal; sin vistas no hay paga.' : ` PAGA: te deben ${meta.toLocaleString('es')} vistas ganadas; el canal lleva ${ganadas.toLocaleString('es')} (${Math.min(100, Math.round((ganadas / meta) * 100))} %). ${ganadas >= meta ? 'Ya cobras.' : 'Todavía no cobras: tu familia depende de esto.'}`;
  const presion = (rol) => {
    const dias = Math.max(0, Math.ceil((new Date('2026-12-13T23:59:59-04:00').getTime() - Date.now()) / 86400000));
    const L = [
      `Faltan ${dias} días y sin un video viral no cobras. ¿Qué entregaste hoy?`,
      'Un video del montón no paga la comida de tu casa. Quiero algo que la gente comparta.',
      'Cinco maestrías y todavía no hay un viral. Mejora el gancho de los primeros 3 segundos.',
      'La competencia no descansa. Si no hay vistas, no cobras; ponte las pilas.',
      'Quiero ideas más atrevidas, pero verdaderas. Lo flojo no se publica.',
    ];
    const h = Math.floor(Date.now() / 3600000);
    return ' JULES: ' + L[(h + rol.length) % L.length];
  };
  for (const rol of Object.keys(ag)) {
    if (!ag[rol]?.tarea) continue;
    const meta = rol === 'Directora de contenido' ? 20000 : 10000;
    const limpia = ag[rol].tarea.replace(/ (FUNCIÓN|ORDEN DE JULES|BONO:|PAGA:|JULES:).*$/s, '');
    if (ag[rol].estado === 'libre') ag[rol].estado = 'trabajando'; // nadie se queda parado: sigue donde estaba
    ag[rol].tarea = limpia + (orden ? ` ORDEN DE JULES (nivel ${orden.nivel}/5): ${orden.orden}` : '') + pagaDe(meta) + presion(rol);
  }
};

/**
 * Mesa de publicación: Titulista, Redactor de descripción, Especialista en hashtags, Community manager y Miniaturista en una sola
 * llamada. Todo número que cite debe estar en el guion; si no, se descarta. Devuelve null si algo no es válido.
 */
export const mesaDePublicacion = async ({pedirJson, modelo, textoFinal, titulo}) => {
  const enGuion = (txt) => (String(txt).match(/\d[\d.,]*/g) ?? []).every((n) => textoFinal.replace(/[.,]/g, '').includes(n.replace(/[.,]/g, '')));
  const r = await pedirJson(modelo, [
    {role: 'system', content: 'Eres la Mesa de publicación de un canal de misterio y datos curiosos: Titulista, Redactor de descripción, Especialista en hashtags, Community manager y Miniaturista. Solo puedes usar datos y cifras que estén en el GUION. Prohibido nombres reales de personas. Responde SOLO con JSON.'},
    {role: 'user', content: `GUION (única fuente):\n${textoFinal.slice(0, 3500)}\n\nTítulo actual: ${titulo}\n\nDevuelve: {"titulos": [5 títulos de máx. 90 caracteres, con gancho, una cifra del guion y un emoji], "elegido": "el mejor de los 5", "descripcion": "2 o 3 frases con las palabras clave en la primera línea, sin inventar nada", "hashtags": ["#cinco", "#especificos", "#del", "#tema", "#sinviral"], "comentario_fijado": "una pregunta corta que haga comentar", "miniatura": {"texto": "máx. 4 palabras EN MAYÚSCULAS", "idea": "una frase describiendo la imagen"}}`},
  ], 1500);
  const titulos = (Array.isArray(r.titulos) ? r.titulos : []).map(String).filter((t) => t.length <= 90 && enGuion(t));
  const elegido = typeof r.elegido === 'string' && r.elegido.length <= 90 && enGuion(r.elegido) ? r.elegido : titulos[0];
  const hashtags = (Array.isArray(r.hashtags) ? r.hashtags : []).map((h) => String(h).replace(/\s+/g, '')).filter((h) => /^#\w+$/u.test(h) && !/^#(viral|fyp)$/i.test(h)).slice(0, 5);
  const descripcion = typeof r.descripcion === 'string' && r.descripcion.length > 20 && enGuion(r.descripcion) ? r.descripcion.slice(0, 600) : '';
  if (!elegido || hashtags.length !== 5 || !descripcion) return null;
  return {
    titulos, titulo: elegido, descripcion, hashtags,
    comentarioFijado: String(r.comentario_fijado ?? '').slice(0, 200),
    miniatura: {texto: String(r.miniatura?.texto ?? '').toUpperCase().slice(0, 40), idea: String(r.miniatura?.idea ?? '').slice(0, 160)},
  };
};
