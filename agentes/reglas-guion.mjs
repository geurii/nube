/** Límite del gancho: los 14 términos son una regla de Shorts, no de videos largos. */
export const maxPalabrasGancho = (formato = 'short') => formato === 'largo' ? 24 : 14;
export const validarGancho = (texto, formato = 'short') => {
  const palabras = String(texto ?? '').trim().split(/\s+/).filter(Boolean).length;
  const maximo = maxPalabrasGancho(formato);
  return {palabras, maximo, valido: palabras > 0 && palabras <= maximo};
};


/** Calcula la posición real de la revelación sobre el total del guion, sin redondear antes de validar. */
export const medirRevelacion = (escenas = []) => {
  const palabras = (e) => String(e?.texto ?? '').trim().split(/\s+/).filter(Boolean).length;
  const indice = escenas.findIndex((e) => e?.tipo === 'revelacion');
  const total = escenas.reduce((s, e) => s + palabras(e), 0);
  const antes = indice < 0 ? 0 : escenas.slice(0, indice).reduce((s, e) => s + palabras(e), 0);
  return {antes, total, porcentaje: total > 0 && indice >= 0 ? antes / total * 100 : 0, existe: indice >= 0};
};

export const validarRevelacion = (escenas = [], minimo = 55, maximo = 80) => {
  const m = medirRevelacion(escenas);
  return {...m, valido: m.existe && m.total > 0 && m.porcentaje >= minimo && m.porcentaje <= maximo};
};

/** Un largo compartido entre YouTube y TikTok debe narrarse entre 8 y 10 minutos. */
export const validarLongitudGuion = (escenas = [], minimo = 1200, maximo = 1350) => {
  const palabras = escenas.reduce((total, e) => total + String(e?.texto ?? '').trim().split(/\s+/).filter(Boolean).length, 0);
  return {palabras, minimo, maximo, valido: palabras >= minimo && palabras <= maximo};
};
