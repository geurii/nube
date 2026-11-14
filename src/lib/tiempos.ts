import type {
  EscenaResuelta,
  Guion,
  PalabraAlineada,
  PalabraTiempo,
  TiemposResueltos,
} from './tipos';

/** Segundos de margen al final, después de que termina la narración. */
export const COLA_FINAL = 0.6;

export type Token = {texto: string; desdeChar: number; hastaChar: number};

export const tokenizar = (texto: string): Token[] => {
  const tokens: Token[] = [];
  const re = /\S+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(texto)) !== null) {
    tokens.push({texto: m[0], desdeChar: m.index, hastaChar: m.index + m[0].length});
  }
  return tokens;
};

type TokenTiempo = {
  escena: number;
  token: Token;
  inicio?: number;
  fin?: number;
};

/** Rellena por interpolación las palabras que no tienen tiempo asignado. */
const rellenarHuecos = (todos: TokenTiempo[], duracionAudio: number) => {
  let i = 0;
  while (i < todos.length) {
    if (todos[i].inicio !== undefined) {
      i++;
      continue;
    }
    let j = i;
    while (j < todos.length && todos[j].inicio === undefined) j++;
    const desde = i > 0 ? (todos[i - 1].fin as number) : 0;
    const hasta = j < todos.length ? (todos[j].inicio as number) : duracionAudio;
    const n = j - i;
    const pesos = todos.slice(i, j).map((t) => t.token.texto.length + 1);
    const total = pesos.reduce((a, b) => a + b, 0);
    let cursor = desde;
    for (let k = 0; k < n; k++) {
      const dur = ((hasta - desde) * pesos[k]) / total;
      todos[i + k].inicio = cursor;
      todos[i + k].fin = cursor + dur;
      cursor += dur;
    }
    i = j;
  }
};

/**
 * Calcula cuándo empieza y termina cada escena y cada palabra.
 *  - Si hay palabras alineadas (guion/palabras.json), se usan.
 *  - Si no, se reparte el audio proporcionalmente a la longitud del texto.
 *  - Los campos `inicio`/`fin` del guion siempre tienen prioridad.
 */
export const resolverTiempos = (
  guion: Guion,
  palabras: PalabraAlineada[],
  duracionAudio: number,
): TiemposResueltos => {
  const escenas = guion.escenas;
  const n = escenas.length;
  const tokensPorEscena = escenas.map((e) => tokenizar(e.texto));
  const duracionTotal = duracionAudio + COLA_FINAL;

  const todos: TokenTiempo[] = [];
  tokensPorEscena.forEach((toks, i) => toks.forEach((token) => todos.push({escena: i, token})));

  const inicios: number[] = new Array(n).fill(NaN);
  const fines: number[] = new Array(n).fill(NaN);
  inicios[0] = 0;
  escenas.forEach((e, i) => {
    if (e.inicio !== undefined) inicios[i] = e.inicio;
    if (e.fin !== undefined) {
      fines[i] = e.fin;
      if (i + 1 < n && Number.isNaN(inicios[i + 1])) inicios[i + 1] = e.fin;
    }
  });

  if (palabras.length > 0) {
    // 1) Palabras con tiempo real
    for (const tt of todos) {
      const coincidencias = palabras.filter(
        (p) =>
          p.escena === tt.escena &&
          p.desdeChar < tt.token.hastaChar &&
          p.hastaChar > tt.token.desdeChar,
      );
      if (coincidencias.length > 0) {
        tt.inicio = Math.min(...coincidencias.map((c) => c.inicio));
        tt.fin = Math.max(...coincidencias.map((c) => c.fin));
      }
    }
    rellenarHuecos(todos, duracionAudio);

    // 2) Límites de escena: punto medio del silencio entre la última palabra
    //    de una escena y la primera de la siguiente.
    for (let i = 1; i < n; i++) {
      if (!Number.isNaN(inicios[i])) continue;
      const anteriores = todos.filter((t) => t.escena === i - 1);
      const propias = todos.filter((t) => t.escena === i);
      const finAnterior = anteriores.length
        ? (anteriores[anteriores.length - 1].fin as number)
        : inicios[i - 1];
      const inicioPropio = propias.length ? (propias[0].inicio as number) : finAnterior;
      inicios[i] = finAnterior + (inicioPropio - finAnterior) * 0.5;
    }
  } else {
    // Estimación proporcional: caracteres + una pausa fija por escena
    const peso = (i: number) => escenas[i].texto.replace(/\s+/g, '').length + 12;
    let i = 0;
    while (i < n) {
      if (!Number.isNaN(inicios[i])) {
        i++;
        continue;
      }
      // tramo de escenas sin inicio conocido: [a, j)
      const a = i - 1;
      let j = i;
      while (j < n && Number.isNaN(inicios[j])) j++;
      const desde = inicios[a];
      const hasta = j < n ? inicios[j] : !Number.isNaN(fines[n - 1]) ? fines[n - 1] : duracionAudio;
      const indices = [];
      for (let k = a; k < j; k++) indices.push(k);
      const total = indices.reduce((s, k) => s + peso(k), 0);
      let cursor = desde;
      for (const k of indices) {
        if (k !== a) inicios[k] = cursor;
        cursor += ((hasta - desde) * peso(k)) / total;
      }
      i = j;
    }
  }

  for (let i = 0; i < n; i++) {
    if (Number.isNaN(fines[i])) fines[i] = i + 1 < n ? inicios[i + 1] : duracionTotal;
  }

  if (palabras.length === 0) {
    // Palabras repartidas dentro del 88 % inicial de cada escena
    for (let i = 0; i < n; i++) {
      const propias = todos.filter((t) => t.escena === i);
      const disponible = (fines[i] - inicios[i]) * 0.88;
      const pesos = propias.map((t) => t.token.texto.length + 1.5);
      const total = pesos.reduce((s, p) => s + p, 0);
      let cursor = inicios[i] + 0.05;
      propias.forEach((t, k) => {
        const dur = (disponible * pesos[k]) / total;
        t.inicio = cursor;
        t.fin = cursor + dur;
        cursor += dur;
      });
    }
  }

  const resueltas: EscenaResuelta[] = escenas.map((e, i) => {
    const palabrasEscena: PalabraTiempo[] = todos
      .filter((t) => t.escena === i)
      .map((t) => ({texto: t.token.texto, inicio: t.inicio as number, fin: t.fin as number}));
    return {...e, indice: i, inicio: inicios[i], fin: fines[i], palabras: palabrasEscena};
  });

  return {duracionAudio, duracionTotal, escenas: resueltas};
};

/** Agrupa las palabras de una escena en bloques cortos (máx. palabras / caracteres). */
export const agruparPalabras = (
  palabras: PalabraTiempo[],
  maxPalabras = 4,
  maxCaracteres = 24,
): PalabraTiempo[][] => {
  const grupos: PalabraTiempo[][] = [];
  let actual: PalabraTiempo[] = [];
  let chars = 0;
  for (const p of palabras) {
    const nuevoChars = chars + p.texto.length + (actual.length ? 1 : 0);
    if (actual.length > 0 && (actual.length >= maxPalabras || nuevoChars > maxCaracteres)) {
      grupos.push(actual);
      actual = [];
      chars = 0;
    }
    actual.push(p);
    chars += p.texto.length + 1;
  }
  if (actual.length) grupos.push(actual);
  return grupos;
};
