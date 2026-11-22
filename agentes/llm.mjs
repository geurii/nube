// Respaldo de modelos: si Groq se queda sin cuota, la oficina pasa sola a otros proveedores GRATIS (los que tengan llave en los secretos).
// Todos usan el formato "compatible con OpenAI". El modelo se elige solo: se pregunta a cada proveedor qué modelos tiene y se toma el mejor
// de una lista de preferencias. Si ningún proveedor tiene llave, devuelve null y todo sigue como antes. Nunca imprime llaves.
const PROVEEDORES = [
  {nombre: 'Cerebras', base: 'https://api.cerebras.ai/v1', clave: 'CEREBRAS_API_KEY', prefiere: [/gpt-oss/i, /llama.*70b/i, /qwen.*(235|32)b/i, /llama/i]},
  {nombre: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', clave: 'GEMINI_API_KEY', prefiere: [/gemini-.*flash(?!.*(lite|tts|image|live|preview-tts))/i, /gemini-.*flash/i], descarta: /tts|image|embed|live|audio/i},
  {nombre: 'OpenRouter', base: 'https://openrouter.ai/api/v1', clave: 'OPENROUTER_API_KEY', prefiere: [/(llama-3\.3-70b|gpt-oss-120b|qwen3.*235b|deepseek).*:free$/i, /:free$/i], soloGratis: true},
  {nombre: 'GitHub Models', base: 'https://models.github.ai/inference', catalogo: 'https://models.github.ai/catalog/models', clave: 'GITHUB_TOKEN', cabeceras: {'X-GitHub-Api-Version': '2022-11-28', Accept: 'application/vnd.github+json'}, prefiere: [/gpt-4\.1$/i, /gpt-4o$/i, /llama.*70b/i, /gpt-4\.1-mini/i, /mini/i], descarta: /embed|nano|vision|o1|o3|o4/i},
  {nombre: 'Mistral', base: 'https://api.mistral.ai/v1', clave: 'MISTRAL_API_KEY', prefiere: [/mistral-large/i, /mistral-medium/i, /mistral-small/i], descarta: /embed|ocr|moderation|codestral-embed/i},
  {nombre: 'Cloudflare', base: null, clave: 'CLOUDFLARE_API_TOKEN', cuenta: 'CLOUDFLARE_ACCOUNT_ID', prefiere: [/llama-3\.3-70b/i, /gpt-oss/i, /llama/i]},
];
export const diagnosticoRespaldo = [];
const nota = (t) => { console.log(t); diagnosticoRespaldo.push(t); };
const dormir = (ms) => new Promise((r) => setTimeout(r, ms));
const modelos = new Map();

const elegirModelos = async (p, key) => {
  if (modelos.has(p.nombre)) return modelos.get(p.nombre);
  const lista = [];
  try {
    const r = await fetch(p.catalogo ?? `${p.base}/models`, {headers: {Authorization: `Bearer ${key}`, ...(p.cabeceras ?? {})}, signal: AbortSignal.timeout(20000)});
    if (r.ok) {
      const j = await r.json();
      const ids = (Array.isArray(j) ? j : (j.data ?? [])).map((x) => String(x.id ?? x.name ?? '').replace(/^models\//, '')).filter((x) => x && !(p.descarta?.test(x)));
      for (const re of p.prefiere) for (const x of ids) if (re.test(x) && !lista.includes(x)) lista.push(x);
    }
  } catch { /* sin lista */ }
  const r = lista.slice(0, 4);
  modelos.set(p.nombre, r);
  return r;
};

/** Pide una respuesta a los proveedores de respaldo, en orden. Devuelve {texto, proveedor, modelo} o null. */
// Balance entre proveedores: el que acaba de funcionar va primero; el que da límite (429) descansa un rato y se vuelve a usar solo.
const bloqueadoHasta = new Map();
let ultimoBueno = null;
const ordenados = () => {
  const ahora = Date.now();
  const libres = PROVEEDORES.filter((p) => (bloqueadoHasta.get(p.nombre) ?? 0) <= ahora);
  const orden = [...libres.filter((p) => p.nombre === ultimoBueno), ...libres.filter((p) => p.nombre !== ultimoBueno)];
  return orden.length ? orden : PROVEEDORES; // si todos descansan, se prueban igual
};
const descansar = (nombre, r) => {
  const espera = Number(r.headers?.get?.('retry-after')) || 60;
  bloqueadoHasta.set(nombre, Date.now() + Math.min(Math.max(espera, 45), 1800) * 1000);
};
export const chatAlternativo = async (mensajes, {maxTokens = 2500, temperatura = 0.4, json = false} = {}) => {
  for (const p of ordenados()) {
    const key = (process.env[p.clave] || '').trim();
    if (!key || p.nombre === 'Cloudflare') continue;
    const lista = await elegirModelos(p, key);
    if (!lista.length) { nota(`${p.nombre}: sin modelo`); continue; }
    let fallos = 0;
    for (const modelo of lista) {
      if (fallos >= 2) { descansar(p.nombre, {}); break; } // proveedor lento o caído: se pasa al siguiente sin perder minutos
      try {
        const r = await fetch(`${p.base}/chat/completions`, {
          method: 'POST', headers: {Authorization: `Bearer ${key}`, 'Content-Type': 'application/json', ...(p.cabeceras ?? {})}, signal: AbortSignal.timeout(50000),
          body: JSON.stringify({model: modelo, messages: mensajes, temperature: temperatura, max_tokens: json ? Math.round(maxTokens * 1.8) : maxTokens, ...(json ? {response_format: {type: 'json_object'}} : {})}),
        });
        if (!r.ok) { nota(`${p.nombre}/${modelo}: ${r.status}`); if (r.status === 429) { descansar(p.nombre, r); break; } fallos++; continue; }
        let texto = ((await r.json()).choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
        if (json) { const a = texto.indexOf('{'), b = texto.lastIndexOf('}'); try { JSON.parse(texto.slice(a, b + 1)); } catch { nota(`${p.nombre}/${modelo}: JSON roto`); fallos++; continue; } }
        if (texto.trim()) { ultimoBueno = p.nombre; return {texto, proveedor: p.nombre, modelo}; }
        nota(`${p.nombre}/${modelo}: vacío`);
      } catch (e) { fallos++; nota(`${p.nombre}/${modelo}: ${String(e.message ?? e).slice(0, 50)}`); }
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
