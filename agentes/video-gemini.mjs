// Gemini MIRA el video terminado (imagen y audio) y devuelve una revisión técnica en JSON.
// Usa la Interactions API (la que muestra hoy la documentación). Prueba varios modelos en orden y deja dicho cuál funcionó.
// Si algo falla, devuelve {error} y NUNCA lanza: quien lo llama sigue sin esta revisión.
import fs from 'node:fs';

const BASE = 'https://generativelanguage.googleapis.com';
const MODELOS = (process.env.GEMINI_MODELO_VIDEO ? [process.env.GEMINI_MODELO_VIDEO] : ['gemini-4-hydrogen', 'gemini-3.8-flash', 'gemini-2.5-flash']);
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));

const subirArchivo = async (key, ruta, mime) => {
  const bytes = fs.readFileSync(ruta);
  const ini = await fetch(`${BASE}/upload/v1beta/files`, {
    method: 'POST',
    headers: {'x-goog-api-key': key, 'X-Goog-Upload-Protocol': 'resumable', 'X-Goog-Upload-Command': 'start', 'X-Goog-Upload-Header-Content-Length': String(bytes.length), 'X-Goog-Upload-Header-Content-Type': mime, 'Content-Type': 'application/json'},
    body: JSON.stringify({file: {display_name: 'video-a-revisar'}}),
    signal: AbortSignal.timeout(60000),
  });
  const url = ini.headers.get('x-goog-upload-url');
  if (!ini.ok || !url) throw new Error(`no pude iniciar la subida (${ini.status})`);
  const sub = await fetch(url, {method: 'POST', headers: {'Content-Length': String(bytes.length), 'X-Goog-Upload-Offset': '0', 'X-Goog-Upload-Command': 'upload, finalize'}, body: bytes, signal: AbortSignal.timeout(300000)});
  if (!sub.ok) throw new Error(`falló la subida (${sub.status})`);
  const file = (await sub.json()).file;
  if (!file?.uri || !file?.name) throw new Error('la subida no devolvió el archivo');
  for (let i = 0; i < 40; i++) {
    const e = await (await fetch(`${BASE}/v1beta/${file.name}`, {headers: {'x-goog-api-key': key}, signal: AbortSignal.timeout(30000)})).json();
    if (e.state === 'ACTIVE') return file.uri;
    if (e.state === 'FAILED') throw new Error('Gemini no pudo procesar el video');
    await dormir(5000);
  }
  throw new Error('Gemini tardó demasiado en procesar el video');
};

const textoDe = (j) => {
  const piezas = [];
  if (typeof j.output_text === 'string') piezas.push(j.output_text);
  for (const s of j.steps ?? []) for (const c of s.content ?? []) if (c.type === 'text' && c.text) piezas.push(c.text);
  for (const o of j.outputs ?? []) if (o.type === 'text' && o.text) piezas.push(o.text);
  return piezas.join('\n');
};

export const revisarVideo = async ({ruta, key, contexto = ''}) => {
  if (!key) return {error: 'falta GEMINI_API_KEY'};
  if (!ruta || !fs.existsSync(ruta)) return {error: 'no encuentro el archivo de video'};
  const tam = fs.statSync(ruta).size;
  let video;
  try {
    video = tam < 15 * 1024 * 1024
      ? {type: 'video', data: fs.readFileSync(ruta).toString('base64'), mime_type: 'video/mp4'}
      : {type: 'video', uri: await subirArchivo(key, ruta, 'video/mp4'), mime_type: 'video/mp4'};
  } catch (e) { return {error: `no pude preparar el video: ${e.message}`}; }
  const prompt = `Eres un revisor técnico de videos cortos verticales para TikTok, YouTube Shorts e Instagram. MIRA y ESCUCHA este video completo y revísalo con rigor profesional. ${contexto}\nResponde SOLO con JSON: {"gancho_3s": {"nota": 0-10, "comentario": "qué se ve y qué se oye en los primeros 3 segundos"}, "audio": {"nota": 0-10, "comentario": "voz, ritmo, volumen, música"}, "subtitulos": {"legibles": true|false, "tapados_o_cortados": true|false, "comentario": "..."}, "imagen": {"nota": 0-10, "defectos": ["borroso, distorsionado, plano, repetitivo, texto cortado, etc."]}, "ritmo": {"nota": 0-10, "comentario": "¿cambia lo que se ve cada pocos segundos?"}, "defectos_graves": [SOLO fallos de fondo, lista vacía si no hay], "nota_general": 0-10, "recomendacion": "subir" | "no subir", "por_que": "una frase"}
REGLA DE DEFECTOS GRAVES: escribe en "defectos_graves" ÚNICAMENTE fallos de fondo que impiden publicar: (1) audio ausente, cortado o ininteligible; (2) subtítulos tapados, cortados o ilegibles; (3) imagen negra, congelada, rota o con texto cortado; (4) imágenes que NO tienen relación alguna con lo que se dice (pantallas abstractas o fondos genéricos que no muestran el tema); (5) contenido peligroso o con datos claramente falsos. NO escribas ahí opiniones de calidad, estilo, ritmo, gancho, originalidad ni gustos: de eso se encargan otros 8 revisores. Si no hay fallos de fondo, "defectos_graves" va vacío y "recomendacion" es "subir".`;
  const intentos = [];
  for (const modelo of MODELOS) {
    for (let i = 1; i <= 4; i++) {
      try {
        const r = await fetch(`${BASE}/v1beta/interactions`, {
          method: 'POST', headers: {'x-goog-api-key': key, 'Content-Type': 'application/json'}, signal: AbortSignal.timeout(300000),
          body: JSON.stringify({model: modelo, input: [video, {type: 'text', text: prompt}]}),
        });
        const cuerpo = await r.text();
        if (r.status === 429) { await dormir(((Number(/retry in (\d+)/i.exec(cuerpo)?.[1] ?? 20)) + 2) * 1000); continue; }
        if (!r.ok) {
          // 500/503/504 = Gemini saturado, es temporal: se espera y se reintenta antes de pasar al otro modelo
          if ([500, 502, 503, 504].includes(r.status) && i < 4) { await dormir(i * 30000); continue; }
          intentos.push(`${modelo}: ${r.status} ${cuerpo.replaceAll(key, '***').slice(0, 140)}`); break;
        }
        const txt = textoDe(JSON.parse(cuerpo));
        const m = /\{[\s\S]*\}/.exec(txt.replace(/```json|```/g, ''));
        if (!m) { intentos.push(`${modelo}: respuesta sin JSON`); break; }
        return {modelo, revision: JSON.parse(m[0])};
      } catch (e) { intentos.push(`${modelo}: ${String(e.message).slice(0, 140)}`); break; }
    }
  }
  return {error: `ningún modelo respondió. ${intentos.join(' | ')}`};
};
