// Escenas pintadas por el Pintor de la oficina: fondo "pintado:<id>" -> lee public/pintados/<id>.json y lo dibuja en pixel art.
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/PressStart2P';
import {G} from './pixelG';
import {pintar, IMAGENES, type EscenaPintada} from './pintado';
import type {PropsEscena} from './Escenas';

const {fontFamily: FUENTE_PIXEL} = loadFont();
const F = 2;
const OBJETOS_NARRATIVOS = new Set(['barco','pez','hielo','faro','ovni','explosion','ciudad','bosque','arbol','edificio','central','pergamino','calendario','reloj','castillo','corona','libro','moneda','iglesia','caballo','silueta','astro','duna','montanas','hidrofono','sonar','microfono','volcan','fuego','lago','avion','tren','submarino','barril','cerveza','cerveceria','tsunami','deslizamiento']);
const CAPAS_PROHIBIDAS = new Set(['circulo','rect','poligono','linea','texto','foto']);

const Lienzo: React.FC<{id: string}> = ({id}) => {
  const {width, height, fps, durationInFrames} = useVideoConfig();
  const frame = useCurrentFrame();
  // Movimiento de cámara continuo también en escenas pixel art: evita que el plano parezca una imagen fija.
  const progreso = Math.min(1, Math.max(0, frame / Math.max(1, durationInFrames)));
  const direccion = (id.length % 2 === 0) ? 1 : -1;
  const escala = 1.035 + progreso * 0.055;
  const moverX = Math.sin(progreso * Math.PI) * 1.15 * direccion;
  const moverY = Math.sin(progreso * Math.PI * 1.4) * -0.7;
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
        const capaSinObjeto = esc.capas.some((cap) => CAPAS_PROHIBIDAS.has(String(cap?.t ?? '')));
        const protagonista = esc.capas.some((cap) => {
          const tipo = String(cap?.t ?? '');
          if (!OBJETOS_NARRATIVOS.has(tipo)) return false;
          if (tipo === 'bosque') return Number(cap?.n ?? 0) >= 6;
          const medidas = ['w','h','r','alto'].map((k) => Number(cap?.[k])).filter(Number.isFinite);
          return Math.max(0, ...medidas) >= 0.08;
        });
        if (capaSinObjeto || !protagonista) {
          throw new Error('Cuadro rechazado: contiene geometría suelta o no tiene un objeto protagonista reconocible y visible: ' + id);
        }
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
      <canvas ref={ref} width={lw} height={lh} style={{width: '100%', height: '100%', imageRendering: 'pixelated', transform: `scale(${escala}) translate(${moverX}%, ${moverY}%)`, transformOrigin: 'center center'}} />
    </AbsoluteFill>
  );
};

export const REGISTRO_PINTADO: Record<string, React.FC<PropsEscena>> = {
  pintado: ({parametro}) => <Lienzo id={parametro ?? ''} />,
};
