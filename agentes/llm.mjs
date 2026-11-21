// Respaldo de modelos: si Groq se queda sin cuota, la oficina pasa sola a otros proveedores GRATIS (los que tengan llave en los secretos).
// Todos usan el formato "compatible con OpenAI". El modelo se elige solo: se pregunta a cada proveedor qué modelos tiene y se toma el mejor
// de una lista de preferencias. Si ningún proveedor tiene llave, devuelve null y todo sigue como antes. Nunca imprime llaves.
const PROVEEDORES = [
  {nombre: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', clave: 'GEMINI_API_KEY', prefiere: [/gemini-.*flash(?!.*(lite|tts|image|live|preview-tts))/i, /gemini-.*flash/i], descarta: /tts|image|embed|live|audio/i},
  {nombre: 'Cerebras', base: 'https://api.cerebras.ai/v1', clave: 'CEREBRAS_API_KEY', prefiere: [/gpt-oss/i, /llama.*70b/i, /qwen.*(235|32)b/i, /llama/i]},
  {nombre: 'OpenRouter', base: 'https://openrouter.ai/api/v1', clave: 'OPENROUTER_API_KEY', prefiere: [/(llama-3\.3-70b|gpt-oss-120b|qwen3.*235b|deepseek).*:free$/i, /:free$/i], soloGratis: true},
  {nombre: 'GitHub Models', base: 'https://models.github.ai/inference', catalogo: 'https://models.github.ai/catalog/models', clave: 'GITHUB_TOKEN', cabeceras: {'X-GitHub-Api-Version': '2022-11-28', Accept: 'application/vnd.github+json'}, prefiere: [/gpt-4\.1$/i, /gpt-4o$/i, /llama.*70b/i, /gpt-4\.1-mini/i, /mini/i], descarta: /embed|nano|vision|o1|o3|o4/i},
  {nombre: 'Mistral', base: 'https://api.mistral.ai/v1', clave: 'MISTRAL_API_KEY', prefiere: [/mistral-large/i, /mistral-medium/i, /mistral-small/i], descarta: /embed|ocr|moderation|codestral-embed/i},
  {nombre: 'Cloudflare', base: null, clave: 'CLOUDFLARE_API_TOKEN', cuenta: 'CLOUDFLARE_ACCOUNT_ID', prefiere: [/llama-3\.3-70b/i, /gpt-oss/i, /llama/i]},
];
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const modelos = new Map();

const elegirModelo = async (p, key) => {
  if (modelos.has(p.nombre)) return modelos.get(p.nombre);
  let m = null;
  try {
    const r = await fetch(p.catalogo ?? `${p.base}/models`, {headers: {Authorization: `Bearer ${key}`, ...(p.cabeceras ?? {})}, signal: AbortSignal.timeout(20000)});
    if (r.ok) {
      const j = await r.json();
      const ids = (Array.isArray(j) ? j : (j.data ?? [])).map((x) => String(x.id ?? x.name ?? '').replace(/^models\//, '')).filter((x) => x && !(p.descarta?.test(x)));
      for (const re of p.prefiere) { m = ids.find((x) => re.test(x)); if (m) break; }
    }
  } catch { /* sin lista */ }
  modelos.set(p.nombre, m);
  return m;
};

/** Pide una respuesta a los proveedores de respaldo, en orden. Devuelve {texto, proveedor, modelo} o null. */
export const chatAlternativo = async (mensajes, {maxTokens = 2500, temperatura = 0.4} = {}) => {
  for (const p of PROVEEDORES) {
    const key = (process.env[p.clave] || '').trim();
    if (!key || p.nombre === 'Cloudflare') continue; // Cloudflare usa otra ruta: se añade si hace falta
    const modelo = await elegirModelo(p, key);
    if (!modelo) continue;
    for (let i = 1; i <= 2; i++) {
      try {
        const r = await fetch(`${p.base}/chat/completions`, {
          method: 'POST', headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(p.cabeceras ?? {})}, signal: AbortSignal.timeout(120000),
          body: JSON.stringify({model: modelo, messages: mensajes, temperature: temperatura, max_tokens: maxTokens}),
        });
        if (r.status === 429 || r.status >= 500) { await dormir(4000 * i); continue; }
        if (!r.ok) break;
        const texto = (await r.json()).choices?.[0]?.message?.content ?? '';
        if (texto.trim()) return {texto, proveedor: p.nombre, modelo};
      } catch { await dormir(3000 * i); }
    }
  }
  return null;
};

export const proveedoresConLlave = () => PROVEEDORES.filter((p) => (process.env[p.clave] || '').trim() && p.nombre !== 'Cloudflare').map((p) => p.nombre);

/** Modelos de Groq que esta cuenta SÍ tiene, en orden de preferencia. Nunca devuelve una lista vacía. */
export const modelosDisponibles = async (key, base = 'https://api.groq.com/openai/v1') => {
  const preferidos = ['openai/gpt-oss-20b', 'llama-3.3-70b-versatile', 'qwen/qwen3-32b', 'meta-llama/llama-4-scout-17b-16e-instruct', 'openai/gpt-oss-120b'];
  try {
    const r = await fetch(`${base}/models`, {headers: {Authorization: `Bearer ${key}`}, signal: AbortSignal.timeout(20000)});
    if (r.ok) {
      const ids = ((await r.json()).data ?? []).map((x) => x.id);
      const buenos = preferidos.filter((m) => ids.includes(m));
      if (buenos.length) return buenos;
    }
  } catch { /* sin lista */ }
  return ['openai/gpt-oss-120b'];
};
