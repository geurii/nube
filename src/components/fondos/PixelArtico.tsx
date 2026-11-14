import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {rnd} from '../../lib/util';
import type {PropsEscena} from './Escenas';

const useTp = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return {t: frame / fps, tp: Math.floor((frame / fps) * 12) / 12};
};
const snap = (v: number, p: number) => Math.round(v / p) * p;

const Lienzo: React.FC<{children: React.ReactNode}> = ({children}) => (
  <AbsoluteFill style={{background: '#000', overflow: 'hidden'}}>
    <svg viewBox="0 0 1080 1920" width="100%" height="100%" shapeRendering="crispEdges">
      {children}
    </svg>
  </AbsoluteFill>
);
const Cielo: React.FC<{colores: string[]; y0?: number; alto: number}> = ({colores, y0 = 0, alto}) => (
  <g>
    {colores.map((c, i) => (
      <rect key={i} x={0} y={y0 + (alto / colores.length) * i} width={1080} height={alto / colores.length + 1} fill={c} />
    ))}
  </g>
);
const Nieve: React.FC<{tp: number; n?: number}> = ({tp, n = 70}) => (
  <g>
    {Array.from({length: n}).map((_, i) => {
      const y = ((tp * (120 + rnd(i, 2) * 160) + rnd(i, 3) * 2000) % 2000) - 40;
      const x = rnd(i, 1) * 1080 + Math.sin(tp * 1.5 + i) * 30;
      const s = rnd(i, 4) > 0.8 ? 12 : 6;
      return <rect key={i} x={snap(x, 6)} y={snap(y, 6)} width={s} height={s} fill="#fff" opacity={0.85} />;
    })}
  </g>
);

/* ---------- Ártico: aurora, hielo a la deriva y (opcional) la base soviética ---------- */
export const PixelArtico: React.FC<PropsEscena> = ({parametro}) => {
  const {t, tp} = useTp();
  const base = parametro === 'base';
  return (
    <Lienzo>
      <Cielo colores={['#050a1c', '#0a1330', '#0e1c44', '#12285a', '#1b3a6e']} alto={1150} />
      {Array.from({length: 45}).map((_, i) => {
        const x = i * 24;
        const h = 300 + Math.sin(tp * 0.9 + i * 0.35) * 160 + Math.sin(tp * 0.4 + i * 0.9) * 90;
        return (
          <g key={i}>
            <rect x={x} y={snap(380 - h / 2, 12)} width={24} height={snap(h, 12)} fill="#2fe6a0" opacity={0.16} />
            <rect x={x} y={snap(420 - h / 3, 12)} width={24} height={snap(h / 2, 12)} fill="#7a5cff" opacity={0.14} />
          </g>
        );
      })}
      {Array.from({length: 40}).map((_, i) =>
        Math.sin(tp * 3 + i * 1.7) > -0.2 ? <rect key={i} x={snap(rnd(i, 1) * 1060, 6)} y={snap(rnd(i, 2) * 800, 6)} width={6} height={6} fill="#fff" /> : null,
      )}
      {/* hielo */}
      <rect x={0} y={1150} width={1080} height={770} fill="#cfe8f5" />
      {Array.from({length: 14}).map((_, r) => (
        <g key={r}>
          {Array.from({length: 9}).map((__, k) => {
            const w = 120 + rnd(r * 9 + k, 5) * 160;
            const x = ((k * 190 - t * (6 + r * 3) + r * 70) % 1300) - 120;
            const c = (r + k) % 3 === 0 ? '#a9d2ea' : (r + k) % 3 === 1 ? '#e8f6ff' : '#bfe0f2';
            return <rect key={k} x={snap(x, 12)} y={1150 + r * 56} width={snap(w, 12)} height={44} fill={c} />;
          })}
          <rect x={snap(((r * 313 + t * 8) % 1100) - 20, 12)} y={1150 + r * 56 + 44} width={96} height={12} fill="#6e9fbd" />
        </g>
      ))}
      <rect x={0} y={1140} width={1080} height={14} fill="#fff" />
      {base && (
        <g>
          <rect x={560} y={940} width={300} height={170} fill="#7a1f1f" />
          <rect x={548} y={916} width={324} height={30} fill="#3a1212" />
          <rect x={600} y={990} width={64} height={64} fill={Math.sin(tp * 2.2) > -0.4 ? '#ffd66b' : '#4a3a1a'} />
          <rect x={780} y={1030} width={52} height={80} fill="#2a0c0c" />
          <rect x={910} y={770} width={14} height={340} fill="#444" />
          <rect x={874} y={820} width={86} height={12} fill="#444" />
          <rect x={874} y={870} width={86} height={12} fill="#444" />
          <rect x={906} y={742} width={22} height={22} fill={Math.sin(tp * 4) > 0 ? '#ff2d2d' : '#5a1010'} />
          <rect x={470} y={1090} width={560} height={24} fill="#f4fbff" />
        </g>
      )}
      <Nieve tp={tp} />
    </Lienzo>
  );
};

/* ---------- Avión con paracaidistas / rescate con globo ---------- */
export const PixelAvion: React.FC<PropsEscena> = ({parametro, duracion}) => {
  const {t, tp} = useTp();
  const p = Math.min(1, t / Math.max(duracion, 1));
  const avionX = parametro === 'rescate' ? 560 : snap(-300 + p * 1500, 12);
  const avionY = parametro === 'rescate' ? 560 : 560 + Math.round(Math.sin(tp * 2) * 2) * 6;
  const helice = Math.floor(tp * 24) % 2 === 0;
  return (
    <Lienzo>
      <Cielo colores={['#0b1d3a', '#12315c', '#1c4a7e', '#2f6aa3', '#5c97c9', '#9cc4e4', '#d6ecfa']} alto={1920} />
      {Array.from({length: 9}).map((_, i) => {
        const x = ((rnd(i, 1) * 1400 - t * (30 + rnd(i, 2) * 80)) % 1400) - 200;
        const y = 200 + rnd(i, 3) * 1300;
        const w = 180 + rnd(i, 4) * 220;
        return (
          <g key={i} fill="#fff" opacity={0.9}>
            <rect x={snap(x, 12)} y={snap(y, 12)} width={snap(w, 12)} height={48} />
            <rect x={snap(x + 36, 12)} y={snap(y - 36, 12)} width={snap(w - 100, 12)} height={48} />
          </g>
        );
      })}
      {/* avión */}
      <g transform={`translate(${avionX} ${avionY})`}>
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
          const y = 760 + ((t * 120 + k * 200) % 900);
          const x = snap(280 + k * 380 + Math.sin(t * 1.3 + k) * 40, 12);
          return (
            <g key={k}>
              <rect x={x} y={y} width={180} height={24} fill={k ? '#f2b400' : '#d7263d'} />
              <rect x={x + 24} y={y - 24} width={132} height={24} fill={k ? '#f2b400' : '#d7263d'} />
              <rect x={x + 60} y={y - 48} width={60} height={24} fill={k ? '#f2b400' : '#d7263d'} />
              <rect x={x + 6} y={y + 24} width={6} height={110} fill="#fff" />
              <rect x={x + 168} y={y + 24} width={6} height={110} fill="#fff" />
              <rect x={x + 72} y={y + 130} width={36} height={60} fill="#1c2b4a" />
              <rect x={x + 72} y={y + 110} width={36} height={24} fill="#f1c9a5" />
            </g>
          );
        })}
      {parametro === 'rescate' && (
        <g>
          {(() => {
            const sube = interpolate(t, [0, Math.max(duracion, 1)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
            const gx = snap(250 + sube * 280, 12);
            const gy = snap(1500 - sube * 780, 12);
            return (
              <g>
                <circle cx={250} cy={560} r={78} fill="#d7263d" />
                <rect x={246} y={640} width={8} height={gy - 640} fill="#fff" />
                <rect x={236 + (gx - 250)} y={gy} width={36} height={24} fill="#f1c9a5" />
                <rect x={230 + (gx - 250)} y={gy + 24} width={48} height={72} fill="#1c2b4a" />
                <rect x={230 + (gx - 250)} y={gy + 96} width={20} height={36} fill="#1c2b4a" />
                <rect x={256 + (gx - 250)} y={gy + 96} width={20} height={36} fill="#1c2b4a" />
              </g>
            );
          })()}
        </g>
      )}
    </Lienzo>
  );
};

/* ---------- Documentos y fotos ---------- */
export const PixelDocs: React.FC<PropsEscena> = () => {
  const {t, tp} = useTp();
  const flash = Math.max(0, 1 - ((t % 1.6) / 0.25));
  return (
    <Lienzo>
      <Cielo colores={['#1a120a', '#241a0f', '#2e2114', '#241a0f']} alto={1920} />
      {Array.from({length: 22}).map((_, i) => {
        const y = ((tp * (90 + rnd(i, 2) * 140) + rnd(i, 3) * 2200) % 2200) - 200;
        const x = snap(rnd(i, 1) * 900, 12);
        const foto = rnd(i, 5) > 0.6;
        return (
          <g key={i}>
            <rect x={x} y={snap(y, 12)} width={foto ? 150 : 120} height={foto ? 120 : 160} fill={foto ? '#d9d2c0' : '#f4efe0'} />
            {foto ? <rect x={x + 12} y={snap(y, 12) + 12} width={126} height={72} fill="#5b7488" /> : [0, 1, 2, 3, 4].map((k) => <rect key={k} x={x + 12} y={snap(y, 12) + 16 + k * 28} width={96 - (k % 2) * 30} height={8} fill="#6b6354" />)}
          </g>
        );
      })}
      <rect x={0} y={0} width={1080} height={1920} fill="#fff" opacity={flash * 0.6} />
    </Lienzo>
  );
};

/* ---------- Sonar bajo el hielo ---------- */
export const PixelSonar: React.FC<PropsEscena> = () => {
  const {t, tp} = useTp();
  const sx = snap(((t * 40) % 1500) - 300, 12);
  return (
    <Lienzo>
      <Cielo colores={['#e8f6ff', '#bfe0f2', '#06223f', '#08305a', '#0a3a6e', '#062447', '#031429']} y0={0} alto={1920} />
      <rect x={0} y={420} width={1080} height={36} fill="#8fc4df" />
      {Array.from({length: 12}).map((_, i) => (
        <rect key={i} x={i * 100 + 20} y={456} width={52} height={36 + (i % 3) * 36} fill="#8fc4df" />
      ))}
      {[0, 1, 2, 3].map((k) => {
        const r = ((t * 0.5 + k / 4) % 1) * 760;
        return <circle key={k} cx={540} cy={1060} r={r} fill="none" stroke="#7dffb0" strokeWidth={10} opacity={Math.max(0, 1 - r / 760)} />;
      })}
      <g transform={`translate(${sx} 960)`}>
        <rect x={0} y={60} width={420} height={72} fill="#2b3a4a" />
        <rect x={420} y={72} width={36} height={48} fill="#2b3a4a" />
        <rect x={-36} y={84} width={36} height={24} fill="#2b3a4a" />
        <rect x={150} y={12} width={96} height={48} fill="#34465a" />
        <rect x={190} y={-24} width={14} height={36} fill="#34465a" />
        <rect x={-48} y={36} width={24} height={72} fill="#1f2a36" />
      </g>
      <rect x={532} y={1040} width={16} height={16} fill="#7dffb0" />
    </Lienzo>
  );
};

export const REGISTRO_ARTICO: Record<string, React.FC<PropsEscena>> = {
  pixelartico: PixelArtico,
  pixelavion: PixelAvion,
  pixeldocs: PixelDocs,
  pixelsonar: PixelSonar,
};
