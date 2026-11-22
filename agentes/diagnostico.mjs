// Diagnóstico REAL (1 minuto): llama de verdad a cada proveedor con las claves reales y anota qué contesta.
// Pide lo mismo que pide la oficina: una respuesta en modo JSON. No imprime claves. Guarda oficina-salida/diagnostico.json.
import fs from 'node:fs';
import {chatAlternativo, diagnosticoRespaldo, proveedoresConLlave} from './llm.mjs';

const salida = {fecha: new Date().toISOString(), proveedoresConLlave: proveedoresConLlave(), groq: null, respaldo: null, notas: []};
const key = (process.env.GROQ_API_KEY || '').trim();
if (key) {
  try {
    const t0 = Date.now();
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(40000),
      body: JSON.stringify({model: 'openai/gpt-oss-120b', messages: [{role: 'user', content: 'Responde SOLO este JSON: {"ok": true}'}], max_tokens: 200, reasoning_effort: 'low'}),
    });
    const cuerpo = await r.text();
    salida.groq = {status: r.status, ms: Date.now() - t0, restante: {peticionesDia: r.headers.get('x-ratelimit-remaining-requests'), tokensMin: r.headers.get('x-ratelimit-remaining-tokens')}, cuerpo: r.ok ? 'ok' : cuerpo.slice(0, 200)};
  } catch (e) { salida.groq = {error: String(e.message ?? e).slice(0, 120)}; }
}
// Una petición como las del guion (JSON con varias escenas), probada proveedor por proveedor
{
  const t0 = Date.now();
  const r = await chatAlternativo([
    {role: 'system', content: 'Eres un guionista. Responde SOLO con un JSON válido.'},
    {role: 'user', content: 'Devuelve {"titulo": string, "escenas": [{"tipo": "hook"|"historia"|"revelacion"|"veredicto", "texto": string}]} con 5 escenas cortas sobre el sonido Bloop del océano.'},
  ], {maxTokens: 1500, json: true});
  salida.notas.push({usado: r ? `${r.proveedor}/${r.modelo}` : null, ms: Date.now() - t0, fallos: [...diagnosticoRespaldo]});
}
salida.respaldo = salida.notas.at(-1)?.usado ?? null;
fs.mkdirSync('oficina-salida', {recursive: true});
fs.writeFileSync('oficina-salida/diagnostico.json', JSON.stringify(salida, null, 2));
console.log(JSON.stringify(salida, null, 2));
