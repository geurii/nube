// Versiones HORIZONTALES (1920x1080) de las escenas pixel. Los Shorts siguen usando las verticales.
import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/PressStart2P';
import {rnd} from '../../lib/util';
import type {PropsEscena} from './Escenas';

const {fontFamily: FUENTE_PIXEL} = loadFont();
const W = 1920;
const H = 1080;

const useTp = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return {t: frame / fps, tp: Math.floor((frame / fps) * 12) / 12};
};
const snap = (v: number, p: number) => Math.round(v / p) * p;

const Lienzo: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" height="100%" shapeRendering="crispEdges">
      {children}
    </svg>
  </AbsoluteFill>
);
const Cielo: React.FC<{colores: string[]; y0?: number; alto?: number}> = ({colores, y0 = 0, alto = H}) => (
  <g>
    {colores.map((c, i) => (
      <rect key={i} x={0} y={y0 + (alto / colores.length) * i} width={W} height={alto / colores.length + 1} fill={c} />
    ))}
  </g>
);
const Sprite: React.FC<{filas: string[]; paleta: Record<string, string>; x: number; y: number; p: number}> = ({filas, paleta, x, y, p}) => (
  <g>
    {filas.flatMap((fila, j) =>
      [...fila].map((c, i) => (c !== '.' && paleta[c] ? <rect key={`${i}-${j}`} x={x + i * p} y={y + j * p} width={p} height={p} fill={paleta[c]} /> : null)),
    )}
  </g>
);
const SIGNO = ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'];

const Nieve: React.FC<{tp: number; n?: number}> = ({tp, n = 90}) => (
  <g>
    {Array.from({length: n}).map((_, i) => {
      const y = ((tp * (120 + rnd(i, 2) * 160) + rnd(i, 3) * 1300) % 1300) - 40;
      const x = rnd(i, 1) * W + Math.sin(tp * 1.5 + i) * 30;
      const s = rnd(i, 4) > 0.8 ? 12 : 6;
      return <rect key={i} x={snap(x, 6)} y={snap(y, 6)} width={s} height={s} fill="#fff" opacity={0.85} />;
    })}
  </g>
);

/* ---------- Ártico: aurora, hielo a la deriva y la base soviética ---------- */
export const PixelArticoH: React.FC<PropsEscena> = ({parametro}) => {
  const {t, tp} = useTp();
  const hz = 600;
  const base = parametro === 'base';
  return (
    <Lienzo>
      <Cielo colores={['#050a1c', '#0a1330', '#0e1c44', '#12285a', '#1b3a6e']} alto={hz + 1} />
      {Array.from({length: 80}).map((_, i) => {
        const h = 170 + Math.sin(tp * 0.9 + i * 0.35) * 90 + Math.sin(tp * 0.4 + i * 0.9) * 50;
        return (
          <g key={i}>
            <rect x={i * 24} y={snap(210 - h / 2, 12)} width={24} height={snap(h, 12)} fill="#2fe6a0" opacity={0.16} />
            <rect x={i * 24} y={snap(250 - h / 3, 12)} width={24} height={snap(h / 2, 12)} fill="#7a5cff" opacity={0.14} />
          </g>
        );
      })}
      {Array.from({length: 60}).map((_, i) =>
        Math.sin(tp * 3 + i * 1.7) > -0.2 ? <rect key={i} x={snap(rnd(i, 1) * 1900, 6)} y={snap(rnd(i, 2) * 540, 6)} width={6} height={6} fill="#fff" /> : null,
      )}
      <rect x={0} y={hz} width={W} height={H - hz} fill="#cfe8f5" />
      {Array.from({length: 8}).map((_, r) => (
        <g key={r}>
          {Array.from({length: 15}).map((__, k) => {
            const w = 140 + rnd(r * 15 + k, 5) * 200;
            const x = ((k * 190 - t * (6 + r * 3) + r * 70) % 2850) - 150;
            const c = (r + k) % 3 === 0 ? '#a9d2ea' : (r + k) % 3 === 1 ? '#e8f6ff' : '#bfe0f2';
            return <rect key={k} x={snap(x, 12)} y={hz + r * 60} width={snap(w, 12)} height={48} fill={c} />;
          })}
          <rect x={snap(((r * 313 + t * 8) % 1800) - 20, 12)} y={hz + r * 60 + 48} width={96} height={12} fill="#6e9fbd" />
        </g>
      ))}
      <rect x={0} y={hz - 10} width={W} height={14} fill="#fff" />
      {base && (
        <g>
          <rect x={1100} y={hz - 190} width={320} height={190} fill="#7a1f1f" />
          <rect x={1084} y={hz - 224} width={352} height={34} fill="#3a1212" />
          <rect x={1150} y={hz - 140} width={64} height={64} fill={Math.sin(tp * 2.2) > -0.4 ? '#ffd66b' : '#4a3a1a'} />
          <rect x={1330} y={hz - 110} width={56} height={110} fill="#2a0c0c" />
          <rect x={1480} y={hz - 430} width={14} height={430} fill="#444" />
          <rect x={1444} y={hz - 380} width={86} height={12} fill="#444" />
          <rect x={1444} y={hz - 330} width={86} height={12} fill="#444" />
          <rect x={1476} y={hz - 458} width={22} height={22} fill={Math.sin(tp * 4) > 0 ? '#ff2d2d' : '#5a1010'} />
          <rect x={1000} y={hz - 18} width={560} height={24} fill="#f4fbff" />
        </g>
      )}
      <Nieve tp={tp} />
    </Lienzo>
  );
};

/* ---------- Avión con paracaidistas / rescate con globo ---------- */
export const PixelAvionH: React.FC<PropsEscena> = ({parametro, duracion}) => {
  const {t, tp} = useTp();
  const rescate = parametro === 'rescate';
  const p = Math.min(1, t / Math.max(duracion, 1));
  const px = rescate ? 1250 : snap(-450 + p * (W + 700), 12);
  const py = rescate ? 250 : 380 + Math.round(Math.sin(tp * 2) * 2) * 6;
  const helice = Math.floor(tp * 24) % 2 === 0;
  return (
    <Lienzo>
      <Cielo colores={['#0b1d3a', '#12315c', '#1c4a7e', '#2f6aa3', '#5c97c9', '#9cc4e4', '#d6ecfa']} />
      {Array.from({length: 11}).map((_, i) => {
        const x = ((rnd(i, 1) * 2400 - t * (30 + rnd(i, 2) * 80)) % 2400) - 300;
        const y = 80 + rnd(i, 3) * 850;
        const w = 180 + rnd(i, 4) * 240;
        return (
          <g key={i} fill="#fff" opacity={0.9}>
            <rect x={snap(x, 12)} y={snap(y, 12)} width={snap(w, 12)} height={48} />
            <rect x={snap(x + 36, 12)} y={snap(y - 36, 12)} width={snap(w - 100, 12)} height={48} />
          </g>
        );
      })}
      <g transform={`translate(${px} ${py})`}>
        <rect x={0} y={24} width={330} height={52} fill="#9aa4ad" />
        <rect x={330} y={36} width={36} height={32} fill="#9aa4ad" />
        <rect x={366} y={48} width={24} height={16} fill="#c9d1d8" />
        <rect x={0} y={0} width={36} height={36} fill="#7d8791" />
        <rect x={-12} y={-12} width={24} height={36} fill="#7d8791" />
        <rect x={90} y={76} width={150} height={20} fill="#7d8791" />
        <rect x={110} y={-20} width={150} height={20} fill="#7d8791" />
        <rect x={110} y={0} width={150} height={24} fill="#6a747e" />
        {[150, 210].map((x) => (
          <rect key={x} x={x} y={helice ? -4 : 8} width={14} height={helice ? 96 : 72} fill="#222" />
        ))}
        {[60, 100, 140, 180, 220].map((x) => (
          <rect key={x} x={x} y={36} width={24} height={20} fill="#1a2430" />
        ))}
        <rect x={0} y={58} width={330} height={8} fill="#3d4650" />
      </g>
      {parametro === 'paracaidas' &&
        [0, 1].map((k) => {
          const y = 420 + ((t * 110 + k * 260) % 560);
          const x = snap(500 + k * 650 + Math.sin(t * 1.3 + k) * 40, 12);
          const c = k ? '#f2b400' : '#d7263d';
          return (
            <g key={k}>
              <rect x={x} y={y} width={180} height={24} fill={c} />
              <rect x={x + 24} y={y - 24} width={132} height={24} fill={c} />
              <rect x={x + 60} y={y - 48} width={60} height={24} fill={c} />
              <rect x={x + 6} y={y + 24} width={6} height={110} fill="#fff" />
              <rect x={x + 168} y={y + 24} width={6} height={110} fill="#fff" />
              <rect x={x + 72} y={y + 130} width={36} height={60} fill="#1c2b4a" />
              <rect x={x + 72} y={y + 110} width={36} height={24} fill="#f1c9a5" />
            </g>
          );
        })}
      {rescate &&
        (() => {
          const sube = interpolate(t, [0, Math.max(duracion, 1)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
          const gx = snap(620 + sube * 520, 12);
          const gy = snap(960 - sube * 640, 12);
          return (
            <g>
              <circle cx={620} cy={200} r={70} fill="#d7263d" />
              <line x1={620} y1={270} x2={gx + 18} y2={gy} stroke="#fff" strokeWidth={8} />
              <rect x={gx} y={gy} width={36} height={24} fill="#f1c9a5" />
              <rect x={gx - 6} y={gy + 24} width={48} height={72} fill="#1c2b4a" />
              <rect x={gx - 6} y={gy + 96} width={20} height={36} fill="#1c2b4a" />
              <rect x={gx + 22} y={gy + 96} width={20} height={36} fill="#1c2b4a" />
            </g>
          );
        })()}
    </Lienzo>
  );
};

/* ---------- Documentos y fotos ---------- */
export const PixelDocsH: React.FC<PropsEscena> = () => {
  const {t, tp} = useTp();
  const flash = Math.max(0, 1 - (t % 1.6) / 0.25);
  return (
    <Lienzo>
      <Cielo colores={['#1a120a', '#241a0f', '#2e2114', '#241a0f']} />
      {Array.from({length: 30}).map((_, i) => {
        const y = ((tp * (90 + rnd(i, 2) * 140) + rnd(i, 3) * 1500) % 1500) - 200;
        const x = snap(rnd(i, 1) * 1750, 12);
        const foto = rnd(i, 5) > 0.6;
        return (
          <g key={i}>
            <rect x={x} y={snap(y, 12)} width={foto ? 150 : 120} height={foto ? 120 : 160} fill={foto ? '#d9d2c0' : '#f4efe0'} />
            {foto ? (
              <rect x={x + 12} y={snap(y, 12) + 12} width={126} height={72} fill="#5b7488" />
            ) : (
              [0, 1, 2, 3, 4].map((k) => <rect key={k} x={x + 12} y={snap(y, 12) + 16 + k * 28} width={96 - (k % 2) * 30} height={8} fill="#6b6354" />)
            )}
          </g>
        );
      })}
      <rect x={0} y={0} width={W} height={H} fill="#fff" opacity={flash * 0.6} />
    </Lienzo>
  );
};

/* ---------- Sonar bajo el hielo ---------- */
export const PixelSonarH: React.FC<PropsEscena> = () => {
  const {t} = useTp();
  const sx = snap(((t * 40) % 2400) - 350, 12);
  return (
    <Lienzo>
      <Cielo colores={['#bfe0f2', '#06223f', '#08305a', '#0a3a6e', '#062447', '#031429']} />
      <rect x={0} y={150} width={W} height={36} fill="#8fc4df" />
      {Array.from({length: 21}).map((_, i) => (
        <rect key={i} x={i * 96 + 20} y={186} width={52} height={36 + (i % 3) * 30} fill="#8fc4df" />
      ))}
      {[0, 1, 2, 3].map((k) => {
        const r = ((t * 0.5 + k / 4) % 1) * 700;
        return <circle key={k} cx={960} cy={620} r={r} fill="none" stroke="#7dffb0" strokeWidth={10} opacity={Math.max(0, 1 - r / 700)} />;
      })}
      <g transform={`translate(${sx} 540)`}>
        <rect x={0} y={60} width={420} height={72} fill="#2b3a4a" />
        <rect x={420} y={72} width={36} height={48} fill="#2b3a4a" />
        <rect x={-36} y={84} width={36} height={24} fill="#2b3a4a" />
        <rect x={150} y={12} width={96} height={48} fill="#34465a" />
        <rect x={190} y={-24} width={14} height={36} fill="#34465a" />
        <rect x={-48} y={36} width={24} height={72} fill="#1f2a36" />
      </g>
      <rect x={952} y={612} width={16} height={16} fill="#7dffb0" />
    </Lienzo>
  );
};

/* ---------- Misterio ---------- */
export const PixelMisterioH: React.FC<PropsEscena> = () => {
  const {t, tp} = useTp();
  const lx = snap(960 + Math.sin(t * 0.9) * 600, 12);
  const ly = snap(540 + Math.cos(t * 0.7) * 230, 12);
  return (
    <Lienzo>
      <Cielo colores={['#050a1e', '#0a1340', '#0d1a55', '#0a1340', '#050a1e']} />
      {Array.from({length: 26}).map((_, i) => {
        const y = 1180 - ((tp * (50 + rnd(i, 2) * 80) + rnd(i, 3) * 1400) % 1400);
        const s = rnd(i, 4) > 0.7 ? 16 : 10;
        return <Sprite key={i} filas={SIGNO} paleta={{'#': i % 3 === 0 ? '#E8B20C' : '#4a5fa8'}} x={snap(rnd(i, 1) * 1860, 12)} y={snap(y, 12)} p={s} />;
      })}
      <circle cx={lx} cy={ly} r={260} fill="#fff6c8" opacity={0.1} />
      <circle cx={lx} cy={ly} r={150} fill="#fff6c8" opacity={0.12} />
      <g>
        <rect x={lx - 130} y={ly - 130} width={260} height={24} fill="#E8B20C" />
        <rect x={lx - 130} y={ly + 106} width={260} height={24} fill="#E8B20C" />
        <rect x={lx - 130} y={ly - 130} width={24} height={260} fill="#E8B20C" />
        <rect x={lx + 106} y={ly - 130} width={24} height={260} fill="#E8B20C" />
        <rect x={lx + 130} y={ly + 130} width={48} height={48} fill="#8a5f05" />
        <rect x={lx + 178} y={ly + 178} width={96} height={48} fill="#5b4332" />
        <Sprite filas={SIGNO} paleta={{'#': '#ffd84a'}} x={lx - 50} y={ly - 70} p={20} />
      </g>
    </Lienzo>
  );
};

/* ---------- Éxito ---------- */
export const PixelExitoH: React.FC<PropsEscena> = () => {
  const {t, tp} = useTp();
  const colores = ['#ff3b6b', '#E8B20C', '#1e5bff', '#22c55e', '#fff'];
  return (
    <Lienzo>
      <Cielo colores={['#12061f', '#1c0a30', '#2a0f45', '#1c0a30']} />
      {[0, 1, 2].map((k) => {
        const ciclo = (t * 0.7 + k / 3) % 1;
        const cx = [480, 1440, 960][k];
        const cy = [380, 520, 760][k];
        return (
          <g key={k}>
            {Array.from({length: 12}).map((_, i) => {
              const a = (i / 12) * Math.PI * 2;
              const r = ciclo * 330;
              return <rect key={i} x={snap(cx + Math.cos(a) * r, 12)} y={snap(cy + Math.sin(a) * r + ciclo * ciclo * 90, 12)} width={18} height={18} fill={colores[(i + k) % 5]} opacity={1 - ciclo} />;
            })}
          </g>
        );
      })}
      {Array.from({length: 90}).map((_, i) => {
        const y = ((tp * (260 + rnd(i, 2) * 300) + rnd(i, 3) * 1300) % 1300) - 100;
        return <rect key={i} x={snap(rnd(i, 1) * 1900 + Math.sin(tp * 2 + i) * 30, 12)} y={snap(y, 12)} width={18} height={30} fill={colores[i % 5]} />;
      })}
    </Lienzo>
  );
};

/* ---------- Veredicto: pantalla partida roja / dorada ---------- */
export const PixelVeredictoH: React.FC<PropsEscena> = ({parametro}) => {
  const locura = parametro === 'locura';
  const {t, tp} = useTp();
  const entrada = snap(interpolate(t, [0, 0.5], [960, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), 12);
  const pulso = Math.round(Math.sin(tp * 4) * 2) * 6;
  const tiembla = Math.round(Math.sin(tp * 20)) * 6;
  const estilo = {fontFamily: FUENTE_PIXEL, fill: '#fff', stroke: '#000', strokeWidth: 12, paintOrder: 'stroke'} as const;
  return (
    <Lienzo>
      <g transform={`translate(${tiembla} 0)`}>
        <Cielo colores={['#5a0f12', '#7f1d1d', '#a32020', '#7f1d1d', '#5a0f12']} />
        <g transform={`translate(${entrada} 0)`}>
          <rect x={960} y={0} width={960} height={H} fill="#b8860b" />
          {Array.from({length: 5}).map((_, i) => (
            <rect key={i} x={960} y={i * 216} width={960} height={108} fill="#d4a017" />
          ))}
        </g>
        {Array.from({length: 8}).map((_, i) => (
          <rect key={i} x={948} y={i * 160 + ((tp * 80) % 160) - 160} width={24} height={80} fill="#fff" />
        ))}
        <text x={480} y={330 + pulso} textAnchor="middle" fontSize={60} {...estilo}>
          {locura ? '¿LOCURA' : '¿ESTAFADOR'}
        </text>
        <text x={1440} y={830 - pulso} textAnchor="middle" fontSize={locura ? 46 : 60} {...estilo}>
          {locura ? 'O GENIALIDAD?' : 'O GENIO?'}
        </text>
        <rect x={840} y={420 + pulso} width={240} height={240} fill="#fff" />
        <rect x={852} y={432 + pulso} width={216} height={216} fill="#111" />
        <Sprite filas={SIGNO} paleta={{'#': '#ffd84a'}} x={900} y={468 + pulso} p={24} />
      </g>
    </Lienzo>
  );
};

export const REGISTRO_H: Record<string, React.FC<PropsEscena>> = {
  pixelartico: PixelArticoH,
  pixelavion: PixelAvionH,
  pixeldocs: PixelDocsH,
  pixelsonar: PixelSonarH,
  pixelmisterio: PixelMisterioH,
  pixelexito: PixelExitoH,
  pixelveredicto: PixelVeredictoH,
};
