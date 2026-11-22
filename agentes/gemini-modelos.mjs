// Qué modelos de Gemini puede usar de verdad esta cuenta HOY (Google retira modelos: "gemini-2.5-flash ya no está disponible para cuentas nuevas" dio error 404).
// Pregunta la lista a Google, deja los de texto/imagen/video, y los ordena: primero los "flash" (rápidos) del más nuevo al más viejo, luego los demás.
// Si Google no responde, usa una lista fija. Se guarda en memoria durante la corrida: una sola consulta.
const BASE = 'https://generativelanguage.googleapis.com';
const EXCLUIR = /embed|lite|image|tts|live|aqa|robotics|computer|audio|imagen|veo|nano|learnlm/i;
export const MODELOS_FIJOS = ['gemini-3.8-flash', 'gemini-4-hydrogen'];

/** Ordena nombres de modelos: flash primero, luego otros, luego pro; dentro de cada grupo, la versión más nueva primero. Función pura. */
export const ordenarModelos = (nombres) => {
  const tipo = (n) => (/flash/.test(n) ? 0 : /pro/.test(n) ? 2 : 1);
  const version = (n) => parseFloat(/gemini-(\d+(?:\.\d+)?)/.exec(n)?.[1] ?? '0') || 0;
  return [...new Set(nombres)]
    .filter((n) => /^gemini-/.test(n) && !EXCLUIR.test(n))
    .sort((a, b) => tipo(a) - tipo(b) || version(b) - version(a));
};

let memoria = null;
export const modelosGemini = async (key, max = 4) => {
  if (memoria) return memoria;
  try {
    const r = await fetch(`${BASE}/v1beta/models?pageSize=200`, {headers: {'x-goog-api-key': key}, signal: AbortSignal.timeout(20000)});
    if (!r.ok) throw new Error('lista ' + r.status);
    const j = await r.json();
    const orden = ordenarModelos((j.models ?? []).map((m) => String(m.name).replace(/^models\//, '')));
    memoria = orden.length ? orden.slice(0, max) : MODELOS_FIJOS;
  } catch {
    memoria = MODELOS_FIJOS;
  }
  return memoria;
};
