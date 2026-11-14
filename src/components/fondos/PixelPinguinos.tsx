// Escenas pixel de la serie "¿Por qué no comemos pingüino?". Funcionan en vertical (1080x1920) y
// horizontal (1920x1080): todo se coloca con fracciones del lienzo y una unidad `u`.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/PressStart2P';
import {formatearNumero, rnd} from '../../lib/util';
import type {PropsEscena} from './Escenas';

const {fontFamily: FUENTE_PIXEL} = loadFont();

const useDim = () => {
  const {width: W, height: H, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const t = frame / fps;
  return {W, H, t, tp: Math.floor(t * 12) / 12, horiz: W > H, u: Math.min(W, H) / 1080};
};
const snap = (v: number, p: number) => Math.round(v / p) * p;

const Lienzo: React.FC<{children: React.ReactNode}> = ({children}) => {
  const {width: W, height: H} = useVideoConfig();
  return (
    <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
      <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" shapeRendering="crispEdges">
        {children}
      </svg>
    </AbsoluteFill>
  );
};
const Bandas: React.FC<{colores: string[]; y0?: number; alto: number}> = ({colores, y0 = 0, alto}) => {
  const {width: W} = useVideoConfig();
  return (
    <g>
      {colores.map((c, i) => (
        <rect key={i} x={0} y={y0 + (alto / colores.length) * i} width={W} height={alto / colores.length + 1} fill={c} />
      ))}
    </g>
  );
};
const Sprite: React.FC<{filas: string[]; paleta: Record<string, string>; x: number; y: number; p: number; flip?: boolean}> = ({filas, paleta, x, y, p, flip}) => {
  const ancho = filas[0].length;
  return (
    <g>
      {filas.flatMap((fila, j) =>
        [...fila].map((c, i) =>
          c !== '.' && paleta[c] ? <rect key={`${i}-${j}`} x={x + (flip ? ancho - 1 - i : i) * p} y={y + j * p} width={p} height={p} fill={paleta[c]} /> : null,
        ),
      )}
    </g>
  );
};

/* ---------- Sprites ---------- */
const PINGUINO = [
  '....kkkkkk....',
  '...kkkkkkkk...',
  '..kkwkkkkwkk..',
  '..kkkkyykkkk..',
  '..kkkkyykkkk..',
  '..kkkkkkkkkk..',
  '.kkkwwwwwwkkk.',
  '.kkwwwwwwwwkk.',
  '.kkwwwwwwwwkk.',
  '.kkwwwwwwwwkk.',
  '.kkwwwwwwwwkk.',
  '..kwwwwwwwwk..',
  '..kkwwwwwwkk..',
  '...kkkkkkkk...',
];
const PIES_A = ['...yy....yy...', '..yyy....yyy..'];
const PIES_B = ['....yy..yy....', '...yyy..yyy...'];
const PALETA_PINGUINO = {k: '#12141c', w: '#f4f6fa', y: '#f2a81d'};

const Pinguino: React.FC<{x: number; y: number; p: number; paso: number; flip?: boolean}> = ({x, y, p, paso, flip}) => {
  const pies = paso % 2 === 0 ? PIES_A : PIES_B;
  const bob = paso % 2 === 0 ? 0 : -p;
  return (
    <g>
      <rect x={x + p} y={y + 16 * p} width={12 * p} height={p} fill="#000" opacity={0.22} />
      <Sprite filas={[...PINGUINO, ...pies]} paleta={PALETA_PINGUINO} x={x} y={y + bob} p={p} flip={flip} />
    </g>
  );
};

const AVE = ['.....rr.....', '....oooo....', '....ooyy....', '...oooo.....', '.oooooooo...', 'oooooooooo..', 'oooooooooooo', '.oooooooooo.', '..oooooooo..', '...y....y...'];
const SIGNO = ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'];
const HUEVO = ['..www..', '.wwwww.', 'wwwwwww', 'wwwwwww', 'wwwwwww', 'wwwwwww', '.wwwww.', '..www..'];

const Nieve: React.FC<{tp: number; n?: number; viento?: number}> = ({tp, n = 80, viento = 0}) => {
  const {width: W, height: H} = useVideoConfig();
  return (
    <g>
      {Array.from({length: n}).map((_, i) => {
        const v = 120 + rnd(i, 2) * 180;
        const y = ((tp * v + rnd(i, 3) * H * 1.2) % (H * 1.1)) - 30;
        const x = ((rnd(i, 1) * W + tp * viento * (0.5 + rnd(i, 6)) + Math.sin(tp * 1.5 + i) * 25) % (W + 60)) - 30;
        const s = rnd(i, 4) > 0.8 ? 12 : 6;
        return <rect key={i} x={snap(x, 6)} y={snap(y, 6)} width={s} height={s} fill="#fff" opacity={0.85} />;
      })}
    </g>
  );
};

/* ---------- Colonia de pingüinos (con cartel de prohibido si parametro = ley) ---------- */
export const PixelColonia: React.FC<PropsEscena> = ({parametro}) => {
  const {W, H, t, tp, horiz, u} = useDim();
  const hz = H * (horiz ? 0.5 : 0.46);
  return (
    <Lienzo>
      <Bandas colores={['#050a1c', '#0a1330', '#0e1c44', '#12285a', '#1b3a6e']} alto={hz + 1} />
      {Array.from({length: Math.ceil(W / 24)}).map((_, i) => {
        const h = (170 + Math.sin(tp * 0.9 + i * 0.35) * 90 + Math.sin(tp * 0.4 + i * 0.9) * 50) * u;
        return (
          <g key={i}>
            <rect x={i * 24} y={snap(hz * 0.42 - h / 2, 12)} width={24} height={snap(h, 12)} fill="#2fe6a0" opacity={0.16} />
            <rect x={i * 24} y={snap(hz * 0.5 - h / 3, 12)} width={24} height={snap(h / 2, 12)} fill="#7a5cff" opacity={0.14} />
          </g>
        );
      })}
      {Array.from({length: 50}).map((_, i) =>
        Math.sin(tp * 3 + i * 1.7) > -0.2 ? <rect key={i} x={snap(rnd(i, 1) * (W - 20), 6)} y={snap(rnd(i, 2) * hz * 0.9, 6)} width={6} height={6} fill="#fff" /> : null,
      )}
      <rect x={0} y={hz} width={W} height={H - hz} fill="#cfe8f5" />
      {Array.from({length: 9}).map((_, r) => (
        <g key={r}>
          {Array.from({length: Math.ceil(W / 150) + 2}).map((__, k) => {
            const w = 120 + rnd(r * 20 + k, 5) * 180;
            const x = ((k * 190 - t * (5 + r * 2) + r * 70) % (W + 380)) - 190;
            const c = (r + k) % 3 === 0 ? '#a9d2ea' : (r + k) % 3 === 1 ? '#e8f6ff' : '#bfe0f2';
            return <rect key={k} x={snap(x, 12)} y={hz + r * ((H - hz) / 9)} width={snap(w, 12)} height={(H - hz) / 9 - 8} fill={c} />;
          })}
        </g>
      ))}
      <rect x={0} y={hz - 8} width={W} height={12} fill="#fff" />
      {[0, 1, 2].map((fila) => {
        const p = Math.max(6, Math.round((6 + fila * 3) * u));
        const y = hz + (H - hz) * (0.12 + fila * 0.28);
        const sep = 14 * p * 1.9;
        const n = Math.ceil(W / sep) + 2;
        const vel = 14 + fila * 8;
        return Array.from({length: n}).map((_, i) => {
          const x = ((i * sep + t * vel + fila * 90) % (n * sep)) - sep;
          const paso = Math.floor(tp * 3 + i * 0.7 + fila) % 2;
          return <Pinguino key={`${fila}-${i}`} x={snap(x, p)} y={snap(y, p)} p={p} paso={paso} flip={(i + fila) % 3 === 0} />;
        });
      })}
      {parametro === 'ley' && (
        <g>
          <rect x={W * (horiz ? 0.72 : 0.62)} y={hz - 330 * u} width={24 * u} height={330 * u} fill="#6b4a2a" />
          <rect x={W * (horiz ? 0.72 : 0.62) - 140 * u} y={hz - 560 * u} width={304 * u} height={300 * u} fill="#f4f6fa" stroke="#111" strokeWidth={12 * u} />
          <circle cx={W * (horiz ? 0.72 : 0.62) + 12 * u} cy={hz - 410 * u} r={105 * u} fill="none" stroke="#d7263d" strokeWidth={26 * u} />
          <line x1={W * (horiz ? 0.72 : 0.62) - 62 * u} y1={hz - 484 * u} x2={W * (horiz ? 0.72 : 0.62) + 86 * u} y2={hz - 336 * u} stroke="#d7263d" strokeWidth={26 * u} />
          <Sprite filas={PINGUINO} paleta={PALETA_PINGUINO} x={W * (horiz ? 0.72 : 0.62) - 60 * u} y={hz - 480 * u} p={Math.max(4, Math.round(9 * u))} />
        </g>
      )}
      <Nieve tp={tp} />
    </Lienzo>
  );
};

/* ---------- Supermercado: pollo, pato, pavo... y el estante vacío del pingüino ---------- */
export const PixelSuper: React.FC<PropsEscena> = () => {
  const {W, H, t, tp, u} = useDim();
  const filas = 3;
  const colores = ['#e8a548', '#b9783b', '#c9672e', '#e8a548', '#b9783b', '#c9672e'];
  const p = Math.max(6, Math.round(12 * u));
  const parpadeo = Math.sin(tp * 5) > 0;
  return (
    <Lienzo>
      <rect x={0} y={0} width={W} height={H} fill="#e9e4d8" />
      {Array.from({length: Math.ceil(W / 96)}).map((_, i) => (
        <rect key={i} x={i * 96} y={0} width={4} height={H} fill="#d6d0c0" />
      ))}
      <rect x={0} y={H * 0.9} width={W} height={H * 0.1} fill="#8b8b95" />
      {Array.from({length: Math.ceil(W / 96)}).map((_, i) => (
        <rect key={i} x={i * 96} y={H * 0.9} width={48} height={H * 0.05} fill="#a3a3ad" />
      ))}
      <rect x={0} y={H * 0.04} width={W} height={H * 0.07} fill="#d7263d" />
      <text x={W / 2} y={H * 0.087} textAnchor="middle" fontFamily={FUENTE_PIXEL} fontSize={Math.round(38 * u)} fill="#fff">
        SUPERMERCADO
      </text>
      {Array.from({length: filas}).map((_, f) => {
        const y = H * (0.2 + f * 0.24);
        const n = Math.floor((W - 160) / (12 * p * 1.3));
        const sep = (W - 160) / n;
        return (
          <g key={f}>
            <rect x={60} y={y + 10 * p + 6} width={W - 120} height={p * 1.4} fill="#6b4a2a" />
            {Array.from({length: n}).map((__, i) => {
              const centro = f === 1 && i === Math.floor(n / 2);
              const x = 80 + i * sep;
              if (centro) {
                return (
                  <g key={i}>
                    <rect x={x - 6} y={y - 12} width={12 * p + 12} height={8 * p + 20} fill="none" stroke={parpadeo ? '#d7263d' : '#7a1020'} strokeWidth={8} strokeDasharray="16 10" />
                    <Sprite filas={SIGNO} paleta={{'#': '#9a9aa6'}} x={x + 2 * p} y={y - 2 * p} p={Math.round(p * 0.8)} />
                  </g>
                );
              }
              const rebote = Math.round(Math.sin(tp * 2 + i + f) * 0.5) * 3;
              return (
                <g key={i}>
                  <Sprite filas={AVE} paleta={{o: colores[(i + f) % colores.length], r: '#d7263d', y: '#f2a81d'}} x={x} y={y + rebote} p={p} />
                  <rect x={x + 3 * p} y={y + 10 * p + 14} width={6 * p} height={p * 0.9} fill="#fff" />
                </g>
              );
            })}
          </g>
        );
      })}
      <g transform={`translate(${W / 2 - 230 * u} ${H * 0.67 + Math.sin(t * 2) * 6})`}>
        <rect x={0} y={0} width={460 * u} height={120 * u} fill="#fff" stroke="#111" strokeWidth={8} />
        <text x={230 * u} y={78 * u} textAnchor="middle" fontFamily={FUENTE_PIXEL} fontSize={Math.round(34 * u)} fill="#d7263d">
          PINGUINO
        </text>
        <line x1={20 * u} y1={20 * u} x2={440 * u} y2={100 * u} stroke="#d7263d" strokeWidth={12} />
      </g>
    </Lienzo>
  );
};

/* ---------- Caldera de vapor con contador (≈ 2 millones) ---------- */
export const PixelCaldera: React.FC<PropsEscena> = ({duracion}) => {
  const {W, H, t, tp, horiz, u} = useDim();
  const objetivo = 2000000;
  const prog = interpolate(t, [0, Math.max(duracion * 0.8, 1)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const valor = objetivo * (1 - Math.pow(1 - prog, 3));
  const hz = H * 0.66;
  const cx = W * (horiz ? 0.34 : 0.5);
  const cw = 360 * u;
  return (
    <Lienzo>
      <Bandas colores={['#1b0f2e', '#2e1540', '#4a1d4f', '#7a2a55', '#b0405a', '#e0705a']} alto={hz} />
      <rect x={W * (horiz ? 0.7 : 0.7)} y={hz - 230 * u} width={150 * u} height={150 * u} fill="#ffe9a8" />
      <rect x={0} y={hz} width={W} height={H - hz} fill="#1d3557" />
      {Array.from({length: Math.ceil(W / 120)}).map((_, i) => {
        const dy = Math.round(Math.sin(tp * 2 + i * 0.8) * 2) * 6;
        return <rect key={i} x={i * 120 + ((tp * 20) % 120)} y={hz + 40 * u + (i % 3) * 36 * u + dy} width={72} height={12} fill="#3f6b9c" />;
      })}
      <rect x={0} y={hz} width={W} height={26 * u} fill="#2d2a2e" />
      {/* base de piedra y fuego */}
      <rect x={cx - cw * 0.62} y={hz - 70 * u} width={cw * 1.24} height={70 * u} fill="#4a4550" />
      {Array.from({length: 7}).map((_, i) => {
        const alto = (40 + Math.abs(Math.sin(tp * 6 + i * 1.4)) * 70) * u;
        return <rect key={i} x={cx - cw * 0.5 + i * (cw / 7)} y={hz - 70 * u - alto} width={cw / 7} height={alto} fill={i % 2 ? '#ff8a1f' : '#ffd23f'} />;
      })}
      {/* caldera */}
      <rect x={cx - cw * 0.55} y={hz - 330 * u} width={cw * 1.1} height={230 * u} fill="#16161d" />
      <rect x={cx - cw * 0.6} y={hz - 350 * u} width={cw * 1.2} height={36 * u} fill="#2a2a34" />
      <rect x={cx - cw * 0.45} y={hz - 300 * u} width={cw * 0.9} height={20 * u} fill="#3b3b49" />
      {Array.from({length: 5}).map((_, i) => (
        <rect key={i} x={cx - cw * 0.45 + i * (cw * 0.9) / 5 + ((tp * 40) % 40)} y={hz - 352 * u} width={20 * u} height={12 * u} fill="#d9d9e0" opacity={0.7} />
      ))}
      {/* vapor */}
      {Array.from({length: 14}).map((_, i) => {
        const ciclo = ((tp * 0.35 + rnd(i, 1)) % 1);
        const y = hz - 360 * u - ciclo * 520 * u;
        const x = cx - cw * 0.4 + rnd(i, 2) * cw * 0.8 + Math.sin(ciclo * 6 + i) * 40 * u;
        const s = (36 + ciclo * 70) * u;
        return <rect key={i} x={snap(x, 12)} y={snap(y, 12)} width={snap(s, 12)} height={snap(s * 0.7, 12)} fill="#f4f6fa" opacity={0.75 * (1 - ciclo)} />;
      })}
      {/* contador */}
      <rect x={W * (horiz ? 0.52 : 0.08)} y={H * (horiz ? 0.28 : 0.31)} width={W * (horiz ? 0.42 : 0.84)} height={200 * u} fill="#000" opacity={0.75} />
      <text x={W * (horiz ? 0.73 : 0.5)} y={H * (horiz ? 0.28 : 0.31) + 100 * u} textAnchor="middle" fontFamily={FUENTE_PIXEL} fontSize={Math.round((horiz ? 54 : 52) * u)} fill="#fff" stroke="#000" strokeWidth={10} paintOrder="stroke">
        {formatearNumero(valor)}
      </text>
      <text x={W * (horiz ? 0.73 : 0.5)} y={H * (horiz ? 0.28 : 0.31) + 170 * u} textAnchor="middle" fontFamily={FUENTE_PIXEL} fontSize={Math.round(32 * u)} fill="#ff8a8a">
        PINGUINOS
      </text>
    </Lienzo>
  );
};

/* ---------- Tormenta polar: expedición de invierno (con huevos al final si parametro = huevos) ---------- */
export const PixelTormenta: React.FC<PropsEscena> = ({parametro, duracion}) => {
  const {W, H, t, tp, u} = useDim();
  const hz = H * 0.7;
  const huevos = parametro === 'huevos' && t > duracion * 0.45;
  const pasoX = snap(W * 0.3 + Math.min(t / Math.max(duracion, 1), 1) * W * 0.38, 12);
  return (
    <Lienzo>
      <Bandas colores={['#03050c', '#070b18', '#0b1124', '#0f1830', '#14203f']} alto={hz + 1} />
      <rect x={0} y={hz} width={W} height={H - hz} fill="#9fb8d0" />
      {Array.from({length: 7}).map((_, i) => (
        <rect key={i} x={snap(((i * 330 - t * 30) % (W + 330)) - 100, 12)} y={hz + 30 * u + (i % 3) * 70 * u} width={240 * u} height={22 * u} fill="#c9dcec" />
      ))}
      {/* trineo y figuras con linterna */}
      <g transform={`translate(${pasoX} ${hz - 150 * u})`}>
        <rect x={140 * u} y={90 * u} width={200 * u} height={36 * u} fill="#5b4332" />
        <rect x={130 * u} y={126 * u} width={220 * u} height={12 * u} fill="#2b2b33" />
        {[0, 1].map((k) => {
          const bob = Math.round(Math.sin(tp * 6 + k) * 1) * 6;
          return (
            <g key={k} transform={`translate(${-k * 90 * u} ${bob})`}>
              <rect x={20 * u} y={0} width={44 * u} height={32 * u} fill="#f1c9a5" />
              <rect x={14 * u} y={32 * u} width={56 * u} height={72 * u} fill={k ? '#1d4e89' : '#8a1c1c'} />
              <rect x={14 * u} y={104 * u} width={22 * u} height={44 * u} fill="#1b1b22" />
              <rect x={44 * u} y={104 * u} width={22 * u} height={44 * u} fill="#1b1b22" />
              <line x1={70 * u} y1={60 * u} x2={140 * u} y2={100 * u} stroke="#d9d9e0" strokeWidth={6} />
            </g>
          );
        })}
        <rect x={-190 * u} y={40 * u} width={30 * u} height={36 * u} fill="#ffd66b" />
        <polygon points={`${-160 * u},${58 * u} ${-700 * u},${-80 * u} ${-700 * u},${200 * u}`} fill="#ffe9a8" opacity={0.12} />
      </g>
      {/* ráfagas de viento */}
      {Array.from({length: 16}).map((_, i) => {
        const x = ((tp * (500 + rnd(i, 1) * 300) + rnd(i, 2) * W) % (W + 400)) - 300;
        return <rect key={i} x={snap(x, 12)} y={snap(rnd(i, 3) * hz, 12)} width={snap(120 + rnd(i, 4) * 200, 12)} height={6} fill="#fff" opacity={0.55} />;
      })}
      <Nieve tp={tp} n={140} viento={700} />
      {huevos && (
        <g>
          <rect x={0} y={0} width={W} height={H} fill="#000" opacity={0.55} />
          <circle cx={W / 2} cy={H * 0.5} r={260 * u} fill="#ffe9a8" opacity={0.18 + Math.abs(Math.sin(tp * 3)) * 0.1} />
          {[-1, 0, 1].map((k) => (
            <Sprite key={k} filas={HUEVO} paleta={{w: '#f6f1e3'}} x={W / 2 + k * 150 * u - 42 * u} y={H * 0.5 - 56 * u + Math.round(Math.sin(tp * 3 + k) * 1) * 6} p={Math.max(6, Math.round(12 * u))} />
          ))}
          <text x={W / 2} y={H * 0.5 + 170 * u} textAnchor="middle" fontFamily={FUENTE_PIXEL} fontSize={Math.round(40 * u)} fill="#fff" stroke="#000" strokeWidth={10} paintOrder="stroke">
            3 HUEVOS
          </text>
        </g>
      )}
    </Lienzo>
  );
};

export const REGISTRO_PINGUINOS: Record<string, React.FC<PropsEscena>> = {
  pixelcolonia: PixelColonia,
  pixelsuper: PixelSuper,
  pixelcaldera: PixelCaldera,
  pixeltormenta: PixelTormenta,
};
