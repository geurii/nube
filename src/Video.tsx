import React from 'react';
import {AbsoluteFill, Audio, Sequence, staticFile, useVideoConfig} from 'remotion';
import type {VideoProps} from './lib/tipos';
import {Fondo} from './components/Fondo';
import {Subtitulos} from './components/Subtitulos';
import {Personaje} from './components/Personaje';
import {Musica} from './components/Musica';
import {Escaneo, Glitch, Titular} from './components/Gancho';

/** Frames de solape entre un fondo y el siguiente (fundido). */
/* El solape se calcula dentro del componente según los fps */
/** Cada fondo de una lista dura como mucho esto (segundos) para que el flujo no se pare. */
const MAX_SEGUNDOS_POR_FONDO = 3;

export const Video: React.FC<VideoProps> = ({guion, musica, tiempos}) => {
  const {fps, durationInFrames} = useVideoConfig();
  if (!tiempos) return <AbsoluteFill style={{background: '#000'}} />;

  const aFrame = (s: number) => Math.round(s * fps);
  const SOLAPE = Math.round(fps / 3); // fundido entre fondos (~0,33 s)
  const personajeVisible = guion.personaje?.visible !== false;
  const gancho = guion.estilo === 'gancho'; // edición de gancho: cortes más rápidos, glitch, escaneo y titular
  const maxPorFondo = gancho ? 1.8 : MAX_SEGUNDOS_POR_FONDO;

  // Cada escena se parte en tramos; cada tramo usa un fondo de la lista (en ciclo).
  const tramos = tiempos.escenas.flatMap((e) => {
    const lista = Array.isArray(e.fondo) ? e.fondo : [e.fondo];
    const inicio = aFrame(e.inicio);
    const fin = aFrame(e.fin);
    const total = fin - inicio;
    const n = lista.length > 1 ? Math.max(lista.length, Math.ceil(total / (maxPorFondo * fps))) : 1;
    return Array.from({length: n}).map((_, k) => {
      const desde = inicio + Math.round((total * k) / n);
      const hasta = inicio + Math.round((total * (k + 1)) / n);
      return {
        clave: `${e.indice}-${k}`,
        fondo: lista[k % lista.length],
        indice: e.indice + k,
        indiceEscena: e.indice,
        subindice: k,
        desde,
        hasta,
        ultimo: k === n - 1,
      };
    });
  });

  // Efectos de sonido: automáticos en cada cambio + los que marque el guion en cada escena.
  const efectos: {frame: number; tipo: string; vol: number}[] = [{frame: 0, tipo: 'hit', vol: 0.55}];
  tiempos.escenas.forEach((e, i) => {
    const ini = aFrame(e.inicio);
    if (i > 0) efectos.push({frame: ini - 3, tipo: i % 2 ? 'whoosh-sube' : 'whoosh-baja', vol: 0.5});
    if (e.tipo === 'revelacion' && tiempos.escenas[i - 1]?.tipo !== 'revelacion') {
      efectos.push({frame: Math.max(0, ini - 2 * fps), tipo: 'riser', vol: 0.5});
      efectos.push({frame: ini, tipo: 'boom', vol: 0.7});
    }
    if (e.tipo === 'veredicto') {
      efectos.push({frame: ini, tipo: 'hit', vol: 0.6});
      efectos.push({frame: ini + 6, tipo: 'ding', vol: 0.4});
    }
    (e.sfx ?? []).forEach((s) => efectos.push({frame: ini + aFrame(s.en), tipo: s.tipo, vol: s.volumen ?? 0.5}));
  });
  tramos.forEach((tr, k) => {
    if (tr.subindice > 0) efectos.push({frame: tr.desde - 2, tipo: k % 2 ? 'swoosh' : 'pixel', vol: 0.35});
  });

  return (
    <AbsoluteFill style={{background: '#000'}}>
      {/* Fondos (siempre en movimiento, con fundido entre ellos) */}
      {tramos.map((tr) => {
        const hasta = Math.min(tr.hasta + SOLAPE, durationInFrames);
        return (
          <Sequence key={`fondo-${tr.clave}`} from={tr.desde} durationInFrames={Math.max(1, hasta - tr.desde)}>
            <Fondo fondo={tr.fondo} indice={tr.indice} duracion={tr.hasta - tr.desde} />
          </Sequence>
        );
      })}

      {/* Oscurecedor + viñeta + grano para que el texto se lea y todo se vea cohesionado */}
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(ellipse at 50% 45%, rgba(0,0,0,0.10) 0%, rgba(0,0,0,0.38) 70%, rgba(0,0,0,0.68) 100%)',
        }}
      />

      {gancho && <Escaneo />}
      {gancho && tramos.slice(1).map((tr) => (
        <Sequence key={`glitch-${tr.clave}`} from={tr.desde} durationInFrames={8}>
          <Glitch semilla={tr.indice + 1} />
        </Sequence>
      ))}

      {/* Subtítulos karaoke: siempre por encima de cualquier fondo */}
      {tiempos.escenas.map((e) => {
        const desde = aFrame(e.inicio);
        const hasta = aFrame(e.fin);
        return (
          <Sequence key={`sub-${e.indice}`} from={desde} durationInFrames={Math.max(1, hasta - desde)}>
            <Subtitulos escena={e} />
          </Sequence>
        );
      })}

      {gancho && guion.ganchoTexto && (
        <Sequence from={0} durationInFrames={Math.round(2.8 * fps)}>
          <Titular texto={guion.ganchoTexto} />
        </Sequence>
      )}

      {/* Personaje */}
      {personajeVisible && (
        <Personaje esquina={guion.personaje?.esquina} imagen={guion.personaje?.imagen ?? null} />
      )}

      {/* Efectos de sonido */}
      {efectos.map((ef, k) => (
        <Sequence key={`sfx-${k}`} from={Math.max(0, ef.frame)} durationInFrames={Math.round(2.6 * fps)}>
          <Audio src={staticFile(`sfx/${ef.tipo}.wav`)} volume={ef.vol} />
        </Sequence>
      ))}

      {/* Narración */}
      <Audio src={staticFile(guion.audio)} />

      {/* Música a -20 dB */}
      {musica && <Musica src={musica} />}
    </AbsoluteFill>
  );
};
