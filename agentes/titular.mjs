// Titular gigante de los primeros segundos: sale de la frase del hook. Regla de oro: NUNCA queda cortado a mitad de frase.
// Si cabe entero (hasta ~60 letras) se usa completo; si no, se corta antes de una palabra de relleno ("la", "de", "que"...) y termina en "…?".
const FUNCIONALES = new Set(['el', 'la', 'los', 'las', 'un', 'una', 'unos', 'unas', 'de', 'del', 'al', 'a', 'en', 'con', 'por', 'para', 'que', 'y', 'o', 'e', 'u', 'se', 'su', 'sus', 'lo', 'le', 'les', 'como', 'más', 'mas', 'sin', 'sobre', 'entre', 'hasta', 'desde', 'cuando', 'cuyo', 'cuya', 'ni', 'pero', 'si', 'mi', 'tu']);
const MAX_LETRAS = 60;
const MAX_PALABRAS = 12;

const limpiaPalabra = (p) => String(p).toLowerCase().replace(/[.,;:!?¿¡"“”()]/g, '');

export const ganchoDe = (texto) => {
  let s = String(texto ?? '').replace(/^¿?\s*sabías que\s*/i, '').trim();
  s = (s.split(/(?<=[.!?])\s/)[0] ?? '').replace(/[.!¿?,;:]+$/g, '').trim();
  const palabras = s.split(/\s+/).filter(Boolean);
  if (!palabras.length) return '';
  const usar = [];
  let largo = 0;
  for (const p of palabras) {
    if (usar.length >= MAX_PALABRAS || largo + p.length + 1 > MAX_LETRAS) break;
    usar.push(p);
    largo += p.length + 1;
  }
  const completa = usar.length === palabras.length;
  if (!completa) while (usar.length > 3 && FUNCIONALES.has(limpiaPalabra(usar[usar.length - 1]))) usar.pop(); // no terminar en "la", "de", "que"...
  const frase = usar.join(' ').replace(/[,;:]+$/, '');
  return `¿${frase.charAt(0).toUpperCase()}${frase.slice(1)}${completa ? '' : '…'}?`;
};
