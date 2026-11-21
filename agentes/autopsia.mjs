// Autopsia: por qué los videos anteriores NO cogieron vistas. Lee las vistas reales (vistas.json) y le pide a Groq un análisis honesto.
// Solo usa lo que se ve en los datos (título, vistas, fecha); donde falte información (retención, miniatura, quién lo vio) lo dice.
// Resultado: oficina-salida/<canal>/autopsia.json, que leen el Guionista y el panel de críticos. Nunca detiene al flujo.
// Variables: CANAL, GROQ_API_KEY.
import fs from 'node:fs';
import path from 'node:path';
const MODELOS = ['llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'openai/gpt-oss-120b']; // cuotas separadas: si uno se agota, pasa al siguiente

const CANAL = (process.env.CANAL || 'lqns').trim();
const KEY = process.env.GROQ_API_KEY;
const carpeta = path.resolve('oficina-salida', CANAL);
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const vistas = leer(path.join(carpeta, 'vistas.json'), null);
if (!KEY || !vistas?.videos?.length) { console.log('Autopsia: sin datos de vistas o sin clave.'); process.exit(0); }
// solo se analiza de nuevo si hay datos más nuevos que la última autopsia
const previa = leer(path.join(carpeta, 'autopsia.json'), null);
if (previa && previa.total === vistas.total && Date.now() - new Date(previa.fecha).getTime() < 6 * 3600 * 1000) { console.log('Autopsia: ya está al día.'); process.exit(0); }

const analitica = leer(path.join(carpeta, 'analitica.json'), null);
const retencion = (analitica?.porVideo ?? []).map((v) => { const t = vistas.videos.find((x) => x.id === v.id)?.titulo; return t ? `- "${t}": retención media ${v.retencionPct} % (${v.duracionMediaSeg} s de media), +${v.suscriptoresGanados} suscriptores` : null; }).filter(Boolean).join('\n');
const lista = [...vistas.videos].sort((a, b) => b.vistas - a.vistas);
const tabla = lista.map((v) => `- "${v.titulo}" · ${v.vistas} vistas · ${String(v.publicado ?? '').slice(0, 10)}`).join('\n');
const media = Math.round(lista.reduce((s, v) => s + v.vistas, 0) / lista.length);

try {
  let r = null;
  for (let i = 1; i <= 5 && !r; i++) {
    try {
      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(90000),
        body: JSON.stringify({model: MODELOS[(i - 1) % MODELOS.length], ...(MODELOS[(i - 1) % MODELOS.length].includes('gpt-oss') ? {reasoning_effort: 'low'} : {}), temperature: 0.4, max_tokens: 1800, messages: [
          {role: 'system', content: 'Eres analista de canales de YouTube, con cinco licenciaturas y mucha ambición: tu paga son las vistas del canal. Analizas con rigor y SIN inventar: usa solo los datos dados. Donde no se pueda saber algo (retención, miniatura, a quién se mostró), dilo. Responde SOLO con JSON.'},
          {role: 'user', content: `VIDEOS DEL CANAL (de más a menos vistas; promedio ${media}):\n${tabla}\n\n${retencion ? `RETENCIÓN REAL (YouTube Analytics):\n${retencion}\n\n` : ''}Devuelve: {"que_funciono": "lo que tienen en común los de más vistas, según los títulos y fechas", "por_que_fallaron": ["causas probables de las pocas vistas, cada una con la evidencia de los datos"], "no_se_puede_saber": ["lo que falta saber"], "reglas": ["3 reglas concretas y accionables para el próximo video"]}`},
        ]}),
      });
      if (resp.status === 429) { const t = await resp.text(); await dormir((Number(/try again in ([\d.]+)s/i.exec(t)?.[1] ?? 15) + 1) * 1000); continue; }
      if (!resp.ok) { await dormir(3000 * i); continue; }
      const txt = (await resp.json()).choices?.[0]?.message?.content ?? '';
      const m = /\{[\s\S]*\}/.exec(txt.replace(/```json|```/g, ''));
      if (m) r = JSON.parse(m[0]);
    } catch { await dormir(3000 * i); }
  }
  if (!r) throw new Error('Groq no respondió');
  const lim = (a, n) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, 260)).slice(0, n);
  fs.writeFileSync(path.join(carpeta, 'autopsia.json'), JSON.stringify({
    fecha: new Date().toISOString(), total: vistas.total, promedio: media,
    queFunciono: String(r.que_funciono ?? '').slice(0, 300), porQueFallaron: lim(r.por_que_fallaron, 5), noSePuedeSaber: lim(r.no_se_puede_saber, 4), reglas: lim(r.reglas, 3),
  }, null, 2));
  console.log('Autopsia lista.');
} catch (e) { console.warn('Autopsia no pudo:', e.message); }
process.exit(0);
