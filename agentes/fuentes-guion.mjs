/**
 * Selección factual de fuentes. Un largo requiere investigación suficiente y diversidad real:
 * mínimo 3 dominios distintos y 8.500 caracteres de páginas consultadas.
 * Wikipedia/contexto se conserva como apoyo para Shorts, nunca cuenta como fuente independiente del largo.
 */
const dominioDe = (fuente) => {
  const valor = String(fuente?.dominio ?? '').trim().toLowerCase().replace(/^www\\./, '');
  if (valor) return valor;
  try { return new URL(String(fuente?.url ?? '')).hostname.toLowerCase().replace(/^www\\./, ''); }
  catch { return ''; }
};

export const seleccionarFuentesParaGuion = (fuentes = [], formato = 'short') => {
  const web = [];
  const urls = new Set();
  const dominios = new Set();
  for (const fuente of Array.isArray(fuentes) ? fuentes : []) {
    if (!fuente || fuente.apoyo === true) continue;
    const texto = String(fuente.texto ?? '').trim();
    const dominio = dominioDe(fuente);
    let url = '';
    try { url = new URL(String(fuente.url ?? '')).href.split('#')[0]; } catch { continue; }
    if (!dominio || !url || texto.length < 220 || urls.has(url) || dominios.has(dominio)) continue;
    urls.add(url);
    dominios.add(dominio);
    web.push({...fuente, dominio});
    if (web.length >= 6) break;
  }

  if (formato === 'largo') {
    const caracteres = web.reduce((total, fuente) => total + String(fuente.texto ?? '').length, 0);
    if (web.length < 3 || caracteres < 8500) {
      throw new Error(`Investigación insuficiente para un largo: ${web.length} dominios independientes y ${caracteres} caracteres útiles; se requieren al menos 3 dominios y 8.500 caracteres de material consultado. Se descarta el tema y se busca otro.`);
    }
    return web;
  }

  if (web.length) return [web[0]];
  const apoyo = (Array.isArray(fuentes) ? fuentes : []).find((f) => f && f.apoyo === true && String(f.texto ?? '').trim().length >= 220);
  return apoyo ? [apoyo] : [];
};

export const materialDesdeFuentes = (fuentes = []) => (Array.isArray(fuentes) ? fuentes : []).map((fuente, i) =>
  `FUENTE CONSULTADA ${i + 1} — ${String(fuente.titulo ?? 'Sin título')}\nDOMINIO: ${dominioDe(fuente) || 'desconocido'}\nURL: ${String(fuente.url ?? '')}\nCONTENIDO:\n${String(fuente.texto ?? '').trim()}`
).join('\n\n');
