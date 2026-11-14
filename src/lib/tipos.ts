export type TipoEscena = 'hook' | 'historia' | 'revelacion' | 'veredicto';

export type Plataforma = 'tiktok' | 'instagram' | 'youtube';

export type Esquina =
  | 'arriba-izquierda'
  | 'arriba-derecha'
  | 'abajo-izquierda'
  | 'abajo-derecha';

export type Escena = {
  /** hook (0-3 s), historia, revelacion (65-75 %), veredicto (últimos 10-15 s) */
  tipo: TipoEscena;
  /** Texto que se narra en esta escena. Se muestra palabra por palabra. */
  texto: string;
  /**
   * Fondo de la escena. Puede ser:
   *  - un archivo dentro de /public: "fondos/foto.jpg", "fondos/clip.mp4"
   *  - una escena animada: escenario | vestido | contador:1700000000 | misterio | capas | veredicto | exito
   *  - una LISTA de cualquiera de los anteriores: se alternan con fundido dentro de la escena
   *    (ej. ["fondos/hotel.mp4", "fondos/calle.jpg", "fondos/taxi.mp4"]) para que el fondo
   *    cambie cada pocos segundos.
   */
  fondo: string | string[];
  /** Efectos de sonido extra: `en` = segundos desde el inicio de la escena.
   *  tipos: whoosh-sube, whoosh-baja, swoosh, riser, hit, boom, pop, tick, ding, sparkle, pixel, moneda */
  sfx?: {en: number; tipo: string; volumen?: number}[];
  /** Opcional: forzar el segundo exacto en que empieza la escena */
  inicio?: number;
  /** Opcional: forzar el segundo exacto en que termina la escena */
  fin?: number;
};

export type Guion = {
  titulo: string;
  /** short = máximo 60 s. largo = sin límite. */
  formato: 'short' | 'largo';
  /** tiktok / instagram usan musica/tiktok.mp3, youtube usa musica/youtube.mp3 */
  plataforma: Plataforma;
  /** Ruta de la narración dentro de /public, ej: "audio/narracion.wav" */
  audio: string;
  /** Opcional: forzar un archivo de música concreto dentro de /public */
  musica?: string | null;
  /** Opcional: esquina del personaje. Por defecto arriba-derecha. */
  personaje?: {esquina?: Esquina; visible?: boolean; imagen?: string | null};
  escenas: Escena[];
};

/** Una palabra alineada con el audio (lo genera `npm run voz` en guion/palabras.json). */
export type PalabraAlineada = {
  /** índice de la escena a la que pertenece */
  escena: number;
  /** posición inicial dentro del texto de esa escena */
  desdeChar: number;
  /** posición final (exclusiva) dentro del texto de esa escena */
  hastaChar: number;
  /** segundos */
  inicio: number;
  /** segundos */
  fin: number;
};

export type PalabraTiempo = {
  texto: string;
  inicio: number;
  fin: number;
};

export type EscenaResuelta = Escena & {
  indice: number;
  inicio: number;
  fin: number;
  palabras: PalabraTiempo[];
};

export type TiemposResueltos = {
  duracionAudio: number;
  duracionTotal: number;
  escenas: EscenaResuelta[];
};

export type VideoProps = {
  guion: Guion;
  palabras: PalabraAlineada[];
  /** Música ya resuelta por scripts/render.mjs (ruta dentro de /public) o null */
  musica: string | null;
  /** Lo rellena calculateMetadata */
  tiempos?: TiemposResueltos;
};
