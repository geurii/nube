// Respaldo de modelos: si Groq se queda sin cuota, la oficina pasa sola a otros proveedores GRATIS (los que tengan llave en los secretos).
// Todos usan el formato "compatible con OpenAI". El modelo se elige solo: se pregunta a cada proveedor qué modelos tiene y se toma el mejor
// de una lista de preferencias. Si ningún proveedor tiene llave, devuelve null y todo sigue como antes. Nunca imprime llaves.
const PROVEEDORES = [
  {nombre: 'Cerebras', base: 'https://api.cerebras.ai/v1', clave: 'CEREBRAS_API_KEY', prefiere: [/gpt-oss/i, /llama.*70b/i, /qwen.*(235|32)b/i, /llama/i]},
  {nombre: 'Gemini', base: 'https://generativelanguage.googleapis.com/v1beta/openai', clave: 'GEMINI_API_KEY', prefiere: [/gemini-.*flash(?!.*(lite|tts|image|live|preview-tts))/i, /gemini-.*flash/i], descarta: /tts|image|embed|live|audio/i},
  {nombre: 'OpenRouter', base: 'https://openrouter.ai/api/v1', clave: 'OPENROUTER_API_KEY', prefiere: [/(llama-3\.3-70b|gpt-oss-120b|qwen3.*235b|deepseek).*:free$/i, /:free$/i], soloGratis: true},
  {nombre: 'GitHub Models', base: 'https://models.github.ai/inference', catalogo: 'https://models.github.ai/catalog/models', clave: 'GITHUB_TOKEN', cabeceras: {'X-GitHub-Api-Version': '2022-11-28', Accept: 'application/vnd.github+json'}, prefiere: [/gpt-4\.1$/i, /gpt-4o$/i, /llama.*70b/i, /gpt-4\.1-mini/i, /mini/i], descarta: /embed|nano|vision|o1|o3|o4/i},
  {nombre: 'Mistral', base: 'https://api.mistral.ai/v1', clave: 'MISTRAL_API_KEY', prefiere: [/mistral-large/i, /mistral-medium/i, /mistral-small/i], descarta: /embed|ocr|moderation|codestral-embed/i},
  // MÁS PROVEEDORES GRATIS (verificados con la red el 22 nov 2026: la lista de modelos responde; los marcados sinLlave también contestan un chat sin ninguna llave)
  {nombre: 'Groq', base: 'https://api.groq.com/openai/v1', clave: 'GROQ_API_KEY', prefiere: [/gpt-oss-120b/i, /llama-3.3-70b/i, /gpt-oss/i, /llama/i], descarta: /whisper|tts|guard|orpheus|playai|prompt/i},
  {nombre: 'SambaNova', base: 'https://api.sambanova.ai/v1', clave: 'SAMBANOVA_API_KEY', prefiere: [/llama.*70b/i, /gpt-oss/i, /deepseek/i, /llama/i], descarta: /embed|whisper|e5/i},
  {nombre: 'NVIDIA NIM', base: 'https://integrate.api.nvidia.com/v1', clave: 'NVIDIA_API_KEY', prefiere: [/llama-3.3-70b/i, /gpt-oss/i, /llama.*70b/i, /mistral.*large/i], descarta: /embed|rerank|guard|vision|vl|tts|asr|retriev|clip|parse|safety|reward|nv-|riva/i},
  {nombre: 'Cohere', base: 'https://api.cohere.ai/compatibility/v1', clave: 'COHERE_API_KEY', prefiere: [/command-a/i, /command-r-plus/i, /command-r/i], descarta: /embed|rerank|vision/i},
  {nombre: 'Z.ai (GLM)', base: 'https://api.z.ai/api/paas/v4', clave: 'ZAI_API_KEY', prefiere: [/glm-4.5-flash/i, /flash/i, /glm/i], descarta: /vision|image|video|tts|asr|embed/i},
  {nombre: 'Ollama Cloud', base: 'https://ollama.com/v1', clave: 'OLLAMA_API_KEY', prefiere: [/gpt-oss.*120b/i, /gpt-oss/i, /qwen/i, /deepseek/i], descarta: /embed|vision|vl/i},
  {nombre: 'LLM7', base: 'https://api.llm7.io/v1', clave: 'LLM7_API_KEY', prefiere: [/llama.*70b/i, /gpt-oss/i, /qwen/i, /mistral/i, /gemma/i], descarta: /claude|opus|sonnet|haiku|fable|gpt-5|gpt-4|o1|o3|o4|gemini|embed|image|tts|whisper/i},
  {nombre: 'Requesty', base: 'https://router.requesty.ai/v1', clave: 'REQUESTY_API_KEY', prefiere: [/free/i, /gpt-oss/i, /llama.*70b/i], descarta: /embed|image|tts|whisper|claude|gpt-5|o1|o3|o4/i, soloGratis: true},
  {nombre: 'Pollinations', base: 'https://text.pollinations.ai/openai', clave: 'POLLINATIONS_API_KEY', sinLlave: true, prefiere: [/openai/i, /./], descarta: /image|audio|tts|whisper|embed/i},
  {nombre: 'OVHcloud', base: 'https://oai.endpoints.kepler.ai.cloud.ovh.net/v1', clave: 'OVH_API_KEY', sinLlave: true, prefiere: [/Llama-3_3-70B/i, /Qwen3.*27B/i, /gpt-oss/i, /nemotron/i], descarta: /tts|asr|stt|embed|whisper|riva|stable-diffusion|vl|omni|translate|solaria|olala/i},
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
    const r = await fetch(p.catalogo ?? `${p.base}/models`, {headers: {...(key ? {Authorization: `Bearer ${key}`} : {}), ...(p.cabeceras ?? {})}, signal: AbortSignal.timeout(8000)});
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
  const limite = Date.now() + 180_000; // no permitir que el respaldo consuma toda la ventana de producción
  for (const p of ordenados()) {
    if (Date.now() >= limite) { nota('Respaldo: se agotó la ventana de 3 minutos; se evita bloquear el ciclo.'); break; }
    const key = (process.env[p.clave] || '').trim();
    if ((!key && !p.sinLlave) || p.nombre === 'Cloudflare') continue; // los marcados sinLlave (Pollinations, OVHcloud) contestan sin ninguna llave: respaldo gratis automático
    const lista = await elegirModelos(p, key);
    if (!lista.length) { nota(`${p.nombre}: sin modelo`); continue; }
    let fallos = 0;
    for (const modelo of lista) {
      if (fallos >= 2) { descansar(p.nombre, {}); break; } // proveedor lento o caído: se pasa al siguiente sin perder minutos
      try {
        const r = await fetch(`${p.base}/chat/completions`, {
          method: 'POST', headers: {...(key ? {Authorization: `Bearer ${key}`} : {}), 'Content-Type': 'application/json', ...(p.cabeceras ?? {})}, signal: AbortSignal.timeout(Math.min(18000, Math.max(1000, limite - Date.now()))),
          body: JSON.stringify({model: modelo, messages: mensajes, temperature: temperatura, max_tokens: json ? Math.round(maxTokens * 1.8) : maxTokens, ...(json ? {response_format: {type: 'json_object'}} : {}), ...(/gpt-oss/i.test(modelo) && p.nombre === 'Cerebras' ? {reasoning_effort: 'low'} : {})}),
        });
        if (!r.ok) { nota(`${p.nombre}/${modelo}: ${r.status}`); if (r.status === 429) { descansar(p.nombre, r); break; } fallos++; continue; }
        let texto = ((await r.json()).choices?.[0]?.message?.content ?? '').replace(/<think>[\s\S]*?<\/think>/gi, '');
        if (json) { const a = texto.indexOf('{'), b = texto.lastIndexOf('}'); try { JSON.parse(texto.slice(a, b + 1)); } catch { nota(`${p.nombre}/${modelo}: JSON roto (${texto.trim() ? texto.trim().length + ' letras' : 'vacío'})`); fallos++; continue; } }
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

/** Prueba UN proveedor con una petición real mínima (la usa el comprobador de llaves). Devuelve {estado: 'ok'|'error'|'sin-llave', detalle, ms}. */
export const probarProveedor = async (nombre) => {
  const p = PROVEEDORES.find((x) => x.nombre === nombre);
  if (!p || p.base === null) return {estado: 'error', detalle: 'proveedor no soportado'};
  const key = (process.env[p.clave] || '').trim();
  if (!key && !p.sinLlave) return {estado: 'sin-llave', detalle: `Falta guardar en GitHub: ${p.clave}`};
  const lista = await elegirModelos(p, key);
  if (!lista.length) return {estado: 'error', detalle: `${p.nombre}: no devolvió lista de modelos${key ? ' (¿llave inválida?)' : ''}`};
  let ultimo = '';
  for (const modelo of lista.slice(0, 2)) {
    const t0 = Date.now();
    try {
      const r = await fetch(`${p.base}/chat/completions`, {method: 'POST', headers: {...(key ? {Authorization: `Bearer ${key}`} : {}), 'Content-Type': 'application/json', ...(p.cabeceras ?? {})}, signal: AbortSignal.timeout(40000), body: JSON.stringify({model: modelo, messages: [{role: 'user', content: 'Responde solo: ok'}], max_tokens: 20, ...(/gpt-oss/i.test(modelo) && p.nombre === 'Cerebras' ? {reasoning_effort: 'low'} : {})})});
      const ms = Date.now() - t0;
      if (r.ok) return {estado: 'ok', detalle: `responde (${modelo}, ${(ms / 1000).toFixed(1)} s)${key ? '' : ' · sin cuenta'}`, ms};
      ultimo = `${p.nombre}: error ${r.status}${r.status === 429 ? ' (descansando: cuota agotada)' : r.status === 401 || r.status === 403 ? ' (llave inválida)' : ''}`;
    } catch (e) { ultimo = `${p.nombre}: ${String(e.message ?? e).slice(0, 60)}`; }
  }
  return {estado: 'error', detalle: ultimo};
};
