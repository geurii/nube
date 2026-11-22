// Oficina de videos de "Lo Que No Sabías" · corre en GitHub Actions, sin que Claude participe.
// Departamentos: Dirección (elige tema) → Investigación (Wikipedia, con fuente) → Guionista (Groq)
//   → Editor crítico (retención y ritmo) → Verificador (rechaza lo que no esté en la fuente) → Escenógrafo (fondos de cada escena).
// Salida en oficina-salida/: guion-<tema>.json (formato del render), informe-<tema>.md, estado.json (lo que ve la oficina 3D), historial.json.
// Variables: GROQ_API_KEY (secreto), TEMA (opcional: título en Wikipedia), FORMATO (short|largo), IDIOMAS (por defecto "es,en"), PALABRAS (largo).
import fs from 'node:fs';
import path from 'node:path';
import {puestosDeLaOficina, mesaDePublicacion} from './puestos.mjs';
import {avisarTelefono} from './aviso.mjs';
import {leerManual, pendientesDeVistoBueno, ESTADO_ESPERA} from './manual.mjs';
import {crearVisuales} from './visuales.mjs';
import {investigarEnLaWeb} from './investigar-web.mjs';
import {limpiarParaVoz} from './texto-voz.mjs';
import {textoDeRadar} from './radar.mjs';
import {completarHashtags} from './hashtags.mjs';
import {ganchoDe} from './titular.mjs'; // titular gigante de los primeros segundos (nunca cortado a mitad de frase)
import {evaluarGuionConPanel} from './panel-guion.mjs';
import {titulosVirales, armarBloqueWeb, guardarWeb} from './web.mjs';
import {filtrarTemas, sinRechazadas, leerPreferencias, fueRechazada} from './ideas.mjs';
import {enGarantia} from './garantia.mjs';
import {chatAlternativo, proveedoresConLlave, modelosDisponibles, diagnosticoRespaldo} from './llm.mjs';

const KEY = process.env.GROQ_API_KEY;
const CANAL_ID = (process.env.CANAL || 'lqns').trim();
const leerJsonSync = (ruta, porDefecto) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return porDefecto; } };
const CONFIG = (leerJsonSync(path.resolve('agentes', 'canales-propios.json'), {canales: []}).canales ?? []).find((c) => c.id === CANAL_ID);
if (!CONFIG) { console.error(`ERROR: el canal "${CANAL_ID}" no existe en agentes/canales-propios.json`); process.exit(1); }
let TEMA = (process.env.TEMA ?? '').trim();
const FORMATO = process.env.FORMATO === 'largo' ? 'largo' : 'short';
const IDIOMAS = (process.env.IDIOMAS ? process.env.IDIOMAS.split(',') : CONFIG.idiomasFuente ?? ['es', 'en']).map((x) => x.trim()).filter(Boolean);
const PALABRAS = FORMATO === 'largo' ? Number(process.env.PALABRAS) || 900 : 110;
const CTA = CONFIG.cta ?? 'Comparte este video con un amigo que haría lo mismo, sígueme.';
const UA = 'OficinaVideos/1.0 (proyecto educativo)';
const SALIDA = path.resolve('oficina-salida', CANAL_ID);
const MANUAL = leerManual(CANAL_ID); // modo manual del dueño (apagado por defecto)
const NOTIFICACIONES = path.resolve('oficina-salida', 'notificaciones.json');
fs.mkdirSync(SALIDA, {recursive: true});

const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const slugDe = (t) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'sin-tema';
let slug = 'sin-tema';

/* ====================== Estado real para la oficina 3D ====================== */
const ESTADO = path.join(SALIDA, 'estado.json');
const HISTORIAL = path.join(SALIDA, 'historial.json');
const leerJson = (ruta, porDefecto) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return porDefecto; } };
/** Próximo ciclo automático (02:00 y 14:00 UTC): cuánto falta, para que la jefa meta presión con plazos reales. */
const horasParaProximoCiclo = () => {
  const ahora = new Date();
  const candidatos = [2, 14].flatMap((h) => [0, 1].map((d) => { const t = new Date(Date.UTC(ahora.getUTCFullYear(), ahora.getUTCMonth(), ahora.getUTCDate() + d, h)); return t; })).filter((t) => t > ahora).sort((a, b) => a - b);
  return Math.max(1, Math.round((candidatos[0] - ahora) / 3600000));
};
/** Reporte para la campana de la oficina 3D. tipo: reporte | alerta | listo. */
const notificar = (tipo, titulo, texto) => {
  avisarTelefono(tipo, titulo, texto);
  const lista = leerJson(NOTIFICACIONES, []);
  lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal: CANAL_ID, canalNombre: CONFIG.nombre, tipo, titulo, texto});
  fs.mkdirSync(path.dirname(NOTIFICACIONES), {recursive: true});
  fs.writeFileSync(NOTIFICACIONES, JSON.stringify(lista.slice(0, 80), null, 2));
};
/** Lo que la Mesa de publicación y los auditores dejaron en este ciclo (para el estado de los 30 puestos). */
const CTX = {pintadas: 0, gancho: null, mesa: null, fuentes: 0, escenas: 0, sinImagen: 0, problemas: [], puntaje: null};
const registrar = (resultado, detalle, intentos, extra = {}) => {
  const e = leerJson(ESTADO, {agentes: {}, historial: [], totales: {aprobados: 0, rechazados: 0, errores: 0}});
  e.totales = {aprobados: 0, rechazados: 0, errores: 0, ...(e.totales ?? {})};
  e.totales[resultado === 'aprobado' ? 'aprobados' : resultado === 'rechazado' ? 'rechazados' : 'errores']++;
  e.historial = [{fecha: new Date().toISOString(), tema: TEMA || '(sin tema)', formato: FORMATO, resultado, intentos, detalle}, ...(e.historial ?? [])].slice(0, 20);
  const t = e.totales;
  const resumen = `Aprobados: ${t.aprobados}. Rechazados: ${t.rechazados}. Con error: ${t.errores}.`;
  const ag = e.agentes ?? {};
  if (resultado === 'aprobado') {
    ag['Directora de contenido'] = {estado: 'libre', actividad: 'hablando', tarea: `Último guion aprobado: "${TEMA}" (${FORMATO}). ${resumen}`};
    ag['Investigador de temas'] = {estado: 'libre', actividad: 'leyendo', tarea: `Dejó el material de "${TEMA}" con su fuente en Wikipedia.`};
    ag['Guionista'] = {estado: 'libre', actividad: 'escribiendo', tarea: `Entregó el guion de "${TEMA}". ${detalle}`};
    ag['Editor de guion'] = {estado: 'libre', actividad: 'pensando', tarea: `Pulió el guion y eligió los fondos de cada escena. ${extra.editor ?? ''}`.trim()};
    ag['Verificador de datos'] = {estado: 'libre', actividad: 'leyendo', tarea: `Aprobó "${TEMA}" en el intento ${intentos}.`};
  } else if (resultado === 'rechazado') {
    ag['Directora de contenido'] = {estado: 'trabajando', actividad: 'pensando', tarea: `Necesita revisión: el guion de "${TEMA}" no pasó la verificación. ${resumen}`};
    ag['Investigador de temas'] = {estado: 'libre', actividad: 'leyendo', tarea: `Dejó el material de "${TEMA}" con su fuente en Wikipedia.`};
    ag['Guionista'] = {estado: 'trabajando', actividad: 'escribiendo', tarea: `Intentó ${intentos} veces escribir "${TEMA}" sin que el Verificador lo aprobara.`};
    ag['Verificador de datos'] = {estado: 'trabajando', actividad: 'leyendo', tarea: `Rechazó "${TEMA}": ${detalle}`};
  } else {
    ag['Directora de contenido'] = {estado: 'trabajando', actividad: 'pensando', tarea: `La oficina falló en su último ciclo: ${detalle}`};
  }
  puestosDeLaOficina(ag, {resultado, tema: TEMA, ctx: CTX, historial: leerJson(HISTORIAL, []), orden: ORDEN_JULES, formulas: leerJson(path.join(SALIDA, 'formulas.json'), null), vistas: leerJson(path.join(SALIDA, 'vistas.json'), null), subidos: leerJson(path.join(SALIDA, 'subidos.json'), null), vigilados: (CONFIG.vigilar ?? []).length});
  // Jules, la jefa: exigente, directa y con números reales. Nunca esconde un resultado malo.
  const h = horasParaProximoCiclo();
  const jefa = (rol, frase) => { if (ag[rol]) ag[rol].tarea = `${ag[rol].tarea} JEFA: ${frase}`; };
  if (resultado === 'aprobado') {
    jefa('Guionista', intentos > 1 ? `Necesitaste ${intentos} intentos. Mañana, a la primera.` : 'A la primera. Mantenlo.');
    jefa('Editor de guion', extra.puntaje !== undefined && extra.puntaje < 7 ? `Un ${extra.puntaje}/10 no alcanza. Quiero ganchos que frenen el dedo.` : 'Sigue siendo implacable.');
    jefa('Verificador de datos', 'Que no se te cuele ni un dato sin fuente.');
    jefa('Directora de contenido', `Faltan ${h} h para el próximo ciclo. Sin excusas.`);
  } else if (resultado === 'rechazado') {
    jefa('Guionista', `${intentos} intentos y nada aprobado. Esto es inaceptable. Estudien la fuente antes de escribir.`);
    jefa('Directora de contenido', `Un guion rechazado no se publica. Tienen ${h} h para entregar algo que pase.`);
  } else {
    jefa('Directora de contenido', `Falló el ciclo. Quiero la causa y el arreglo antes de las próximas ${h} h.`);
  }
  e.jefa = {mensaje: ag['Directora de contenido']?.tarea ?? '', horasParaProximoCiclo: h};
  const edit = extra.editor ? ` Editor: ${extra.editor}` : '';
  if (resultado === 'aprobado') notificar('reporte', `Guion aprobado: ${TEMA}`, `${FORMATO === 'largo' ? 'Video largo' : 'Short'} de "${TEMA}" aprobado en el intento ${intentos}. ${detalle}${edit} ${resumen} Próximo ciclo en ${h} h.`);
  else if (resultado === 'rechazado') notificar('alerta', `Guion rechazado: ${TEMA}`, `El Verificador no aprobó "${TEMA}" tras ${intentos} intentos: ${detalle} ${resumen} No se publica. Próximo ciclo en ${h} h.`);
  else notificar('alerta', 'La oficina falló', `${detalle} ${resumen} Próximo ciclo en ${h} h.`);
  e.agentes = ag;
  e.actualizado = new Date().toISOString();
  fs.writeFileSync(ESTADO, JSON.stringify(e, null, 2));
};

const fallar = (m) => { console.error('ERROR:', m); process.exit(1); };
if (!KEY) { try { registrar('error', 'Falta el secreto GROQ_API_KEY.', 0); } catch { /* sin estado */ } fallar('Falta el secreto GROQ_API_KEY.'); }

/* ====================== Investigación: Wikipedia (gratis, con fuente) ====================== */
const wikipedia = async (lang, titulo) => {
  const url = `https://${lang}.wikipedia.org/w/api.php?action=query&prop=extracts%7Cinfo&inprop=url&explaintext=1&exsectionformat=plain&redirects=1&format=json&titles=${encodeURIComponent(titulo)}`;
  for (let i = 1; i <= 3; i++) {
    try {
      const r = await fetch(url, {headers: {'User-Agent': UA}, signal: AbortSignal.timeout(30000)});
      if (!r.ok) { await dormir(2000 * i); continue; }
      const pagina = Object.values((await r.json()).query?.pages ?? {})[0];
      if (!pagina || pagina.missing !== undefined || !pagina.extract) return null;
      return pagina;
    } catch { await dormir(2000 * i); }
  }
  return null;
};
/** Quita referencias, bibliografía y enlaces: ahí están los nombres de autores, que no son parte de la historia. */
const limpiarMaterial = (texto) => {
  const corte = texto.search(/^\s*(References|Further reading|External links|See also|Notes|Bibliography|Referencias|Enlaces externos|Véase también|Bibliografía|Notas)\s*$/im);
  return (corte > 500 ? texto.slice(0, corte) : texto).trim();
};
const investigar = async () => {
  const fuentes = [];
  for (const lang of IDIOMAS) {
    const p = await wikipedia(lang, TEMA);
    if (p) fuentes.push({idioma: lang, titulo: p.title, url: p.fullurl, texto: limpiarMaterial(p.extract).slice(0, FORMATO === 'largo' ? 3500 : 4500)});
  }
  // segunda fuente que no es Wikipedia (DuckDuckGo, gratis y sin llave): solo apoyo para contrastar fechas y cifras
  const web = await investigarEnLaWeb(TEMA);
  return [...fuentes, ...web];
};

/* ====================== Groq con reintentos ====================== */
/** Cultura de la empresa: va delante de las instrucciones de todos los agentes. Ambición sin bajar el rigor: perfeccionistas. */
const CULTURA = 'EMPRESA: ' + (CONFIG.nombre ?? 'el canal') + '. FORMATO FACELESS (decisión del dueño): videos SIN personaje, SIN caras ni rostros de nadie en pantalla y sin mascota con lupa; solo voz en off y visuales en movimiento que muestran lo que se dice. META: monetizar el canal antes del 13 de diciembre de 2026 (YouTube pide 1.000 suscriptores y 4.000 horas de reproducción, o 10 millones de vistas en Shorts en 90 días) y llevarlo arriba. Eres un/a profesional con cinco maestrías en tu área, perfeccionista y obsesionado/a con hacer videos virales. Tu paga individual son 10.000 vistas ganadas para el canal (Jules, la jefa, cobra 20.000): si el canal no las consigue no cobras, y tienes una familia que alimentar, así que trabajas duro y sin descanso. Jules te presiona a diario. Ambición NO es inventar: jamás sacrificas la verdad ni las normas por vistas.';
const ORDEN_JULES = leerJson(path.join(SALIDA, 'ordenes.json'), [])[0];
const ALTERNOS = process.env.GROQ_API_KEY ? (await modelosDisponibles(process.env.GROQ_API_KEY)).filter((m) => m !== 'openai/gpt-oss-120b') : []; // modelos de Groq con cuota separada que SÍ existen en la cuenta
let groqBloqueadoHasta = 0; // mientras Groq esté en 429, se usan primero los demás proveedores
let WEB_BLOQUE = leerPreferencias(CANAL_ID); // arranca con lo que el dueño aprobó y rechazó; después se le suma lo que dice internet // lo que dice internet HOY sobre el tema: se les da a TODOS los agentes (se llena después de investigar)
const groqDirecto = async (modelo, mensajes, maxTokens = FORMATO === 'largo' ? 4500 : 2500) => {
  mensajes = mensajes.map((m, i) => (i === 0 && m.role === 'system' ? {...m, content: CULTURA + (WEB_BLOQUE ? ' ' + WEB_BLOQUE : '') + (ORDEN_JULES ? ` ORDEN VIGENTE DE JULES (nivel ${ORDEN_JULES.nivel}/5, la dio el dueño): ${ORDEN_JULES.orden}` : '') + '\n\n' + m.content} : m));
  let ultimo = 'sin respuesta';
  const maxIntentos = proveedoresConLlave().length ? 4 : 8; // con respaldo disponible no se pierde tiempo esperando a Groq
  for (let intento = 1; intento <= maxIntentos; intento++) {
    try {
      // si el modelo principal agotó su cuota (429), se pasa a otros modelos de Groq, que tienen cuotas separadas
      const mod = ultimo.includes('429') && ALTERNOS.length ? (intento >= 3 ? ALTERNOS[(intento - 3) % ALTERNOS.length] : modelo) : modelo;
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json'},
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({
          model: mod,
          messages: mensajes,
          temperature: 0.4,
          max_tokens: maxTokens,
          // los modelos "gpt-oss" razonan antes de responder: poco razonamiento = más espacio para el texto
          ...(mod.includes('gpt-oss') ? {reasoning_effort: 'low'} : {}),
        }),
      });
      if (r.status === 429) {
        const cuerpo = await r.text();
        const espera = Number(/try again in ([\d.]+)s/i.exec(cuerpo)?.[1] ?? 20);
        console.log(`Groq pide esperar ${espera} s (límite por minuto del nivel gratis). Intento ${intento}/8.`);
        ultimo = 'límite de Groq (429)';
        groqBloqueadoHasta = Date.now() + 90_000;
        if (proveedoresConLlave().length) break; // hay respaldo: se pasa a otro proveedor sin esperar
        await dormir((Math.min(espera, 60) + 2) * 1000);
        continue;
      }
      if (r.status >= 500) { ultimo = `Groq ${r.status}`; await dormir(3000 * intento); continue; }
      if (r.status === 404 || r.status === 400) { ultimo = `modelo no disponible (${mod})`; if (mod !== modelo) { await dormir(1000); continue; } }
      if (!r.ok) throw Object.assign(new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 300)}`), {fatal: true});
      const j = await r.json();
      const eleccion = j.choices?.[0];
      const contenido = eleccion?.message?.content ?? '';
      if (!contenido.trim()) { ultimo = `respuesta vacía (${eleccion?.finish_reason ?? '?'})`; continue; }
      return contenido;
    } catch (e) {
      if (e.fatal) throw e;
      ultimo = String(e.message ?? e);
      await dormir(3000 * intento);
    }
  }
  throw new Error(`Groq no respondió tras ${maxIntentos} intentos (${ultimo}).`);
};
/** Groq primero; si se agota, pasa a Gemini, Cerebras, OpenRouter o Mistral (los que tengan llave). */
let esperaTotal = 0; // segundos esperando a que se libere la cuota (tope por ciclo)
const groq = async (modelo, mensajes, maxTokens, json = false) => {
  for (let ronda = 1; ; ronda++) {
    try { return await groqUnaRonda(modelo, mensajes, maxTokens, json); }
    catch (e) {
      if (e.fatal || ronda >= 3 || esperaTotal >= 480 || !/429|Respaldos/.test(String(e.message))) throw e;
      console.log(`Todos los proveedores en límite: espero 70 s a que se libere la cuota (ronda ${ronda}/3).`);
      esperaTotal += 70; await dormir(70_000);
    }
  }
};
const groqUnaRonda = async (modelo, mensajes, maxTokens, json = false) => {
  if (Date.now() < groqBloqueadoHasta && proveedoresConLlave().length) {
    const rapido = await chatAlternativo(mensajes.map((m, i) => (i === 0 && m.role === 'system' ? {...m, content: CULTURA + (WEB_BLOQUE ? ' ' + WEB_BLOQUE : '') + ' ' + m.content} : m)), {maxTokens: maxTokens ?? 2500, json});
    if (rapido) { console.log(`Groq en límite: se usó ${rapido.proveedor} (${rapido.modelo}).`); return rapido.texto; }
  }
  try { return await groqDirecto(modelo, mensajes, maxTokens); }
  catch (e) {
    if (e.fatal) throw e;
    const alt = await chatAlternativo(mensajes.map((m, i) => (i === 0 && m.role === 'system' ? {...m, content: CULTURA + (WEB_BLOQUE ? ' ' + WEB_BLOQUE : '') + ' ' + m.content} : m)), {maxTokens: maxTokens ?? 2500, json});
    if (!alt) { e.message += ` Respaldos: ${[...new Set(diagnosticoRespaldo)].join('; ').slice(0, 450) || 'ninguno con llave'}.`; throw e; }
    console.log(`Groq no respondió: se usó ${alt.proveedor} (${alt.modelo}).`);
    return alt.texto;
  }
};
const extraerJson = (texto) => {
  const a = texto.indexOf('{'), b = texto.lastIndexOf('}');
  if (a < 0 || b < 0) throw new Error('sin JSON');
  return JSON.parse(texto.slice(a, b + 1));
};
/** Pide JSON; si viene roto, lo vuelve a pedir una vez. */
/** Arregla los fallos típicos de JSON de los modelos: comas de más o de menos, comillas curvas, texto antes o después. */
const repararJson = (texto) => {
  let t = String(texto).replace(/```json|```/g, '').replace(/[\u201C\u201D]/g, '"').replace(/[\u2018\u2019]/g, "'");
  const a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b <= a) throw new Error('sin JSON');
  t = t.slice(a, b + 1);
  const intentos = [t, t.replace(/,\s*([}\]])/g, '$1'), t.replace(/,\s*([}\]])/g, '$1').replace(/"\s*\n\s*"/g, '",\n"').replace(/}\s*\n\s*{/g, '},\n{').replace(/]\s*\n\s*"/g, '],\n"')];
  for (const x of intentos) { try { return JSON.parse(x); } catch { /* siguiente */ } }
  throw new Error('JSON no válido');
};
const pedirJson = async (modelo, mensajes, maxTokens) => {
  let texto = await groq(modelo, mensajes, maxTokens, true);
  for (let k = 1; k <= 3; k++) {
    try { return extraerJson(texto); } catch { /* se intenta reparar */ }
    try { return repararJson(texto); } catch { /* se pide de nuevo */ }
    if (k === 3) break;
    texto = await groq(modelo, [...mensajes, {role: 'assistant', content: texto.slice(0, 1200)}, {role: 'user', content: 'Tu respuesta no era JSON válido (revisa comas y corchetes). Devuelve SOLO el JSON completo y bien formado, sin texto antes ni después.'}], maxTokens, true);
  }
  throw new Error('El modelo no devolvió un JSON válido tras 3 intentos.');
};
const elegirModelo = async () => {
  for (let i = 1; i <= 4; i++) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/models', {headers: {Authorization: `Bearer ${KEY}`}, signal: AbortSignal.timeout(30000)});
      if (r.status === 401) throw Object.assign(new Error('La clave de Groq no es válida (401). Crea otra y guárdala como GROQ_API_KEY.'), {fatal: true});
      if (!r.ok) { await dormir(2000 * i); continue; }
      const ids = (await r.json()).data.map((m) => m.id);
      const preferidos = ['openai/gpt-oss-120b', 'llama-3.3-70b-versatile', 'openai/gpt-oss-20b', 'llama-3.1-8b-instant'];
      const modelo = preferidos.find((p) => ids.includes(p)) ?? ids.find((x) => !/whisper|guard|tts|orpheus|playai/i.test(x));
      if (!modelo) throw Object.assign(new Error('No hay un modelo de texto disponible en Groq: ' + ids.join(', ')), {fatal: true});
      return modelo;
    } catch (e) { if (e.fatal) throw e; await dormir(2000 * i); }
  }
  throw new Error('No pude conectar con Groq para listar los modelos.');
};

/* ====================== Dirección: elige el tema sola ====================== */
const existeEnWikipedia = async (titulo) => {
  const p = await wikipedia('en', titulo);
  return !!p && (p.extract ?? '').length > 3000;
};
const elegirTema = async (modelo) => {
  const hechos = leerJson(HISTORIAL, []);
  // RADAR: videos de canales CHICOS que acaban de explotar en el nicho (YouTube público). El tema se elige mirando lo que está pegando, no solo Wikipedia.
  const radar = leerJson(path.join(SALIDA, 'radar.json'), null);
  const resumenRadar = textoDeRadar(radar, 8);
  const bloqueRadar = resumenRadar
    ? ` RADAR DE CANALES POR EXPLOTAR (videos recientes de canales chicos del nicho que se dispararon): ${resumenRadar}. PRIORIDAD: los PRIMEROS temas de tu lista deben salir de lo que está pegando en ese radar: la misma idea (un suceso, objeto o lugar REAL y documentado) escrita como el título exacto de su artículo de Wikipedia. Descarta del radar lo que no sea un hecho real (películas, series, famosos, chismes, juegos).`
    : '';
  if (resumenRadar) informe.push(`Radar: ${radar.canales.length} canales chicos que explotaron (${String(radar.fecha).slice(0, 10)}); se usan para elegir el tema.`);
  const r = await pedirJson(modelo, [
    {role: 'system', content: `Eres el/la Director/a de contenido del canal de YouTube "${CONFIG.nombre}" (${CONFIG.nicho}). Respondes SOLO con JSON.`},
    {role: 'user', content: `Dame 20 títulos EXACTOS de artículos de Wikipedia en inglés sobre ${CONFIG.nicho}, con mucha documentación. Prefiere casos con HECHOS CONCRETOS y bien documentados (un objeto, un lugar, un evento con fecha y cifras), no fenómenos que solo tienen teorías ni conspiraciones. Reglas: nada sobre personas (ni biografías), nada de política ni de violencia gráfica, nada ya hecho. Ya hechos: ${hechos.join(', ') || 'ninguno'}.${bloqueRadar} Formato: {"temas": ["Titulo 1", "Titulo 2"]}`},
  ], 1500);
  const ideasEquipo = filtrarTemas(leerJson(path.join(SALIDA, 'ayudas.json'), {}).temas ?? [], CANAL_ID); // los temas que el dueño rechazó se quitan y los que aprobó van primero
  // NUNCA se repite un tema: "Bloop" y "The Bloop" son el MISMO tema (se compara sin mayúsculas, sin "The" inicial y sin signos).
  // Se miran los temas anotados, todos los guiones que existen (aprobados o no), lo ya producido y lo ya subido a YouTube.
  const clave = (x) => String(x).toLowerCase().replace(/^the[-_ ]+/, '').replace(/[^a-z0-9]+/g, '');
  let guiones = [];
  try { guiones = fs.readdirSync(SALIDA).filter((f) => /^guion-.+\.json$/.test(f)).map((f) => f.replace(/^guion-|\.json$/g, '')); } catch { /* sin carpeta */ }
  const subidosTitulos = (leerJson(path.join(SALIDA, 'subidos.json'), {}).videos ?? []).map((v) => v.titulo);
  const vistos = [...new Set([...hechos, ...guiones, ...leerJson(path.join(SALIDA, 'producidos.json'), []), ...subidosTitulos].map(clave).filter((k) => k.length >= 4))];
  const yaHecho = (x) => { if (fueRechazada(x, CANAL_ID)) return true; const k = clave(x); return k.length >= 4 && vistos.some((v) => v === k || (k.length >= 6 && v.length >= 6 && (v.includes(k) || k.includes(v)))); };
  for (const t of [...ideasEquipo, ...(r.temas ?? [])]) {
    if (typeof t !== 'string' || yaHecho(t)) continue;
    const p = await wikipedia('en', t);
    if (!p || (p.extract ?? '').length <= 3000) continue;
    if (yaHecho(p.title)) continue; // el artículo real (tras la redirección) tampoco debe ser un tema ya hecho
    return p.title;
  }
  throw new Error('No encontré un tema nuevo con material suficiente en Wikipedia.');
};

/* ====================== Normas de la jefa (las cumplen todos) ====================== */
const NORMAS = `NORMAS DE LA JEFA (no se negocian):
1. Solo puedes usar datos que estén en el MATERIAL. Si un dato no está en el material, no existe. Prohibido inventar.
2. Si el material no alcanza para lo que se pide, dilo y escribe menos. Un guion corto y verdadero vale más que uno largo con relleno.
3. La primera frase empieza exactamente con "Sabías que", dura MÁXIMO 14 palabras y es un GANCHO REAL: una pregunta intrigante o un hecho increíble (con un número o una cifra concreta SOLO si el material la trae; nunca inventes una), que se entienda en un segundo y deje la duda abierta (que el dedo se frene). Esa frase saldrá además como titular gigante en pantalla.
4. ${CONFIG.tono ?? 'Tono de misterio, no de miedo.'} Lenguaje claro para gente normal. Sin tecnicismos.
5. Sin nombres de personas reales: di "el capitán", "un científico", "los investigadores". Sí puedes nombrar lugares, barcos, libros u objetos.
6. Las dudas se dicen como dudas ("según la fuente", "no se sabe"). Si dos fuentes difieren, di las dos.
7. La revelación ("Pero lo que no sabías:") cae entre el 65 % y el 75 % del guion.
8. Cierra con una pregunta al espectador y con esta frase EXACTA: "${CTA}"
8b. TODO el texto se LEE EN VOZ ALTA por una voz en español: escríbelo en español puro, sin palabras en inglés (traduce: "estruendo", no "blast"), sin transliteraciones raras ni siglas sueltas, y los rangos con palabras ("entre 10 y 15", no "10-15").
9. Escribe las cifras y los años con DÍGITOS, exactamente como aparecen en DATOS EXACTOS (por ejemplo 1609 o 1420 MHz). NUNCA conviertas un número a palabras ni lo cambies: un número mal copiado es un dato falso.
11. GANCHO AUDITIVO (primeros 3 segundos, lo que se OYE): una pregunta imposible o una cifra dicha en voz alta, con frase corta y una pausa dramática justo antes de la respuesta. Nada de saludos ni introducciones.
12. GANCHO VISUAL (lo que se VE): cada escena describe algo que se pueda mostrar y la cifra o la idea clave aparece escrita en pantalla; el fondo cambia cada 3 segundos.
13. AMBICIÓN: tu paga depende de las vistas; cada vista es dinero para ti. Escribe para que el dedo se detenga y el video se vea hasta el final.
11. SOLO HECHOS PUNTUALES: no afirmes causas, coincidencias, tendencias ni expresiones como "la mayoría", "siempre" o "coincide con" si el material no las dice con esas mismas palabras. La revelación ("Pero lo que no sabías:") debe ser UN hecho concreto copiado casi literal del material, con su cifra o fecha. Si el material solo ofrece teorías, cuenta que son teorías.
10. Cada dato (fecha, cifra, lugar, causa, relación) debe poder encontrarse casi literal en el MATERIAL. Si dudas de una frase, quítala. Prefiere pocas frases verdaderas a muchas dudosas. No uses cifras que el material no traiga.`;

const REPARTO = FORMATO === 'largo'
  ? 'La revelación ("Pero lo que no sabías:") debe empezar cuando lleves entre el 65 % y el 75 % de las palabras del guion.'
  : 'Reparto de palabras obligatorio: antes de la revelación, entre 70 y 80 palabras (el hook más 3 o 4 escenas de historia); la revelación, entre 12 y 18 palabras; el veredicto, entre 22 y 28 palabras e incluye la frase final exacta.';
const FORMATO_ESCENAS = 'Formato JSON de escenas: [{"tipo": "hook|historia|revelacion|veredicto", "texto": "una o dos frases"}]. La primera escena es "hook", la última "veredicto".';

/** Fórmula del momento (la deja el Cazador de fórmulas): solo estructura, nunca temas ni contenido de otros canales. */
const ayudasDelEquipo = () => {
  const y = leerJson(path.join(SALIDA, 'ayudas.json'), {});
  const au = leerJson(path.join(SALIDA, 'autopsia.json'), null);
  const partes = [];
  if (au?.reglas?.length) partes.push(`AUTOPSIA de por qué los videos anteriores no cogieron vistas (reglas): ${au.reglas.join(' | ')}`);
  if (y.ganchos?.length) partes.push(`Plantillas de gancho del equipo: ${sinRechazadas(y.ganchos, CANAL_ID).slice(0, 3).join(' // ')}`);
  if (y.mejorasGuion?.length) partes.push(`Mejoras que el equipo vio en el guion anterior: ${sinRechazadas(y.mejorasGuion, CANAL_ID).join(' | ')}`);
  if (y.titulos?.length) partes.push(`Patrones de título que funcionan: ${sinRechazadas(y.titulos, CANAL_ID).join(' | ')}`);
  return partes.length ? `\n\nAYUDA DEL EQUIPO (úsala si encaja; los datos del MATERIAL mandan): ${partes.join('. ')}` : '';
};
const aprendizajesDelPanel = () => {
  const a = leerJson(path.join(SALIDA, 'aprendizajes.json'), []).slice(0, 3);
  return a.length ? `\n\nCRÍTICAS REALES DEL PANEL DE ESPECTADORES a videos anteriores (corrige estos defectos): ${a.map((x) => `"${x.video}": ${x.mejora} ${(x.quejas ?? []).slice(0, 2).join(' | ')}`).join(' // ')}` : '';
};
const formulaActual = () => {
  const f = leerJson(path.join(SALIDA, 'formulas.json'), null)?.formula;
  if (!f?.formula) return '';
  return `\nFÓRMULA DEL MOMENTO (lo que hoy funciona en canales exitosos; imita la ESTRUCTURA, no los temas): ${f.formula}. Plantillas de gancho: ${(f.ganchos ?? []).join(' | ')}. Evita: ${(f.evitar ?? []).join(' | ')}.\n`;
};
/** Frases del material que traen cifras o fechas, tal cual: el Guionista solo puede usar estos valores. */
const datosExactos = (material) => {
  const frases = material.replace(/\s+/g, ' ').split(/(?<=[.!?])\s+/).filter((x) => /\d/.test(x) && x.length < 260);
  return [...new Set(frases)].slice(0, 22).map((x) => '- ' + x).join('\n') || '(el material no trae cifras)';
};
/** Nombres de personas que el Verificador ya detectó en intentos anteriores: prohibido repetirlos. */
const PROHIBIDOS = [];
const prohibidosTexto = () => (PROHIBIDOS.length ? `\n\nNOMBRES PROHIBIDOS (ya te los rechazaron; di su papel: "el investigador", "el astrónomo"): ${[...new Set(PROHIBIDOS)].join(', ')}.` : '');
const guionista = (material, problemas) => [
  {role: 'system', content: `Eres el/la Guionista del canal de YouTube "${CONFIG.nombre}" (${CONFIG.nicho}). Tienes maestría en narración de documental, retención de audiencia y rigor periodístico. ${NORMAS}\nResponde SOLO con JSON.`},
  {role: 'user', content: `Escribe un guion de ${FORMATO === 'largo' ? 'video largo' : 'Short vertical de unos 55 segundos'} de unas ${PALABRAS} palabras sobre "${TEMA}". ${REPARTO}${formulaActual()}${aprendizajesDelPanel()}${ayudasDelEquipo()}\n\nDATOS EXACTOS (cualquier cifra o fecha que escribas debe ser EXACTAMENTE una de estas, dicha en palabras):\n${datosExactos(material)}${prohibidosTexto()}\n\nMATERIAL (única fuente permitida):\n${material}\n\n${problemas?.length ? `El Verificador o el Editor rechazaron la versión anterior. Corrige exactamente esto:\n${problemas.map((p) => `- "${p.frase}": ${p.motivo}`).join('\n')}\n\n` : ''}Formato JSON: {"titulo": "...(máx. 90 caracteres, con un emoji)", "descripcion": "...(2 frases)", "hashtags": ["#cinco", "#especificos", "#del", "#tema", "#sinviral"], "escenas": [...]}. Los hashtags son 5, específicos del tema; nunca #viral ni #fyp. ${FORMATO_ESCENAS}`},
];
const editor = (titulo, escenas) => [
  {role: 'system', content: `Eres el/la Editor/a crítico/a de guiones de un canal de YouTube. Eres implacable: tu trabajo es encontrar lo que haría que alguien deslice el video y arreglarlo. Evalúas gancho (¿se entiende en un segundo? ¿es una pregunta intrigante o un hecho increíble, de máximo 14 palabras, que saldrá como titular gigante en pantalla? Si cumple eso, merece 7 o más aunque no lleve cifra: solo baja de 7 si es descriptivo, largo o aburrido. Sé exigente pero JUSTO: no castigues lo que el material no permite), ritmo (frases cortas, nada de relleno), claridad para gente normal y fuerza del cierre. Reglas duras: NO agregues datos nuevos ni cifras; solo recorta, reordena y mejora la redacción de lo que ya está. Mantén "Sabías que" al inicio, la frase final exacta "${CTA}" y la revelación entre el 65 % y el 75 %. Cada escena debe poder mostrarse con un cambio de imagen cada 3 segundos: frases de máximo 18 palabras. Responde SOLO con JSON.`},
  {role: 'user', content: `TÍTULO: ${titulo}\nGUION:\n${JSON.stringify(escenas)}\n\nDevuelve: {"puntaje": número del 0 al 10 del guion ORIGINAL, "critica": "máximo 3 frases, directas y duras", "titulo": "título mejorado, máx. 90 caracteres, con un emoji", "escenas": [versión mejorada, mismo formato]}.`},
];
const verificador = (material, escenas) => [
  {role: 'system', content: `Eres el/la Verificador/a, auditor/a estricto/a de datos, con maestría en verificación de fuentes y lectura crítica. Tu trabajo es rechazar. Si una frase afirma un dato (fecha, cifra, lugar, causa, nombre, relación) que no está literalmente respaldado por el MATERIAL, la marcas. Las opiniones y las frases de enlace no cuentan. Nunca apruebas por cortesía: si no puedes comprobarlo, lo reportas. Además, lista en "nombres_de_personas" los nombres propios de personas reales que aparezcan en el GUION A REVISAR (solo en el guion, nunca en el material; no cuentes lugares, barcos, libros ni objetos). Si el guion no nombra a ninguna persona, deja la lista vacía. Responde SOLO con JSON: {"aprobado": true|false, "problemas": [{"frase": "...", "motivo": "..."}], "nombres_de_personas": []}.`},
  {role: 'user', content: `MATERIAL:\n${material}\n\nGUION A REVISAR (frase por frase):\n${escenas.map((e, i) => `${i + 1}. ${e.texto}`).join('\n')}`},
];

/* ====================== Escenógrafo: fondos de cada escena ====================== */
const CATALOGO = {
  pixelmisterio: 'fondo de misterio general (sin parámetro)',
  pixelcifra: 'número grande con texto; parámetro "NUMERO|subtexto|tono" (tono: rojo, azul, oro, teal, mint)',
  pixeldocs: 'documentos y archivos (sin parámetro)',
  pixelsonar: 'sonar y ondas de sonido bajo el agua (sin parámetro)',
  pixelartico: 'paisaje helado (sin parámetro)',
  pixelavion: 'avión (sin parámetro)',
  pixelciudad: 'ciudad de noche (sin parámetro)',
  pixelrascacielos: 'rascacielos al atardecer; parámetro opcional: texto corto',
  pixelbanco: 'fachada de banco con bóveda; parámetro opcional: texto corto',
  pixelgrafica: 'gráfica que sube o cae; parámetro "TITULO|sube", "TITULO|cae" o "TITULO|duda"',
  pixeljuicio: 'juzgado con mazo y balanza; parámetro opcional: texto corto',
  pixelfantasmas: 'cientos de figuras fantasma que se desvanecen; parámetro "TITULO" o "TITULO|fade"',
  pixelbarcoderiva: 'velero en el mar al atardecer; parámetro opcional: texto corto',
  pixelcubierta: 'cubierta vacía de un barco de noche; parámetro opcional: texto corto',
  pixelbodega: 'bodega de barco con barriles; parámetro opcional: texto corto',
  pixelpremio: 'escenario con foco y trofeo; parámetro opcional: texto corto',
};
const limpiarParametro = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ñ/gi, 'n').toUpperCase().replace(/[^A-Z0-9 .,+%|:'-]/g, '').slice(0, 40).trim();
const escenografo = (escenas) => [
  {role: 'system', content: `Eres el/la Escenógrafo/a de un canal de misterio. Para cada escena eliges de 2 a ${FORMATO === 'largo' ? 4 : 3} fondos del CATÁLOGO que muestren visualmente lo que se dice (el espectador debe ver algo distinto cada 3 segundos). Usa solo nombres del catálogo, sin inventar. Si el catálogo no tiene nada que encaje EXACTAMENTE con lo que dice la escena, usa "pixelmisterio": un fondo que no encaja es peor que uno neutro. Nunca uses un barco para hablar de nieve ni un banco para hablar de sonidos. Responde SOLO con JSON.`},
  {role: 'user', content: `CATÁLOGO:\n${Object.entries(CATALOGO).map(([k, v]) => `- ${k}: ${v}`).join('\n')}\n\nESCENAS:\n${escenas.map((e, i) => `${i}. [${e.tipo}] ${e.texto}`).join('\n')}\n\nDevuelve: {"fondos": [["pixelmisterio", "pixelcifra:4 MILLONES|DE CLIENTES|oro"], ...]} con una lista por escena, en el mismo orden (${escenas.length} listas). Los textos de los parámetros en MAYÚSCULAS, sin tildes ni ñ.`},
];
/** Fondos que solo tienen sentido si la escena habla de eso. */
const SOLO_SI = {
  pixelbanco: /banco|bóveda|boveda|dinero|dólares|dolares/i,
  pixeljuicio: /juez|tribunal|condena|juicio|cárcel|carcel|acusa|culpable/i,
  pixelrascacielos: /empresa|fundador|fundadora|startup|negocio|ciudad/i,
  pixelfantasmas: /clientes|usuarios|seguidores|personas que no existían/i,
  pixelbarcoderiva: /barco|buque|velero|navío|navio|bergantín|bergantin|océano|oceano|mar\b/i,
  pixelcubierta: /barco|buque|velero|navío|navio|bergantín|bergantin|cubierta/i,
  pixelbodega: /barril|bodega|carga|cargamento/i,
  pixelpremio: /premio|lista|elegid|trofeo/i,
  pixelgrafica: /sube|baja|cae|cifra|porcentaje|crec|decre|número|numero/i,
  pixelavion: /avión|avion|vuelo|aeronave/i,
  pixelartico: /ártico|artico|hielo|polo|nieve|helad|glaciar|montaña|montana/i,
  pixelsonar: /sonido|ruido|señal|senal|ondas|submarin|micrófono|microfono|zumbido/i,
  pixelciudad: /ciudad|calle|edificio/i,
};
const validarFondos = (propuesta, total, escenas) => {
  const salida = [];
  for (let i = 0; i < total; i++) {
    const lista = Array.isArray(propuesta?.[i]) ? propuesta[i] : [];
    const buenos = lista
      .map((f) => String(f))
      .map((f) => { const [id, ...resto] = f.split(':'); return {id: id.trim(), param: limpiarParametro(resto.join(':'))}; })
      .filter((f) => CATALOGO[f.id])
      .filter((f) => !SOLO_SI[f.id] || SOLO_SI[f.id].test(escenas?.[i]?.texto ?? ''))
      .slice(0, FORMATO === 'largo' ? 4 : 3)
      .map((f) => (f.param ? `${f.id}:${f.param}` : f.id));
    salida.push(buenos.length ? buenos : ['pixelmisterio']);
  }
  return salida;
};

/* ====================== Comprobaciones propias (sin IA) ====================== */
const palabrasDe = (e) => e.texto.split(/\s+/).filter(Boolean).length;
const comprobar = (escenas) => {
  const p = [];
  if (!/^Sabías que/.test(escenas[0]?.texto ?? '')) p.push({frase: escenas[0]?.texto ?? '', motivo: 'La primera frase debe empezar con "Sabías que".'});
  const ultima = escenas[escenas.length - 1]?.texto ?? '';
  if (!ultima.includes(CTA)) p.push({frase: ultima, motivo: `Falta la frase de cierre exacta: "${CTA}"`});
  const total = escenas.reduce((s, e) => s + palabrasDe(e), 0);
  const i = escenas.findIndex((e) => e.tipo === 'revelacion');
  if (i < 0) p.push({frase: '', motivo: 'No hay escena de revelación.'});
  else {
    const antes = escenas.slice(0, i).reduce((s, e) => s + palabrasDe(e), 0);
    const pct = Math.round((antes / total) * 100);
    if (pct < 60 || pct > 78) p.push({frase: escenas[i].texto, motivo: `La revelación cae al ${pct} % (${antes} de ${total} palabras antes de ella) y debe caer entre 65 % y 75 %: añade historia antes de la revelación o acórtala.`});
  }
  return p;
};
/** Titular de los primeros segundos: la frase del hook sin "Sabías que", en pregunta corta (máx. ~9 palabras). */
const normalizar = (lista) => (lista ?? []).map((e) => ({tipo: ['hook', 'historia', 'revelacion', 'veredicto'].includes(e?.tipo) ? e.tipo : 'historia', texto: String(e?.texto ?? '').trim()})).filter((e) => e.texto);

/* ====================== Flujo ====================== */
const informe = [`# Informe de la oficina · ${CONFIG.nombre} · ${TEMA || 'tema por elegir'} (${FORMATO})`, ''];
try {
  // MODO MANUAL (opcional): si hay un guion esperando tu visto bueno, la oficina no apila otro hasta que respondas
  if (MANUAL.activo && pendientesDeVistoBueno(CANAL_ID).length && !process.env.TEMA) {
    console.log(`Modo manual: "${pendientesDeVistoBueno(CANAL_ID)[0].titulo}" espera tu visto bueno. No se genera otro guion hasta que respondas.`);
    process.exit(0);
  }
  const modelo = await elegirModelo();
  informe.push(`Modelo usado en Groq: ${modelo}`, '');
  if (!TEMA) { TEMA = await elegirTema(modelo); informe[0] = `# Informe de la oficina · ${TEMA} (${FORMATO})`; informe.push('Tema elegido por la oficina.', ''); }
  slug = slugDe(TEMA);
  const fuentes = await investigar();
  if (!fuentes.some((f) => !f.apoyo)) throw new Error(`No encontré el tema "${TEMA}" en Wikipedia (${IDIOMAS.join(', ')}). Pruébalo con el título exacto del artículo.`);
  // INTERNET PARA TODOS: una vez por ciclo se reúne lo que dice la web de hoy y se les da a todos los agentes (Guionista, Editor, Verificador, Titulista, panel, pintores...)
  try {
    const tit = await Promise.race([titulosVirales(TEMA), new Promise((r) => setTimeout(() => r([]), 25000))]);
    const resumenes = fuentes.filter((x) => x.apoyo).map((x) => ({host: String(x.titulo).split(':')[0], texto: x.texto}));
    const bloqueWeb = armarBloqueWeb({tema: TEMA, resumenes, titulos: tit, radarTexto: textoDeRadar(leerJson(path.join(SALIDA, 'radar.json'), null), 2)});
    guardarWeb(CANAL_ID, {tema: TEMA, bloque: bloqueWeb, resumenes: resumenes.length, titulos: tit});
    WEB_BLOQUE = [bloqueWeb, leerPreferencias(CANAL_ID)].filter(Boolean).join(' ');
    if (bloqueWeb) informe.push(`Internet para todos los agentes: ${resumenes.length} resúmenes web y ${tit.length} videos virales de YouTube sobre el tema.`);
  } catch { /* sin internet extra */ }
  informe.push('## Investigación', ...fuentes.map((f) => `- ${f.apoyo ? 'web (apoyo)' : f.idioma}: [${f.titulo}](${f.url})`), '');
  const material = fuentes.map((f) => `### ${f.apoyo ? 'FUENTE DE APOYO (resumen de un buscador web: úsala solo para contrastar fechas y cifras con Wikipedia; si difiere, di las dos versiones)' : 'FUENTE (' + f.idioma + ')'} ${f.url}\n${f.texto}`).join('\n\n');

  let escenas = [], titulo = TEMA, descripcion = '', hashtags = [], problemas = [], aprobado = false, intentos = 0, puntaje = null, critica = '';
  for (let intento = 1; intento <= 4 && !aprobado; intento++) {
    intentos = intento;
    puntaje = null; critica = '';
    const borrador = await pedirJson(modelo, guionista(material, problemas));
    let esc = normalizar(borrador.escenas);
    titulo = borrador.titulo ?? titulo;
    descripcion = borrador.descripcion ?? descripcion;
    hashtags = (Array.isArray(borrador.hashtags) ? borrador.hashtags : []).map((h) => String(h).replace(/\s+/g, '')).filter((h) => /^#\w+$/u.test(h) && !/^#(viral|fyp)$/i.test(h)).slice(0, 5);
    if (esc.length < 3) { problemas = [{frase: '', motivo: 'El guion salió demasiado corto: escribe al menos 5 escenas.'}]; informe.push(`## Intento ${intento}: RECHAZADO`, '- Guion demasiado corto.', ''); continue; }
    // Editor crítico: si su versión rompe las reglas, se queda la del Guionista
    try {
      const ed = await pedirJson(modelo, editor(titulo, esc));
      const mejora = normalizar(ed.escenas);
      puntaje = typeof ed.puntaje === 'number' ? ed.puntaje : puntaje;
      critica = String(ed.critica ?? '').slice(0, 300);
      if (mejora.length >= 3 && comprobar(mejora).length === 0) { esc = mejora; titulo = ed.titulo ?? titulo; }
    } catch (e) { informe.push(`(El Editor no pudo revisar este intento: ${e.message})`); }
    escenas = esc;
    const propios = comprobar(escenas);
    const revision = await pedirJson(modelo, verificador(material, escenas), 1500);
    // Segunda comprobación sin IA: el nombre tiene que estar de verdad en el texto del guion
    const textoGuion = escenas.map((e) => e.texto).join(' ').toLowerCase();
    PROHIBIDOS.push(...(revision.nombres_de_personas ?? []).filter((n) => typeof n === 'string' && n.trim()));
    const nombres = (revision.nombres_de_personas ?? []).filter((n) => typeof n === 'string' && n.trim() && textoGuion.includes(n.trim().toLowerCase()));
    problemas = [...propios, ...(revision.problemas ?? []), ...(nombres.length ? [{frase: nombres.join(', '), motivo: 'El guion nombra a personas reales. Usa su papel ("el líder", "un científico", "el capitán"), aunque el material traiga el nombre.'}] : [])];
    // PUERTA DE CALIDAD: el Editor manda. Mínimo 7/10 (6/10 solo en el último intento); si no, se reescribe con su crítica.
    const GARANTIA = enGarantia(CANAL_ID);
    const umbral = GARANTIA ? (intento >= 2 ? 0 : 5) : intento >= 3 ? 5 : 6; // el gusto del público lo juzga el panel de 8 espectadores (paso 2); el Editor solo exige un mínimo para que la fábrica no se quede sin video // con garantía, desde el 2.º intento la nota del Editor solo aconseja (0 = no bloquea) // con garantía de publicación el estilo se relaja; la verdad nunca
    if (puntaje !== null && puntaje < umbral) problemas.push({frase: '(calidad)', motivo: `El Editor puso ${puntaje}/10 (mínimo ${umbral}). Reescribe arreglando esto: ${critica}`});
    aprobado = problemas.length === 0 && revision.aprobado !== false;
    // PASO 2: el PANEL de 8 espectadores juzga el guion ANTES de hacer la voz y el video, así un rechazo no gasta render. Si lo rechazan, se reescribe con sus críticas.
    CTX.panelGuion = null;
    if (aprobado) {
      try {
        const pv = await evaluarGuionConPanel({llamar: (m) => pedirJson(modelo, m, 2500), guion: {titulo, escenas, publicacion: {titulo, descripcion}}, garantia: GARANTIA, autopsia: leerJson(path.join(SALIDA, 'autopsia.json'), null)});
        CTX.panelGuion = pv;
        informe.push(`Panel de 8 espectadores (guion, intento ${intento}): ${pv.resumen}${pv.mejora ? ' Mejora: ' + pv.mejora : ''}`, ...pv.votos.map((v) => `- ${v.quien}: ${v.leGusto ? 'le gustó' : 'NO le gustó'} · ${v.comentario}`));
        if (!pv.aprobado) {
          problemas.push({frase: '(panel)', motivo: `El panel de 8 espectadores lo rechazó (${pv.resumen}). Lo único que más subiría las vistas: ${pv.mejora}. Reescribe el gancho y el ritmo arreglando esto.`});
          aprobado = false;
          try { // el Guionista aprende de estas críticas en los ciclos siguientes
            const rutaApr = path.join(SALIDA, 'aprendizajes.json');
            fs.writeFileSync(rutaApr, JSON.stringify([{fecha: new Date().toISOString(), video: titulo, mejora: pv.mejora, quejas: pv.votos.filter((v) => !v.leGusto).map((v) => v.comentario).slice(0, 3)}, ...leerJson(rutaApr, [])].slice(0, 12), null, 2));
          } catch { /* sin aprendizajes */ }
        } else { critica = `${critica} Panel: ${pv.resumen}`.trim(); }
      } catch (e) { informe.push(`(El panel no pudo evaluar el guion: ${String(e.message ?? e).slice(0, 120)}. Pasa sin su voto.)`); }
    }
    informe.push(`## Intento ${intento}: ${aprobado ? 'APROBADO' : 'RECHAZADO'}`, critica ? `Editor (${puntaje ?? '?'}/10): ${critica}` : '', ...problemas.map((p) => `- "${p.frase}" → ${p.motivo}`), '');
  }

  // El tema queda anotado (aprobado o no) para que la oficina no lo repita
  fs.writeFileSync(HISTORIAL, JSON.stringify([...new Set([...leerJson(HISTORIAL, []), TEMA])], null, 2));

  let fondos = escenas.map(() => ['pixelmisterio']);
  if (aprobado) {
    try { fondos = validarFondos((await pedirJson(modelo, escenografo(escenas), FORMATO === 'largo' ? 3000 : 1500)).fondos, escenas.length, escenas); }
    catch (e) { informe.push(`(El Escenógrafo no pudo elegir fondos: ${e.message}. Se usa el fondo general.)`); }
  }
  CTX.gancho = {palabrasPrimera: String(escenas[0]?.texto ?? '').split(/\s+/).filter(Boolean).length, escenasConUnFondo: fondos.filter((f) => f.length < 2).length};
  CTX.escenas = escenas.length; CTX.fuentes = fuentes.length; CTX.problemas = problemas; CTX.puntaje = puntaje;
  if (aprobado) {
    try {
      const mesa = await mesaDePublicacion({pedirJson, modelo, textoFinal: escenas.map((e) => e.texto).join(' '), titulo});
      if (mesa) { CTX.mesa = mesa; titulo = mesa.titulo; descripcion = mesa.descripcion; hashtags = mesa.hashtags; }
      else informe.push('(La Mesa de publicación no entregó algo válido: se usa lo del Guionista.)');
    } catch (e) { informe.push('(La Mesa de publicación falló: ' + e.message + '. Se usa lo del Guionista.)'); }
  }
  // IMÁGENES DE CERO: fotos reales de internet por escena (pixeladas a pantalla completa) + los dos pintores añadiendo ambiente (agentes/visuales.mjs)
  if (aprobado && escenas.length) {
    try {
      const v = await crearVisuales({llamar: (m, max) => pedirJson(modelo, m, max), escenas, slug, tema: TEMA, canal: CANAL_ID, nota: (t) => informe.push(t)});
      for (const [i, lista] of Object.entries(v.fondos)) { fondos[Number(i)] = lista; CTX.pintadas++; }
      if (v.creditos) descripcion = `${descripcion}\n\n${v.creditos}`;
      CTX.fotos = v.cobertura;
      informe.push(`Pintores: ${CTX.pintadas} de ${escenas.length} escenas dibujadas.`);
    } catch (e) { informe.push('(Las imágenes no se pudieron generar: ' + e.message + '. Se usa el fondo del catálogo.)'); }
  }
  const sinImagen = aprobado ? fondos.filter((f) => f.every((x) => x === 'pixelmisterio')).length : 0;
  CTX.sinImagen = sinImagen;
  if (sinImagen >= Math.ceil(escenas.length / 2)) {
    notificar('reporte', `Aviso (no necesita tu OK): faltan imágenes para "${TEMA}"`, `${sinImagen} de ${escenas.length} escenas no tienen una imagen que encaje y usarían un fondo neutro. Sigo adelante solo con el fondo neutro; la mejora (pintor de imágenes) está pendiente.`);
    informe.push(`PERMISO PEDIDO: ${sinImagen}/${escenas.length} escenas sin imagen propia.`);
  }
  const palabras = escenas.reduce((s, e) => s + palabrasDe(e), 0);
  informe.push(`Palabras: ${palabras} · Escenas: ${escenas.length}`);
  hashtags = completarHashtags(hashtags, TEMA); // regla fija: SIEMPRE 5 hashtags específicos, aunque la Mesa de publicación haya fallado
  const guion = {
    titulo,
    formato: FORMATO,
    ...(FORMATO === 'largo' ? {orientacion: 'horizontal'} : {}),
    plataforma: 'youtube',
    canal: CANAL_ID,
    voz: CONFIG.voz ?? 'es-DO-EmilioNeural',
    vozGemini: CONFIG.vozGemini ?? 'Sadaltager',
    audio: `audio/${CANAL_ID}-${slug}.wav`,
    musica: CONFIG.musica ?? null,
    personaje: {visible: false}, // FORMATO FACELESS (22 nov 2026): sin personaje ni cara en pantalla, solo voz en off y visuales en movimiento
    creado: new Date().toISOString(),
    estilo: 'gancho', // edición de gancho: titular gigante, cortes rápidos con glitch y escaneo (copia el ritmo de los reels que frenan el dedo, sin cambiar el pixel del canal)
    ganchoTexto: ganchoDe(escenas[0]?.texto),
    publicacion: {titulo, descripcion: `${descripcion}\n\n${CONFIG.ctaEscrito ?? ''}\n\nFuentes: ${fuentes.filter((f) => !f.apoyo).map((f) => f.url).join(' · ')}${CONFIG.enlaceCanal ? `\n\nMás historias en el canal: ${CONFIG.enlaceCanal}` : ''}${hashtags.length ? `\n\n${hashtags.join(' ')}` : ''}`},
    estado: aprobado ? (MANUAL.activo ? ESTADO_ESPERA : 'aprobado') : 'rechazado-necesita-revision',
    editor: {puntaje, critica},
    // el texto que se LEE en voz alta y se ve en los subtítulos sale limpio: sin rangos con guion, horas con dos puntos, comas de miles ni unidades abreviadas
    escenas: escenas.map((e, i) => ({...e, texto: limpiarParaVoz(e.texto), fondo: fondos[i]})),
  };
  if (CTX.mesa) guion.publicacion = {...guion.publicacion, titulosAlternativos: CTX.mesa.titulos, comentarioFijado: CTX.mesa.comentarioFijado, miniatura: CTX.mesa.miniatura};
  fs.writeFileSync(path.join(SALIDA, `guion-${slug}.json`), JSON.stringify(guion, null, 2));
  registrar(aprobado ? 'aprobado' : 'rechazado', aprobado ? `${palabras} palabras, ${escenas.length} escenas.` : (problemas[0]?.motivo ?? 'sin detalle').slice(0, 160), intentos, {editor: puntaje !== null ? `Puntaje: ${puntaje}/10. ${critica}`.slice(0, 200) : '', puntaje: puntaje ?? undefined});
  fs.writeFileSync(path.join(SALIDA, `informe-${slug}.md`), informe.join('\n'));
  console.log(informe.join('\n'));
  if (aprobado && MANUAL.activo) {
    notificar('permiso', `Guion listo para tu visto bueno: ${titulo.slice(0, 70)}`, 'Modo manual: la voz y el render esperan tu respuesta en la oficina (Me gusta, seguir / Pedir cambios / Descartar).');
  }
  // Rechazar un guion es un resultado normal (queda anotado en estado.json); solo un error real hace fallar el flujo.
  if (!aprobado) console.log('El Verificador no aprobó el guion tras 3 intentos. Queda marcado para revisión.');
} catch (e) {
  informe.push('## ERROR', String(e.message ?? e));
  const temaMalo = /No encontré el tema|material suficiente|sin material/i.test(String(e.message ?? e));
  if (temaMalo) {
    // Un tema que no carga NO es un error de la oficina: se descarta y el ciclo prueba con otro.
    try { fs.writeFileSync(HISTORIAL, JSON.stringify([...new Set([...leerJson(HISTORIAL, []), TEMA])], null, 2)); } catch { /* sin historial */ }
    try { registrar('rechazado', `Tema descartado (no se pudo cargar): ${TEMA}`, 0); } catch { /* sin estado */ }
    try { fs.writeFileSync(path.join(SALIDA, `informe-${slug}.md`), informe.join('\n')); } catch { /* sin informe */ }
    console.log(`Tema descartado: ${TEMA}. Se prueba con otro.`);
    process.exit(0);
  }
  try { registrar('error', String(e.message ?? e).slice(0, 160), 0); } catch { /* sin estado */ }
  try { fs.writeFileSync(path.join(SALIDA, `informe-${slug}.md`), informe.join('\n')); } catch { /* sin informe */ }
  fallar(e.message ?? e);
}
