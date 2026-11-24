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

const UNIDADES_NUMERO = [
  ['', 'mil', 'millón', 'mil millones', 'billón', 'mil billones', 'trillón'],
];

const UNIDADES_ES = ['cero','uno','dos','tres','cuatro','cinco','seis','siete','ocho','nueve'];
const DIEZ_A_DIECINUEVE = ['diez','once','doce','trece','catorce','quince','dieciséis','diecisiete','dieciocho','diecinueve'];
const DECENAS_ES = ['', '', 'veinte','treinta','cuarenta','cincuenta','sesenta','setenta','ochenta','noventa'];
const CENTENAS_ES = ['', 'ciento','doscientos','trescientos','cuatrocientos','quinientos','seiscientos','setecientos','ochocientos','novecientos'];

const menorMilEnLetras = (n) => {
  if (n < 10) return UNIDADES_ES[n];
  if (n < 20) return DIEZ_A_DIECINUEVE[n - 10];
  if (n < 30) return n === 20 ? 'veinte' : ['veintiuno','veintidós','veintitrés','veinticuatro','veinticinco','veintiséis','veintisiete','veintiocho','veintinueve'][n - 21];
  if (n < 100) return DECENAS_ES[Math.floor(n / 10)] + (n % 10 ? ' y ' + UNIDADES_ES[n % 10] : '');
  if (n === 100) return 'cien';
  return CENTENAS_ES[Math.floor(n / 100)] + (n % 100 ? ' ' + menorMilEnLetras(n % 100) : '');
};

const enteroEnLetras = (valor) => {
  if (!Number.isSafeInteger(valor) || valor < 0) return String(valor);
  if (valor < 1000) return menorMilEnLetras(valor);
  if (valor < 1_000_000) {
    const miles = Math.floor(valor / 1000);
    const resto = valor % 1000;
    return (miles === 1 ? 'mil' : menorMilEnLetras(miles) + ' mil') + (resto ? ' ' + menorMilEnLetras(resto) : '');
  }
  const escalas = [
    [1_000_000_000_000, 'billón', 'billones'],
    [1_000_000_000, 'mil millones', 'mil millones'],
    [1_000_000, 'millón', 'millones'],
  ];
  for (const [base, singular, plural] of escalas) {
    if (valor >= base) {
      const grupo = Math.floor(valor / base);
      const resto = valor % base;
      const nombre = singular === 'mil millones' ? singular : (grupo === 1 ? singular : plural);
      const cantidad = singular === 'mil millones' ? (grupo === 1 ? '' : enteroEnLetras(grupo)) : (grupo === 1 ? 'un' : enteroEnLetras(grupo));
      return cantidad + ' ' + nombre + (resto ? ' ' + enteroEnLetras(resto) : '');
    }
  }
  return String(valor);
};

const numeroEnLetras = (literal) => {
  const normal = String(literal).replace(/[\s.](?=\d{3}(?:\D|$))/g, '').replace(/\.(?=\d)/g, ',');
  const [entero, decimal] = normal.split(',');
  const n = Number(entero);
  if (!Number.isSafeInteger(n)) return literal;
  const base = enteroEnLetras(n);
  return decimal ? base + ' coma ' + [...decimal].map((d) => UNIDADES_ES[Number(d)]).join(' ') : base;
};

export const limpiarParaVoz = (entrada) => {
  try {
    let t = String(entrada ?? '');
    // Une miles escritos con separadores de espacio: 1 470 000 -> 1470000.
    t = t.replace(/\b\d{1,3}(?:\s+\d{3})+\b/g, (m) => m.replace(/\s/g, ''));
    // Miles con coma: 5,000 -> 5000; millones abreviados: 2.3M -> 2,3 millones.
    for (let i = 0; i < 3; i++) t = t.replace(/(\d{1,3}),(\d{3})(?!\d)/g, '$1$2');
    t = t.replace(/(\d+(?:[.,]\d+)?)\s*M\b(?![a-záéíóúñ])/gi, '$1 millones');
    t = t.replace(/\b(\d{1,2}):(\d{2})\b(?!:)/g, '$1 y $2');
    t = t.replace(/(?<![\d-])(\d[\d.,]*)\s*[-–—]\s*(\d[\d.,]*)(?![\d-])/g, 'entre $1 y $2');
    for (const [re, por] of UNIDADES) t = t.replace(re, por);
    t = t.replace(/\ba\.\s?m\./gi, 'de la mañana').replace(/\bp\.\s?m\./gi, 'de la tarde');
    t = t.replace(/[≈~]\s*/g, 'unos ').replace(/\s&\s/g, ' y ').replace(/(\d)\s*×\s*(\d)/g, '$1 por $2');
    t = t.replace(/\bentre\s+entre\b/gi, 'entre');
    // Normaliza miles con punto antes de convertir cada cifra a palabras.
    t = t.replace(/(?<![\d.])([1-9]\d{0,2})\.(\d{3})(?!\d)/g, '$1$2');
    // Convierte TODAS las cifras restantes a palabras: nunca dejar dígitos crudos para el TTS.
    t = t.replace(/\b\d+(?:[.,]\d+)?\b/g, (m) => numeroEnLetras(m));
    for (const [re, por] of REEMPLAZOS_INGLES) t = t.replace(re, por);
    return t.replace(/\s{2,}/g, ' ').trim();
  } catch {
    return String(entrada ?? '');
  }
};
/** Palabras sueltas en inglés que delatan una frase sin traducir (en minúscula, para no confundir con nombres propios como "The Bloop"). */
export const palabrasEnInglesSueltas = (texto) => [...new Set(String(texto ?? '').match(/\b(?:the|and|of|with|from|was|were|that|this|which|during|after|before)\b/g) ?? [])];
