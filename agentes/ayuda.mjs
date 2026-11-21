// Tablero de ayuda mutua: nadie se queda sin hacer nada. Los puestos que quedaron LIBRES (incluida Jules) toman tareas útiles que otro
// puesto dejó sin hacer o que ayudan al siguiente video. Cada ayuda produce algo que se usa de verdad en el próximo ciclo
// (oficina-salida/<canal>/ayudas.json, que lee el Guionista; los temas los usa el Director). Cuesta una llamada corta a Groq por tarea.
// Variables: CANAL, GROQ_API_KEY. No detiene el flujo.
import fs from 'node:fs';
import path from 'node:path';

const CANAL = (process.env.CANAL || 'lqns').trim();
const KEY = process.env.GROQ_API_KEY;
const MAX_TAREAS = 5;
const carpeta = path.resolve('oficina-salida', CANAL);
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const config = (leer(path.join('agentes', 'canales-propios.json'), {canales: []}).canales ?? []).find((c) => c.id === CANAL) ?? {};
if (!KEY) { console.log('Ayuda: falta GROQ_API_KEY.'); process.exit(0); }

const estado = leer(path.join(carpeta, 'estado.json'), null);
if (!estado) { console.log('Ayuda: sin estado.'); process.exit(0); }
const libres = Object.entries(estado.agentes ?? {}).filter(([, a]) => a?.estado === 'libre').map(([n]) => n);
if (!libres.length) { console.log('Ayuda: todos están ocupados.'); process.exit(0); }

const vistas = leer(path.join(carpeta, 'vistas.json'), null);
const autopsia = leer(path.join(carpeta, 'autopsia.json'), null);
const historial = leer(path.join(carpeta, 'historial.json'), []);
const ayudas = leer(path.join(carpeta, 'ayudas.json'), {});
const topTitulos = [...(vistas?.videos ?? [])].sort((a, b) => b.vistas - a.vistas).slice(0, 5).map((v) => `"${v.titulo}" (${v.vistas} vistas)`).join('; ');
const ultimoGuion = (() => {
  try {
    const f = fs.readdirSync(carpeta).filter((n) => /^guion-.*\.json$/.test(n)).map((n) => ({n, t: fs.statSync(path.join(carpeta, n)).mtimeMs})).sort((a, b) => b.t - a.t)[0];
    return f ? leer(path.join(carpeta, f.n), null) : null;
  } catch { return null; }
})();
const base = `Canal: "${config.nombre ?? CANAL}" (${config.nicho ?? ''}). ${config.tono ?? ''} Reglas: nada de nombres reales de personas; todo guion empieza con "Sabías que"; revelación entre 65 % y 75 %. Datos reales de vistas: ${topTitulos || 'aún no hay'}. ${autopsia?.reglas?.length ? 'Reglas de la autopsia: ' + autopsia.reglas.join(' | ') : ''}`;

const llamar = async (instruccion) => {
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(90000),
        body: JSON.stringify({model: 'openai/gpt-oss-120b', reasoning_effort: 'low', temperature: 0.6, max_tokens: 1200, messages: [
          {role: 'system', content: 'Eres un/a profesional con cinco licenciaturas, perfeccionista y ambicioso/a: tu paga son las vistas del canal. Ayudas a un compañero con una tarea concreta. No inventes datos. Responde SOLO con JSON.'},
          {role: 'user', content: `${base}\n\nTAREA: ${instruccion}`},
        ]}),
      });
      if (r.status === 429) { const t = await r.text(); await dormir((Number(/try again in ([\d.]+)s/i.exec(t)?.[1] ?? 15) + 1) * 1000); continue; }
      if (!r.ok) { await dormir(3000 * i); continue; }
      const m = /\{[\s\S]*\}/.exec(((await r.json()).choices?.[0]?.message?.content ?? '').replace(/```json|```/g, ''));
      if (m) return JSON.parse(m[0]);
    } catch { await dormir(3000 * i); }
  }
  return null;
};
const lista = (a, n, max = 220) => (Array.isArray(a) ? a : []).map((x) => String(x).slice(0, max)).filter(Boolean).slice(0, n);

const TAREAS = [
  {id: 'plan', para: 'Jules (su plan del ciclo)', rol: 'Directora de contenido', solo: 'Directora de contenido',
    pedir: () => `Eres Jules, la jefa. Escribe el plan de prioridades del próximo ciclo. Devuelve {"plan": ["3 prioridades concretas, cada una con un responsable de la oficina y la meta de monetizar antes del 13 de diciembre"]}`,
    guardar: (r) => { ayudas.plan = lista(r.plan, 3, 240); return ayudas.plan.join(' · '); }},
  {id: 'ganchos', para: 'Guionista', rol: 'Guionista', pedir: () => `Escribe 5 plantillas de PRIMERA FRASE (gancho auditivo, empiezan con "Sabías que", caben en 3 segundos, con una cifra o pregunta imposible) y para cada una la imagen que se ve (gancho visual). Usa [TEMA] y [CIFRA] como huecos. Devuelve {"ganchos": ["frase | imagen en pantalla"]}`,
    guardar: (r) => { ayudas.ganchos = lista(r.ganchos, 5); return `${ayudas.ganchos.length} ganchos nuevos`; }},
  {id: 'revision', para: 'Editor de guion', rol: 'Editor de guion', hay: () => !!ultimoGuion, pedir: () => `Revisa este guion con ojo crítico de editor y di las 3 mejoras que más subirían las vistas (gancho, ritmo, repetición, cierre). Guion: ${ultimoGuion.escenas.map((e) => e.texto).join(' ').slice(0, 2500)}\nDevuelve {"mejoras": ["mejora concreta"]}`,
    guardar: (r) => { ayudas.mejorasGuion = lista(r.mejoras, 3); return `${ayudas.mejorasGuion.length} mejoras al último guion`; }},
  {id: 'temas', para: 'Investigador de temas', rol: 'Investigador de temas', pedir: () => `Propón 5 títulos EXACTOS de artículos de Wikipedia en inglés sobre ${config.nicho ?? 'misterios'}, con mucha documentación. Nada de personas, política ni violencia. No repitas estos: ${historial.slice(-40).join(', ')}. Devuelve {"temas": ["Titulo exacto"]}`,
    guardar: (r) => { ayudas.temas = lista(r.temas, 5, 120); return `${ayudas.temas.length} temas candidatos`; }},
  {id: 'titulos', para: 'Titulista', rol: 'Titulista', hay: () => !!topTitulos, pedir: () => `Con los títulos que más vistas tuvieron, deduce 4 patrones de título que funcionan para este canal y escribe una plantilla por patrón. Solo con lo que muestran los datos. Devuelve {"titulos": ["plantilla de título"]}`,
    guardar: (r) => { ayudas.titulos = lista(r.titulos, 4); return `${ayudas.titulos.length} plantillas de título`; }},
];

const usados = new Set();
const ahora = new Date().toISOString();
let hechas = 0;
for (const t of TAREAS) {
  if (hechas >= MAX_TAREAS) break;
  if (t.hay && !t.hay()) continue;
  const quien = (t.solo && libres.includes(t.solo) && !usados.has(t.solo) ? t.solo : null) ?? libres.find((n) => !usados.has(n) && n !== 'Directora de contenido' && n !== t.rol);
  if (!quien) continue;
  const r = await llamar(t.pedir());
  if (!r) { console.log(`Ayuda ${t.id}: sin respuesta.`); continue; }
  const resumen = t.guardar(r);
  usados.add(quien);
  estado.agentes[quien] = {estado: 'trabajando', actividad: 'escribiendo', tarea: `AYUDA: dejó libre su puesto y le echó una mano a (${t.para}). Entregó: ${String(resumen).slice(0, 220)}`};
  hechas++;
  console.log(`${quien} ayudó a ${t.para}: ${String(resumen).slice(0, 100)}`);
}
if (hechas) {
  ayudas.fecha = ahora;
  fs.writeFileSync(path.join(carpeta, 'ayudas.json'), JSON.stringify(ayudas, null, 2));
  estado.actualizado = ahora;
  fs.writeFileSync(path.join(carpeta, 'estado.json'), JSON.stringify(estado, null, 2));
}
process.exit(0);
