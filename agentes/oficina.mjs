// Oficina de videos de "Lo Que No Sabías" · corre en GitHub Actions (sin que Claude participe).
// Departamentos: Investigación (Wikipedia, con fuente) → Guionista (Groq) → Verificador (Groq + comprobaciones propias).
// Salida: oficina-salida/guion-<tema>.json (formato del sistema de render) + informe-<tema>.md (qué se revisó y qué se rechazó).
// Variables: GROQ_API_KEY (secreto), TEMA (título en Wikipedia), FORMATO (short|largo), IDIOMAS (por defecto "es,en").
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GROQ_API_KEY;
let TEMA = (process.env.TEMA ?? '').trim();
const FORMATO = process.env.FORMATO === 'largo' ? 'largo' : 'short';
const IDIOMAS = (process.env.IDIOMAS ?? 'es,en').split(',').map((s) => s.trim()).filter(Boolean);
const PALABRAS = FORMATO === 'largo' ? Number(process.env.PALABRAS) || 900 : 110;
const CTA = 'Comparte este video con un amigo que haría lo mismo, sígueme.';
const UA = 'OficinaVideos/1.0 (proyecto educativo)';
const SALIDA = path.resolve('oficina-salida');
fs.mkdirSync(SALIDA, {recursive: true});

const fallar = (m) => { console.error('ERROR:', m); process.exit(1); };
if (!KEY) fallar('Falta el secreto GROQ_API_KEY.');

/* ---------- Investigación: Wikipedia (gratis, con fuente) ---------- */
const investigar = async () => {
  const fuentes = [];
  for (const lang of IDIOMAS) {
    const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts%7Cinfo&inprop=url&explaintext=1&exsectionformat=plain&redirects=1&format=json&titles=${encodeURIComponent(TEMA)}`;
    const r = await fetch(url, {headers: {'User-Agent': UA}});
    if (!r.ok) continue;
    const j = await r.json();
    const pagina = Object.values(j.query?.pages ?? {})[0];
    if (!pagina || pagina.missing !== undefined || !pagina.extract) continue;
    fuentes.push({idioma: lang, titulo: pagina.title, url: pagina.fullurl, texto: pagina.extract.slice(0, FORMATO === 'largo' ? 3500 : 4500)});
  }
  return fuentes;
};

/* ---------- Groq ---------- */
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const groq = async (modelo, mensajes, maxTokens = FORMATO === 'largo' ? 4500 : 2500, intento = 1) => {
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json'},
    body: JSON.stringify({
      model: modelo,
      messages: mensajes,
      temperature: 0.4,
      max_tokens: maxTokens,
      // los modelos "gpt-oss" razonan antes de responder: poco razonamiento = más espacio para el guion
      ...(modelo.includes('gpt-oss') ? {reasoning_effort: 'low'} : {}),
    }),
  });
  if (r.status === 429 && intento <= 5) {
    const cuerpo = await r.text();
    const espera = Number(/try again in ([d.]+)s/i.exec(cuerpo)?.[1] ?? 20);
    console.log(`Groq pide esperar ${espera} s (límite por minuto del nivel gratis). Reintento ${intento}/5.`);
    await dormir((espera + 2) * 1000);
    return groq(modelo, mensajes, maxTokens, intento + 1);
  }
  if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 300)}`);
  const j = await r.json();
  const eleccion = j.choices?.[0];
  const contenido = eleccion?.message?.content ?? '';
  if (!contenido.trim()) throw new Error(`Groq devolvió una respuesta vacía (motivo: ${eleccion?.finish_reason ?? 'desconocido'}).`);
  return contenido;
};
const json = (texto) => {
  const a = texto.indexOf('{'), b = texto.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('La IA no devolvió JSON: ' + texto.slice(0, 200));
  return JSON.parse(texto.slice(a, b + 1));
};
const elegirModelo = async () => {
  const r = await fetch('https://api.groq.com/openai/v1/models', {headers: {Authorization: `Bearer ${KEY}`}});
  if (!r.ok) throw new Error(`No pude listar los modelos de Groq (${r.status}). ¿La clave es válida?`);
  const ids = (await r.json()).data.map((m) => m.id);
  const preferidos = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
  const modelo = preferidos.find((p) => ids.includes(p)) ?? ids.find((i) => !/whisper|guard|tts|orpheus|playai/i.test(i));
  if (!modelo) throw new Error('No encontré un modelo de texto disponible en Groq. Modelos: ' + ids.join(', '));
  return modelo;
};


/* ---------- Dirección: elige el tema sola (sin personas, sin repetir) ---------- */
const HISTORIAL = path.join(SALIDA, 'historial.json');
const leerHistorial = () => { try { return JSON.parse(fs.readFileSync(HISTORIAL, 'utf8')); } catch { return []; } };
const existeEnWikipedia = async (titulo) => {
  const url = `https://en.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&redirects=1&format=json&titles=${encodeURIComponent(titulo)}`;
  const r = await fetch(url, {headers: {'User-Agent': UA}});
  if (!r.ok) return false;
  const pagina = Object.values((await r.json()).query?.pages ?? {})[0];
  return !!pagina && pagina.missing === undefined && (pagina.extract ?? '').length > 3000;
};
const elegirTema = async (modelo) => {
  const hechos = leerHistorial();
  const respuesta = await groq(modelo, [
    {role: 'system', content: 'Eres el/la Director/a de contenido de un canal de misterio y datos curiosos en YouTube. Respondes SOLO con JSON.'},
    {role: 'user', content: `Dame 20 títulos EXACTOS de artículos de Wikipedia en inglés sobre misterios sin resolver, fenómenos raros, objetos históricos enigmáticos o casos curiosos con mucha documentación. Reglas: nada sobre personas (ni biografías), nada de política ni de violencia gráfica, nada ya hecho. Ya hechos: ${hechos.join(', ') || 'ninguno'}. Formato: {"temas": ["Titulo 1", "Titulo 2"]}`},
  ]);
  const lista = json(respuesta).temas ?? [];
  for (const t of lista) {
    if (hechos.includes(t)) continue;
    if (await existeEnWikipedia(t)) return t;
  }
  throw new Error('No encontré un tema nuevo con material suficiente en Wikipedia.');
};

/* ---------- Normas de la jefa (las cumplen todos) ---------- */
const NORMAS = `NORMAS DE LA JEFA (no se negocian):
1. Solo puedes usar datos que estén en el MATERIAL. Si un dato no está en el material, no existe. Prohibido inventar.
2. Si el material no alcanza para lo que se pide, dilo y escribe menos. Un guion corto y verdadero vale más que uno largo con relleno.
3. La primera frase empieza exactamente con "Sabías que" y trae una imagen concreta que se entienda en un segundo.
4. Tono de misterio, no de miedo. Español neutro, claro, para gente normal. Sin tecnicismos.
5. Sin nombres de personas reales: di "el capitán", "un científico", "los investigadores". Sí puedes nombrar lugares, barcos, libros u objetos.
6. Las dudas se dicen como dudas ("según la fuente", "no se sabe"). Si dos fuentes difieren, di las dos.
7. La revelación ("Pero lo que no sabías:") cae entre el 65 % y el 75 % del guion.
8. Cierra con una pregunta al espectador y con esta frase EXACTA: "${CTA}"
9. Los números y fechas se escriben con palabras, como se dicen en voz alta.
10. Cada dato (fecha, cifra, lugar, causa, relación) debe poder encontrarse casi literal en el MATERIAL. Si dudas de una frase, quítala. Prefiere pocas frases verdaderas a muchas dudosas. No uses cifras que el material no traiga.`;

const REPARTO = FORMATO === 'largo'
  ? 'La revelación ("Pero lo que no sabías:") debe empezar cuando lleves entre el 65 % y el 75 % de las palabras del guion.'
  : 'Reparto de palabras obligatorio: antes de la revelación, entre 70 y 80 palabras (el hook más 3 o 4 escenas de historia); la revelación, entre 12 y 18 palabras; el veredicto, entre 22 y 28 palabras e incluye la frase final exacta.';
const guionista = (material, problemas) => [
  {role: 'system', content: `Eres el/la Guionista de un canal de YouTube de misterio y datos curiosos. Tienes triple maestría: narración de documental, retención de audiencia en Shorts/YouTube y rigor periodístico. ${NORMAS}\nResponde SOLO con JSON.`},
  {role: 'user', content: `Escribe un guion de ${FORMATO === 'largo' ? 'video largo' : 'Short vertical de unos 55 segundos'} de unas ${PALABRAS} palabras sobre "${TEMA}". ${REPARTO}\n\nMATERIAL (única fuente permitida):\n${material}\n\n${problemas?.length ? `El Verificador rechazó la versión anterior. Corrige exactamente esto:\n${problemas.map((p) => `- "${p.frase}": ${p.motivo}`).join('\n')}\n\n` : ''}Formato JSON: {"titulo": "...(máx. 90 caracteres, con un emoji)", "descripcion": "...(2 frases)", "escenas": [{"tipo": "hook|historia|revelacion|veredicto", "texto": "una o dos frases"}]}. La primera escena es "hook", la última "veredicto".`},
];
const verificador = (material, escenas) => [
  {role: 'system', content: `Eres el/la Verificador/a, auditor/a estricto/a de datos. Tienes triple maestría: verificación de fuentes, lectura crítica y edición. Tu trabajo es rechazar. Si una frase afirma un dato (fecha, cifra, lugar, causa, nombre, relación) que no está literalmente respaldado por el MATERIAL, la marcas. Las opiniones y frases de enlace no cuentan. Nunca apruebas por cortesía: si no puedes comprobarlo, lo reportas. Responde SOLO con JSON: {"aprobado": true|false, "problemas": [{"frase": "...", "motivo": "..."}]}.`},
  {role: 'user', content: `MATERIAL:\n${material}\n\nGUION A REVISAR (frase por frase):\n${escenas.map((e, i) => `${i + 1}. ${e.texto}`).join('\n')}`},
];

/* ---------- Comprobaciones propias (sin IA) ---------- */
const comprobar = (escenas) => {
  const p = [];
  if (!/^Sabías que/.test(escenas[0]?.texto ?? '')) p.push({frase: escenas[0]?.texto ?? '', motivo: 'La primera frase debe empezar con "Sabías que".'});
  const ultima = escenas[escenas.length - 1]?.texto ?? '';
  if (!ultima.includes(CTA)) p.push({frase: ultima, motivo: `Falta la frase de cierre exacta: "${CTA}"`});
  const n = (e) => e.texto.split(/\s+/).length;
  const total = escenas.reduce((s, e) => s + n(e), 0);
  const i = escenas.findIndex((e) => e.tipo === 'revelacion');
  if (i < 0) p.push({frase: '', motivo: 'No hay escena de revelación.'});
  else {
    const antes = escenas.slice(0, i).reduce((s, e) => s + n(e), 0);
    const pct = Math.round((antes / total) * 100);
    if (pct < 60 || pct > 78) p.push({frase: escenas[i].texto, motivo: `La revelación cae al ${pct} % (${antes} de ${total} palabras antes de ella) y debe caer entre 65 % y 75 %: añade historia antes de la revelación o acórtala.`});
  }
  return p;
};

/* ---------- Estado real para la oficina 3D (estado.json) ---------- */
const ESTADO = path.join(SALIDA, 'estado.json');
const leerEstado = () => {
  try { return JSON.parse(fs.readFileSync(ESTADO, 'utf8')); } catch { return {agentes: {}, historial: [], totales: {aprobados: 0, rechazados: 0, errores: 0}}; }
};
const registrar = (resultado, detalle, intentos) => {
  const e = leerEstado();
  e.totales = e.totales ?? {aprobados: 0, rechazados: 0, errores: 0};
  const clave = resultado === 'aprobado' ? 'aprobados' : resultado === 'rechazado' ? 'rechazados' : 'errores';
  e.totales[clave] = (e.totales[clave] ?? 0) + 1;
  e.historial = [{fecha: new Date().toISOString(), tema: TEMA || '(sin tema)', formato: FORMATO, resultado, intentos, detalle}, ...(e.historial ?? [])].slice(0, 20);
  const t = e.totales;
  const resumen = `Aprobados: ${t.aprobados}. Rechazados: ${t.rechazados}. Con error: ${t.errores}.`;
  const ag = e.agentes ?? {};
  if (resultado === 'aprobado') {
    ag['Directora de contenido'] = {estado: 'libre', actividad: 'hablando', tarea: `Último guion aprobado: "${TEMA}" (${FORMATO}). ${resumen}`};
    ag['Investigador de temas'] = {estado: 'libre', actividad: 'leyendo', tarea: `Dejó el material de "${TEMA}" con su fuente en Wikipedia.`};
    ag['Guionista'] = {estado: 'libre', actividad: 'escribiendo', tarea: `Entregó el guion de "${TEMA}". ${detalle}`};
    ag['Verificador de datos'] = {estado: 'libre', actividad: 'leyendo', tarea: `Aprobó "${TEMA}" en el intento ${intentos}.`};
  } else if (resultado === 'rechazado') {
    ag['Directora de contenido'] = {estado: 'esperando_decision', actividad: 'pensando', tarea: `Necesita revisión: el guion de "${TEMA}" no pasó la verificación. ${resumen}`};
    ag['Investigador de temas'] = {estado: 'libre', actividad: 'leyendo', tarea: `Dejó el material de "${TEMA}" con su fuente en Wikipedia.`};
    ag['Guionista'] = {estado: 'trabajando', actividad: 'escribiendo', tarea: `Intentó 3 veces escribir "${TEMA}" sin que el Verificador lo aprobara.`};
    ag['Verificador de datos'] = {estado: 'esperando_decision', actividad: 'leyendo', tarea: `Rechazó "${TEMA}": ${detalle}`};
  } else {
    ag['Directora de contenido'] = {estado: 'esperando_decision', actividad: 'pensando', tarea: `La oficina falló en su último ciclo: ${detalle}`};
  }
  e.agentes = ag;
  e.actualizado = new Date().toISOString();
  fs.writeFileSync(ESTADO, JSON.stringify(e, null, 2));
};

/* ---------- Flujo ---------- */
let slug = 'sin-tema';
const informe = [`# Informe de la oficina · ${TEMA} (${FORMATO})`, ''];
try {
  const modeloTema = await elegirModelo();
  if (!TEMA) { TEMA = await elegirTema(modeloTema); informe[0] = `# Informe de la oficina · ${TEMA} (${FORMATO})`; informe.push('Tema elegido por la oficina.', ''); }
  slug = TEMA.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const fuentes = await investigar();
  if (!fuentes.length) throw new Error(`No encontré el tema "${TEMA}" en Wikipedia (${IDIOMAS.join(', ')}). Pruébalo con el título exacto del artículo.`);
  informe.push('## Investigación', ...fuentes.map((f) => `- ${f.idioma}: [${f.titulo}](${f.url})`), '');
  const material = fuentes.map((f) => `### FUENTE (${f.idioma}) ${f.url}\n${f.texto}`).join('\n\n');
  const modelo = await elegirModelo();
  informe.push(`Modelo usado en Groq: ${modelo}`, '');

  let escenas = null, titulo = '', descripcion = '', problemas = [], aprobado = false, intentosUsados = 0;
  for (let intento = 1; intento <= 3 && !aprobado; intento++) {
    intentosUsados = intento;
    const borrador = json(await groq(modelo, guionista(material, problemas)));
    escenas = (borrador.escenas ?? []).map((e) => ({tipo: e.tipo, texto: String(e.texto ?? '').trim()})).filter((e) => e.texto);
    titulo = borrador.titulo ?? TEMA;
    descripcion = borrador.descripcion ?? '';
    if (escenas.length < 3) throw new Error('El guion salió demasiado corto.');
    const propios = comprobar(escenas);
    const revision = json(await groq(modelo, verificador(material, escenas), 1500));
    problemas = [...propios, ...(revision.problemas ?? [])];
    aprobado = problemas.length === 0 && revision.aprobado !== false;
    informe.push(`## Intento ${intento}: ${aprobado ? 'APROBADO' : 'RECHAZADO'}`, ...problemas.map((p) => `- "${p.frase}" → ${p.motivo}`), '');
  }
  const palabras = escenas.reduce((s, e) => s + e.texto.split(/\s+/).length, 0);
  informe.push(`Palabras: ${palabras} · Escenas: ${escenas.length}`);
  const guion = {
    titulo,
    formato: FORMATO,
    ...(FORMATO === 'largo' ? {orientacion: 'horizontal'} : {}),
    plataforma: 'youtube',
    audio: `audio/oficina-${slug}.wav`,
    musica: 'musica/firma-canal.mp3',
    personaje: {esquina: 'arriba-derecha', visible: true},
    publicacion: {titulo, descripcion: `${descripcion}\n\nMándaselo a un amigo que haría lo mismo, sígueme.\n\nFuentes: ${fuentes.map((f) => f.url).join(' · ')}\n\nMás historias en el canal: https://youtube.com/@lo.que.no.sabias_do`},
    estado: aprobado ? 'aprobado' : 'rechazado-necesita-revision',
    escenas: escenas.map((e) => ({...e, fondo: ['pixelmisterio']})),
  };
  fs.writeFileSync(path.join(SALIDA, `guion-${slug}.json`), JSON.stringify(guion, null, 2));
  fs.writeFileSync(path.join(SALIDA, `informe-${slug}.md`), informe.join('\n'));
  // se anota el tema (aprobado o no) para que la oficina no lo repita
  fs.writeFileSync(HISTORIAL, JSON.stringify([...new Set([...leerHistorial(), TEMA])], null, 2));
  registrar(aprobado ? 'aprobado' : 'rechazado', aprobado ? `${palabras} palabras, ${escenas.length} escenas.` : (problemas[0]?.motivo ?? 'sin detalle').slice(0, 160), intentosUsados);
  console.log(informe.join('\n'));
  if (!aprobado) { console.error('El Verificador no aprobó el guion tras 3 intentos. Queda marcado para revisión.'); process.exit(2); }
} catch (e) {
  informe.push('## ERROR', String(e.message ?? e));
  try { registrar('error', String(e.message ?? e).slice(0, 160), 0); } catch { /* sin estado */ }
  fs.writeFileSync(path.join(SALIDA, `informe-${slug}.md`), informe.join('\n'));
  fallar(e.message ?? e);
}
