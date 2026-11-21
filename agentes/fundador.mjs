// Fundador de canales: recibe un PEDIDO (nombre, de qué trata, idioma) y deja el canal listo dentro de la oficina:
// configuración (voz, tono, reglas, frase de cierre), carpeta propia, plan completo (nombre, descripción, palabras clave, hashtags,
// prompts de avatar y banner, calendario de temas) y una notificación con los pasos que SOLO puede hacer una persona
// (abrir la cuenta y el canal en YouTube: pide identidad y verificación, la oficina no puede).
// Los pedidos son archivos oficina-salida/pedidos/*.json (los crea el botón "Nuevo canal" de la oficina 3D).
// Variables: GROQ_API_KEY. Lo ejecuta fundador.yml cuando llega un pedido.
import fs from 'node:fs';
import path from 'node:path';
import {avisarTelefono} from './aviso.mjs';

const KEY = process.env.GROQ_API_KEY;
const CONFIG_RUTA = path.join('agentes', 'canales-propios.json');
const PEDIDOS = path.join('oficina-salida', 'pedidos');
const leer = (ruta, d) => { try { return JSON.parse(fs.readFileSync(ruta, 'utf8')); } catch { return d; } };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const slug = (t) => String(t).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, '').slice(0, 14) || 'canal';

// Voces en español que el sistema ya conoce (ver scripts/voz.mjs). Para otros idiomas la voz queda marcada como pendiente.
const VOCES_ES = ['es-MX-JorgeNeural', 'es-DO-EmilioNeural', 'es-ES-AlvaroNeural', 'es-US-AlonsoNeural', 'es-CO-GonzaloNeural', 'es-AR-TomasNeural'];

const notificar = (canal, nombre, tipo, titulo, texto) => {
  avisarTelefono(tipo, titulo, texto);
  const ruta = path.join('oficina-salida', 'notificaciones.json');
  const lista = leer(ruta, []);
  lista.unshift({id: Date.now().toString(36) + Math.random().toString(36).slice(2, 6), fecha: new Date().toISOString(), canal, canalNombre: nombre, tipo, titulo, texto});
  fs.mkdirSync(path.dirname(ruta), {recursive: true});
  fs.writeFileSync(ruta, JSON.stringify(lista.slice(0, 80), null, 2));
};

const groq = async (mensajes) => {
  let ultimo = '';
  for (let i = 1; i <= 6; i++) {
    try {
      const r = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json'},
        signal: AbortSignal.timeout(120000),
        body: JSON.stringify({model: 'openai/gpt-oss-120b', temperature: 0.5, max_tokens: 3500, reasoning_effort: 'low', messages: mensajes}),
      });
      if (r.status === 429) { const t = await r.text(); await dormir((Number(/try again in ([\d.]+)s/i.exec(t)?.[1] ?? 20) + 2) * 1000); ultimo = '429'; continue; }
      if (!r.ok) throw new Error(`Groq ${r.status}: ${(await r.text()).slice(0, 200)}`);
      const texto = (await r.json()).choices?.[0]?.message?.content ?? '';
      const a = texto.indexOf('{'), b = texto.lastIndexOf('}');
      if (a < 0 || b < 0) { ultimo = 'sin JSON'; continue; }
      return JSON.parse(texto.slice(a, b + 1));
    } catch (e) { ultimo = String(e.message ?? e); await dormir(3000 * i); }
  }
  throw new Error(`Groq no respondió con un plan válido (${ultimo}).`);
};

if (!KEY) { console.error('Falta GROQ_API_KEY.'); process.exit(1); }
fs.mkdirSync(PEDIDOS, {recursive: true});
const pendientes = fs.readdirSync(PEDIDOS).filter((f) => f.endsWith('.json') && !f.endsWith('.hecho.json'));
if (!pendientes.length) { console.log('No hay pedidos de canal nuevo.'); process.exit(0); }

let fallos = 0;
for (const archivo of pendientes) {
  const ruta = path.join(PEDIDOS, archivo);
  const pedido = leer(ruta, null);
  try {
    if (!pedido?.nombre || !pedido?.nicho) throw new Error('El pedido no trae nombre y de qué trata.');
    const nombre = String(pedido.nombre).trim().slice(0, 60);
    const nicho = String(pedido.nicho).trim().slice(0, 300);
    const idioma = String(pedido.idioma || 'es').trim().slice(0, 5);
    const config = leer(CONFIG_RUTA, {canales: []});
    let id = slug(nombre);
    while (config.canales.some((c) => c.id === id)) id = `${id}${Math.floor(Math.random() * 90 + 10)}`;

    const plan = await groq([
      {role: 'system', content: 'Eres el/la Fundador/a de canales de YouTube: estratega de contenido con maestría en nichos, retención de audiencia y marca. Diseñas canales realistas, sin prometer resultados ni cifras. Respondes SOLO con JSON.'},
      {role: 'user', content: `Diseña desde cero un canal de YouTube.\nNombre pedido: "${nombre}"\nDe qué trata: ${nicho}\nIdioma: ${idioma}\n\nDevuelve JSON: {"nicho": "una frase clara del nicho para guiar a los guionistas", "tono": "una frase con el tono (ej: 'Tono cercano y curioso.')", "cta": "frase hablada de cierre que invite a compartir y seguir", "ctaEscrito": "la misma frase escrita para la descripción", "descripcionCanal": "texto 'Acerca de' de máx. 600 caracteres, sin promesas", "palabrasClave": ["10 palabras clave"], "hashtagsBase": ["5 hashtags específicos del nicho; nunca #viral ni #fyp"], "nombresAlternativos": ["3 nombres posibles por si el pedido no está disponible"], "promptAvatar": "descripción para generar el avatar (imagen cuadrada)", "promptBanner": "descripción para generar el banner (2048x1152)", "temasIniciales": ["14 títulos exactos de artículos de Wikipedia en inglés para los primeros videos, sin personas, con mucha documentación"], "reglas": ["5 reglas de contenido propias de este canal"]}.`},
    ]);

    const voz = idioma.startsWith('es') ? VOCES_ES[0] : VOCES_ES[0];
    const nota = idioma.startsWith('es') ? '' : ' La voz queda en español (es-MX-JorgeNeural) hasta que se elija una voz de ' + idioma + '.';
    const canal = {
      id, nombre, nicho: String(plan.nicho ?? nicho).slice(0, 300), tono: String(plan.tono ?? 'Tono cercano y curioso.'), idioma,
      idiomasFuente: idioma.startsWith('es') ? ['es', 'en'] : [idioma, 'en'], voz,
      cta: String(plan.cta ?? 'Comparte este video con alguien a quien le guste, sígueme.'), ctaEscrito: String(plan.ctaEscrito ?? plan.cta ?? ''),
      musica: null, enlaceCanal: '', activo: true, vigilar: [], creado: new Date().toISOString(), estadoYouTube: 'pendiente de crear',
    };
    config.canales.push(canal);
    fs.writeFileSync(CONFIG_RUTA, JSON.stringify(config, null, 2));

    const dir = path.join('oficina-salida', id);
    fs.mkdirSync(dir, {recursive: true});
    fs.writeFileSync(path.join(dir, 'estado.json'), JSON.stringify({actualizado: new Date().toISOString(), totales: {aprobados: 0, rechazados: 0, errores: 0}, historial: [], agentes: {'Directora de contenido': {estado: 'libre', actividad: 'hablando', tarea: `Canal nuevo "${nombre}" listo en la oficina. Primer ciclo en el próximo horario. JEFA: quiero el primer guion aprobado hoy.`}}}, null, 2));
    fs.writeFileSync(path.join(dir, 'historial.json'), '[]');
    const md = [
      `# Plan del canal: ${nombre}`, '', `Creado por la oficina el ${new Date().toISOString().slice(0, 10)}. Identificador interno: \`${id}\`.`, '',
      '## De qué trata', canal.nicho, '', '## Descripción del canal (pegar en "Acerca de")', String(plan.descripcionCanal ?? ''), '',
      '## Palabras clave', (plan.palabrasClave ?? []).join(', '), '', '## Hashtags base', (plan.hashtagsBase ?? []).join(' '), '',
      '## Nombres alternativos (si el pedido no está disponible)', ...(plan.nombresAlternativos ?? []).map((n) => `- ${n}`), '',
      '## Avatar (prompt)', String(plan.promptAvatar ?? ''), '', '## Banner 2048x1152 (prompt)', String(plan.promptBanner ?? ''), '',
      '## Reglas del canal', ...(plan.reglas ?? []).map((r) => `- ${r}`), '', '## Primeros 14 temas (artículos de Wikipedia)', ...(plan.temasIniciales ?? []).map((t) => `- ${t}`), '',
      '## Lo que SOLO puedes hacer tú', '1. Entrar a YouTube con la cuenta de Google que quieras y crear el canal con el nombre de arriba.', '2. Poner avatar, banner y la descripción.', '3. Para que la oficina pueda subir videos solos: crear los secretos `YT_CLIENT_ID`, `YT_CLIENT_SECRET` y `YT_REFRESH_TOKEN_' + id.toUpperCase() + '` (ver LEEME-OFICINA.md).', '4. Poner el enlace del canal en `enlaceCanal` de `agentes/canales-propios.json`.', nota ? `\nNota:${nota}` : '',
    ].join('\n');
    fs.writeFileSync(path.join(dir, 'PLAN.md'), md);
    notificar(id, nombre, 'listo', `Canal nuevo: ${nombre}`, `Quedó listo dentro de la oficina y ya entra en los próximos ciclos. Plan completo en oficina-salida/${id}/PLAN.md. Falta lo que solo puedes hacer tú: crear la cuenta y el canal en YouTube con ese nombre.${nota}`);
    fs.renameSync(ruta, path.join(PEDIDOS, archivo.replace(/\.json$/, '.hecho.json')));
    console.log(`Canal creado: ${nombre} (${id})`);
  } catch (e) {
    fallos++;
    console.error(`Pedido ${archivo}:`, e.message ?? e);
    notificar('oficina', 'Oficina', 'alerta', 'No pude crear el canal', `${e.message ?? e} El pedido sigue pendiente (${archivo}).`);
  }
}
process.exit(fallos ? 1 : 0);
