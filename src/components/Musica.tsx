import React from 'react';
import {Audio, interpolate, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';

/** -20 dB respecto a la narración → factor lineal 0.1 */
export const VOLUMEN_MUSICA_DB = -20;
const BASE = Math.pow(10, VOLUMEN_MUSICA_DB / 20);

export const Musica: React.FC<{src: string}> = ({src}) => {
  const frame = useCurrentFrame();
  const {fps, durationInFrames} = useVideoConfig();

  const entrada = interpolate(frame, [0, fps * 1.2], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const salida = interpolate(frame, [durationInFrames - fps * 2, durationInFrames], [1, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  return <Audio src={staticFile(src)} loop volume={BASE * entrada * salida} />;
};
