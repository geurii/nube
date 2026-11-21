// Panel de espectadores críticos: 8 personas con gustos y hábitos distintos "scrollean" el video ANTES de subirlo y votan si va o no va.
// Hoy evalúan lo que se puede leer del video (gancho, guion completo, título, descripción, miniatura, duración): TODAVÍA NO ven los
// fotogramas ni oyen la voz. Si la mayoría no lo aprueba, el video NO se sube y sus críticas se guardan para que el Guionista las lea.
// Variables: ID (por ejemplo oficina-bloop), CANAL, GROQ_API_KEY. Salida del flujo: aprobado=true|false.
// Si el panel no puede trabajar (error de red o de la IA), NO bloquea la producción: deja pasar el video y avisa.
import fs from 'node:fs';
import path from 'node:path';
import {revisarVideo} from './video-gemini.mjs';

const KEY = process.env.GROQ_API_KEY;
const ID = process.env.ID;
const CANAL = (process.env.CANAL || 'lqns').trim();
const RAIZ = path.resolve('oficina-salida');
const carpeta = path.join(RAIZ, CANAL);
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const salida = (v) => { if (process.env.GITHUB_OUTPUT) fs.appendFileSync(process.env.GITHUB_OUTPUT, `aprobado=${v}\n`); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

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

const marcarCriticos = (cambios) => {
  const ruta = path.join(carpeta, 'estado.json');
  try {
    const e = leer(ruta, {agentes: {}});
    e.agentes = {...(e.agentes ?? {}), ...cambios};
    e.actualizado = new Date().toISOString();
    fs.writeFileSync(ruta, JSON.stringify(e, null, 2));
  } catch { /* sin estado */ }
};
const notificar = (tipo, titulo, texto) => {
  try {
    const ruta = path.join(RAIZ, 'notificaciones.json');
    const lista = leer(ruta, []);
    lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal: CANAL, tipo, titulo, texto});
    fs.writeFileSync(ruta, JSON.stringify(lista.slice(0, 80), null, 2));
  } catch { /* sin notificaciones */ }
};

if (!ID) { console.log('Sin video que evaluar.'); salida('false'); process.exit(0); }
const guion = leer(path.join('guion', 'serie', `${ID}.json`), null);
if (!guion || !KEY) {
  console.log('El panel no pudo trabajar (falta el guion o la clave de Groq). Se deja pasar el video.');
  notificar('alerta', 'El panel de críticos no pudo evaluar', `No pude evaluar "${ID}" (falta el guion o la clave). El video pasó sin su voto.`);
  salida('true');
  process.exit(0);
}

const textoVideo = guion.escenas.map((e, i) => `${i + 1}. [${e.tipo}] ${e.texto}`).join('\n');
const pub = guion.publicacion ?? {};
const palabras = guion.escenas.reduce((s, e) => s + e.texto.split(/\s+/).filter(Boolean).length, 0);
const duracionAprox = Math.round(palabras / 2.3);

const llamar = async (mensajes) => {
  for (let i = 1; i <= 6; i++) {
    for (const modelo of ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile']) {
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST', headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(90000),
          body: JSON.stringify({model: modelo, messages: mensajes, temperature: 0.7, max_tokens: 2500, ...(modelo.includes('gpt-oss') ? {reasoning_effort: 'low'} : {})}),
        });
        if (r.status === 429) { const t = await r.text(); await dormir((Number(/try again in ([\d.]+)s/i.exec(t)?.[1] ?? 15) + 1) * 1000); continue; }
        if (!r.ok) continue;
        const txt = (await r.json()).choices?.[0]?.message?.content ?? '';
        const j = /\{[\s\S]*\}/.exec(txt.replace(/```json|```/g, ''));
        if (j) return JSON.parse(j[0]);
      } catch { /* siguiente intento */ }
    }
    await dormir(3000 * i);
  }
  throw new Error('Groq no respondió.');
};

// 1) Gemini MIRA y ESCUCHA el video terminado (si hay clave y archivo)
let gem = null;
{
  const ruta = ['out/serie/' + ID + '-subida.mp4', 'out/serie/' + ID + '.mp4'].find((p) => fs.existsSync(p));
  const g = await revisarVideo({ruta, key: process.env.GEMINI_API_KEY, contexto: 'Título: ' + (guion.publicacion?.titulo ?? guion.titulo) + '.'});
  if (g.revision) gem = {modelo: g.modelo, ...g.revision};
  else console.warn('Gemini no pudo revisar el video:', g.error);
  if (!gem) notificar('alerta', 'Gemini no pudo mirar el video', String(g.error ?? '').slice(0, 220) + ' El panel juzgó solo el guion.');
}
const autopsia = leer(path.join(carpeta, 'autopsia.json'), null);
const textoGemini = gem ? `\n\nREVISIÓN TÉCNICA DEL VIDEO (Gemini lo vio y lo oyó): gancho 3 s ${gem.gancho_3s?.nota}/10 (${gem.gancho_3s?.comentario}); audio ${gem.audio?.nota}/10 (${gem.audio?.comentario}); subtítulos legibles: ${gem.subtitulos?.legibles}, tapados o cortados: ${gem.subtitulos?.tapados_o_cortados}; imagen ${gem.imagen?.nota}/10, defectos: ${(gem.imagen?.defectos ?? []).join(', ') || 'ninguno'}; ritmo ${gem.ritmo?.nota}/10; defectos graves: ${(gem.defectos_graves ?? []).join(', ') || 'ninguno'}.` : '';
const textoAutopsia = autopsia ? `\n\nPOR QUÉ LOS VIDEOS ANTERIORES NO COGIERON VISTAS (autopsia con datos reales): ${(autopsia.porQueFallaron ?? []).join(' | ')}. Reglas que debía seguir este video: ${(autopsia.reglas ?? []).join(' | ')}. Fíjate si este video repite esos errores.` : '';

try {
  const r = await llamar([
    {role: 'system', content: 'Eres un panel de 8 espectadores reales de redes sociales. Cada uno tiene su personalidad y hábitos y juzga con honestidad, sin cortesía: si no lo engancha, desliza y lo dice. No sabes nada del equipo que hizo el video. Evalúas SOLO lo que se te muestra (no puedes ver imágenes ni oír la voz). Responde SOLO con JSON.'},
    {role: 'user', content: `ESPECTADORES:\n${CRITICOS.map(([n, d], i) => `${i + 1}. ${n}: ${d}`).join('\n')}\n\nVIDEO (Short de unos ${duracionAprox} segundos hablado):\nTítulo: ${pub.titulo ?? guion.titulo}\nMiniatura (idea): ${pub.miniatura?.texto ?? ''} ${pub.miniatura?.idea ?? ''}\nDescripción: ${String(pub.descripcion ?? '').slice(0, 300)}\nGuion completo:\n${textoVideo}${textoGemini}${textoAutopsia}\n\nPara CADA espectador devuelve: {"votos": [{"quien": "nombre exacto", "pasa_los_3_segundos": true|false, "sigue_hasta_segundo": número, "le_gusto": true|false, "lo_compartiria": true|false, "comentario": "una frase honesta, como hablaría esa persona"}], "mejora_principal": "lo único que más subiría las vistas, una frase"}`},
  ]);
  const votos = (Array.isArray(r.votos) ? r.votos : []).slice(0, 8).map((v, i) => ({
    quien: CRITICOS[i]?.[0] ?? String(v.quien ?? ''),
    pasa3: v.pasa_los_3_segundos === true,
    sigueHasta: Math.max(0, Math.min(duracionAprox + 5, Math.round(Number(v.sigue_hasta_segundo) || 0))),
    leGusto: v.le_gusto === true,
    compartiria: v.lo_compartiria === true,
    comentario: String(v.comentario ?? '').slice(0, 220),
  }));
  if (votos.length < 6) throw new Error('el panel devolvió menos de 6 votos');
  const gustos = votos.filter((v) => v.leGusto).length;
  const pasan = votos.filter((v) => v.pasa3).length;
  const gemMalo = gem && (gem.recomendacion === 'no subir' || Number(gem.nota_general) < 6 || gem.subtitulos?.tapados_o_cortados === true || (Array.isArray(gem.defectos_graves) && gem.defectos_graves.length > 0));
  const aprobado = gustos >= Math.ceil(votos.length * 0.6) && pasan >= Math.ceil(votos.length * 0.5) && !gemMalo;
  const resumen = `${gem ? `Gemini (${gem.modelo}) lo vio: ${gem.nota_general}/10, ${gem.recomendacion}. ` : ''}${gustos} de ${votos.length} aprobaron, ${pasan} pasaron los primeros 3 segundos, ${votos.filter((v) => v.compartiria).length} lo compartirían.`;
  const mejora = String(r.mejora_principal ?? '').slice(0, 240);
  fs.writeFileSync(path.join(carpeta, `panel-${ID}.json`), JSON.stringify({fecha: new Date().toISOString(), id: ID, aprobado, resumen, mejora, gemini: gem, votos}, null, 2));

  const cambios = {};
  votos.forEach((v, i) => {
    const nombre = CRITICOS[i]?.[0];
    if (nombre) cambios[nombre] = {estado: v.leGusto ? 'libre' : 'esperando_decision', actividad: 'leyendo', tarea: `${v.leGusto ? 'Le gustó' : 'NO le gustó'} "${guion.titulo}": ${v.comentario} (siguió hasta el segundo ${v.sigueHasta}${v.compartiria ? ', lo compartiría' : ''}).`};
  });
  marcarCriticos(cambios);

  if (!aprobado) {
    const previo = leer(path.join(carpeta, 'aprendizajes.json'), []);
    fs.writeFileSync(path.join(carpeta, 'aprendizajes.json'), JSON.stringify([{fecha: new Date().toISOString(), video: guion.titulo, mejora, quejas: [...(gem && gemMalo ? ['Gemini: ' + [gem.por_que, ...(gem.defectos_graves ?? [])].filter(Boolean).join(' / ')] : []), ...votos.filter((v) => !v.leGusto).map((v) => `${v.quien}: ${v.comentario}`)].slice(0, 4)}, ...previo].slice(0, 10), null, 2));
    notificar('alerta', `El panel rechazó: ${guion.titulo}`, `${resumen} No se sube. Mejora principal: ${mejora}`);
  } else {
    notificar('reporte', `El panel aprobó: ${guion.titulo}`, `${resumen} Mejora sugerida: ${mejora}`);
  }
  console.log(`Panel: ${aprobado ? 'APROBADO' : 'RECHAZADO'}. ${resumen}`);
  salida(aprobado ? 'true' : 'false');
} catch (e) {
  console.warn('El panel falló:', e.message, '— se deja pasar el video.');
  notificar('alerta', 'El panel de críticos falló', `No pudo evaluar "${ID}" (${String(e.message).slice(0, 120)}). El video pasó sin su voto.`);
  salida('true');
}
process.exit(0);
