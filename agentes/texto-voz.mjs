// Deja el texto listo para ser LEÍDO EN VOZ ALTA en español (y para los subtítulos): sin rangos con guion, sin horas con dos puntos,
// sin comas de miles, sin símbolos ni unidades abreviadas. Caso real que falló: "10-15 megatoneladas" se leyó "octubre de 15 megatoneladas".
// Función pura y segura: si algo raro pasa devuelve el texto original.

const REEMPLAZOS_INGLES = [
  [/\bblast\b/gi, 'estruendo'],
  [/\bflood\b/gi, 'inundación'],
  [/\bevent\b/gi, 'evento'],
];

const UNIDADES = [
  [/(\d)\s*km\s*(?:²|2\b)/g, '$1 kilómetros cuadrados'],
  [/(\d)\s*m\s*(?:²|2\b)/g, '$1 metros cuadrados'],
  [/(\d)\s*km\/h\b/gi, '$1 kilómetros por hora'],
  [/(\d)\s*mph\b/gi, '$1 millas por hora'],
  [/(\d)\s*km\b/gi, '$1 kilómetros'],
  [/(\d)\s*kg\b/gi, '$1 kilogramos'],
  [/(\d)\s*cm\b/gi, '$1 centímetros'],
  [/(\d)\s*mm\b/gi, '$1 milímetros'],
  [/(\d)\s*ft\b/gi, '$1 pies'],
  [/(\d)\s*m\b(?![a-záéíóúñ])/g, '$1 metros'],
  [/(\d)\s*%/g, '$1 por ciento'],
  [/(\d)\s*°\s*C\b/g, '$1 grados'],
  [/(\d)\s*°/g, '$1 grados'],
];

export const limpiarParaVoz = (entrada) => {
  try {
    let t = String(entrada ?? '');
    // 1) miles con coma: 5,000 -> 5000 ; 2,300,000 -> 2300000 (si no, la voz dice "cinco coma cero")
    for (let i = 0; i < 3; i++) t = t.replace(/(\d{1,3}),(\d{3})(?!\d)/g, '$1$2');
    // 2) millones abreviados: 2.3M / 2.3 M -> 2,3 millones
    t = t.replace(/(\d+(?:[.,]\d+)?)\s*M\b(?![a-záéíóúñ])/g, '$1 millones');
    // 3) horas: 7:14 -> 7 y 14 (sin dos puntos)
    t = t.replace(/\b(\d{1,2}):(\d{2})\b(?!:)/g, '$1 y $2');
    // 4) rangos: 10-15 -> entre 10 y 15 (no toca fechas tipo 2026-11-22)
    t = t.replace(/(?<![\d-])(\d[\d.,]*)\s*[-–—]\s*(\d[\d.,]*)(?![\d-])/g, 'entre $1 y $2');
    // 5) unidades y símbolos
    for (const [re, por] of UNIDADES) t = t.replace(re, por);
    t = t.replace(/\ba\.\s?m\./gi, 'de la mañana').replace(/\bp\.\s?m\./gi, 'de la tarde');
    t = t.replace(/[≈~]\s*/g, 'unos ').replace(/\s&\s/g, ' y ').replace(/(\d)\s*×\s*(\d)/g, '$1 por $2');
    t = t.replace(/\bentre\s+entre\b/gi, 'entre');
    // 6) miles con punto (2.150 -> 2150) y decimales con punto -> coma (en español se dice "dos coma tres")
    t = t.replace(/(?<![\d.])([1-9]\d{0,2})\.(\d{3})(?!\d)/g, '$1$2').replace(/(\d)\.(\d)/g, '$1,$2');
    // 7) palabras en inglés que se cuelan
    for (const [re, por] of REEMPLAZOS_INGLES) t = t.replace(re, por);
    return t.replace(/\s{2,}/g, ' ').trim();
  } catch {
    return String(entrada ?? '');
  }
};

/** Palabras sueltas en inglés que delatan una frase sin traducir (en minúscula, para no confundir con nombres propios como "The Bloop"). */
export const palabrasEnInglesSueltas = (texto) => [...new Set(String(texto ?? '').match(/\b(?:the|and|of|with|from|was|were|that|this|which|during|after|before)\b/g) ?? [])];
