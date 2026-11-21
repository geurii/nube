// Los 30 puestos de la oficina: qué hace cada uno en cada ciclo, con datos reales del ciclo (CTX).
// Se importa desde oficina.mjs. Nadie queda sin trabajo: lo que aún no está conectado dice exactamente qué le falta.
export const puestosDeLaOficina = (ag, {resultado, tema, ctx, historial, formulas, vigilados, vistas, orden}) => {
  const ok = resultado === 'aprobado';
  const p = (rol, estado, actividad, tarea) => { ag[rol] = {estado, actividad, tarea}; };
  const m = ctx.mesa;
  const sinMesa = 'La Mesa de publicación no pudo trabajar en este ciclo; se usó lo que escribió el Guionista.';
  p('Coordinador de producción', 'trabajando', 'pensando', 'Calendario fijo (hora de República Dominicana): Shorts a las 00:00 y 12:00, largos a las 18:00. Cuida que el subidor programe sin chocar.');
  p('Programador de publicación', 'trabajando', 'escribiendo', 'Reserva el próximo horario libre (mínimo 40 min adelante) al subir cada video y lo deja programado en YouTube.');
  p('Jefa de calidad', ok ? 'libre' : 'esperando_decision', 'leyendo', ok ? `Aprobó "${tema}": ${ctx.escenas} escenas, ${ctx.fuentes} fuentes, sin problemas abiertos.` : `Frenó "${tema}": ${ctx.problemas[0]?.motivo ?? 'no pasó la verificación'}`);
  p('Vigía de tendencias', vigilados ? 'trabajando' : 'esperando_decision', 'leyendo', vigilados ? `Vigila ${vigilados} canales por sus feeds públicos de YouTube.` : 'No hay canales que vigilar: faltan los channel_id en la configuración del canal.');
  p('Analista de competencia', formulas ? 'libre' : 'trabajando', 'pensando', formulas ? `Última fórmula sacada de los videos que más rinden (${formulas.fecha ?? 'sin fecha'}); se copia la estructura, nunca el contenido.` : 'Espera datos del Cazador para comparar títulos y ganchos.');
  p('Archivista de ideas', 'libre', 'leyendo', `Lleva ${historial.length} temas ya usados para que ninguno se repita.`);
  p('Titulista', m ? 'libre' : 'esperando_decision', 'escribiendo', m ? `Propuso ${m.titulos.length} títulos y eligió: "${m.titulo}".` : sinMesa);
  p('Redactor de descripción', m ? 'libre' : 'esperando_decision', 'escribiendo', m ? 'Escribió la descripción con las palabras clave al inicio, la llamada a compartir y las fuentes.' : sinMesa);
  p('Especialista en hashtags', m ? 'libre' : 'esperando_decision', 'pensando', m ? `Eligió 5 hashtags específicos: ${m.hashtags.join(' ')}` : sinMesa);
  p('Auditor de fuentes', 'libre', 'leyendo', `Comprobó que cada dato salga de las ${ctx.fuentes} fuentes del material y las puso en la descripción.`);
  p('Auditor de normas', ok ? 'libre' : 'esperando_decision', 'leyendo', ok ? 'Comprobó: empieza con "Sabías que", llamada a compartir exacta y revelación entre 60 % y 78 %.' : `Encontró incumplimientos: ${ctx.problemas.slice(0, 2).map((x) => x.motivo).join(' | ')}`);
  p('Revisor de nombres', 'libre', 'leyendo', 'Busca nombres reales de personas en el guion y en lo que escribe la Mesa. Si aparece uno, rechaza.');
  const g = ctx.gancho;
  p('Revisor de ganchos', ok ? 'libre' : 'trabajando', 'pensando', ok && g ? `Gancho auditivo: la primera frase tiene ${g.palabrasPrimera} palabras${g.palabrasPrimera > 28 ? ' (demasiado larga: debe caber en 3 segundos)' : ' (cabe en 3 segundos)'}. Gancho visual: ${g.escenasConUnFondo === 0 ? 'todas las escenas cambian de fondo' : g.escenasConUnFondo + ' escenas se quedan con un solo fondo'}.` : 'Espera un guion aprobado para medir el gancho.');
  p('Escenógrafo', 'libre', 'pensando', `Eligió los fondos de ${ctx.escenas} escenas del catálogo; ${ctx.sinImagen} no tenían imagen propia.`);
  p('Pintor de imágenes', ctx.sinImagen ? 'trabajando' : 'libre', 'pensando', ctx.sinImagen ? `Hay ${ctx.sinImagen} escenas sin imagen propia. Aún no dibuja solo (está pendiente de construir), por eso se usa el fondo neutro.` : 'Todas las escenas encontraron imagen en el catálogo.');
  p('Revisor visual', 'trabajando', 'leyendo', 'Pendiente: mirará los fotogramas con Gemini antes de publicar (aún por construir).');
  p('Miniaturista', m ? 'libre' : 'trabajando', 'escribiendo', m ? `Diseñó la idea de miniatura: "${m.miniatura.texto}" — ${m.miniatura.idea}` : sinMesa);
  p('Analista de retención', 'trabajando', 'leyendo', `Mide por ahora lo que sí tiene: ${ctx.escenas} escenas y su ritmo. Los datos reales de YouTube aún no están conectados.`);
  p('Community manager', m ? 'libre' : 'trabajando', 'escribiendo', m ? `Dejó listo el comentario fijado: "${m.comentarioFijado.slice(0, 90)}"` : sinMesa);
  // Paga: las vistas reales del canal. Cada puesto cobra su parte (1 punto por vista ganada); si no hay vistas nuevas, no cobra.
  const total = vistas?.total, ganadas = vistas?.ganadasDesdeElUltimoCiclo ?? 0;
  const parte = (n) => Math.floor(n / 30);
  const bono = typeof total === 'number' ? ` BONO: el canal suma ${total.toLocaleString('es')} vistas; en este ciclo ganó ${ganadas.toLocaleString('es')} y a cada puesto le tocan ${parte(ganadas)} puntos. ${ganadas === 0 ? 'Sin vistas nuevas no cobra nadie.' : 'Más vistas, más paga.'}` : ' BONO: aún no puedo leer las vistas del canal.';
  p('Redactor de reportes', 'libre', 'escribiendo', 'Escribe el reporte de cada ciclo y lo manda a la campana.');
  for (const rol of Object.keys(ag)) if (ag[rol]?.tarea) ag[rol].tarea = ag[rol].tarea.replace(/ ORDEN DE JULES:.*?(?= BONO:|$)/, '').replace(/ BONO:.*$/, '') + (orden ? ` ORDEN DE JULES (nivel ${orden.nivel}/5): ${orden.orden}` : '') + bono;
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
