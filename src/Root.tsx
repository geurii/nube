import React from 'react';
import {CalculateMetadataFunction, Composition, staticFile} from 'remotion';
import {getAudioDurationInSeconds} from '@remotion/media-utils';
import {Video} from './Video';
import type {Guion, PalabraAlineada, VideoProps} from './lib/tipos';
import {COLA_FINAL, resolverTiempos} from './lib/tiempos';
import guionJson from '../guion/guion.json';
import palabrasJson from '../guion/palabras.json';

export const FPS = 30;
export const ANCHO = 1080;
export const ALTO = 1920;

/** Mide la narración y calcula la duración del video y los tiempos de cada palabra. */
export const calcularMetadatos: CalculateMetadataFunction<VideoProps> = async ({props}) => {
  const duracionAudio = await getAudioDurationInSeconds(staticFile(props.guion.audio));
  const tiempos = resolverTiempos(props.guion, props.palabras, duracionAudio);
  return {
    durationInFrames: Math.ceil((duracionAudio + COLA_FINAL) * FPS),
    props: {...props, tiempos},
  };
};

export const Root: React.FC = () => {
  return (
    <Composition
      id="LoQueNoSabias"
      component={Video}
      width={ANCHO}
      height={ALTO}
      fps={FPS}
      durationInFrames={FPS * 60}
      defaultProps={{
        guion: guionJson as Guion,
        palabras: palabrasJson as PalabraAlineada[],
        musica: null,
      }}
      calculateMetadata={calcularMetadatos}
    />
  );
};
