import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {Video} from './Video';
import {VideoNinos} from './ninos/VideoNinos';
import type {Guion, PalabraAlineada, VideoProps} from './lib/tipos';
import {COLA_FINAL, resolverTiempos} from './lib/tiempos';
import guionJson from '../guion/guion.json';
import palabrasJson from '../guion/palabras.json';

export const FPS_SHORT = 60; // Shorts a 60 fps
export const FPS_LARGO = 30; // video largo a 30 fps
export const ANCHO = 1080;
export const ALTO = 1920;

/** Mide la narración y calcula la duración del video y los tiempos de cada palabra. */
const metadatosCon =
  (fps: number): CalculateMetadataFunction<VideoProps> =>
  async ({props}) => {
    const duracionAudio = await getAudioDurationInSeconds(staticFile(props.guion.audio));
    const tiempos = resolverTiempos(props.guion, props.palabras, duracionAudio);
    return {
      durationInFrames: Math.ceil((duracionAudio + COLA_FINAL) * fps),
      props: {...props, tiempos},
    };
  };

export const Root: React.FC = () => {
  const propsPorDefecto = {
    guion: guionJson as Guion,
    palabras: palabrasJson as PalabraAlineada[],
    musica: null,
  };
  return (
    <>
      {/* Shorts: vertical 9:16 */}
      <Composition
        id="LoQueNoSabias"
        component={Video}
        width={ANCHO}
        height={ALTO}
        fps={FPS_SHORT}
        durationInFrames={FPS_SHORT * 60}
        defaultProps={propsPorDefecto}
        calculateMetadata={metadatosCon(FPS_SHORT)}
      />
      {/* Shorts infantiles de colores: vertical 9:16, 60 fps, imágenes que cambian constantemente */}
      <Composition
        id="ColoresNinos"
        component={VideoNinos}
        width={ANCHO}
        height={ALTO}
        fps={FPS_SHORT}
        durationInFrames={FPS_SHORT * 30}
        defaultProps={propsPorDefecto}
        calculateMetadata={metadatosCon(FPS_SHORT)}
      />
      {/* Video largo: horizontal 16:9 */}
      <Composition
        id="LargoHorizontal"
        component={Video}
        width={ALTO}
        height={ANCHO}
        fps={FPS_LARGO}
        durationInFrames={FPS_LARGO * 60}
        defaultProps={propsPorDefecto}
        calculateMetadata={metadatosCon(FPS_LARGO)}
      />
    </>
  );
};
