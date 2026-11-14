import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/PressStart2P';
import {formatearNumero, rnd} from '../../lib/util';
import type {PropsEscena} from './Escenas';

const {fontFamily: FUENTE_PIXEL} = loadFont();

/** Tiempo "escalonado" a 12 cuadros por segundo: da el movimiento entrecortado del pixel art. */
const useTp = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return {t: frame / fps, tp: Math.floor((frame / fps) * 12) / 12};
};

const snap = (v: number, p: number) => Math.round(v / p) * p;

const Sprite: React.FC<{
  filas: string[];
  paleta: Record<string, string>;
  x: number;
  y: number;
  p: number;
  opacidad?: number;
}> = ({filas, paleta, x, y, p, opacidad = 1}) => (
  <g opacity={opacidad}>
    {filas.flatMap((fila, j) =>
      [...fila].map((c, i) =>
        c !== '.' && paleta[c] ? (
          <rect key={`${i}-${j}`} x={x + i * p} y={y + j * p} width={p} height={p} fill={paleta[c]} />
        ) : null,
      ),
    )}
  </g>
);

const Lienzo: React.FC<{children: React.ReactNode; fondo?: string}> = ({children, fondo = '#000'}) => (
  <AbsoluteFill style={{background: fondo, overflow: 'hidden'}}>
    <svg viewBox="0 0 1080 1920" width="100%" height="100%" shapeRendering="crispEdges">
      {children}
    </svg>
  </AbsoluteFill>
);

/** Cielo en franjas de color (degradado "de píxeles"). */
const Cielo: React.FC<{colores: string[]; alto?: number}> = ({colores, alto = 1920}) => (
  <g>
    {colores.map((c, i) => (
      <rect key={i} x={0} y={(alto / colores.length) * i} width={1080} height={alto / colores.length + 1} fill={c} />
    ))}
  </g>
);

const Estrellas: React.FC<{tp: number; n?: number; alto?: number}> = ({tp, n = 40, alto = 900}) => (
  <g>
    {Array.from({length: n}).map((_, i) => {
      const on = Math.sin(tp * 3 + i * 1.7) > -0.3;
      const s = rnd(i, 5) > 0.8 ? 12 : 6;
      return on ? <rect key={i} x={snap(rnd(i, 1) * 1060, 6)} y={snap(rnd(i, 2) * alto, 6)} width={s} height={s} fill="#fff" /> : null;
    })}
  </g>
);

const CORAZON = ['.##.##.', '#######', '#######', '.#####.', '..###..', '...#...'];
const OJO = ['.wwwww.', 'wwkkkww', 'wwkkkww', '.wwwww.'];
const SIGNO = ['.###.', '#...#', '....#', '..##.', '..#..', '.....', '..#..'];
const VESTIDO = [
  '......###...###......',
  '......#d#...#d#......',
  '.....##dd###dd##.....',
  '.....#ddddddddd#.....',
  '.....#ddddddddd#.....',
  '......#ddddddd#......',
  '.......#ddddd#.......',
  '......##ddddd##......',
  '......#bbbbbbb#......',
  '.....#ddddddddd#.....',
  '.....#ddddddddd#.....',
  '....#ddddddddddd#....',
  '....#ddddddddddd#....',
  '...#ddddddddddddd#...',
  '...#ddddddddddddd#...',
  '..#ddddddddddddddd#..',
  '..#ddddddddddddddd#..',
  '.#ddddddddddddddddd#.',
  '.#ddddddddddddddddd#.',
  '#ddddddddddddddddddd#',
  '#ddddddddddddddddddd#',
  '#ddddddddddddddddddd#',
  '#####################',
];

/* ---------------- Ciudad pixel con parallax (noche) ---------------- */
export const PixelCiudad: React.FC<PropsEscena> = () => {
  const {t, tp} = useTp();
  const capas = [
    {vel: 20, color: '#1b1f4a', base: 1500, alto: 520, semilla: 1},
    {vel: 45, color: '#262a63', base: 1640, alto: 640, semilla: 2},
    {vel: 90, color: '#0f1030', base: 1800, alto: 760, semilla: 3},
  ];
  return (
    <Lienzo>
      <Cielo colores={['#0a0628', '#150a3a', '#240d4d', '#3a1259', '#5a1a63', '#8a2a6a', '#c2476a']} alto={1300} />
      <rect x={0} y={1300} width={1080} height={620} fill="#c2476a" />
      <Estrellas tp={tp} alto={700} />
      <g>
        <rect x={780} y={190} width={150} height={150} fill="#fff3c4" />
        <rect x={756} y={214} width={198} height={102} fill="#fff3c4" />
        <rect x={810} y={220} width={36} height={36} fill="#e8d28a" />
      </g>
      {capas.map((c, li) => {
        const ancho = 1200;
        const desplaza = (t * c.vel) % ancho;
        const edificios = Array.from({length: 14}).map((_, i) => ({
          x: i * 96 - desplaza,
          w: 72 + Math.floor(rnd(i, c.semilla) * 3) * 24,
          h: c.alto * (0.4 + rnd(i, c.semilla + 9) * 0.6),
        }));
        return (
          <g key={li}>
            {[0, 1].map((rep) =>
              edificios.map((b, i) => {
                const bx = snap(b.x + rep * ancho, 24);
                const by = snap(c.base - b.h, 24);
                return (
                  <g key={`${rep}-${i}`}>
                    <rect x={bx} y={by} width={b.w} height={b.h + 400} fill={c.color} />
                    {li > 0 &&
                      Array.from({length: Math.floor(b.h / 72)}).flatMap((__, r) =>
                        Array.from({length: Math.floor(b.w / 36) - 1}).map((___, k) => {
                          const luz = Math.sin(tp * 0.8 + i * 3 + r * 1.3 + k) > -0.2;
                          return luz ? <rect key={`${r}-${k}`} x={bx + 12 + k * 36} y={by + 24 + r * 72} width={18} height={24} fill="#ffd66b" /> : null;
                        }),
                      )}
                  </g>
                );
              }),
            )}
          </g>
        );
      })}
    </Lienzo>
  );
};

/* ---------------- Escenario pixel: telón, focos, público ---------------- */
export const PixelEscenario: React.FC<PropsEscena> = () => {
  const {t, tp} = useTp();
  const cols = Array.from({length: 23});
  return (
    <Lienzo fondo="#1a0509">
      <Cielo colores={['#2a0710', '#3d0a17', '#4f0d1e', '#3d0a17']} alto={1500} />
      {cols.map((_, i) => (
        <rect key={i} x={i * 48} y={0} width={48} height={420 + (i % 2) * 24 + Math.abs(Math.sin(tp * 1.5 + i)) * 12} fill={i % 2 ? '#8a1626' : '#6a0f1d'} />
      ))}
      {[0, 1].map((k) => {
        const ang = Math.sin(tp * 0.9 + k * 3) * 260;
        const cx = (k ? 760 : 320) + ang;
        return <polygon key={k} points={`${k ? 900 : 180},0 ${k ? 960 : 240},0 ${cx + 220},1500 ${cx - 220},1500`} fill="#fff1b8" opacity={0.17} />;
      })}
      {Array.from({length: 20}).map((_, i) => (
        <rect key={i} x={(i % 10) * 108} y={1500 + Math.floor(i / 10) * 60} width={108} height={60} fill={(i + Math.floor(i / 10)) % 2 ? '#8b6b3c' : '#6e5230'} />
      ))}
      {/* podio y público */}
      <rect x={420} y={1180} width={240} height={330} fill="#3a2a14" />
      <rect x={420} y={1180} width={240} height={24} fill="#c9a24a" />
      {Array.from({length: 12}).map((_, i) => {
        const bob = Math.round(Math.sin(tp * 4 + i * 1.9) * 2) * 6;
        return (
          <g key={i}>
            <rect x={i * 92 - 6} y={1700 + bob + (i % 2) * 30} width={72} height={72} fill="#0a0408" />
            <rect x={i * 92 - 30} y={1772 + bob + (i % 2) * 30} width={120} height={200} fill="#0a0408" />
          </g>
        );
      })}
      <Estrellas tp={tp} n={18} alto={400} />
      <rect x={0} y={0} width={1080} height={1920} fill="#000" opacity={0.15 + Math.max(0, Math.sin(t * 6)) * 0.03} />
    </Lienzo>
  );
};

/* ---------------- Vestido pixel que cambia de color con destello ---------------- */
const COLORES = [
  ['#d7263d', '#8f1226'],
  ['#1e5bff', '#0f2f94'],
  ['#f2b400', '#9a6f00'],
  ['#f6f3ee', '#b8b2a6'],
];
export const PixelVestido: React.FC<PropsEscena> = ({duracion}) => {
  const {t, tp} = useTp();
  const tramo = Math.max(duracion / COLORES.length, 0.9);
  const idx = Math.min(COLORES.length - 1, Math.floor(t / tramo));
  const enTramo = t - idx * tramo;
  const [c, o] = COLORES[idx];
  const destello = enTramo < 0.25 ? 1 - enTramo / 0.25 : 0;
  const p = 22;
  const dy = Math.round(Math.sin(tp * 3) * 2) * 6;
  return (
    <Lienzo>
      <Cielo colores={['#120a2b', '#1b0f3d', '#26144e', '#1b0f3d', '#120a2b']} alto={1920} />
      {Array.from({length: 12}).map((_, i) => {
        const a = (tp * 0.35 + i / 12) * Math.PI * 2;
        return <polygon key={i} points={`540,860 ${540 + Math.cos(a) * 1300},${860 + Math.sin(a) * 1300} ${540 + Math.cos(a + 0.12) * 1300},${860 + Math.sin(a + 0.12) * 1300}`} fill={c} opacity={0.12} />;
      })}
      <Estrellas tp={tp} n={50} alto={1800} />
      <Sprite filas={VESTIDO} paleta={{'#': '#0b0b14', d: c, b: o}} x={309} y={560 + dy} p={p} />
      <rect x={309} y={560 + dy} width={462} height={506} fill="#fff" opacity={destello * 0.9} />
      {Array.from({length: 14}).map((_, i) => {
        const s = Math.sin(tp * 5 + i * 2.3) > 0.2;
        return s ? <rect key={i} x={snap(260 + rnd(i, 3) * 560, 12)} y={snap(520 + rnd(i, 4) * 600, 12)} width={12} height={12} fill="#fff" /> : null;
      })}
      {COLORES.map((cc, i) => (
        <g key={i}>
          <rect x={290 + i * 130} y={1400} width={100} height={100} fill="#fff" />
          <rect x={296 + i * 130} y={1406} width={88} height={88} fill={i <= idx ? cc[0] : '#2a2a3a'} />
        </g>
      ))}
    </Lienzo>
  );
};

/* ---------------- Vistas: contador pixel con corazones y ojos ---------------- */
export const PixelVistas: React.FC<PropsEscena> = ({duracion, parametro}) => {
  const {t, tp} = useTp();
  const objetivo = Number(parametro ?? '1000000') || 1000000;
  const p = interpolate(t, [0, Math.max(duracion * 0.65, 1)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  const valor = objetivo * (1 - Math.pow(1 - p, 3));
  return (
    <Lienzo>
      <Cielo colores={['#06081c', '#0b1030', '#101842', '#0b1030']} alto={1920} />
      {Array.from({length: 22}).map((_, i) => {
        const y = 2000 - ((tp * (140 + rnd(i, 2) * 200) + rnd(i, 3) * 2000) % 2100);
        const x = snap(rnd(i, 1) * 960 + Math.sin(tp * 2 + i) * 20, 12);
        return rnd(i, 4) > 0.4 ? (
          <Sprite key={i} filas={CORAZON} paleta={{'#': '#ff3b6b'}} x={x} y={snap(y, 12)} p={12} />
        ) : (
          <Sprite key={i} filas={OJO} paleta={{w: '#fff', k: '#111'}} x={x} y={snap(y, 12)} p={12} />
        );
      })}
      <rect x={40} y={1130} width={1000} height={250} fill="#000" opacity={0.7} />
      <text x={540} y={1260} textAnchor="middle" fontFamily={FUENTE_PIXEL} fontSize={58} fill="#fff" stroke="#000" strokeWidth={10} paintOrder="stroke">
        {formatearNumero(valor)}
      </text>
      <text x={540} y={1340} textAnchor="middle" fontFamily={FUENTE_PIXEL} fontSize={34} fill="#ff3b6b">
        VISTAS
      </text>
    </Lienzo>
  );
};

/* ---------------- Misterio: signos de interrogación y lupa que escanea ---------------- */
export const PixelMisterio: React.FC<PropsEscena> = () => {
  const {t, tp} = useTp();
  const lx = snap(540 + Math.sin(t * 0.9) * 300, 12);
  const ly = snap(1000 + Math.cos(t * 0.7) * 420, 12);
  return (
    <Lienzo>
      <Cielo colores={['#050a1e', '#0a1340', '#0d1a55', '#0a1340', '#050a1e']} alto={1920} />
      {Array.from({length: 18}).map((_, i) => {
        const y = 2000 - ((tp * (50 + rnd(i, 2) * 80) + rnd(i, 3) * 2000) % 2100);
        const s = rnd(i, 4) > 0.7 ? 16 : 10;
        return <Sprite key={i} filas={SIGNO} paleta={{'#': i % 3 === 0 ? '#E8B20C' : '#4a5fa8'}} x={snap(rnd(i, 1) * 980, 12)} y={snap(y, 12)} p={s} />;
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

/* ---------------- Capas: tarjetas pixel que se sueltan por pasos ---------------- */
export const PixelCapas: React.FC<PropsEscena> = () => {
  const {t, tp} = useTp();
  const colores = ['#f6f3ee', '#f2b400', '#1e5bff', '#d7263d'];
  const ciclo = 1.4;
  const paso = Math.floor(t / ciclo);
  const enCiclo = (t % ciclo) / ciclo;
  return (
    <Lienzo>
      <Cielo colores={['#170d2b', '#1f1138', '#170d2b']} alto={1920} />
      <Estrellas tp={tp} n={30} alto={1900} />
      {colores
        .map((c, i) => ({c, i, idx: (((i - paso) % 4) + 4) % 4}))
        .sort((a, b) => b.idx - a.idx)
        .map(({c, i, idx}) => {
          const salida = idx === 0 ? interpolate(enCiclo, [0.45, 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}) : 0;
          const x = 240 + snap(salida * 900, 36) + idx * 12;
          const y = 1000 + idx * 18 - snap(salida * 300, 36);
          return (
            <g key={i} opacity={1 - salida * 0.85}>
              <rect x={x - 12} y={y - 12} width={624} height={744} fill="#0b0b14" />
              <rect x={x} y={y} width={600} height={720} fill={c} />
              <rect x={x} y={y + 690} width={600} height={30} fill="#000" opacity={0.18} />
              {[0, 1, 2, 3].map((k) => (
                <rect key={k} x={x + (k % 2 ? 520 : 40)} y={y + (k < 2 ? 40 : 640)} width={40} height={40} fill="#6b7280" />
              ))}
            </g>
          );
        })}
    </Lienzo>
  );
};

/* ---------------- Éxito: confeti cuadrado y fuegos pixel ---------------- */
export const PixelExito: React.FC<PropsEscena> = () => {
  const {t, tp} = useTp();
  const colores = ['#ff3b6b', '#E8B20C', '#1e5bff', '#22c55e', '#fff'];
  return (
    <Lienzo>
      <Cielo colores={['#12061f', '#1c0a30', '#2a0f45', '#1c0a30']} alto={1920} />
      {[0, 1, 2].map((k) => {
        const ciclo = (t * 0.7 + k / 3) % 1;
        const cx = [300, 780, 540][k];
        const cy = [700, 900, 1250][k];
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
      {Array.from({length: 60}).map((_, i) => {
        const y = ((tp * (260 + rnd(i, 2) * 300) + rnd(i, 3) * 2000) % 2100) - 100;
        return <rect key={i} x={snap(rnd(i, 1) * 1060 + Math.sin(tp * 2 + i) * 30, 12)} y={snap(y, 12)} width={18} height={30} fill={colores[i % 5]} />;
      })}
    </Lienzo>
  );
};

/* ---------------- Veredicto: pantalla partida roja / dorada ---------------- */
export const PixelVeredicto: React.FC<PropsEscena> = ({parametro}) => {
  const locura = parametro === 'locura';
  const proteccion = parametro === 'proteccion';
  const {t, tp} = useTp();
  const entrada = snap(interpolate(t, [0, 0.5], [600, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), 12);
  const pulso = Math.round(Math.sin(tp * 4) * 2) * 6;
  const tiembla = Math.round(Math.sin(tp * 20)) * 6;
  return (
    <Lienzo>
      <g transform={`translate(${tiembla} 0)`}>
        <Cielo colores={['#5a0f12', '#7f1d1d', '#a32020', '#7f1d1d', '#5a0f12']} alto={1920} />
        <g transform={`translate(${entrada} 0)`}>
          <rect x={540} y={0} width={540} height={1920} fill="#b8860b" />
          {Array.from({length: 8}).map((_, i) => (
            <rect key={i} x={540} y={i * 240} width={540} height={120} fill="#d4a017" />
          ))}
        </g>
        {Array.from({length: 12}).map((_, i) => (
          <rect key={i} x={528} y={i * 160 + ((tp * 80) % 160)} width={24} height={80} fill="#fff" />
        ))}
        <text x={270} y={640 + pulso} textAnchor="middle" fontFamily={FUENTE_PIXEL} fontSize={proteccion ? 40 : 54} fill="#fff" stroke="#000" strokeWidth={proteccion ? 6 : 12} paintOrder="stroke">
          {proteccion ? '¿PROTECCION' : locura ? '¿LOCURA' : '¿ESTAFADOR'}
        </text>
        <text x={810} y={1300 - pulso} textAnchor="middle" fontFamily={FUENTE_PIXEL} fontSize={proteccion ? 32 : locura ? 38 : 54} fill="#fff" stroke="#000" strokeWidth={proteccion ? 6 : 12} paintOrder="stroke">
          {proteccion ? 'O HIPOCRESIA?' : locura ? 'O GENIALIDAD?' : 'O GENIO?'}
        </text>
        <rect x={420} y={800 + pulso} width={240} height={240} fill="#fff" />
        <rect x={432} y={812 + pulso} width={216} height={216} fill="#111" />
        <Sprite filas={SIGNO} paleta={{'#': '#ffd84a'}} x={462} y={834 + pulso} p={24} />
      </g>
    </Lienzo>
  );
};

export const REGISTRO_PIXEL: Record<string, React.FC<PropsEscena>> = {
  pixelveredicto: PixelVeredicto,
  pixelciudad: PixelCiudad,
  pixelescenario: PixelEscenario,
  pixelvestido: PixelVestido,
  pixelvistas: PixelVistas,
  pixelmisterio: PixelMisterio,
  pixelcapas: PixelCapas,
  pixelexito: PixelExito,
};
