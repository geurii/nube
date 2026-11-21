// Jules, la jefa, responde los mensajes del dueño. El mensaje llega como archivo en oficina-salida/chat-pendiente/ (lo escribe la
// oficina 3D desde el computador del dueño). Jules contesta con números reales y convierte la presión del dueño en una ORDEN
// para los 30 puestos: queda en oficina-salida/<canal>/ordenes.json y la leen la Oficina y los puestos en el próximo ciclo.
// Variable: GROQ_API_KEY.
import fs from 'node:fs';
import path from 'node:path';

const KEY = process.env.GROQ_API_KEY;
const RAIZ = path.resolve('oficina-salida');
const PEND = path.join(RAIZ, 'chat-pendiente');
const CHAT = path.join(RAIZ, 'chat.json');
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
if (!fs.existsSync(PEND)) { console.log('Sin mensajes.'); process.exit(0); }
if (!KEY) { console.error('Falta GROQ_API_KEY.'); process.exit(1); }

const pendientes = fs.readdirSync(PEND).filter((f) => f.endsWith('.json') && !f.endsWith('.hecho.json')).sort();
if (!pendientes.length) { console.log('Sin mensajes.'); process.exit(0); }

const llamar = async (mensajes) => {
  for (let i = 1; i <= 6; i++) {
    for (const modelo of ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile']) {
      try {
        const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST', headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(90000),
          body: JSON.stringify({model: modelo, messages: mensajes, temperature: 0.6, max_tokens: 900, ...(modelo.includes('gpt-oss') ? {reasoning_effort: 'low'} : {})}),
        });
        if (r.status === 429) { const t = await r.text(); await dormir((Number(/try again in ([\d.]+)s/i.exec(t)?.[1] ?? 15) + 1) * 1000); continue; }
        if (!r.ok) continue;
        const txt = (await r.json()).choices?.[0]?.message?.content ?? '';
        const j = /\{[\s\S]*\}/.exec(txt.replace(/```json|```/g, ''));
        if (j) return JSON.parse(j[0]);
      } catch { /* siguiente intento */ }
    }
    await dormir(3000 * i);
  }
  throw new Error('Groq no respondió.');
};

let chat = leer(CHAT, []);
for (const archivo of pendientes) {
  const ruta = path.join(PEND, archivo);
  const p = leer(ruta, {});
  const canal = /^[a-z0-9]{1,24}$/.test(String(p.canal ?? '')) ? p.canal : 'lqns';
  const texto = String(p.texto ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 600);
  if (!texto) { fs.renameSync(ruta, ruta.replace(/\.json$/, '.hecho.json')); continue; }
  const carpeta = path.join(RAIZ, canal);
  const estado = leer(path.join(carpeta, 'estado.json'), {agentes: {}});
  const vistas = leer(path.join(carpeta, 'vistas.json'), null);
  const ordenes = leer(path.join(carpeta, 'ordenes.json'), []);
  const agentes = Object.entries(estado.agentes ?? {});
  const parados = agentes.filter(([, a]) => a.estado === 'esperando_decision').map(([n]) => n);
  const dias = Math.max(0, Math.ceil((new Date('2026-12-13T23:59:59-04:00').getTime() - Date.now()) / 86400000));
  const contexto = [
    `Días que faltan para la meta (monetizar antes del 13 de diciembre de 2026): ${dias}.`,
    vistas?.total !== undefined ? `Vistas reales del canal: ${vistas.total} en sus últimos videos; ganadas en el último ciclo: ${vistas.ganadasDesdeElUltimoCiclo ?? 0}.` : 'Vistas del canal: aún no disponibles.',
    `Totales de la oficina: ${JSON.stringify(estado.totales ?? {})}. Puestos esperando una decisión: ${parados.length ? parados.join(', ') : 'ninguno'}.`,
    ordenes.length ? `Última orden que diste: "${ordenes[0].orden}" (nivel ${ordenes[0].nivel}).` : 'Aún no has dado órdenes por este chat.',
  ].join('\n');
  const historia = chat.slice(0, 8).reverse().map((m) => `${m.de === 'tu' ? 'DUEÑO' : 'JULES'}: ${m.texto}`).join('\n');
  const r = await llamar([
    {role: 'system', content: 'Eres Jules, la directora de una oficina de 30 profesionales que hacen videos de misterio y datos curiosos para YouTube. Eres la jefa más exigente: perfeccionista, ambiciosa, directa y presionas sin parar, pero hablas con respeto al DUEÑO del canal, que es quien te da la presión y las órdenes. Meta de la empresa: monetizar antes del 13 de diciembre de 2026. Reglas: usa SOLO las cifras del CONTEXTO, nunca inventes datos ni prometas un número de vistas; no te inventes cosas que la oficina ya hizo. Si el dueño te exige más, tú conviertes eso en UNA orden concreta y más dura para tus 30 empleados. Responde corto (máx. 70 palabras), en español, sin tecnicismos. Responde SOLO con JSON: {"respuesta": "lo que le dices al dueño", "orden": "la orden para el equipo (una frase) o cadena vacía si no hay", "nivel": número de 1 a 5 con la presión que aplicarás}.'},
    {role: 'user', content: `CONTEXTO:\n${contexto}\n\nCONVERSACIÓN RECIENTE:\n${historia || '(empieza ahora)'}\n\nMENSAJE NUEVO DEL DUEÑO: ${texto}`},
  ]);
  const respuesta = String(r.respuesta ?? '').slice(0, 600) || 'Entendido. Lo atiendo ahora.';
  const orden = String(r.orden ?? '').slice(0, 280);
  const nivel = Math.min(5, Math.max(1, Math.round(Number(r.nivel) || 3)));
  const ahora = new Date().toISOString();
  const id = Date.now().toString(36);
  chat = [{id: id + 'j', de: 'jules', texto: respuesta, fecha: ahora, orden, nivel, canal}, {id: id + 't', de: 'tu', texto, fecha: p.fecha ?? ahora, canal}, ...chat].slice(0, 120);
  if (orden) {
    fs.mkdirSync(carpeta, {recursive: true});
    fs.writeFileSync(path.join(carpeta, 'ordenes.json'), JSON.stringify([{fecha: ahora, orden, nivel}, ...ordenes].slice(0, 10), null, 2));
  }
  fs.writeFileSync(path.join(carpeta, 'jefa.json'), JSON.stringify({nivel, orden: orden || ordenes[0]?.orden || '', fecha: ahora}, null, 2));
  fs.writeFileSync(CHAT, JSON.stringify(chat, null, 2));
  fs.renameSync(ruta, ruta.replace(/\.json$/, '.hecho.json'));
  console.log(`Jules respondió (nivel ${nivel})${orden ? ' y dio una orden' : ''}.`);
}
