// Edición de gancho (estilo "frena el dedo"): titular gigante en los primeros segundos + glitch rojo/cian en cada corte + líneas de escaneo.
// Solo se usa cuando el guion trae estilo: 'gancho'. Mantiene la tipografía pixelada del canal.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/PressStart2P';

const {fontFamily: FUENTE_PIXEL} = loadFont();
const ruido = (n: number) => { const x = Math.sin(n * 127.1 + 311.7) * 43758.5453; return x - Math.floor(x); };

/** La fuente pixelada no tiene mayúsculas con tilde (salían como "EXPLOSIóN"): se quitan las tildes y se conserva la Ñ. */
export const sinTildes = (t: string): string => t.replace(/[ÁÀÂÄ]/g, 'A').replace(/[ÉÈÊË]/g, 'E').replace(/[ÍÌÎÏ]/g, 'I').replace(/[ÓÒÔÖ]/g, 'O').replace(/[ÚÙÛÜ]/g, 'U');

/** Parte el titular en líneas de máximo `max` letras (sin cortar palabras). */
export const partirTitular = (texto: string, max: number, maxLineas = 4): string[] => {
  const palabras = sinTildes(texto.trim().toUpperCase()).split(/\s+/).filter(Boolean);
  const lineas: string[] = [];
  let actual = '';
  for (const p of palabras) {
    if ((actual + ' ' + p).trim().length > max && actual) { lineas.push(actual); actual = p; } else actual = (actual + ' ' + p).trim();
  }
  if (actual) lineas.push(actual);
  return lineas.slice(0, maxLineas);
};

/** Titular gigante de los primeros segundos (la pregunta imposible). La última línea va en rojo. */
export const Titular: React.FC<{texto: string; segundos?: number}> = ({texto, segundos = 2.8}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const vertical = height > width;
  const fin = Math.round(segundos * fps);
  if (frame >= fin || !texto) return null;
  // el titular SIEMPRE se ve entero: si no cabe en 4 líneas, se achica la letra (nunca se corta)
  let tam = Math.round(width * (vertical ? 0.056 : 0.03));
  let lineas = partirTitular(texto, Math.max(8, Math.floor((width * (vertical ? 0.9 : 0.8)) / tam)), 12);
  for (const f of [0.88, 0.76, 0.66, 0.58]) {
    if (lineas.length <= 4) break;
    tam = Math.round(width * (vertical ? 0.056 : 0.03) * f);
    lineas = partirTitular(texto, Math.max(8, Math.floor((width * (vertical ? 0.9 : 0.8)) / tam)), 12);
  }
  const entrada = interpolate(frame, [0, 5], [1.18, 1], {extrapolateRight: 'clamp'});
  const salida = interpolate(frame, [fin - 6, fin], [1, 0], {extrapolateLeft: 'clamp'});
  const dx = frame % 4 < 2 ? 5 : -5; // temblor RGB
  return (
    <AbsoluteFill style={{background: '#000', alignItems: 'center', justifyContent: 'flex-start', paddingTop: height * (vertical ? 0.33 : 0.14), opacity: salida, pointerEvents: 'none'}}>
      <div style={{transform: `scale(${entrada})`, textAlign: 'center', fontFamily: FUENTE_PIXEL, fontSize: tam, lineHeight: 1.45, width: '92%'}}>
        {lineas.map((l, i) => {
          const ultima = i === lineas.length - 1 && lineas.length > 1;
          return (
            <div key={i} style={{color: ultima ? '#ff3b3b' : '#ffffff', WebkitTextStroke: `${Math.max(6, tam / 7)}px #000`, paintOrder: 'stroke fill', textShadow: `${dx}px 0 rgba(255,40,60,0.85), ${-dx}px 0 rgba(0,229,255,0.85)`}}>
              {l}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

/** Destello glitch al empezar cada corte: dos capas rojo/cian desplazadas y barras horizontales. Va dentro de un Sequence corto. */
export const Glitch: React.FC<{frames?: number; semilla?: number}> = ({frames = 8, semilla = 1}) => {
  const f = useCurrentFrame();
  const {height} = useVideoConfig();
  if (f >= frames) return null;
  const k = 1 - f / frames;
  const dx = Math.round(34 * k) * (f % 2 ? 1 : -1);
  const barras = [0, 1, 2].map((b) => ({y: ruido(semilla * 7 + f * 3 + b) * height, h: 6 + ruido(semilla + b + f) * 26, x: (ruido(semilla + f + b * 5) - 0.5) * 60}));
  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <AbsoluteFill style={{background: `rgba(255,0,60,${0.4 * k})`, transform: `translateX(${dx}px)`, mixBlendMode: 'screen'}} />
      <AbsoluteFill style={{background: `rgba(0,229,255,${0.36 * k})`, transform: `translateX(${-dx}px)`, mixBlendMode: 'screen'}} />
      {barras.map((b, i) => (
        <div key={i} style={{position: 'absolute', left: 0, right: 0, top: b.y, height: b.h, transform: `translateX(${b.x}px)`, background: i % 2 ? 'rgba(255,40,60,0.6)' : 'rgba(0,229,255,0.55)', mixBlendMode: 'screen'}} />
      ))}
    </AbsoluteFill>
  );
};

/** Líneas de escaneo suaves que dan textura de pantalla a todo el video. */
export const Escaneo: React.FC = () => (
  <AbsoluteFill style={{pointerEvents: 'none', background: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.13) 0px, rgba(0,0,0,0.13) 2px, rgba(0,0,0,0) 2px, rgba(0,0,0,0) 4px)'}} />
);
