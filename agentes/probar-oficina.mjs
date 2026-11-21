// Prueba la oficina SIN gastar Groq: simula las respuestas de la IA y usa Wikipedia de verdad.
// node agentes/probar-oficina.mjs  → corre en una carpeta temporal y revisa que salgan guion, informe y estado.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {pathToFileURL, fileURLToPath} from 'node:url';

const aqui = path.dirname(fileURLToPath(import.meta.url));
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'oficina-prueba-'));
process.chdir(tmp);
process.env.GROQ_API_KEY = 'prueba';
process.env.TEMA = process.env.TEMA ?? 'Bloop';
process.env.FORMATO = 'short';

const CTA = 'Comparte este video con un amigo que haría lo mismo, sígueme.';
const escenas = [
  {tipo: 'hook', texto: 'Sabías que en mil novecientos noventa y siete un sonido enorme se grabó en el océano Pacífico y lo llamaron Bloop.'},
  {tipo: 'historia', texto: 'Lo registraron micrófonos submarinos que la agencia de los océanos de Estados Unidos tenía repartidos por el mar para escuchar el fondo del agua, y duró un buen rato.'},
  {tipo: 'historia', texto: 'El sonido era tan fuerte que se oyó en sensores separados por miles de kilómetros, y por eso pareció venir de algo gigante que se movía muy lejos de cualquier barco.'},
  {tipo: 'historia', texto: 'Mucha gente pensó en un animal desconocido, y la idea se hizo famosa durante años en internet, en programas de televisión y en conversaciones sobre monstruos marinos antiguos.'},
  {tipo: 'revelacion', texto: 'Pero lo que no sabías: la agencia explicó que fue el crujido de hielo que se rompe en la Antártida.'},
  {tipo: 'veredicto', texto: `¿Tú qué piensas, un animal enorme o un bloque de hielo? Cuéntamelo en los comentarios. ${CTA}`},
];
let llamadas = 0;
const original = globalThis.fetch;
globalThis.fetch = async (url, opciones) => {
  const u = String(url);
  if (u.includes('api.groq.com/openai/v1/models')) return new Response(JSON.stringify({data: [{id: 'openai/gpt-oss-120b'}]}), {status: 200});
  if (u.includes('api.groq.com/openai/v1/chat/completions')) {
    llamadas++;
    const cuerpo = JSON.parse(opciones.body);
    const sistema = cuerpo.messages[0].content;
    let respuesta;
    if (sistema.includes('Director/a de contenido')) respuesta = {temas: ['Bloop']};
    else if (sistema.includes('Guionista')) respuesta = {titulo: 'El sonido del océano que parecía un monstruo 🌊', descripcion: 'Un sonido enorme y su explicación.', escenas};
    else if (sistema.includes('Editor/a crítico')) respuesta = {puntaje: 7, critica: 'Gancho claro; recorta la segunda frase.', titulo: 'El sonido del océano que parecía un monstruo 🌊', escenas};
    else if (sistema.includes('Verificador/a')) respuesta = {aprobado: true, problemas: []};
    else if (sistema.includes('Escenógrafo')) respuesta = {fondos: escenas.map(() => ['pixelsonar', 'pixelcifra:1997|EL ANO DEL BLOOP|azul', 'pixelinventado'])};
    else respuesta = {};
    return new Response(JSON.stringify({choices: [{message: {content: JSON.stringify(respuesta)}, finish_reason: 'stop'}]}), {status: 200});
  }
  return original(url, opciones);
};

await import(pathToFileURL(path.join(aqui, 'oficina.mjs')).href);

const salida = path.join(tmp, 'oficina-salida');
const archivos = fs.readdirSync(salida);
const fallos = [];
const guion = JSON.parse(fs.readFileSync(path.join(salida, 'guion-bloop.json'), 'utf8'));
const estado = JSON.parse(fs.readFileSync(path.join(salida, 'estado.json'), 'utf8'));
if (!archivos.includes('informe-bloop.md')) fallos.push('falta el informe');
if (guion.estado !== 'aprobado') fallos.push('el guion no quedó aprobado');
if (guion.escenas.some((e) => !Array.isArray(e.fondo) || e.fondo.length < 1)) fallos.push('hay escenas sin fondo');
if (guion.escenas.some((e) => e.fondo.includes('pixelinventado'))) fallos.push('dejó pasar un fondo inventado');
if (!guion.escenas[0].fondo[1]?.startsWith('pixelcifra:1997|')) fallos.push('el parámetro del fondo salió mal: ' + guion.escenas[0].fondo[1]);
if (estado.totales.aprobados !== 1) fallos.push('el estado no contó el guion aprobado');
if (!estado.agentes['Editor de guion']) fallos.push('el Editor no aparece en el estado');
console.log(`Prueba: ${llamadas} llamadas simuladas a Groq · archivos: ${archivos.join(', ')}`);
if (fallos.length) { console.error('FALLÓ:', fallos.join('; ')); process.exit(1); }
console.log('PRUEBA OK: guion aprobado, fondos validados, estado escrito.');
