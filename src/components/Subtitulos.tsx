import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/Montserrat';
import type {EscenaResuelta, PalabraTiempo} from '../lib/tipos';
import {agruparPalabras} from '../lib/tiempos';

const {fontFamily} = loadFont('normal', {weights: ['900'], subsets: ['latin']});

const AMARILLO = '#FFD60A';
const BLANCO = '#FFFFFF';
const TAMANO = 62;
const BORDE = 9;

type Props = {escena: EscenaResuelta};

/**
 * Subtítulos estilo karaoke: bloques de 3-4 palabras, blancas, grandes,
 * con borde negro; la palabra que se está diciendo se pinta en amarillo
 * y hace un pequeño "pop".
 */
export const Subtitulos: React.FC<Props> = ({escena}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const horizontal = width > height;
  const t = escena.inicio + frame / fps; // segundo absoluto del video

  // En horizontal caben más palabras por línea
  const grupos = horizontal ? agruparPalabras(escena.palabras, 6, 34) : agruparPalabras(escena.palabras);
  if (grupos.length === 0) return null;

  // Grupo visible: desde su primera palabra hasta que empieza el siguiente
  let visible: PalabraTiempo[] | null = null;
  for (let g = 0; g < grupos.length; g++) {
    const desde = grupos[g][0].inicio - 0.08;
    const hasta =
      g + 1 < grupos.length
        ? grupos[g + 1][0].inicio - 0.08
        : Math.min(escena.fin, grupos[g][grupos[g].length - 1].fin + 0.9);
    if (t >= desde && t < hasta) {
      visible = grupos[g];
      break;
    }
  }
  if (!visible) return null;

  const entrada = interpolate(t - (visible[0].inicio - 0.08), [0, 0.12], [0.9, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });

  const renderPalabras = (capa: 'borde' | 'relleno') =>
    visible!.map((p, i) => {
      const siguiente = visible![i + 1];
      const finReal = siguiente ? siguiente.inicio : p.fin;
      const activa = t >= p.inicio && t < Math.max(finReal, p.inicio + 0.12);
      const dt = t - p.inicio;
      const escala = activa
        ? interpolate(dt, [0, 0.09, 0.2], [1, 1.12, 1.06], {
            extrapolateLeft: 'clamp',
            extrapolateRight: 'clamp',
          })
        : 1;
      const color = capa === 'borde' ? '#000' : activa ? AMARILLO : BLANCO;
      return (
        <span
          key={i}
          style={{
            display: 'inline-block',
            margin: '0 16px',
            transform: `scale(${escala})`,
            color,
            WebkitTextStroke: capa === 'borde' ? `${BORDE}px #000` : undefined,
            textShadow:
              capa === 'borde' ? '0 10px 24px rgba(0,0,0,0.75), 0 0 6px rgba(0,0,0,0.9)' : undefined,
          }}
        >
          {p.texto.toUpperCase()}
        </span>
      );
    });

  const estiloBase: React.CSSProperties = {
    position: 'absolute',
    left: horizontal ? 200 : 60,
    right: horizontal ? 200 : 60,
    top: horizontal ? '84%' : '73%',
    transform: `translateY(-50%) scale(${entrada})`,
    display: 'flex',
    flexWrap: 'wrap',
    justifyContent: 'center',
    alignItems: 'center',
    rowGap: 10,
    fontFamily,
    fontWeight: 900,
    fontSize: horizontal ? 54 : TAMANO,
    lineHeight: 1.12,
    textAlign: 'center',
    letterSpacing: 1,
  };

  return (
    <AbsoluteFill style={{pointerEvents: 'none'}}>
      <div style={estiloBase}>{renderPalabras('borde')}</div>
      <div style={estiloBase}>{renderPalabras('relleno')}</div>
    </AbsoluteFill>
  );
};
