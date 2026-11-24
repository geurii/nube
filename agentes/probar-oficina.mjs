// Prueba la oficina SIN gastar Groq: simula las respuestas de la IA y usa Wikipedia de verdad.
// node agentes/probar-oficina.mjs → corre en una carpeta temporal con DOS canales y revisa guion, informe, estado y notificaciones de cada uno.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oficina-prueba-'));
process.chdir(tmp);
fs.mkdirSync('agentes');
const base = JSON.parse(fs.readFileSync(path.join(aqui, 'canales-propios.json'), 'utf8')).canales[0];
fs.writeFileSync(path.join('agentes', 'canales-propios.json'), JSON.stringify({canales: [
  base,
  {id: 'demo', nombre: 'Canal Demo', nicho: 'ciencia curiosa', tono: 'Tono alegre.', idioma: 'es', idiomasFuente: ['en'], voz: 'es-MX-JorgeNeural', cta: 'Suscríbete y cuéntale a un amigo.', ctaEscrito: 'Cuéntale a un amigo.', musica: null, activo: true, vigilar: []},
]}));
// un video publicado hace poco en cada canal: así la garantía de publicación NO está activa y el voto del panel sí bloquea (caso normal)
for (const c of ['lqns', 'demo']) {
  fs.mkdirSync(path.join('oficina-salida', c), {recursive: true});
  fs.writeFileSync(path.join('oficina-salida', c, 'vistas.json'), JSON.stringify({videos: [{id: 'x', publicado: new Date().toISOString(), vistas: 10}]}));
}
process.env.GROQ_API_KEY = 'prueba';
process.env.FORMATO = 'short';

const CTA_LQNS = base.cta;
const {validarGancho} = await import(pathToFileURL(path.join(aqui, 'reglas-guion.mjs')).href);
const hook16 = 'El barco desapareció y nadie pudo explicar qué ocurrió aquella noche en medio del océano Atlántico.';
if (validarGancho(hook16, 'short').valido || !validarGancho(hook16, 'largo').valido) throw new Error('La regla del gancho debe permitir 24 palabras en largo y mantener 14 en short.');
const CTA_DEMO = 'Suscríbete y cuéntale a un amigo.';
const hacer = (cta) => [
  {tipo: 'hook', texto: 'El oceano registro un sonido imposible en 1997.'},
  {tipo: 'historia', texto: 'Lo registraron micrófonos submarinos que la agencia de los océanos de Estados Unidos tenía repartidos por el mar para escuchar el fondo del agua, y duró un buen rato.'},
  {tipo: 'historia', texto: 'El sonido era tan fuerte que se oyó en sensores separados por miles de kilómetros, y por eso pareció venir de algo gigante que se movía muy lejos de cualquier barco.'},
  {tipo: 'historia', texto: 'Mucha gente pensó en un animal desconocido, y la idea se hizo famosa durante años en internet, en programas de televisión y en conversaciones sobre monstruos marinos antiguos.'},
  {tipo: 'revelacion', texto: 'Pero lo que no sabías: la agencia explicó que fue el crujido de hielo que se rompe en la Antártida.'},
  {tipo: 'veredicto', texto: `¿Tú qué piensas, un animal enorme o un bloque de hielo? Cuéntamelo en los comentarios. ${cta}`},
];

// ---- El panel de 8 espectadores (simulado): la primera vez rechaza el guion (2 de 8) y la segunda lo aprueba (7 de 8) ----
let llamadasPanel = 0;
const respuestaPanel = () => {
  llamadasPanel++;
  const aprueba = llamadasPanel > 1;
  return {votos: Array.from({length: 8}, (_, i) => ({quien: 'x', pasa_los_3_segundos: aprueba || i < 2, sigue_hasta_segundo: aprueba ? 70 : 20, le_gusto: aprueba ? i < 7 : i < 2, lo_compartiria: i < 3, comentario: aprueba ? 'Me atrapó.' : 'El gancho es flojo.'})), mejora_principal: 'Empieza con la cifra más impactante.'};
};

// ---- Los dos pintores (simulados): A propone, B objeta la primera vez, A acepta ----
let rondaB = 0;
const cuadro = () => ({cielo: ['#10183a', '#3a4a8a', '#e8a070'], capas: [{t: 'estrellas', n: 40}, {t: 'olas', y: 0.62, color: '#1d4f86'}, {t: 'barco', x: 0.3, y: 0.64, w: 0.3}, {t: 'pez', tipo: 'ballena', x: 0.5, y: 0.45, w: 0.4}]});
const indicesDe = (txt) => [...new Set([...txt.matchAll(/^(\d+)\. \[/gm)].map((m) => Number(m[1])).concat([...txt.matchAll(/"indice":(\d+)/g)].map((m) => Number(m[1]))))];
const respuestaPintor = (sistema, usuario) => {
  const ids = indicesDe(usuario);
  const escenasP = ids.map((i) => ({indice: i, planos: [cuadro(), cuadro()]}));
  if (sistema.includes('Eres el Pintor de luz y detalle')) { rondaB++; return {acuerdo: rondaB > 1, objeciones: rondaB > 1 ? [] : ['Falta un primer plano oscuro', 'Añade rayos de luz'], escenas: escenasP}; }
  return {acuerdo: true, escenas: escenasP};
};
let cta = CTA_LQNS;
let llamadas = 0;
let vioLecciones = false; // ¿llegaron las lecciones aprendidas al contexto de los agentes?
const original = globalThis.fetch;
globalThis.fetch = async (url, opciones) => {
  const u = String(url);
  if (u.includes('html.duckduckgo.com/html/')) {
    const consulta = new URL(u).searchParams.get('q') || '';
    const dominio = /site:([^\\s]+)/.exec(consulta)?.[1] || 'si.edu';
    const snippet = 'Registro institucional con fechas, contexto histórico, descripción documental y datos concretos consultables para verificar este tema.';
    return new Response(`<a class="result__a" href="https://${dominio}/bloop">Bloop institutional record</a><a class="result__snippet">${snippet}</a>`, {status: 200});
  }
  if (/^https:\\/\\/[^/]+\\/bloop$/.test(u)) {
    const texto = 'The institutional record documents the Bloop acoustic event, the hydrophone observations, the recorded date, the geographic context and the scientific explanation. This page provides a primary institutional account and enough descriptive detail for the research test. '.repeat(2);
    return new Response(`<html><head><title>Institutional Bloop Record</title><meta name="description" content="${texto}"></head><body><p>${texto}</p><p>${texto}</p></body></html>`, {status: 200});
  }
  if (u.includes('.wikipedia.org/w/api.php')) return new Response(JSON.stringify({query:{pages:{'-1':{missing:''}}}}), {status:200});
  if (u.includes('api.groq.com/openai/v1/models')) return new Response(JSON.stringify({data: [{id: 'openai/gpt-oss-120b'}]}), {status: 200});
  if (u.includes('api.groq.com/openai/v1/chat/completions')) {
    llamadas++;
    const cuerpo = JSON.parse(opciones.body);
    if (cuerpo.messages.some((m) => String(m.content).includes('LECCIONES QUE EL EQUIPO YA APRENDIÓ') && String(m.content).includes('LECCION-DE-PRUEBA'))) vioLecciones = true;
    const sistema = cuerpo.messages[0].content;
    const escenas = hacer(cta);
    let respuesta;
    if (sistema.includes('Eres el Pintor')) respuesta = respuestaPintor(sistema, cuerpo.messages.at(-1)?.content ?? '');
    else if (sistema.includes('panel de 8 espectadores')) respuesta = respuestaPanel();
    else if (sistema.includes('Director/a de contenido')) respuesta = {temas: ['Bloop']};
    else if (sistema.includes('Mesa de publicación')) respuesta = {titulos: ['El sonido que asustó al océano 🌊', 'Un sonido de 99999 kilómetros 😱'], elegido: 'El sonido que asustó al océano 🌊', descripcion: 'Bloop: el sonido submarino más fuerte jamás registrado y su explicación.', hashtags: ['#viral', '#bloop', '#oceano', '#noaa', '#misterio', '#sonar'], comentario_fijado: '¿Qué crees que lo causó?', miniatura: {texto: 'EL BLOOP', idea: 'Una onda azul en el océano'}};
    else if (sistema.includes('Guionista')) respuesta = {titulo: 'El sonido del océano que parecía un monstruo 🌊', descripcion: 'Un sonido enorme y su explicación.', hashtags: ['#bloop', '#misterio', '#oceano', '#noaa', '#viral'], escenas};
    else if (sistema.includes('Editor/a crítico')) respuesta = {puntaje: 7, critica: 'Gancho claro; recorta la segunda frase.', titulo: 'El sonido del océano que parecía un monstruo 🌊', escenas};
    else if (sistema.includes('Verificador/a')) respuesta = {aprobado: true, problemas: [], nombres_de_personas: ['Nadie Inventado']};
    else if (sistema.includes('Escenógrafo')) respuesta = {fondos: escenas.map(() => ['pixelsonar', 'pixelcifra:1997|EL ANO DEL BLOOP|azul', 'pixelinventado'])};
    else respuesta = {};
    return new Response(JSON.stringify({choices: [{message: {content: JSON.stringify(respuesta)}, finish_reason: 'stop'}]}), {status: 200});
  }
  return original(url, opciones);
};

// una lección guardada (crítica / resultado / pedido del dueño) debe llegar a los agentes
fs.writeFileSync(path.join('oficina-salida', 'lqns', 'lecciones.json'), JSON.stringify([{id: 'x', fecha: new Date().toISOString(), fuente: 'critica', texto: 'LECCION-DE-PRUEBA: empieza con una cifra concreta en los primeros tres segundos'}]));

// Dos canales, uno detrás de otro (como hace el flujo de GitHub)
for (const [canal, ctaCanal, n] of [['lqns', CTA_LQNS, 1], ['demo', CTA_DEMO, 2]]) {
  cta = ctaCanal;
  process.env.CANAL = canal;
  process.env.TEMA = 'Bloop';
  await import(pathToFileURL(path.join(aqui, 'oficina.mjs')).href + `?canal=${n}`);
}

const fallos = [];
const leer = (r) => JSON.parse(fs.readFileSync(path.join(tmp, r), 'utf8'));
for (const canal of ['lqns', 'demo']) {
  const dir = path.join('oficina-salida', canal);
  const guion = leer(path.join(dir, 'guion-bloop.json'));
  const estado = leer(path.join(dir, 'estado.json'));
  if (guion.estado !== 'aprobado') fallos.push(`${canal}: el guion no quedó aprobado (${guion.estado})`);
  if (guion.canal !== canal) fallos.push(`${canal}: el guion no dice a qué canal pertenece`);
  if (!guion.audio.startsWith(`audio/${canal}-`)) fallos.push(`${canal}: el audio no lleva el nombre del canal (${guion.audio})`);
  if (guion.escenas.some((e) => e.fondo.includes('pixelinventado'))) fallos.push(`${canal}: dejó pasar un fondo inventado`);
  if (!guion.escenas.every((e) => e.fondo.length === 2 && e.fondo.every((x) => x.startsWith('pintado:')))) fallos.push(`${canal}: los dos pintores no dibujaron los 2 planos de cada escena`);
  { const inf = fs.readFileSync(path.join(dir, 'informe-bloop.md'), 'utf8'); if (!/acuerdo/.test(inf)) fallos.push(`${canal}: no quedó el diálogo entre los dos pintores en el informe`); }
  for (const e of guion.escenas) for (const x of e.fondo) if (!fs.existsSync(path.join('public', 'pintados', x.replace('pintado:', '') + '.json'))) fallos.push(`${canal}: falta el archivo del cuadro ${x}`);
  if (!guion.publicacion.comentarioFijado) fallos.push(canal + ': la Mesa de publicación no dejó comentario fijado');
  if (guion.publicacion.titulosAlternativos?.some((t) => t.includes('99999'))) fallos.push(canal + ': dejó pasar una cifra inventada en un título');
  if (Object.keys(JSON.parse(fs.readFileSync(path.join('oficina-salida', canal, 'estado.json'), 'utf8')).agentes).length < 15) fallos.push(canal + ': faltan puestos en el estado');
  if (guion.publicacion.descripcion.includes('#viral')) fallos.push(`${canal}: dejó pasar #viral`);
  if (estado.totales.aprobados !== 1) fallos.push(`${canal}: el estado no contó el guion aprobado`);
  if (!estado.agentes['Editor de guion']) fallos.push(`${canal}: el Editor no aparece en el estado`);
}
if (leer('oficina-salida/lqns/guion-bloop.json').voz !== 'es-MX-JorgeNeural') fallos.push('lqns: voz equivocada');
if (leer('oficina-salida/demo/guion-bloop.json').voz !== 'es-MX-JorgeNeural') fallos.push('demo: cada canal debe usar su propia voz');
{ // el panel es el PASO 2: juzga el guion antes de producir; si lo rechaza, se reescribe y el segundo intento se aprueba
  const informes = ['lqns', 'demo'].map((c) => fs.readFileSync(path.join('oficina-salida', c, 'informe-bloop.md'), 'utf8'));
  if (!informes.every((inf) => /Panel de 8 espectadores \(guion/.test(inf))) fallos.push('el panel de 8 espectadores no juzgó el guion en el ciclo de la oficina');
  if (!informes.some((inf) => /NO le gustó/.test(inf) && /Intento 2: APROBADO/.test(inf))) fallos.push('un rechazo del panel no provocó que el guion se reescribiera y se aprobara en el intento 2');
}
{ // RETENCIÓN: un guion que les gusta pero con retención estimada < 70 % NO pasa, ni con la garantía de publicación
  const {decidir, retencionEstimada} = await import(pathToFileURL(path.join(aqui, 'panel-guion.mjs')).href + '?ret');
  const mk = (hasta) => Array.from({length: 8}, () => ({leGusto: true, pasa3: true, sigueHasta: hasta}));
  const bajo = decidir({votos: mk(30), garantia: false, duracion: 60});
  const bajoGarantia = decidir({votos: mk(30), garantia: true, duracion: 60});
  const alto = decidir({votos: mk(52), garantia: false, duracion: 60});
  if (bajo.aprobado || bajoGarantia.aprobado) fallos.push('retención: un guion con retención estimada baja NO debe pasar (ni con garantía)');
  if (!alto.aprobado || retencionEstimada(mk(52), 60) !== 87) fallos.push('retención: un guion con 87 % debe pasar');
  if (!bajo.rechazoPorRetencion) fallos.push('retención: debe marcar que el rechazo fue por retención');
}
if (!vioLecciones) fallos.push('las lecciones aprendidas NO llegaron al contexto de los agentes');
const notis = leer('oficina-salida/notificaciones.json');
if (notis.length !== 2 || !notis.some((x) => x.canal === 'lqns') || !notis.some((x) => x.canal === 'demo')) fallos.push('las notificaciones no tienen un reporte por canal');
if (notis.some((x) => !x.id || !x.fecha || !x.texto)) fallos.push('una notificación está incompleta');
{ // MODO MANUAL: encendido, el guion aprobado queda esperando el visto bueno del dueño (no pasa solo a producir)
  fs.writeFileSync(path.join('oficina-salida', 'lqns', 'manual.json'), JSON.stringify({activo: true}));
  cta = CTA_LQNS;
  process.env.CANAL = 'lqns';
  process.env.TEMA = 'Bloop';
  await import(pathToFileURL(path.join(aqui, 'oficina.mjs')).href + '?canal=3');
  const g = leer('oficina-salida/lqns/guion-bloop.json');
  fs.writeFileSync(path.join('oficina-salida', 'lqns', 'manual.json'), JSON.stringify({activo: false, acciones: [], aplicadas: []})); if (g.estado !== 'aprobado') fallos.push('produccion automatica: el guion no continuo sin visto bueno (' + g.estado + ')');
}
console.log(`Prueba: ${llamadas} llamadas simuladas a Groq · canales: lqns y demo · notificaciones: ${notis.length}`);
if (fallos.length) { console.error('FALLÓ:', fallos.join('; ')); process.exit(1); }
console.log('PRUEBA OK: dos canales con carpetas, voces y reportes propios.');
