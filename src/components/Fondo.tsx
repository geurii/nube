import React from 'react';
import {
  AbsoluteFill,
  Img,
  OffthreadVideo,
  interpolate,
  staticFile,
  useCurrentFrame,
  useVideoConfig,
} from 'remotion';
import {esImagen, esVideo} from '../lib/util';
import {REGISTRO_ESCENAS} from './fondos/Escenas';
import {REGISTRO_PIXEL} from './fondos/Pixel';
import {REGISTRO_ARTICO} from './fondos/PixelArtico';

type Props = {
  fondo: string;
  indice: number;
  /** duración de la escena en frames */
  duracion: number;
};

/**
 * Fondo de una escena. Nunca está quieto:
 *  - imágenes: efecto Ken Burns (zoom + paneo, alternando dirección por escena)
 *  - videos: reproducción con zoom lento
 *  - escenas animadas: componentes de ./fondos/Escenas
 * Además entra con un fundido corto para que el cambio no sea brusco.
 */
export const Fondo: React.FC<Props> = ({fondo, indice, duracion}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();

  const aparicion = interpolate(frame, [0, 10], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  let contenido: React.ReactNode;

  if (esImagen(fondo) || esVideo(fondo)) {
    const p = duracion > 0 ? frame / duracion : 0;
    const dir = indice % 2 === 0 ? 1 : -1;
    const escala = interpolate(p, [0, 1], esVideo(fondo) ? [1.02, 1.12] : [1.08, 1.28]);
    const dx = interpolate(p, [0, 1], [-30 * dir, 30 * dir]);
    const dy = interpolate(p, [0, 1], [20 * dir, -20 * dir]);
    const estilo: React.CSSProperties = {
      width: '100%',
      height: '100%',
      objectFit: 'cover',
      transform: `scale(${escala}) translate(${dx}px, ${dy}px)`,
    };
    contenido = esVideo(fondo) ? (
      <OffthreadVideo src={staticFile(fondo)} muted style={estilo} />
    ) : (
      <Img src={staticFile(fondo)} style={estilo} />
    );
  } else {
    const [nombre, parametro] = fondo.split(':');
    const Escena = REGISTRO_ESCENAS[nombre] ?? REGISTRO_PIXEL[nombre] ?? REGISTRO_ARTICO[nombre] ?? REGISTRO_PIXEL.pixelmisterio;
    contenido = <Escena duracion={duracion / fps} parametro={parametro} />;
  }

  return (
    <AbsoluteFill style={{opacity: aparicion, overflow: 'hidden', background: '#000', isolation: 'isolate', zIndex: 0}}>
      {contenido}
    </AbsoluteFill>
  );
};
