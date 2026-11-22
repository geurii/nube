// Jules, la jefa, responde los mensajes del dueño. El mensaje llega como archivo en oficina-salida/chat-pendiente/ (lo escribe la
// oficina 3D desde el computador del dueño). Jules contesta con números reales y convierte la presión del dueño en una ORDEN
// para los 30 puestos: queda en oficina-salida/<canal>/ordenes.json y la leen la Oficina y los puestos en el próximo ciclo.
// Variable: GROQ_API_KEY.
import fs from 'node:fs';
import path from 'node:path';
import {avisarTelefono} from './aviso.mjs';
import {chatAlternativo, modelosDisponibles} from './llm.mjs';

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

const MODELOS = await modelosDisponibles(KEY); // solo modelos que la cuenta tiene
const llamar = async (mensajes) => {
  for (let i = 1; i <= 3; i++) {
    for (const modelo of MODELOS) {
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
  // Groq agotado: se prueba con Gemini, Cerebras, OpenRouter o GitHub Models
  const alt = await chatAlternativo(mensajes, {maxTokens: 900, temperatura: 0.6});
  const j = alt && /\{[\s\S]*\}/.exec(alt.texto.replace(/```json|```/g, ''));
  if (j) { try { return JSON.parse(j[0]); } catch { /* sin JSON */ } }
  throw new Error('Ningún modelo respondió.');
};

let chat = leer(CHAT, []);
for (const archivo of pendientes) {
  const ruta = path.join(PEND, archivo);
  const p = leer(ruta, {});
  const canal = /^[a-z0-9]{1,24}$/.test(String(p.canal ?? '')) ? p.canal : 'lqns';
  const texto = String(p.texto ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, 1500);
  if (!texto) { fs.renameSync(ruta, ruta.replace(/\.json$/, '.hecho.json')); continue; }
  const carpeta = path.join(RAIZ, canal);
  const estado = leer(path.join(carpeta, 'estado.json'), {agentes: {}});
  const vistas = leer(path.join(carpeta, 'vistas.json'), null);
  const ordenes = leer(path.join(carpeta, 'ordenes.json'), []);
  const meta = leer(path.join(carpeta, 'analitica.json'), null)?.meta;
  const ayudas = leer(path.join(carpeta, 'ayudas.json'), {});
  const progreso = leer(path.join(carpeta, 'progreso.json'), null);
  const subidas = leer(path.join(RAIZ, 'notificaciones.json'), []).filter((n) => /Video subido|Video listo|panel rechaz|panel aprob/i.test(n.titulo)).slice(0, 4).map((n) => `${n.fecha.slice(0, 16)} ${n.titulo}: ${String(n.texto).slice(0, 160)}`);
  const subidos = leer(path.join(carpeta, 'subidos.json'), null);
  const ultimoVideo = [...(vistas?.videos ?? [])].sort((a, b) => new Date(b.publicado) - new Date(a.publicado))[0];
  const agentes = Object.entries(estado.agentes ?? {});
  const parados = agentes.filter(([, a]) => a.estado === 'esperando_decision').map(([n]) => n);
  const dias = Math.max(0, Math.ceil((new Date('2026-12-13T23:59:59-04:00').getTime() - Date.now()) / 86400000));
  const contexto = [
    `Días que faltan para la meta (monetizar antes del 13 de diciembre de 2026): ${dias}.`,
    vistas?.total !== undefined ? `Vistas reales del canal: ${vistas.total} en sus últimos videos; ganadas en el último ciclo: ${vistas.ganadasDesdeElUltimoCiclo ?? 0}.` : 'Vistas del canal: aún no disponibles.',
    meta ? `Avance a la monetización (datos reales de YouTube): ${meta.suscriptores ?? '?'} suscriptores (faltan ${meta.faltanSuscriptores ?? '?'} para 1.000); ${meta.horas12Meses} horas vistas en 12 meses (faltan ${meta.faltanHoras} para 4.000); ${meta.vistasShorts90} vistas de Shorts en 90 días (10 millones es la alternativa).` : 'Suscriptores y horas vistas: aún sin conectar la analítica.',
    ayudas?.iniciativas?.length ? 'Iniciativas propias que propuso tu equipo: ' + ayudas.iniciativas.slice(0, 4).join(' | ') : 'Tu equipo aún no ha propuesto iniciativas.',
    ultimoVideo ? `Último video PÚBLICO en el canal (dato real de YouTube): "${ultimoVideo.titulo}", publicado ${String(ultimoVideo.publicado).slice(0, 16)} UTC.` : 'Aún no hay datos del último video público.',
    progreso ? `Progreso del ciclo actual: ${progreso.porcentaje}% — ${progreso.etapa}.` : '',
    subidos?.total ? `Videos subidos a YouTube por la oficina EN TOTAL: ${subidos.total}. El último: "${subidos.videos?.[0]?.titulo ?? ''}" (${String(subidos.videos?.[0]?.fecha ?? '').slice(0, 16)}).` : 'La oficina todavía no ha subido ningún video (según el contador).',
    subidas.length ? `Últimos avisos de producción y subida (reales): ${subidas.join(' | ')}` : '',
    `Totales de la oficina: ${JSON.stringify(estado.totales ?? {})}. Puestos esperando una decisión: ${parados.length ? parados.join(', ') : 'ninguno'}.`,
    ordenes.length ? `Última orden que diste: "${ordenes[0].orden}" (nivel ${ordenes[0].nivel}).` : 'Aún no has dado órdenes por este chat.',
  ].join('\n');
  const historia = chat.slice(0, 14).reverse().map((m) => `${m.de === 'tu' ? 'DUEÑO' : 'JULES'}: ${m.texto}`).join('\n');
  const r = await llamar([
    {role: 'system', content: 'Eres Jules, la directora de una oficina de 30 profesionales que hacen videos de misterio y datos curiosos para YouTube. Eres la jefa más exigente: perfeccionista, ambiciosa, directa y presionas sin parar, pero hablas con respeto al DUEÑO del canal, que es quien te da la presión y las órdenes. Meta de la empresa: monetizar antes del 13 de diciembre de 2026. Reglas: usa SOLO las cifras del CONTEXTO; si te preguntan si un video ya se subió, responde SOLO con lo que digan el último video público y los avisos reales del CONTEXTO, y si no lo sabes, dilo; nunca inventes datos ni prometas un número de vistas; no te inventes cosas que la oficina ya hizo. Si el dueño te exige más, tú conviertes eso en UNA orden concreta y más dura para tus 30 empleados. Responde de forma natural y directa (máx. 120 palabras); puedes conversar de lo que el dueño quiera sobre el canal, la oficina, ideas, dudas o su plan, no solo de órdenes, en español, sin tecnicismos. REGLA FIJA DEL DUEÑO (no se discute): los videos son SHORTS verticales de MÁXIMO 60 SEGUNDOS (unas 100 a 130 palabras). NUNCA ordenes alargar la duración, subirla a minutos, pasar a video largo ni cambiar el estilo pixel del canal; el dueño decide el formato, no tú. Responde SOLO con JSON: {"respuesta": "lo que le dices al dueño", "orden": "la orden para el equipo (una frase) o cadena vacía si no hay", "nivel": número de 1 a 5 con la presión que aplicarás}.'},
    {role: 'user', content: `CONTEXTO:\n${contexto}\n\nCONVERSACIÓN RECIENTE:\n${historia || '(empieza ahora)'}\n\nMENSAJE NUEVO DEL DUEÑO: ${texto}`},
  ]);
  const respuesta = String(r.respuesta ?? '').slice(0, 1200) || 'Entendido. Lo atiendo ahora.';
  let orden = String(r.orden ?? '').slice(0, 280);
  // Red de seguridad: una orden que cambie la duración o el formato (por ejemplo "aumenta la duración a 8 min") NO se guarda; los videos son Shorts de máx. 60 s
  const cambiaDuracion = /(?:aument|alarg|ampli|extend|sub[ae])\w*\s+(?:la\s+)?(?:duraci|extensi|longitud)/i.test(orden) || (/duraci[oó]n/i.test(orden) && /\b\d+\s*(?:min|minutos)\b/i.test(orden)) || /\bvideos?\s+largos?\b|\bformato\s+largo\b/i.test(orden);
  if (cambiaDuracion) orden = '';
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
  avisarTelefono('jules', 'Respuesta', respuesta + (orden ? ' · ORDEN: ' + orden : ''));
  console.log(`Jules respondió (nivel ${nivel})${orden ? ' y dio una orden' : ''}.`);
}
