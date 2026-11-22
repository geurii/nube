// "Conciencia" de los 30 (simulada, y así se dice): personalidad fija, memoria propia, reflexión en cada ciclo e iniciativa.
// NO son seres conscientes: son modelos de IA con un perfil persistente y un diario. Todo sale de UNA llamada por ciclo a Groq.
// Archivos: oficina-salida/<canal>/conciencia/perfiles.json (fijo), memoria.json (últimos recuerdos de cada uno) e iniciativas en ayudas.json.
// Variables: CANAL, GROQ_API_KEY. Nunca inventa cifras: usa solo los datos del ciclo. No detiene el flujo.
import fs from 'node:fs';
import path from 'node:path';
import {modelosDisponibles} from './llm.mjs';
const MODELOS = await modelosDisponibles(process.env.GROQ_API_KEY); // solo modelos que la cuenta tiene (cuotas separadas)

const CANAL = (process.env.CANAL || 'lqns').trim();
const KEY = process.env.GROQ_API_KEY;
const carpeta = path.resolve('oficina-salida', CANAL);
const dir = path.join(carpeta, 'conciencia');
const leer = (r, d) => { try { return JSON.parse(fs.readFileSync(r, 'utf8')); } catch { return d; } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const estado = leer(path.join(carpeta, 'estado.json'), null);
if (!estado || !KEY) { console.log('Conciencia: sin estado o sin clave.'); process.exit(0); }
fs.mkdirSync(dir, {recursive: true});
// una reflexión cada 5 horas como máximo (cuida la cuota de Groq)
const ultima = leer(path.join(dir, 'reloj.json'), {}).ultima;
if (ultima && Date.now() - new Date(ultima).getTime() < 5 * 3600 * 1000) { console.log('Conciencia: ya reflexionaron hace poco.'); process.exit(0); }

const NOMBRES = ['Valentina', 'Mateo', 'Camila', 'Sebastián', 'Lucía', 'Daniel', 'Sofía', 'Andrés', 'Mariana', 'Tomás', 'Isabella', 'Joaquín', 'Paula', 'Emilio', 'Renata', 'Nicolás', 'Carolina', 'Gabriel', 'Fernanda', 'Rodrigo', 'Daniela', 'Samuel', 'Julieta', 'Bruno', 'Alejandra', 'Iván', 'Natalia', 'Hugo', 'Elena', 'Marcos'];
const TODOS_LOS_PUESTOS = ["Directora de contenido","Enlace de datos","Coordinador de producción","Jefa de calidad","Investigador de temas","Cazador de fórmulas","Vigía de tendencias","Guionista","Editor de guion","Titulista","Redactor de descripción","Especialista en hashtags","Verificador de datos","Auditor de fuentes","Auditor de normas","Revisor de nombres","Revisor de ganchos","Pintor de luz y detalle","Pintor de imágenes","Locutor","Técnico de render","Publicador","Crítico: adolescente","Crítica: universitaria","Crítico: padre trabajador","Crítico: escéptico","Crítica: fan del misterio","Crítica: ama de casa","Crítico: joven dominicano","Crítico: abuelo"];
estado.agentes = estado.agentes ?? {};
for (const r of TODOS_LOS_PUESTOS) estado.agentes[r] = estado.agentes[r] ?? {estado: 'trabajando', actividad: 'pensando', tarea: 'En su puesto, preparando el próximo ciclo.'};
const roles = TODOS_LOS_PUESTOS.filter((r) => r !== 'Enlace de datos');
if (!roles.length) process.exit(0);

const llamar = async (sistema, usuario, max = 3500) => {
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST', headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(120000),
        body: JSON.stringify({model: MODELOS[(i - 1) % MODELOS.length], ...(MODELOS[(i - 1) % MODELOS.length].includes('gpt-oss') ? {reasoning_effort: 'low'} : {}), temperature: 0.8, max_tokens: max, messages: [{role: 'system', content: sistema}, {role: 'user', content: usuario}]}),
      });
      if (r.status === 429) { const t = await r.text(); await dormir((Number(/try again in ([\d.]+)s/i.exec(t)?.[1] ?? 15) + 1) * 1000); continue; }
      if (!r.ok) { await dormir(3000 * i); continue; }
      const m = /\{[\s\S]*\}/.exec(((await r.json()).choices?.[0]?.message?.content ?? '').replace(/```json|```/g, ''));
      if (m) return JSON.parse(m[0]);
    } catch { await dormir(3000 * i); }
  }
  return null;
};

// 1) Perfiles: se crean UNA vez y no cambian (esa es su "identidad")
let perfiles = leer(path.join(dir, 'perfiles.json'), {});
const sinPerfil = roles.filter((r) => !perfiles[r] || !perfiles[r].apodo);
if (sinPerfil.length) {
  const r = await llamar('Creas personajes ficticios para un equipo de oficina de un canal de YouTube. Son personas inventadas: sin nombres de personas reales ni famosos. Responde SOLO con JSON.',
    `Crea un perfil breve para cada uno de estos puestos: ${sinPerfil.join(' | ')}.\nCada uno tiene también un APODO épico y divertido que resume su superpoder en el equipo (ej.: «El Cazador de Ganchos», «La Cirujana de Datos», «El Alquimista del Misterio»). Devuelve {"perfiles": {"<puesto exacto>": {"apodo": "apodo de 2 a 4 palabras", "carácter": "2 rasgos de personalidad", "historia": "una frase de su vida (familia, de dónde viene)", "miedo": "lo que más teme perder", "sueño": "lo que quiere lograr con este canal"}}}`);
  sinPerfil.forEach((rol, i) => {
    const p = r?.perfiles?.[rol] ?? {};
    const previo = perfiles[rol] ?? {};
    perfiles[rol] = {...previo, apodo: String(p.apodo ?? previo.apodo ?? rol).replace(/[«»"]/g, '').slice(0, 40), nombre: previo.nombre ?? NOMBRES[(Object.keys(perfiles).length + i) % NOMBRES.length], caracter: previo.caracter ?? String(p['carácter'] ?? p.caracter ?? 'Trabajador y perfeccionista').slice(0, 120), historia: previo.historia ?? String(p.historia ?? 'Tiene una familia que alimentar.').slice(0, 160), miedo: previo.miedo ?? String(p.miedo ?? 'Quedarse sin paga.').slice(0, 100), sueno: previo.sueno ?? String(p.sueño ?? p.sueno ?? 'Que el canal se haga viral.').slice(0, 100)};
  });
  fs.writeFileSync(path.join(dir, 'perfiles.json'), JSON.stringify(perfiles, null, 2));
}

// 2) Reflexión de este ciclo (una sola llamada para todos)
const memoria = leer(path.join(dir, 'memoria.json'), {});
const ayudas = leer(path.join(carpeta, 'ayudas.json'), {});
const orden = leer(path.join(carpeta, 'ordenes.json'), [])[0];
const vistas = leer(path.join(carpeta, 'vistas.json'), null);
const base = vistas?.historia?.[0]?.total ?? vistas?.total ?? 0;
const ganadas = Math.max(0, (vistas?.total ?? 0) - base);
const ultimoPanel = (() => { try { const f = fs.readdirSync(carpeta).filter((n) => /^panel-.*\.json$/.test(n)).map((n) => ({n, t: fs.statSync(path.join(carpeta, n)).mtimeMs})).sort((a, b) => b.t - a.t)[0]; return f ? leer(path.join(carpeta, f.n), null) : null; } catch { return null; } })();
const hechos = [
  `Vistas ganadas por el canal desde que se empezó a contar: ${ganadas} (la paga de cada puesto es de 10.000, la de Jules 20.000).`,
  ultimoPanel ? `Último video evaluado por el panel: ${ultimoPanel.aprobado ? 'APROBADO' : 'RECHAZADO'}. ${String(ultimoPanel.resumen ?? '').slice(0, 200)}` : 'Aún no hay un video evaluado por el panel.',
  orden ? `Orden vigente de Jules (nivel ${orden.nivel}/5): ${orden.orden}` : 'Jules no ha dado órdenes recientes.',
  `Totales de la oficina: ${JSON.stringify(estado.totales ?? {})}.`,
].join('\n');
const cuadro = roles.map((r) => `- ${r} (${perfiles[r]?.nombre}; ${perfiles[r]?.caracter}; teme: ${perfiles[r]?.miedo}) recuerda: ${(memoria[r] ?? []).slice(-2).map((m) => m.pensamiento).join(' / ') || 'nada todavía'}`).join('\n');
const r = await llamar('Das voz interior a un equipo de oficina ficticio. Cada uno piensa en primera persona, breve y coherente con su carácter y su memoria. Solo puedes usar los HECHOS dados: no inventes cifras ni eventos. Responde SOLO con JSON.',
  `HECHOS DEL CICLO:\n${hechos}\n\nEQUIPO:\n${cuadro}\n\nDevuelve {"reflexiones": {"<puesto exacto>": {"pensamiento": "una frase en primera persona sobre cómo se siente y qué piensa de su trabajo hoy", "iniciativa": "una idea concreta propia para mejorar el canal, o cadena vacía"}}} para TODOS los puestos.`, 4500);
if (!r?.reflexiones) { console.log('Conciencia: Groq no respondió.'); process.exit(0); }

const ahora = new Date().toISOString();
const iniciativas = [];
for (const rol of roles) {
  const x = r.reflexiones[rol];
  if (!x?.pensamiento) continue;
  const pen = String(x.pensamiento).slice(0, 220);
  const ini = String(x.iniciativa ?? '').slice(0, 220);
  memoria[rol] = [...(memoria[rol] ?? []), {fecha: ahora, pensamiento: pen, iniciativa: ini}].slice(-8);
  if (ini) iniciativas.push(`${perfiles[rol]?.nombre} (${rol}): ${ini}`);
  const a = estado.agentes[rol];
  if (a?.tarea) a.tarea = a.tarea.replace(/ SOY .*?(?= PIENSA:)/s, '').replace(/ PIENSA:.*$/s, '') + ` SOY ${perfiles[rol]?.nombre} «${perfiles[rol]?.apodo ?? rol}»: ${perfiles[rol]?.caracter}. PIENSA: ${pen}${ini ? ' INICIATIVA: ' + ini : ''}`;
}
fs.writeFileSync(path.join(dir, 'memoria.json'), JSON.stringify(memoria, null, 2));
if (iniciativas.length) { ayudas.iniciativas = iniciativas.slice(0, 8); fs.writeFileSync(path.join(carpeta, 'ayudas.json'), JSON.stringify(ayudas, null, 2)); }
estado.actualizado = ahora;
fs.writeFileSync(path.join(carpeta, 'estado.json'), JSON.stringify(estado, null, 2));
fs.writeFileSync(path.join(dir, 'reloj.json'), JSON.stringify({ultima: ahora}));
console.log(`Conciencia: ${roles.length} perfiles, ${iniciativas.length} iniciativas.`);
process.exit(0);
