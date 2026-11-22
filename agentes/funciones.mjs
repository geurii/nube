// Segunda función de los 8 críticos: cuando no están votando un video, cada uno trabaja en otra cosa útil para el dueño.
// Corre en cada ciclo; las tareas "diarias" solo se repiten pasadas 20 horas. Todo se guarda en oficina-salida/<canal>/funciones/.
// Variables: CANAL, GROQ_API_KEY y (opcional, solo para comentarios) YT_CLIENT_ID, YT_CLIENT_SECRET, YT_REFRESH_TOKEN, NTFY_TOPIC.
// Nunca inventa cifras: lo que no tiene datos lo dice. No detiene el flujo.
import fs from 'node:fs';
import path from 'node:path';
import {avisarTelefono} from './aviso.mjs';
import {modelosDisponibles} from './llm.mjs';
const MODELOS = await modelosDisponibles(process.env.GROQ_API_KEY); // solo modelos que la cuenta tiene (cuotas separadas)

const CANAL = (process.env.CANAL || 'lqns').trim();
const KEY = process.env.GROQ_API_KEY;
const carpeta = path.resolve('oficina-salida', CANAL);
const dirF = path.join(carpeta, 'funciones');
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const config = (leer(path.join('agentes', 'canales-propios.json'), {canales: []}).canales ?? []).find((c) => c.id === CANAL) ?? {};
const estado = leer(path.join(carpeta, 'estado.json'), null);
if (!estado) { console.log('Funciones: sin estado.'); process.exit(0); }
fs.mkdirSync(dirF, {recursive: true});
const TODOS_LOS_PUESTOS = ["Directora de contenido","Enlace de datos","Coordinador de producción","Jefa de calidad","Investigador de temas","Cazador de fórmulas","Vigía de tendencias","Guionista","Editor de guion","Titulista","Redactor de descripción","Especialista en hashtags","Verificador de datos","Auditor de fuentes","Auditor de normas","Revisor de nombres","Revisor de ganchos","Pintor de luz y detalle","Pintor de imágenes","Locutor","Técnico de render","Publicador","Crítico: adolescente","Crítica: universitaria","Crítico: padre trabajador","Crítico: escéptico","Crítica: fan del misterio","Crítica: ama de casa","Crítico: joven dominicano","Crítico: abuelo"];
for (const r of TODOS_LOS_PUESTOS) estado.agentes[r] = estado.agentes[r] ?? {estado: 'trabajando', actividad: 'pensando', tarea: 'En su puesto, preparando el próximo ciclo.'};
const reloj = leer(path.join(dirF, 'reloj.json'), {});
const vistas = leer(path.join(carpeta, 'vistas.json'), null);
const analitica = leer(path.join(carpeta, 'analitica.json'), null);
const autopsia = leer(path.join(carpeta, 'autopsia.json'), null);
const formulas = leer(path.join(carpeta, 'formulas.json'), null);
const dias = Math.max(0, Math.ceil((new Date('2026-12-13T23:59:59-04:00').getTime() - Date.now()) / 86400000));
const hace = (id) => (Date.now() - new Date(reloj[id] ?? 0).getTime()) / 3600000;

const llamar = async (sistema, usuario) => {
  if (!KEY) return null;
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(90000),
        body: JSON.stringify({model: MODELOS[(i - 1) % MODELOS.length], ...(MODELOS[(i - 1) % MODELOS.length].includes('gpt-oss') ? {reasoning_effort: 'low'} : {}), temperature: 0.6, max_tokens: 1600, messages: [
          {role: 'system', content: `${sistema} Tienes cinco maestrías en tu área y mucha ambición: tu paga depende de las vistas del canal. No inventes datos ni cifras: usa solo lo que se te da; si algo no se sabe, dilo. Sin nombres reales de personas. Responde SOLO con JSON.`},
          {role: 'user', content: usuario},
        ]}),
      });
      if (r.status === 429) { const t = await r.text(); await dormir((Number(/try again in ([\d.]+)s/i.exec(t)?.[1] ?? 15) + 1) * 1000); continue; }
      if (!r.ok) { await dormir(3000 * i); continue; }
      const m = /\{[\s\S]*\}/.exec(((await r.json()).choices?.[0]?.message?.content ?? '').replace(/```json|```/g, ''));
      if (m) return JSON.parse(m[0]);
    } catch { await dormir(3000 * i); }
  }
  return null;
};
const lista = (a, n, max = 240) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, max)).filter(Boolean).slice(0, n);
const ultimoGuion = (() => {
  try {
    const f = fs.readdirSync(carpeta).filter((n) => /^guion-.*\.json$/.test(n)).map((n) => ({n, t: fs.statSync(path.join(carpeta, n)).mtimeMs})).sort((a, b) => b.t - a.t)[0];
    return f ? leer(path.join(carpeta, f.n), null) : null;
  } catch { return null; }
})();
const topTitulos = [...(vistas?.videos ?? [])].sort((a, b) => b.vistas - a.vistas).slice(0, 5).map((v) => `"${v.titulo}" (${v.vistas} vistas)`).join('; ');
const contexto = `Canal "${config.nombre ?? CANAL}" (${config.nicho ?? ''}). Días para la meta de monetizar (13 dic 2026): ${dias}. Vistas reales: ${vistas?.total ?? 'sin datos'}. Mejores videos: ${topTitulos || 'sin datos'}.`;

const guardar = (id, obj) => { fs.writeFileSync(path.join(dirF, `${id}.json`), JSON.stringify({fecha: new Date().toISOString(), ...obj}, null, 2)); reloj[id] = new Date().toISOString(); };

// [id, rol que lo hace, cada cuántas horas, trabajo]
const FUNCIONES = [
  ['contador', 'Crítico: padre trabajador', 20, async () => {
    const m = analitica?.meta;
    const base = vistas?.historia?.[0]?.total ?? vistas?.total ?? 0;
    const ganadas = Math.max(0, (vistas?.total ?? 0) - base);
    const lineas = [`Faltan ${dias} días para el 13 de diciembre.`,
      m ? `Suscriptores: ${m.suscriptores ?? '?'} de 1.000 (faltan ${m.faltanSuscriptores ?? '?'}${typeof m.faltanSuscriptores === 'number' && dias ? `, o sea ${Math.ceil(m.faltanSuscriptores / dias)} por día` : ''}).` : 'Suscriptores: la analítica aún no los trae.',
      m ? `Horas vistas en 12 meses: ${m.horas12Meses} de 4.000 (faltan ${m.faltanHoras}).` : 'Horas vistas: sin datos.',
      m ? `Vistas de Shorts en 90 días: ${m.vistasShorts90} de 10.000.000 (la alternativa a las horas).` : '',
      `Vistas ganadas desde que la oficina empezó a contar: ${ganadas}.`,
      'Ingresos y gastos: el dueño aún no ha cargado datos (se pueden anotar en oficina-salida/' + CANAL + '/finanzas.json).'].filter(Boolean);
    const fin = leer(path.join(carpeta, 'finanzas.json'), null);
    if (fin?.movimientos?.length) { const ing = fin.movimientos.filter((x) => x.monto > 0).reduce((s, x) => s + x.monto, 0); const gas = fin.movimientos.filter((x) => x.monto < 0).reduce((s, x) => s - x.monto, 0); lineas.push(`Ingresos anotados: ${ing}. Gastos anotados: ${gas}. Meta mensual: 2.000 USD.`); }
    guardar('contador', {resumen: lineas});
    return lineas.slice(0, 3).join(' ');
  }],
  ['oportunidades', 'Crítica: fan del misterio', 24, async () => {
    const r = await llamar('Eres analista de oportunidades de crecimiento para canales de YouTube.', `${contexto}\n${formulas ? 'Fórmula detectada en canales virales: ' + JSON.stringify(formulas.formula ?? formulas).slice(0, 700) : ''}\n${autopsia?.reglas?.length ? 'Reglas de la autopsia: ' + autopsia.reglas.join(' | ') : ''}\nDevuelve {"formatos": ["3 formatos o ángulos que podrían crecer para este canal, con la razón basada en los datos"], "ingresos": ["2 formas realistas de ganar dinero con un canal así (patrocinios, afiliados, etc.) y qué se necesita para cada una"], "advertencia": "lo que no se puede saber con estos datos"}`);
    if (!r) return null;
    const o = {formatos: lista(r.formatos, 3), ingresos: lista(r.ingresos, 2), advertencia: String(r.advertencia ?? '').slice(0, 240)};
    guardar('oportunidades', o);
    return `${o.formatos.length} formatos con potencial y ${o.ingresos.length} vías de ingreso: ${o.formatos[0] ?? ''}`;
  }],
  ['otros-formatos', 'Crítico: adolescente', 12, async () => {
    if (!ultimoGuion) return null;
    if (reloj.guionUsado === ultimoGuion.titulo) return null;
    const texto = ultimoGuion.escenas.map((e) => e.texto).join(' ').slice(0, 2500);
    const r = await llamar('Eres productor de contenido para TikTok, Instagram y Facebook en español, y traductor.', `Video: "${ultimoGuion.titulo}". Guion: ${texto}\nDevuelve {"tiktok": {"descripcion": "...", "hashtags": ["#5 específicos"]}, "instagram": "pie de foto", "facebook": "publicación corta que invite a comentar", "ingles": {"titulo": "...", "descripcion": "..."}}. Sin #viral ni #fyp. Solo datos del guion.`);
    if (!r) return null;
    const tags = lista(r.tiktok?.hashtags, 5, 40).filter((h) => /^#\w+$/u.test(h) && !/^#(viral|fyp)$/i.test(h));
    guardar('otros-formatos', {video: ultimoGuion.titulo, tiktok: {descripcion: String(r.tiktok?.descripcion ?? '').slice(0, 300), hashtags: tags}, instagram: String(r.instagram ?? '').slice(0, 400), facebook: String(r.facebook ?? '').slice(0, 500), ingles: {titulo: String(r.ingles?.titulo ?? '').slice(0, 100), descripcion: String(r.ingles?.descripcion ?? '').slice(0, 500)}});
    reloj.guionUsado = ultimoGuion.titulo;
    return `Dejó listos TikTok, Instagram, Facebook y versión en inglés de "${ultimoGuion.titulo}".`;
  }],
  ['mentor', 'Crítica: universitaria', 24, async () => {
    const r = await llamar('Eres mentor de creadores de contenido: claro, directo y sin tecnicismos.', `${contexto}\n${autopsia ? 'Autopsia del canal: ' + [autopsia.queFunciono, ...(autopsia.porQueFallaron ?? [])].join(' | ').slice(0, 700) : ''}\nDevuelve {"leccion": "una lección de crecimiento para el dueño, aplicable HOY a su canal, en 3 frases, sin inventar estadísticas ni nombres", "tarea": "una tarea concreta de 10 minutos para hoy"}`);
    if (!r) return null;
    const o = {leccion: String(r.leccion ?? '').slice(0, 520), tarea: String(r.tarea ?? '').slice(0, 220)};
    guardar('mentor', o);
    avisarTelefono('info', 'Mentor del día', `${o.leccion} Tarea: ${o.tarea}`);
    return `Lección del día: ${o.leccion.slice(0, 120)}`;
  }],
  ['agenda', 'Crítico: joven dominicano', 24, async () => {
    const n = leer(path.join(carpeta, '..', 'notificaciones.json'), []).filter((x) => x.tipo === 'permiso').slice(0, 3);
    const items = [`Revisa tu canal en YouTube Studio: faltan ${dias} días para la meta.`, ...n.map((x) => `Pendiente tuyo: ${x.titulo}`), 'Borra del Escritorio los archivos de claves si aún están (claves-youtube y oficina.json).'];
    guardar('agenda', {items});
    avisarTelefono('info', 'Tu agenda de hoy', items.join(' · '));
    return `Agenda del día enviada (${items.length} puntos).`;
  }],
  ['infantil', 'Crítica: ama de casa', 24, async () => {
    const r = await llamar('Eres guionista de videos educativos infantiles en español (3 a 6 años), seguros y sin violencia.', `Canal infantil "Mini Aventuras" (colores, animales, contar). Devuelve {"ideas": [{"titulo": "...", "gancho": "primera frase", "escenas": ["4 escenas de una frase cada una"]}, ...3 ideas]}. Nada de datos reales de personas.`);
    if (!r) return null;
    const ideas = (Array.isArray(r.ideas) ? r.ideas : []).slice(0, 3).map((i) => ({titulo: String(i.titulo ?? '').slice(0, 90), gancho: String(i.gancho ?? '').slice(0, 160), escenas: lista(i.escenas, 4, 160)}));
    if (!ideas.length) return null;
    guardar('infantil', {ideas});
    return `${ideas.length} ideas nuevas para Mini Aventuras: "${ideas[0].titulo}"…`;
  }],
  ['guardian', 'Crítico: escéptico', 20, async () => {
    const v = leer(path.join(carpeta, '..', 'vigilante.json'), null);
    const lineas = v ? [`Último chequeo del Vigilante: ${v.fecha}.`, `Bien: ${(v.ok ?? []).join(', ') || 'nada'}.`, `Problemas: ${(v.problemas ?? []).join(', ') || 'ninguno'}.`] : ['El Vigilante aún no ha corrido.'];
    lineas.push('Recordatorio: los archivos de claves del Escritorio deben borrarse y el permiso de Google debe seguir "En producción".');
    guardar('guardian', {resumen: lineas});
    return lineas.slice(0, 3).join(' ');
  }],
  ['comunidad', 'Crítico: abuelo', 20, async () => {
    const {YT_CLIENT_ID, YT_CLIENT_SECRET} = process.env;
    const REF = (process.env.YT_REFRESH_TOKEN || '').trim();
    if (!YT_CLIENT_ID || !YT_CLIENT_SECRET || !REF || !analitica?.meta || !vistas?.canalId) return 'Espera que la analítica esté autorizada para leer los comentarios.';
    const tk = await fetch('https://oauth2.googleapis.com/token', {method: 'POST', headers: {'Content-Type': 'application/x-www-form-urlencoded'}, body: new URLSearchParams({client_id: YT_CLIENT_ID.trim(), client_secret: YT_CLIENT_SECRET.trim(), refresh_token: REF, grant_type: 'refresh_token'}), signal: AbortSignal.timeout(30000)}).catch(() => null);
    if (!tk?.ok) return 'No pude conectar con YouTube para leer comentarios.';
    const token = (await tk.json()).access_token;
    const c = await fetch(`https://www.googleapis.com/youtube/v3/commentThreads?part=snippet&allThreadsRelatedToChannelId=${vistas.canalId}&maxResults=10&order=time`, {headers: {Authorization: `Bearer ${token}`}, signal: AbortSignal.timeout(30000)}).catch(() => null);
    if (!c?.ok) return 'No pude leer los comentarios (YouTube no me dio acceso).';
    const hilos = ((await c.json()).items ?? []).map((i) => String(i.snippet?.topLevelComment?.snippet?.textDisplay ?? '').replace(/<[^>]+>/g, '').slice(0, 200)).filter(Boolean);
    if (!hilos.length) return 'No hay comentarios nuevos que responder.';
    const r = await llamar('Eres community manager amable y cercano para un canal de misterio.', `Comentarios recientes:\n${hilos.map((h, i) => `${i + 1}. ${h}`).join('\n')}\nDevuelve {"respuestas": [{"comentario": 1, "respuesta": "borrador corto, cálido y sin prometer nada"}]}. Sin insultos ni datos inventados.`);
    if (!r) return null;
    const resp = (Array.isArray(r.respuestas) ? r.respuestas : []).slice(0, 10).map((x) => ({comentario: hilos[(Number(x.comentario) || 1) - 1] ?? '', respuesta: String(x.respuesta ?? '').slice(0, 280)}));
    guardar('comunidad', {borradores: resp, nota: 'Son borradores: el dueño decide cuáles publicar.'});
    return `${resp.length} borradores de respuesta listos para aprobar.`;
  }],
];

let hechas = 0;
const MAX = 8;
for (const [id, rol, cadaHoras, trabajo] of FUNCIONES) {
  if (hechas >= MAX) break;
  if (hace(id) < cadaHoras) { if (estado.agentes?.[rol]) estado.agentes[rol].tarea = estado.agentes[rol].tarea.replace(/ FUNCIÓN:.*?(?= BONO:| ORDEN DE JULES| JULES:|$)/, '') + ` FUNCIÓN (${id}): ya entregó hoy; ${reloj[id] ? 'la próxima ronda es dentro de ' + Math.max(1, Math.round(cadaHoras - hace(id))) + ' h.' : ''}`; continue; }
  let resumen = null;
  try { resumen = await trabajo(); } catch (e) { console.warn(`Función ${id} falló:`, e.message); }
  if (!resumen) continue;
  hechas++;
  const prev = estado.agentes?.[rol]?.tarea ?? '';
  estado.agentes[rol] = {estado: 'trabajando', actividad: 'escribiendo', tarea: `${prev.replace(/ FUNCIÓN.*$/, '')} FUNCIÓN (${id}): ${String(resumen).slice(0, 260)}`};
  console.log(`${rol} -> ${id}: ${String(resumen).slice(0, 100)}`);
}
// ---- Segunda función de los otros 22: una misión extra por puesto, todas en UNA llamada (cada 6 h) ----
const SEGUNDA = {
  'Directora de contenido': 'detectar la mayor amenaza para la meta del 13 de diciembre y proponer la contramedida',
  'Enlace de datos': 'resumir en 2 frases lo más importante que cambió en los datos desde el último ciclo',
  'Coordinador de producción': 'proponer el mejor horario de publicación de hoy según lo que se sabe y qué videos conviene encolar',
  'Jefa de calidad': 'elegir el defecto más repetido en los videos y proponer una regla nueva para evitarlo',
  'Investigador de temas': 'proponer 2 temas con mucha documentación que encajen con lo que más vistas tuvo',
  'Cazador de fórmulas': 'describir un patrón de título o gancho de canales virales que se pueda copiar como estructura',
  'Vigía de tendencias': 'nombrar un tipo de contenido de misterio que parezca crecer y por qué (solo con datos dados)',
  'Guionista': 'escribir 2 primeras frases alternativas, con gancho de 3 segundos, para el próximo video',
  'Editor de guion': 'señalar la frase que más aburre en el último guion y reescribirla',
  'Titulista': 'proponer 2 títulos alternativos para el último video con una cifra del guion',
  'Redactor de descripción': 'escribir una descripción corta alternativa para el último video con palabras clave al inicio',
  'Especialista en hashtags': 'proponer 5 hashtags específicos alternativos para el último video',
  'Verificador de datos': 'listar qué dato del último guion sería el más fácil de cuestionar y cómo reforzarlo con la fuente',
  'Auditor de fuentes': 'decir qué fuente adicional pública convendría citar para el último tema',
  'Auditor de normas': 'comprobar de memoria una norma del canal y decir si el último guion la cumple',
  'Revisor de nombres': 'listar términos del último guion que podrían confundirse con nombres de personas reales',
  'Revisor de ganchos': 'puntuar de 0 a 10 el gancho del último video y decir cómo subirlo a 9',
  'Pintor de luz y detalle': 'proponer una mejora de luz o detalle para los cuadros del próximo tema',
  'Pintor de imágenes': 'describir una escena en pixel art que se podría dibujar para el próximo tema',
  'Locutor': 'proponer cómo ajustar el ritmo y las pausas de la voz en el gancho y la revelación',
  'Técnico de render': 'proponer una forma de reducir el tiempo de render sin perder calidad',
  'Publicador': 'proponer el texto del comentario fijado y cuándo responder a los primeros comentarios',
};
if (hace('segunda') >= 6 && KEY) {
  const roles = Object.keys(SEGUNDA).filter((r) => estado.agentes?.[r]);
  const r = await llamar('Das trabajo extra concreto a un equipo de oficina de un canal de YouTube.', `${contexto}
Último guion: "${ultimoGuion?.titulo ?? 'ninguno'}". ${ultimoGuion ? ultimoGuion.escenas.map((e) => e.texto).join(' ').slice(0, 1200) : ''}

Cada puesto hace su MISIÓN EXTRA con una entrega de 1 o 2 frases:
${roles.map((x) => `- ${x}: ${SEGUNDA[x]}`).join(' ; ')}
Devuelve {"entregas": {"<puesto exacto>": "su entrega"}} para todos.`);
  if (r?.entregas) {
    const salida = {};
    for (const rol of roles) {
      let e = String(r.entregas[rol] ?? '').slice(0, 260);
      if (!e) continue;
      // cifras inventadas: toda cifra debe estar en los datos dados
      const conocido = (contexto + ' ' + (ultimoGuion ? ultimoGuion.escenas.map((x) => x.texto).join(' ') : '')).replace(/[.,\s]/g, '');
      e = e.replace(/\d[\d.,]*/g, (m) => (m.length > 1 && !conocido.includes(m.replace(/[.,\s]/g, '')) ? '(cifra sin respaldo)' : m));
      salida[rol] = e;
      const a = estado.agentes[rol];
      a.estado = 'trabajando'; a.actividad = 'escribiendo';
      a.tarea = a.tarea.replace(/ SEGUNDA:.*?(?= PAGA:| ORDEN DE JULES| JULES:| FUNCIÓN| SOY |$)/s, '') + ` SEGUNDA: ${e}`;
    }
    guardar('segunda', {entregas: salida});
    console.log(`Segunda función: ${Object.keys(salida).length} entregas.`);
  }
}
fs.writeFileSync(path.join(dirF, 'reloj.json'), JSON.stringify(reloj, null, 2));
estado.actualizado = new Date().toISOString();
fs.writeFileSync(path.join(carpeta, 'estado.json'), JSON.stringify(estado, null, 2));
process.exit(0);
