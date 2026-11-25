// Prueba del circuit-breaker de proveedores SIN consumir créditos ni hacer llamadas externas.
// Simula un HTTP 402 y comprueba que el proveedor queda pausado entre llamadas.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {fileURLToPath, pathToFileURL} from 'node:url';

const raiz = path.dirname(fileURLToPath(import.meta.url));
const temporal = fs.mkdtempSync(path.join(os.tmpdir(), 'proveedores-prueba-'));
const salida = path.join(temporal, 'oficina-salida', 'lqns');
fs.mkdirSync(salida, {recursive: true});

const pausa = Date.now() + 60 * 60 * 1000;
const bloqueados = [
  'Gemini', 'OpenRouter', 'Mistral', 'Groq', 'SambaNova',
  'NVIDIA NIM', 'Cohere', 'Z.ai (GLM)', 'Ollama Cloud', 'LLM7', 'Requesty',
  'Pollinations', 'OVHcloud', 'Cloudflare',
];
fs.writeFileSync(path.join(salida, 'cooldowns-ia.json'), JSON.stringify(Object.fromEntries(bloqueados.map((x) => [x, pausa]))));
process.chdir(temporal);
process.env.CEREBRAS_API_KEY = 'prueba-local-no-valida';

const llamadas = [];
globalThis.fetch = async (url) => {
  const destino = String(url);
  llamadas.push(destino);
  if (destino.endsWith('/models')) {
    return new Response(JSON.stringify({data: [{id: 'gpt-oss-120b'}]}), {
      status: 200, headers: {'Content-Type': 'application/json'},
    });
  }
  if (destino.endsWith('/chat/completions')) {
    return new Response('Payment Required', {status: 402});
  }
  throw new Error('La prueba intentó acceder a un endpoint inesperado: ' + destino);
};

const {chatAlternativo} = await import(pathToFileURL(path.join(raiz, 'llm.mjs')).href + '?prueba-circuit-breaker');
const mensajes = [{role: 'user', content: 'Prueba sintética; no llamar a ningún servicio real.'}];
const primero = await chatAlternativo(mensajes, {maxTokens: 32});
if (primero !== null) throw new Error('Un proveedor con HTTP 402 no debe entregar una respuesta ficticia.');
const llamadasTras402 = llamadas.length;
if (llamadasTras402 !== 2) throw new Error('Se esperaba una consulta de modelos y una llamada de chat simulada; recibidas: ' + llamadasTras402);

const cooldowns = JSON.parse(fs.readFileSync(path.join(salida, 'cooldowns-ia.json'), 'utf8'));
if (!(Number(cooldowns.Cerebras) > Date.now() + 5 * 60 * 1000)) {
  throw new Error('HTTP 402 no persistió el cooldown de seis horas.');
}
const segundo = await chatAlternativo(mensajes, {maxTokens: 32});
if (segundo !== null || llamadas.length !== llamadasTras402) {
  throw new Error('El segundo intento volvió a consumir una solicitud con todos los proveedores en cooldown.');
}

console.log('OK: HTTP 402 se pausa y los siguientes intentos no repiten llamadas ni consumen cuota.');
