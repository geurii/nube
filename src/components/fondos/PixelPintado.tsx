// Escenas pintadas por el Pintor de la oficina: fondo "pintado:<id>" -> lee public/pintados/<id>.json y lo dibuja en pixel art.
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/PressStart2P';
import {G} from './pixelG';
import {pintar, IMAGENES, type EscenaPintada} from './pintado';
import type {PropsEscena} from './Escenas';

const {fontFamily: FUENTE_PIXEL} = loadFont();
const F = 2;
const VACIA: EscenaPintada = {cielo: ['#0a0c24', '#1c2a5e', '#6b4a7a'], capas: [{t: 'estrellas', n: 60}]};

const Lienzo: React.FC<{id: string}> = ({id}) => {
  const {width, height, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const lw = Math.round(width / F);
  const lh = Math.round(height / F);
  const [espera] = useState(() => delayRender('escena pintada'));
  const [spec, setSpec] = useState<EscenaPintada | null>(null);
  const [fuente, setFuente] = useState(false);
  const liberado = useRef(false);
  useEffect(() => {
    document.fonts.load(`16px ${FUENTE_PIXEL}`).catch(() => undefined).then(() => setFuente(true));
    fetch(staticFile(`pintados/${id.replace(/[^a-z0-9-]/gi, '')}.json`))
      .then((r) => { if (!r.ok) throw new Error('No existe el cuadro pixel art ' + id + ': HTTP ' + r.status); return r.json(); })
      .catch((e) => { console.error('Fallo al cargar cuadro pixel art:', e); throw e; })
      .then(async (j) => {
        if (!j || !Array.isArray(j.capas) || j.capas.length < 3) throw new Error('Cuadro pixel art inválido: ' + id);
        const esc = j as EscenaPintada;
        // fotos de referencia: se cargan y se leen como píxeles antes de dibujar (si una falla, la escena se pinta sin ella)
        const pedidas: {clave: string; ruta: string}[] = [];
        for (const cap of esc.capas) {
          const archivo = cap.t === 'foto' ? String(cap.archivo ?? '').replace(/[^a-z0-9._-]/gi, '') : '';
          if (archivo) pedidas.push({clave: archivo, ruta: `referencias/${archivo}`});
        }
        const escenario = typeof esc.escenario === 'string' ? esc.escenario.replace(/[^a-z0-9-]/gi, '') : '';
        if (escenario) pedidas.push({clave: `escenarios/${escenario}`, ruta: `escenarios/${escenario}.png`});
        for (const {clave, ruta} of pedidas) {
          if (IMAGENES.has(clave)) continue;
          try {
            const img = new Image();
            img.src = staticFile(ruta);
            await img.decode();
            const c = document.createElement('canvas');
            c.width = img.naturalWidth; c.height = img.naturalHeight;
            const x = c.getContext('2d');
            if (!x) continue;
            x.drawImage(img, 0, 0);
            IMAGENES.set(clave, {w: c.width, h: c.height, d: x.getImageData(0, 0, c.width, c.height).data});
          } catch { /* sin la foto, la escena queda con sus formas */ }
        }
        setSpec(esc);
      });
  }, [id]);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c || !spec) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const g = new G(lw, lh);
    pintar(g, spec, frame / fps, lw, lh, Math.min(lw, lh) / 360);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(g.d), lw, lh), 0, 0);
    ctx.textBaseline = 'middle';
    for (const t of g.textos) {
      ctx.font = `${t.size}px ${FUENTE_PIXEL}`;
      ctx.textAlign = t.align ?? 'center';
      ctx.lineJoin = 'miter';
      ctx.lineWidth = Math.max(2, t.size / 4);
      ctx.strokeStyle = t.stroke ?? '#000';
      ctx.strokeText(t.s, t.x, t.y);
      ctx.fillStyle = t.fill;
      ctx.fillText(t.s, t.x, t.y);
    }
    if (fuente && !liberado.current) {
      liberado.current = true;
      continueRender(espera);
    }
  }, [frame, spec, fuente]);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <canvas ref={ref} width={lw} height={lh} style={{width: '100%', height: '100%', imageRendering: 'pixelated'}} />
    </AbsoluteFill>
  );
};

export const REGISTRO_PINTADO: Record<string, React.FC<PropsEscena>> = {
  pintado: ({parametro}) => <Lienzo id={parametro ?? ''} />,
};
