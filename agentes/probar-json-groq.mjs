import fs from 'node:fs';
const archivo = 'oficina-salida/diagnostico.json';
const modelo = 'openai/gpt-oss-120b';
const inicio = Date.now();
const resultado = { modelo, valido: false };
try {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) throw new Error('GROQ_API_KEY no está disponible en este paso');
  const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
    signal: AbortSignal.timeout(40000),
    body: JSON.stringify({
      model: modelo,
      messages: [
        { role: 'system', content: 'Devuelve únicamente un objeto JSON válido, sin Markdown.' },
        { role: 'user', content: 'Devuelve exactamente este objeto JSON: {"ok":true,"prueba":"nube-json-estricto"}' }
      ],
      response_format: { type: 'json_object' },
      max_tokens: 256,
      reasoning_effort: 'low'
    })
  });
  resultado.status = r.status;
  const raw = await r.text();
  if (!r.ok) throw new Error('Groq HTTP ' + r.status + ': ' + raw.slice(0, 300));
  const sobre = JSON.parse(raw);
  const texto = sobre.choices?.[0]?.message?.content ?? '';
  const objeto = JSON.parse(texto);
  resultado.valido = objeto?.ok === true && objeto?.prueba === 'nube-json-estricto';
  resultado.modeloRespuesta = sobre.model || modelo;
  resultado.respuesta = objeto;
  if (!resultado.valido) throw new Error('Groq respondió JSON, pero no coincide con el objeto de prueba');
} catch (e) {
  resultado.error = String(e.message ?? e).slice(0, 400);
}
resultado.ms = Date.now() - inicio;
let informe = {};
try { informe = JSON.parse(fs.readFileSync(archivo, 'utf8')); } catch {}
informe.groqJsonEstricto = resultado;
fs.mkdirSync('oficina-salida', { recursive: true });
fs.writeFileSync(archivo, JSON.stringify(informe, null, 2) + '\n', 'utf8');
console.log(JSON.stringify(resultado, null, 2));
if (!resultado.valido) process.exitCode = 1;
