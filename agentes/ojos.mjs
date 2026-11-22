// OJOS de los pintores: Gemini MIRA la foto de referencia y la describe para pintores que no ven imágenes
// (composición, paleta de colores reales, dónde está cada elemento y cómo llevarlo al pixel art).
// Usa la misma Interactions API y la misma lista de modelos que la revisión del video. Nunca lanza: si falla devuelve {error}.
import fs from 'node:fs';

const BASE = 'https://generativelanguage.googleapis.com';
const MODELOS = (process.env.GEMINI_MODELO_VIDEO ? [process.env.GEMINI_MODELO_VIDEO] : ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-2.5-flash']);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const HEX = /^#[0-9a-fA-F]{6}$/;

const textoDe = (j) => {
  const piezas = [];
  if (typeof j.output_text === 'string') piezas.push(j.output_text);
  for (const s of j.steps ?? []) for (const c of s.content ?? []) if (c.type === 'text' && c.text) piezas.push(c.text);
  for (const o of j.outputs ?? []) if (o.type === 'text' && o.text) piezas.push(o.text);
  return piezas.join('\n');
};

/** Limpia la respuesta de Gemini a una forma segura y corta (va dentro del encargo de los pintores). */
export const limpiarVista = (v) => {
  if (!v || typeof v !== 'object') return null;
  const t = (x, n) => String(x ?? '').replace(/\s+/g, ' ').trim().slice(0, n);
  const num = (x) => Math.min(1, Math.max(0, Number(x) || 0));
  const paleta = (Array.isArray(v.paleta) ? v.paleta : []).filter((c) => typeof c === 'string' && HEX.test(c)).slice(0, 6);
  const elementos = (Array.isArray(v.elementos) ? v.elementos : []).slice(0, 6).map((e) => ({que: t(e?.que, 60), x: num(e?.x), y: num(e?.y), w: num(e?.w), h: num(e?.h)})).filter((e) => e.que);
  const o = {sujeto: t(v.sujeto, 140), composicion: t(v.composicion, 220), paleta, elementos, consejo: t(v.consejo_pixel ?? v.consejo, 220)};
  return o.sujeto || o.elementos.length ? o : null;
};

export const textoDeVista = (v) => !v ? '' : [
  `Lo que se ve en la foto: ${v.sujeto}.`,
  v.composicion ? `Composición: ${v.composicion}.` : '',
  v.paleta.length ? `Paleta real: ${v.paleta.join(' ')}.` : '',
  v.elementos.length ? `Elementos (x,y,ancho,alto de 0 a 1): ${v.elementos.map((e) => `${e.que} (${e.x.toFixed(2)},${e.y.toFixed(2)},${e.w.toFixed(2)},${e.h.toFixed(2)})`).join('; ')}.` : '',
  v.consejo ? `Cómo llevarlo al pixel art: ${v.consejo}.` : '',
].filter(Boolean).join(' ');

/** Gemini mira UNA foto (ruta local jpg/png) pensando en la frase de la escena. Devuelve {modelo, vista} o {error}. */
export const mirarFoto = async ({ruta, key, frase = '', modo = 'foto', maxIntentos = 2, hasta = 0}) => {
  if (!key) return {error: 'falta GEMINI_API_KEY'};
  if (!ruta || !fs.existsSync(ruta)) return {error: 'no encuentro la foto'};
  const bytes = fs.readFileSync(ruta);
  if (bytes.length > 4 * 1024 * 1024) return {error: 'la foto pesa demasiado'};
  const mime = bytes.subarray(0, 4).toString('hex') === '89504e47' ? 'image/png' : 'image/jpeg';
  const PROMPT_ESTILO = `Eres los ojos de dos pintores de pixel art que NO pueden ver imágenes. Mira este EJEMPLO de pixel art (de otro artista, solo para inspirarse: no se copia). Cuéntales qué hace bien para que apliquen esas IDEAS a su propio cuadro sobre "${String(frase).slice(0, 120)}". Responde SOLO con JSON: {"sujeto": "qué muestra el ejemplo, en una frase", "composicion": "cómo reparte fondo, plano medio y primer plano y hacia dónde va la luz", "paleta": ["#rrggbb", ... 4 a 6 colores dominantes, de oscuro a claro], "elementos": [{"que": "recurso visual que usa (tramado, contorno, brillo, capas con parallax, niebla, reflejo, etc.)", "x": 0.5, "y": 0.5, "w": 0.2, "h": 0.2}, ... máximo 4], "consejo_pixel": "la idea más aprovechable para un cuadro nuevo, en una frase"}. No nombres personas reales ni describas caras.`;
  const prompt = modo === 'estilo' ? PROMPT_ESTILO : `Eres los ojos de dos pintores de pixel art que NO pueden ver imágenes. Mira esta foto de referencia, que acompaña la frase: "${String(frase).slice(0, 220)}". Descríbesela con precisión para que la dibujen en pixel art. Responde SOLO con JSON: {"sujeto": "qué se ve, en una frase", "composicion": "dónde está lo principal, planos, dirección de la luz", "paleta": ["#rrggbb", ... de 4 a 6 colores dominantes reales de la foto, de oscuro a claro], "elementos": [{"que": "elemento clave", "x": 0-1, "y": 0-1, "w": 0-1, "h": 0-1}, ... máximo 6, con su caja aproximada: x,y es la esquina superior izquierda], "consejo_pixel": "cómo simplificarlo a pixel art con 3 planos de profundidad"}. No nombres personas reales ni describas caras.`;
  const fallos = [];
  const queda = () => (hasta ? hasta - Date.now() : Infinity); // tiempo que queda del presupuesto (ms)
  for (const modelo of MODELOS) {
    for (let i = 1; i <= maxIntentos; i++) {
      if (queda() < 5000) return {error: `Gemini no pudo mirar la foto: se acabó el tiempo asignado. ${fallos.join(' | ')}`};
      try {
        const r = await fetch(`${BASE}/v1beta/interactions`, {
          method: 'POST', headers: {'x-goog-api-key': key, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(Math.max(5000, Math.min(60000, queda()))),
          body: JSON.stringify({model: modelo, input: [{type: 'image', data: bytes.toString('base64'), mime_type: mime}, {type: 'text', text: prompt}]}),
        });
        const cuerpo = await r.text();
        if (r.status === 429) {
          if (i < maxIntentos) await dormir(Math.max(0, Math.min(queda() - 5000, ((Number(/retry in (\d+)/i.exec(cuerpo)?.[1] ?? 15)) + 2) * 1000)));
          else fallos.push(`${modelo}: 429 sin cuota`);
          continue;
        }
        if (!r.ok) {
          if ([500, 502, 503, 504].includes(r.status) && i < maxIntentos) { await dormir(Math.min(queda() - 5000, i * 20000)); continue; }
          fallos.push(`${modelo}: ${r.status} ${cuerpo.replaceAll(key, '***').slice(0, 120)}`); break;
        }
        const m = /\{[\s\S]*\}/.exec(textoDe(JSON.parse(cuerpo)).replace(/```json|```/g, ''));
        if (!m) { fallos.push(`${modelo}: respuesta sin JSON`); break; }
        const vista = limpiarVista(JSON.parse(m[0]));
        if (!vista) { fallos.push(`${modelo}: descripción vacía`); break; }
        return {modelo, vista};
      } catch (e) { fallos.push(`${modelo}: ${String(e.message).slice(0, 120)}`); break; }
    }
  }
  return {error: `Gemini no pudo mirar la foto. ${fallos.join(' | ')}`};
};
