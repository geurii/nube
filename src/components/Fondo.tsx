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
import {REGISTRO_H} from './fondos/PixelH';
import {REGISTRO_PINGUINOS} from './fondos/PixelPinguinos';
import {REGISTRO_SECRETOS} from './fondos/PixelSecretos';
import {REGISTRO_FORBES} from './fondos/PixelForbes';
import {REGISTRO_BARCO} from './fondos/PixelBarco';
import {REGISTRO_PINTADO} from './fondos/PixelPintado';

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
  const {fps, width, height} = useVideoConfig();

  const aparicion = interpolate(frame, [0, Math.round(fps / 3)], [0, 1], {
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
      // pixel art: al ampliar y al hacer zoom los pixeles se mantienen cuadrados, no se emborronan
      imageRendering: 'pixelated',
      transform: `scale(${escala}) translate(${dx}px, ${dy}px)`,
    };
    contenido = esVideo(fondo) ? (
      <OffthreadVideo src={staticFile(fondo)} muted style={estilo} />
    ) : (
      <Img src={staticFile(fondo)} style={estilo} />
    );
  } else {
    const corte = fondo.indexOf(':');
    const nombre = corte < 0 ? fondo : fondo.slice(0, corte);
    const parametro = corte < 0 ? undefined : fondo.slice(corte + 1);
    const horizontal = width > height;
    const Escena =
      (horizontal ? REGISTRO_H[nombre] : undefined) ??
      REGISTRO_ESCENAS[nombre] ??
      REGISTRO_PIXEL[nombre] ??
      REGISTRO_ARTICO[nombre] ??
      REGISTRO_PINGUINOS[nombre] ??
      REGISTRO_SECRETOS[nombre] ??
      REGISTRO_FORBES[nombre] ??
      REGISTRO_BARCO[nombre] ??
      REGISTRO_PINTADO[nombre] ??
      (horizontal ? REGISTRO_H.pixelmisterio : REGISTRO_PIXEL.pixelmisterio);
    contenido = <Escena duracion={duracion / fps} parametro={parametro} />;
  }

  return (
    <AbsoluteFill style={{opacity: aparicion, overflow: 'hidden', background: '#000', isolation: 'isolate', zIndex: 0}}>
      {contenido}
    </AbsoluteFill>
  );
};
