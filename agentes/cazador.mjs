// Cazador de fórmulas: lee los feeds públicos de YouTube (sin clave) de los canales de agentes/canales.json,
// encuentra los videos que más rinden (vistas por hora) y le pide a Groq la FÓRMULA (estructura del título y del gancho),
// nunca el contenido. El resultado queda en oficina-salida/formulas.json y lo lee el Guionista.
// Variables: GROQ_API_KEY. Se ejecuta antes de la Oficina (ver oficina.yml). Si algo falla, no detiene a la Oficina.
import fs from 'node:fs';
import path from 'node:path';

const SAL = 'oficina-salida';
const KEY = process.env.GROQ_API_KEY;
const UA = 'OficinaVideos/1.0 (proyecto educativo)';
fs.mkdirSync(SAL, {recursive: true});
const leer = (ruta, d) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return d; } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const marcar = (tarea, estado = 'libre') => {
  const ruta = path.join(SAL, 'estado.json');
  const e = leer(ruta, {agentes: {}, historial: [], totales: {}});
  e.agentes = {...(e.agentes ?? {}), 'Cazador de fórmulas': {estado, actividad: 'leyendo', tarea}};
  e.actualizado = new Date().toISOString();
  fs.writeFileSync(ruta, JSON.stringify(e, null, 2));
};

const etiqueta = (xml, tag) => new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`).exec(xml)?.[1]?.trim();
const atributo = (xml, tag, attr) => new RegExp(`<${tag}[^>]*\\s${attr}="([^"]*)"`).exec(xml)?.[1];
const limpio = (t) => String(t ?? '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

/** Videos recientes de un canal desde su feed RSS público (incluye las vistas actuales). */
const videosDe = async (canal) => {
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(`https://www.youtube.com/feeds/videos.xml?channel_id=${canal.id}`, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(30000)});
      if (!r.ok) { await dormir(1500 * i); continue; }
      const xml = await r.text();
      return xml.split('<entry>').slice(1).map((e) => {
        const publicado = new Date(etiqueta(e, 'published') ?? 0);
        const vistas = Number(atributo(e, 'media:statistics', 'views') ?? 0);
        const horas = Math.max(1, (Date.now() - publicado.getTime()) / 3600000);
        return {canal: canal.nombre, idioma: canal.idioma, titulo: limpio(etiqueta(e, 'title')), publicado: publicado.toISOString(), vistas, vistasPorHora: Math.round(vistas / horas)};
      });
    } catch { await dormir(1500 * i); }
  }
  return [];
};

try {
  const lista = leer(path.join('agentes', 'canales.json'), {canales: []}).canales ?? [];
  if (!lista.length) throw new Error('agentes/canales.json no tiene canales.');
  const todos = (await Promise.all(lista.map(videosDe))).flat();
  const hace30 = Date.now() - 30 * 86400000;
  const mejores = todos.filter((v) => v.vistas > 0 && new Date(v.publicado).getTime() > hace30).sort((a, b) => b.vistasPorHora - a.vistasPorHora).slice(0, 12);
  if (!mejores.length) throw new Error('No pude leer videos recientes de ningún canal (¿YouTube bloqueó la consulta?).');

  let formula = null;
  if (KEY) {
    const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json'},
      signal: AbortSignal.timeout(120000),
      body: JSON.stringify({
        model: 'openai/gpt-oss-120b',
        temperature: 0.3,
        max_tokens: 1500,
        reasoning_effort: 'low',
        messages: [
          {role: 'system', content: 'Eres analista de formatos virales de YouTube. Analizas SOLO la estructura (cómo está hecho el título y el gancho), jamás el contenido ni los temas. Respondes SOLO con JSON.'},
          {role: 'user', content: `Estos son los videos de misterio y datos que más están rindiendo ahora (vistas por hora), en inglés:\n${mejores.map((v, i) => `${i + 1}. "${v.titulo}" · ${v.canal} · ${v.vistasPorHora} vistas/hora`).join('\n')}\n\nDevuelve: {"formula": "una frase con la estructura que se repite en los títulos y ganchos", "ganchos": ["3 plantillas de gancho en español, con huecos entre [corchetes], sin copiar temas"], "evitar": ["2 errores que se ven en los de menor rendimiento"]}.`},
        ],
      }),
    });
    if (r.ok) {
      const texto = (await r.json()).choices?.[0]?.message?.content ?? '';
      const a = texto.indexOf('{'), b = texto.lastIndexOf('}');
      if (a >= 0 && b > a) formula = JSON.parse(texto.slice(a, b + 1));
    }
  }
  const salida = {actualizado: new Date().toISOString(), canalesLeidos: lista.length, videosRevisados: todos.length, mejores: mejores.slice(0, 5), formula};
  fs.writeFileSync(path.join(SAL, 'formulas.json'), JSON.stringify(salida, null, 2));
  marcar(`Revisó ${todos.length} videos de ${lista.length} canales. Mejor ahora: "${mejores[0].titulo.slice(0, 70)}" (${mejores[0].vistasPorHora} vistas/hora). ${formula?.formula ? `Fórmula: ${String(formula.formula).slice(0, 110)}` : 'Sin análisis de IA esta vez.'}`);
  console.log(`Cazador: ${todos.length} videos leídos; fórmula: ${formula?.formula ?? 'sin IA'}`);
} catch (e) {
  marcar(`No pude cazar fórmulas: ${String(e.message ?? e).slice(0, 160)}`, 'esperando_decision');
  console.error('Cazador:', e.message ?? e);
}
