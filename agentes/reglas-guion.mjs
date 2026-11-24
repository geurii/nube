/** Límite del gancho: los 14 términos son una regla de Shorts, no de videos largos. */
export const maxPalabrasGancho = (formato = 'short') => formato === 'largo' ? 24 : 14;
export const validarGancho = (texto, formato = 'short') => {
  const palabras = String(texto ?? '').trim().split(/\s+/).filter(Boolean).length;
  const maximo = maxPalabrasGancho(formato);
  return {palabras, maximo, valido: palabras > 0 && palabras <= maximo};
};
