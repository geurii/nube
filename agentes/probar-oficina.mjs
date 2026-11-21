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
process.env.GROQ_API_KEY = 'prueba';
process.env.FORMATO = 'short';

const CTA_LQNS = base.cta;
const CTA_DEMO = 'Suscríbete y cuéntale a un amigo.';
const hacer = (cta) => [
  {tipo: 'hook', texto: 'Sabías que en mil novecientos noventa y siete un sonido enorme se grabó en el océano Pacífico y lo llamaron Bloop.'},
  {tipo: 'historia', texto: 'Lo registraron micrófonos submarinos que la agencia de los océanos de Estados Unidos tenía repartidos por el mar para escuchar el fondo del agua, y duró un buen rato.'},
  {tipo: 'historia', texto: 'El sonido era tan fuerte que se oyó en sensores separados por miles de kilómetros, y por eso pareció venir de algo gigante que se movía muy lejos de cualquier barco.'},
  {tipo: 'historia', texto: 'Mucha gente pensó en un animal desconocido, y la idea se hizo famosa durante años en internet, en programas de televisión y en conversaciones sobre monstruos marinos antiguos.'},
  {tipo: 'revelacion', texto: 'Pero lo que no sabías: la agencia explicó que fue el crujido de hielo que se rompe en la Antártida.'},
  {tipo: 'veredicto', texto: `¿Tú qué piensas, un animal enorme o un bloque de hielo? Cuéntamelo en los comentarios. ${cta}`},
];
let cta = CTA_LQNS;
let llamadas = 0;
const original = globalThis.fetch;
globalThis.fetch = async (url, opciones) => {
  const u = String(url);
  if (u.includes('api.groq.com/openai/v1/models')) return new Response(JSON.stringify({data: [{id: 'openai/gpt-oss-120b'}]}), {status: 200});
  if (u.includes('api.groq.com/openai/v1/chat/completions')) {
    llamadas++;
    const cuerpo = JSON.parse(opciones.body);
    const sistema = cuerpo.messages[0].content;
    const escenas = hacer(cta);
    let respuesta;
    if (sistema.includes('Director/a de contenido')) respuesta = {temas: ['Bloop']};
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
  if (!guion.escenas[0].fondo[1]?.startsWith('pixelcifra:1997|')) fallos.push(`${canal}: el parámetro del fondo salió mal`);
  if (!guion.publicacion.comentarioFijado) fallos.push(canal + ': la Mesa de publicación no dejó comentario fijado');
  if (guion.publicacion.titulosAlternativos?.some((t) => t.includes('99999'))) fallos.push(canal + ': dejó pasar una cifra inventada en un título');
  if (Object.keys(JSON.parse(fs.readFileSync(path.join('oficina-salida', canal, 'estado.json'), 'utf8')).agentes).length < 25) fallos.push(canal + ': faltan puestos en el estado');
  if (guion.publicacion.descripcion.includes('#viral')) fallos.push(`${canal}: dejó pasar #viral`);
  if (estado.totales.aprobados !== 1) fallos.push(`${canal}: el estado no contó el guion aprobado`);
  if (!estado.agentes['Editor de guion']) fallos.push(`${canal}: el Editor no aparece en el estado`);
}
if (leer('oficina-salida/lqns/guion-bloop.json').voz !== 'es-DO-EmilioNeural') fallos.push('lqns: voz equivocada');
if (leer('oficina-salida/demo/guion-bloop.json').voz !== 'es-MX-JorgeNeural') fallos.push('demo: cada canal debe usar su propia voz');
const notis = leer('oficina-salida/notificaciones.json');
if (notis.length !== 2 || !notis.some((x) => x.canal === 'lqns') || !notis.some((x) => x.canal === 'demo')) fallos.push('las notificaciones no tienen un reporte por canal');
if (notis.some((x) => !x.id || !x.fecha || !x.texto)) fallos.push('una notificación está incompleta');
console.log(`Prueba: ${llamadas} llamadas simuladas a Groq · canales: lqns y demo · notificaciones: ${notis.length}`);
if (fallos.length) { console.error('FALLÓ:', fallos.join('; ')); process.exit(1); }
console.log('PRUEBA OK: dos canales con carpetas, voces y reportes propios.');
