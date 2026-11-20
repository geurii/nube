// Escenas pixel de la serie "5 trucos" (objetos de diseño propio, sin marcas ni logos).
// Mismo método que los pingüinos: lienzo canvas, 1 píxel = 2 px del video, ampliado sin suavizar.
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/PressStart2P';
import {G} from './pixelG';
import {DIBUJOS} from './secretos';
import type {PropsEscena} from './Escenas';

const {fontFamily: FUENTE_PIXEL} = loadFont();
const F = 2;

const Lienzo: React.FC<{nombre: string; parametro: string; duracion: number}> = ({nombre, parametro, duracion}) => {
  const {width, height, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const lw = Math.round(width / F);
  const lh = Math.round(height / F);
  const [espera] = useState(() => delayRender('fuente pixel'));
  const [listo, setListo] = useState(false);
  useEffect(() => {
    document.fonts
      .load(`16px ${FUENTE_PIXEL}`)
      .catch(() => undefined)
      .then(() => setListo(true));
  }, []);
  const liberado = useRef(false);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const g = new G(lw, lh);
    DIBUJOS[nombre](g, frame / fps, Math.min(lw, lh) / 360, width > height, parametro, duracion);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(g.d), lw, lh), 0, 0);
    ctx.textBaseline = 'middle';
    for (const t of g.textos) {
      ctx.font = `${t.size}px ${FUENTE_PIXEL}`;
      ctx.textAlign = t.align ?? 'center';
      if (t.stroke) {
        ctx.lineJoin = 'miter';
        ctx.lineWidth = Math.max(2, t.size / 4);
        ctx.strokeStyle = t.stroke;
        ctx.strokeText(t.s, t.x, t.y);
      }
      ctx.fillStyle = t.fill;
      ctx.fillText(t.s, t.x, t.y);
    }
    if (listo && !liberado.current) {
      liberado.current = true;
      continueRender(espera);
    }
  }, [frame, listo]);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <canvas ref={ref} width={lw} height={lh} style={{width: '100%', height: '100%', imageRendering: 'pixelated'}} />
    </AbsoluteFill>
  );
};

const crear = (nombre: string): React.FC<PropsEscena> => ({parametro, duracion}) => (
  <Lienzo nombre={nombre} parametro={parametro ?? ''} duracion={duracion} />
);
export const REGISTRO_SECRETOS: Record<string, React.FC<PropsEscena>> = Object.fromEntries(Object.keys(DIBUJOS).map((n) => [n, crear(n)]));
