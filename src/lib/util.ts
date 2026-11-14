/** Pseudoaleatorio determinista (mismo resultado en cada frame y cada render). */
export const rnd = (i: number, sal = 0): number => {
  const x = Math.sin(i * 12.9898 + sal * 78.233) * 43758.5453;
  return x - Math.floor(x);
};

export const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export const esVideo = (ruta: string) => /\.(mp4|webm|mov|m4v)$/i.test(ruta);
export const esImagen = (ruta: string) => /\.(jpe?g|png|webp|gif|avif)$/i.test(ruta);
export const esArchivo = (ruta: string) => esVideo(ruta) || esImagen(ruta);

export const formatearNumero = (n: number) =>
  Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
