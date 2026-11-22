// PANEL DE 8 ESPECTADORES, PASO 2 DEL CICLO: juzga el GUION (gancho, historia, título, descripción) ANTES de gastar voz y render.
// Si lo rechazan, el guion se reescribe con sus críticas y no se produce ningún video: así no se pierden recursos.
// Después de renderizar, el video solo puede frenarse por fallas de IMAGEN o SONIDO (lo decide Gemini en agentes/panel.mjs).
// Función pura de uso: la Oficina le pasa su `llamar(mensajes)` (que devuelve JSON) y recibe {aprobado, resumen, mejora, votos}.
export const CRITICOS = [
  ['Crítico: adolescente', 'Adolescente de 15 años, vive en TikTok. Atención de 2 segundos: si el gancho no lo atrapa, desliza. Odia las explicaciones largas y la voz aburrida.'],
  ['Crítica: universitaria', 'Universitaria de 21 años, curiosa. Le encantan los misterios y los datos raros; comparte con sus amigas lo que la sorprende de verdad.'],
  ['Crítico: padre trabajador', 'Hombre de 35 años, ve videos en el bus. Quiere aprender algo concreto y se va si siente que le hacen perder el tiempo.'],
  ['Crítico: escéptico', 'Hombre de 28 años que detecta el clickbait al instante. Odia la exageración y las promesas que el video no cumple.'],
  ['Crítica: fan del misterio', 'Mujer de 30 años que ve mucho contenido de misterio y casos reales. Conoce estos temas: detecta lo repetido, lo flojo y los errores.'],
  ['Crítica: ama de casa', 'Mujer de 45 años. Le importa que la voz sea agradable y el ritmo cómodo; se aburre con la jerga y con frases enredadas.'],
  ['Crítico: joven dominicano', 'Joven dominicano de 19 años. Le gusta el lenguaje cercano y con chispa; si suena a documental de colegio, lo deja.'],
  ['Crítico: abuelo', 'Hombre de 62 años. Necesita que todo se entienda claro y sin prisa; lee los subtítulos. Le gusta que cuenten una buena historia.'],
];

/** Regla de decisión: les gusta a 6 de 8 o más y al menos 4 de 8 pasan los 3 primeros segundos. Con garantía de publicación el voto solo aconseja. */
export const decidir = ({votos, garantia}) => {
  const gustos = votos.filter((v) => v.leGusto).length;
  const pasan = votos.filter((v) => v.pasa3).length;
  const aprobado = garantia ? true : gustos >= Math.ceil(votos.length * 0.6) && pasan >= Math.ceil(votos.length * 0.5);
  return {aprobado, gustos, pasan};
};

export const evaluarGuionConPanel = async ({llamar, guion, garantia = false, autopsia = null}) => {
  const escenas = guion.escenas ?? [];
  const textoGuion = escenas.map((e, i) => `${i + 1}. [${e.tipo}] ${e.texto}`).join('\n');
  const pub = guion.publicacion ?? {};
  const palabras = escenas.reduce((s, e) => s + String(e.texto ?? '').split(/\s+/).filter(Boolean).length, 0);
  const duracionAprox = Math.round(palabras / 2.3);
  const textoAutopsia = autopsia ? `\n\nPOR QUÉ LOS VIDEOS ANTERIORES NO COGIERON VISTAS (autopsia con datos reales): ${(autopsia.porQueFallaron ?? []).join(' | ')}. Reglas que debía seguir este video: ${(autopsia.reglas ?? []).join(' | ')}. Fíjate si este guion repite esos errores.` : '';
  const r = await llamar([
    {role: 'system', content: 'Eres un panel de 8 espectadores reales de redes sociales. Cada uno tiene su personalidad y hábitos y juzga con honestidad, sin cortesía: si no lo engancha, desliza y lo dice. No sabes nada del equipo que lo hizo. Evalúas SOLO el guion que se te muestra (aún no hay imágenes ni voz). Responde SOLO con JSON.'},
    {role: 'user', content: `ESPECTADORES:\n${CRITICOS.map(([n, d], i) => `${i + 1}. ${n}: ${d}`).join('\n')}\n\nSHORT de unos ${duracionAprox} segundos hablado (todavía es un guion):\nTítulo: ${pub.titulo ?? guion.titulo}\nDescripción: ${String(pub.descripcion ?? '').slice(0, 300)}\nGuion completo:\n${textoGuion}${textoAutopsia}\n\nPara CADA espectador devuelve: {"votos": [{"quien": "nombre exacto", "pasa_los_3_segundos": true|false, "sigue_hasta_segundo": número, "le_gusto": true|false, "lo_compartiria": true|false, "comentario": "una frase honesta, como hablaría esa persona"}], "mejora_principal": "lo único que más subiría las vistas, una frase"}`},
  ]);
  const votos = (Array.isArray(r?.votos) ? r.votos : []).slice(0, 8).map((v, i) => ({
    quien: CRITICOS[i]?.[0] ?? String(v?.quien ?? ''),
    pasa3: v?.pasa_los_3_segundos === true,
    sigueHasta: Math.max(0, Math.min(duracionAprox + 5, Math.round(Number(v?.sigue_hasta_segundo) || 0))),
    leGusto: v?.le_gusto === true,
    compartiria: v?.lo_compartiria === true,
    comentario: String(v?.comentario ?? '').slice(0, 220),
  }));
  if (votos.length < 6) throw new Error('el panel devolvió menos de 6 votos');
  const {aprobado, gustos, pasan} = decidir({votos, garantia});
  const compartirian = votos.filter((v) => v.compartiria).length;
  const mejora = String(r?.mejora_principal ?? '').slice(0, 240);
  const resumen = `${garantia ? '[Garantía de publicación activa] ' : ''}${gustos} de ${votos.length} aprobaron el guion, ${pasan} pasaron los primeros 3 segundos, ${compartirian} lo compartirían.`;
  return {aprobado, resumen, mejora, votos, gustos, pasan};
};
