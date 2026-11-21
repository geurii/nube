// Órdenes por celular: el dueño escribe en GitHub (app del celular, un "issue" o un comentario) y Jules responde en el mismo hilo.
// Modo "mensaje": convierte el texto (variable MENSAJE) en un mensaje pendiente para Jules.
// Modo "respuesta": escribe en un archivo la última respuesta de Jules para publicarla como comentario.
import fs from 'node:fs';
import path from 'node:path';

const modo = process.argv[2];
const RAIZ = path.resolve('oficina-salida');
if (modo === 'mensaje') {
  const texto = String(process.env.MENSAJE ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 600);
  if (texto.length < 2) { console.log('Mensaje vacío: se ignora.'); process.exit(0); }
  const carpeta = path.join(RAIZ, 'chat-pendiente');
  fs.mkdirSync(carpeta, {recursive: true});
  fs.writeFileSync(path.join(carpeta, `${Date.now().toString(36)}-movil.json`), JSON.stringify({canal: 'lqns', texto, fecha: new Date().toISOString(), origen: 'celular'}, null, 2));
  console.log('Mensaje del celular guardado para Jules.');
} else if (modo === 'respuesta') {
  const destino = process.argv[3];
  let chat = [];
  try { chat = JSON.parse(fs.readFileSync(path.join(RAIZ, 'chat.json'), 'utf8')); } catch { /* sin chat */ }
  const j = chat.find((m) => m.de === 'jules');
  const texto = j ? `**Jules:** ${j.texto}${j.orden ? `\n\n**Orden al equipo (nivel ${j.nivel ?? '?'}/5):** ${j.orden}` : ''}` : '**Jules:** recibí tu mensaje pero no pude responder ahora. Lo intento en el próximo ciclo.';
  fs.writeFileSync(destino, texto);
  console.log('Respuesta lista.');
} else { console.error('Uso: movil.mjs mensaje|respuesta'); process.exit(1); }
