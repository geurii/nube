import React from 'react';

/**
 * Ilustraciones vectoriales (SVG) para los Shorts infantiles de colores.
 * Todo está dibujado en código: degradados, brillos, sombras y contorno oscuro, para que se vea
 * nítido en cualquier resolución. Cada objeto cabe en un lienzo de 600 x 600.
 */

export type ColorId = 'rojo' | 'azul' | 'amarillo' | 'verde' | 'naranja' | 'morado' | 'rosa';

export type Paleta = {
  nombre: string; // "ROJO"
  principal: string;
  claro: string;
  oscuro: string;
  fondoA: string;
  fondoB: string;
  fondoC: string;
  rayos: string;
  texto: string; // color del borde del rótulo
};

export const PALETAS: Record<ColorId, Paleta> = {
  rojo: {nombre: 'ROJO', principal: '#E5202E', claro: '#FF6B6B', oscuro: '#8D0B1D', fondoA: '#FFE3E3', fondoB: '#FF9AA2', fondoC: '#FF5C6C', rayos: '#FFFFFF', texto: '#8D0B1D'},
  azul: {nombre: 'AZUL', principal: '#1E6FEB', claro: '#7DB7FF', oscuro: '#0B3A91', fondoA: '#DDF1FF', fondoB: '#8CC8FF', fondoC: '#3F8BFF', rayos: '#FFFFFF', texto: '#0B3A91'},
  amarillo: {nombre: 'AMARILLO', principal: '#FFC400', claro: '#FFE766', oscuro: '#B07A00', fondoA: '#FFF8D1', fondoB: '#FFE066', fondoC: '#FFB300', rayos: '#FFFFFF', texto: '#8A5A00'},
  verde: {nombre: 'VERDE', principal: '#23B04A', claro: '#8EE07A', oscuro: '#0E6B2C', fondoA: '#E3FBD8', fondoB: '#9BE37E', fondoC: '#3CC06A', rayos: '#FFFFFF', texto: '#0E6B2C'},
  naranja: {nombre: 'NARANJA', principal: '#FF7A00', claro: '#FFB060', oscuro: '#A84500', fondoA: '#FFEBD2', fondoB: '#FFB866', fondoC: '#FF8A1F', rayos: '#FFFFFF', texto: '#A84500'},
  morado: {nombre: 'MORADO', principal: '#8E3CF0', claro: '#C79BFF', oscuro: '#4B1A94', fondoA: '#EEDFFF', fondoB: '#C89BFF', fondoC: '#9B55F5', rayos: '#FFFFFF', texto: '#4B1A94'},
  rosa: {nombre: 'ROSA', principal: '#FF4FA3', claro: '#FF9CCB', oscuro: '#A3175F', fondoA: '#FFE0F0', fondoB: '#FFA6D2', fondoC: '#FF5FAE', rayos: '#FFFFFF', texto: '#A3175F'},
};

export const NOMBRES: Record<string, string> = {
  manzana: 'MANZANA', fresa: 'FRESA', mariquita: 'MARIQUITA',
  ballena: 'BALLENA', gota: 'GOTA', globo: 'GLOBO',
  pollito: 'POLLITO', sol: 'SOL', platano: 'PLÁTANO',
  rana: 'RANA', hoja: 'HOJA', pera: 'PERA',
  zanahoria: 'ZANAHORIA', naranja: 'NARANJA', calabaza: 'CALABAZA',
  uvas: 'UVAS', berenjena: 'BERENJENA', flor: 'FLOR',
  cerdito: 'CERDITO', helado: 'HELADO', corazon: 'CORAZÓN',
};

const CONTORNO = '#2B1B2E';

/** Sombra suave en el suelo */
const Sombra: React.FC<{cx?: number; cy?: number; rx?: number}> = ({cx = 300, cy = 548, rx = 170}) => (
  <ellipse cx={cx} cy={cy} rx={rx} ry={rx * 0.13} fill="#000" opacity={0.18} />
);

/** Carita kawaii: ojos con brillo, boca y mejillas */
const Cara: React.FC<{x: number; y: number; s?: number; boca?: 'sonrisa' | 'abierta'}> = ({x, y, s = 1, boca = 'abierta'}) => (
  <g transform={`translate(${x} ${y}) scale(${s})`}>
    <ellipse cx={-48} cy={0} rx={17} ry={22} fill="#2B1B2E" />
    <ellipse cx={48} cy={0} rx={17} ry={22} fill="#2B1B2E" />
    <circle cx={-53} cy={-8} r={7} fill="#fff" />
    <circle cx={43} cy={-8} r={7} fill="#fff" />
    <circle cx={-42} cy={7} r={3.5} fill="#fff" />
    <circle cx={54} cy={7} r={3.5} fill="#fff" />
    <ellipse cx={-82} cy={30} rx={19} ry={11} fill="#FF6F91" opacity={0.55} />
    <ellipse cx={82} cy={30} rx={19} ry={11} fill="#FF6F91" opacity={0.55} />
    {boca === 'abierta' ? (
      <>
        <path d="M-24 22 Q0 62 24 22 Z" fill="#7A1630" stroke={CONTORNO} strokeWidth={5} strokeLinejoin="round" />
        <path d="M-12 40 Q0 32 12 40 Q0 52 -12 40 Z" fill="#FF7A93" />
      </>
    ) : (
      <path d="M-26 24 Q0 56 26 24" fill="none" stroke={CONTORNO} strokeWidth={6} strokeLinecap="round" />
    )}
  </g>
);

/** Brillo blanco para dar volumen */
const Brillo: React.FC<{x: number; y: number; rx: number; ry: number; rot?: number; o?: number}> = ({x, y, rx, ry, rot = -25, o = 0.55}) => (
  <ellipse cx={x} cy={y} rx={rx} ry={ry} fill="#fff" opacity={o} transform={`rotate(${rot} ${x} ${y})`} />
);

const Grad: React.FC<{id: string; a: string; b: string; c?: string; cx?: number; cy?: number}> = ({id, a, b, c, cx = 0.35, cy = 0.3}) => (
  <radialGradient id={id} cx={cx} cy={cy} r={0.85}>
    <stop offset="0%" stopColor={a} />
    <stop offset={c ? '55%' : '100%'} stopColor={b} />
    {c && <stop offset="100%" stopColor={c} />}
  </radialGradient>
);

type Dibujo = React.FC<{uid: string}>;

// ---------------------------------------------------------------- ROJO
const Manzana: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#FF8A8A" b="#E5202E" c="#8D0B1D" /></defs>
    <Sombra />
    <path d="M300 205 C240 150 110 190 115 335 C120 470 215 545 300 520 C385 545 480 470 485 335 C490 190 360 150 300 205 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <path d="M300 205 C296 170 305 140 330 112" fill="none" stroke="#6B3E1B" strokeWidth={16} strokeLinecap="round" />
    <path d="M318 150 C350 100 420 100 450 125 C420 175 350 180 318 150 Z" fill="#35B04A" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" />
    <path d="M330 148 C370 135 410 130 438 128" fill="none" stroke="#1B7A31" strokeWidth={5} strokeLinecap="round" />
    <Brillo x={190} y={290} rx={30} ry={58} rot={20} />
    <Cara x={300} y={365} s={1.05} />
  </g>
);

const Fresa: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#FF7B7B" b="#E5202E" c="#8D0B1D" /></defs>
    <Sombra />
    <path d="M300 535 C180 480 105 360 125 270 C145 190 455 190 475 270 C495 360 420 480 300 535 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    {[[200, 270], [300, 255], [400, 270], [160, 330], [250, 330], [350, 330], [440, 330], [210, 395], [300, 400], [390, 395], [255, 462], [345, 462]].map(([x, y], i) => (
      <ellipse key={i} cx={x} cy={y} rx={8} ry={12} fill="#FFE55C" stroke="#B88A00" strokeWidth={2.5} transform={`rotate(${(i % 3) * 12 - 12} ${x} ${y})`} />
    ))}
    <path d="M300 215 L245 140 L285 170 L300 105 L318 170 L360 140 Z" fill="#2FB24C" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" />
    <path d="M195 232 L150 195 L215 205 Z M405 232 L450 195 L385 205 Z" fill="#2FB24C" stroke={CONTORNO} strokeWidth={6} strokeLinejoin="round" />
    <Brillo x={180} y={300} rx={20} ry={45} rot={18} />
    <Cara x={300} y={340} s={0.95} />
  </g>
);

const Mariquita: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#FF7A7A" b="#E5202E" c="#8D0B1D" /></defs>
    <Sombra />
    <ellipse cx={300} cy={335} rx={185} ry={178} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} />
    <path d="M300 160 L300 512" stroke={CONTORNO} strokeWidth={8} />
    {[[215, 280, 34], [385, 280, 34], [195, 385, 28], [405, 385, 28], [255, 460, 24], [345, 460, 24]].map(([x, y, r], i) => (
      <circle key={i} cx={x} cy={y} r={r} fill={CONTORNO} />
    ))}
    <path d="M135 255 A 175 130 0 0 1 465 255 Q 300 175 135 255 Z" fill={CONTORNO} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <path d="M250 150 C 220 90 180 80 150 95 M350 150 C 380 90 420 80 450 95" fill="none" stroke={CONTORNO} strokeWidth={8} strokeLinecap="round" />
    <circle cx={150} cy={95} r={13} fill={CONTORNO} />
    <circle cx={450} cy={95} r={13} fill={CONTORNO} />
    <ellipse cx={250} cy={215} rx={26} ry={32} fill="#fff" stroke={CONTORNO} strokeWidth={5} />
    <ellipse cx={350} cy={215} rx={26} ry={32} fill="#fff" stroke={CONTORNO} strokeWidth={5} />
    <circle cx={255} cy={222} r={13} fill={CONTORNO} />
    <circle cx={345} cy={222} r={13} fill={CONTORNO} />
    <circle cx={260} cy={217} r={5} fill="#fff" />
    <circle cx={350} cy={217} r={5} fill="#fff" />
    <Brillo x={190} y={330} rx={20} ry={44} rot={20} o={0.45} />
  </g>
);

// ---------------------------------------------------------------- AZUL
const Ballena: Dibujo = ({uid}) => (
  <g>
    <defs>
      <Grad id={`${uid}g`} a="#8CC8FF" b="#1E6FEB" c="#0B3A91" />
    </defs>
    <Sombra rx={190} />
    {/* chorro */}
    <path d="M250 190 C 240 130 195 120 175 100 M250 190 C 262 130 305 120 330 100 M250 190 L250 120" fill="none" stroke="#7DD3FF" strokeWidth={14} strokeLinecap="round" />
    <circle cx={175} cy={96} r={14} fill="#B8E8FF" />
    <circle cx={330} cy={96} r={14} fill="#B8E8FF" />
    <circle cx={250} cy={112} r={12} fill="#B8E8FF" />
    {/* cola */}
    <path d="M455 360 C 500 330 520 280 500 235 C 545 240 575 275 565 320 C 575 285 600 275 618 290 C 600 335 540 385 470 400 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    {/* cuerpo */}
    <path d="M70 380 C 70 245 190 185 300 195 C 420 205 505 290 480 400 C 455 500 300 535 190 500 C 115 478 70 440 70 380 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    {/* panza */}
    <path d="M110 420 C 190 485 360 500 465 410 C 440 505 300 535 190 500 C 140 485 110 455 110 420 Z" fill="#D5ECFF" opacity={0.95} />
    <path d="M150 440 L330 470 M175 465 L345 490 M215 485 L370 495" stroke="#9CCBFF" strokeWidth={5} strokeLinecap="round" />
    {/* aleta */}
    <path d="M285 405 C 270 465 320 485 355 470 C 350 440 325 410 285 405 Z" fill="#1558C9" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" />
    <Brillo x={180} y={270} rx={26} ry={52} rot={55} o={0.5} />
    <Cara x={225} y={345} s={0.95} />
  </g>
);

const Gota: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#A8D8FF" b="#1E6FEB" c="#0B3A91" /></defs>
    <Sombra rx={150} />
    <path d="M300 75 C 300 75 150 270 150 375 C 150 465 215 535 300 535 C 385 535 450 465 450 375 C 450 270 300 75 300 75 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <Brillo x={205} y={360} rx={22} ry={70} rot={12} o={0.6} />
    <circle cx={228} cy={275} r={14} fill="#fff" opacity={0.7} />
    <Cara x={305} y={395} s={0.95} />
  </g>
);

const Globo: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#8FC4FF" b="#1E6FEB" c="#0B3A91" /></defs>
    <Sombra rx={110} />
    <path d="M300 400 C 270 470 330 490 300 560" fill="none" stroke="#5A4A5E" strokeWidth={6} strokeLinecap="round" />
    <path d="M300 55 C 175 55 110 150 120 255 C 130 355 215 410 300 415 C 385 410 470 355 480 255 C 490 150 425 55 300 55 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <path d="M300 412 L275 445 L325 445 Z" fill="#1558C9" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" />
    <Brillo x={195} y={170} rx={26} ry={58} rot={30} o={0.6} />
    <Cara x={300} y={250} s={0.95} />
  </g>
);

// ---------------------------------------------------------------- AMARILLO
const Pollito: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#FFF3A0" b="#FFC400" c="#D99400" /></defs>
    <Sombra rx={150} />
    <path d="M230 500 L215 548 M215 548 L180 548 M215 548 L200 568 M370 500 L385 548 M385 548 L420 548 M385 548 L400 568" stroke="#FF7A00" strokeWidth={13} strokeLinecap="round" fill="none" />
    <ellipse cx={300} cy={345} rx={190} ry={175} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} />
    <path d="M270 175 C 255 125 280 100 300 120 C 310 90 345 100 335 175 Z" fill="#FFC400" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" />
    <path d="M115 350 C 55 360 55 440 120 440 C 140 410 135 380 115 350 Z M485 350 C 545 360 545 440 480 440 C 460 410 465 380 485 350 Z" fill="#FFB300" stroke={CONTORNO} strokeWidth={8} strokeLinejoin="round" />
    <path d="M262 365 L338 365 L300 412 Z" fill="#FF7A00" stroke={CONTORNO} strokeWidth={8} strokeLinejoin="round" />
    <path d="M300 365 L300 392" stroke="#B34A00" strokeWidth={4} />
    <Brillo x={195} y={265} rx={22} ry={50} rot={30} />
    <g transform="translate(300 300)">
      <ellipse cx={-62} cy={0} rx={19} ry={25} fill={CONTORNO} />
      <ellipse cx={62} cy={0} rx={19} ry={25} fill={CONTORNO} />
      <circle cx={-68} cy={-9} r={8} fill="#fff" />
      <circle cx={56} cy={-9} r={8} fill="#fff" />
      <ellipse cx={-105} cy={42} rx={21} ry={12} fill="#FF6F91" opacity={0.55} />
      <ellipse cx={105} cy={42} rx={21} ry={12} fill="#FF6F91" opacity={0.55} />
    </g>
  </g>
);

const Sol: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#FFF6A8" b="#FFC400" c="#FF9D00" /></defs>
    {Array.from({length: 12}).map((_, i) => (
      <path key={i} d="M300 40 L322 120 L278 120 Z" fill="#FFB300" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" transform={`rotate(${i * 30} 300 300)`} />
    ))}
    <circle cx={300} cy={300} r={170} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} />
    <Brillo x={225} y={225} rx={26} ry={52} rot={45} />
    <Cara x={300} y={305} s={1.05} boca="sonrisa" />
  </g>
);

const Platano: Dibujo = ({uid}) => (
  <g>
    <defs>
      <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFF08A" />
        <stop offset="60%" stopColor="#FFC400" />
        <stop offset="100%" stopColor="#D99400" />
      </linearGradient>
    </defs>
    <Sombra rx={160} />
    <path d="M150 130 C 100 270 150 470 330 520 C 430 548 520 500 540 420 C 450 475 330 450 270 360 C 225 295 225 205 235 140 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <path d="M150 130 L238 138 L232 85 L162 80 Z" fill="#7B5A2A" stroke={CONTORNO} strokeWidth={8} strokeLinejoin="round" />
    <path d="M530 410 L548 440 L520 462 Z" fill="#4A3418" stroke={CONTORNO} strokeWidth={6} strokeLinejoin="round" />
    <path d="M200 160 C 185 270 220 390 320 455" fill="none" stroke="#E6A700" strokeWidth={5} strokeLinecap="round" opacity={0.7} />
    <Brillo x={205} y={250} rx={11} ry={60} rot={-8} />
    <Cara x={355} y={438} s={0.62} boca="sonrisa" />
  </g>
);

// ---------------------------------------------------------------- VERDE
const Rana: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#B8F58A" b="#23B04A" c="#0E6B2C" /></defs>
    <Sombra rx={190} />
    <path d="M110 470 C 60 480 60 545 130 545 L 190 545 C 190 500 170 470 110 470 Z M490 470 C 540 480 540 545 470 545 L 410 545 C 410 500 430 470 490 470 Z" fill="#1E9A41" stroke={CONTORNO} strokeWidth={8} strokeLinejoin="round" />
    <ellipse cx={300} cy={365} rx={200} ry={170} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} />
    <ellipse cx={300} cy={440} rx={125} ry={80} fill="#E7FFC9" opacity={0.9} />
    <circle cx={200} cy={215} r={62} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} />
    <circle cx={400} cy={215} r={62} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} />
    <circle cx={200} cy={218} r={40} fill="#fff" stroke={CONTORNO} strokeWidth={5} />
    <circle cx={400} cy={218} r={40} fill="#fff" stroke={CONTORNO} strokeWidth={5} />
    <circle cx={206} cy={224} r={22} fill={CONTORNO} />
    <circle cx={394} cy={224} r={22} fill={CONTORNO} />
    <circle cx={213} cy={215} r={8} fill="#fff" />
    <circle cx={401} cy={215} r={8} fill="#fff" />
    <path d="M205 385 Q300 470 395 385" fill="#7A1630" stroke={CONTORNO} strokeWidth={8} strokeLinejoin="round" />
    <path d="M250 428 Q300 408 350 428 Q300 455 250 428 Z" fill="#FF7A93" />
    <circle cx={255} cy={325} r={7} fill={CONTORNO} />
    <circle cx={345} cy={325} r={7} fill={CONTORNO} />
    <ellipse cx={130} cy={385} rx={22} ry={13} fill="#FF6F91" opacity={0.5} />
    <ellipse cx={470} cy={385} rx={22} ry={13} fill="#FF6F91" opacity={0.5} />
    <Brillo x={165} y={330} rx={18} ry={42} rot={25} o={0.45} />
  </g>
);

const Hoja: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#B8F58A" b="#23B04A" c="#0E6B2C" /></defs>
    <Sombra rx={130} />
    <path d="M300 560 L300 470" stroke="#6B4A1B" strokeWidth={18} strokeLinecap="round" />
    <path d="M300 480 C 120 460 90 250 300 70 C 510 250 480 460 300 480 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <path d="M300 480 L300 120 M300 400 L215 330 M300 400 L385 330 M300 320 L225 255 M300 320 L375 255 M300 245 L255 200 M300 245 L345 200" stroke="#0E6B2C" strokeWidth={7} strokeLinecap="round" fill="none" opacity={0.75} />
    <Brillo x={195} y={300} rx={16} ry={70} rot={-12} o={0.4} />
    <Cara x={300} y={385} s={0.7} />
  </g>
);

const Pera: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#D7FF9A" b="#7ED64A" c="#2F9A2C" /></defs>
    <Sombra rx={150} />
    <path d="M300 125 C 230 125 215 215 190 265 C 110 335 100 460 190 515 C 255 555 345 555 410 515 C 500 460 490 335 410 265 C 385 215 370 125 300 125 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <path d="M300 130 C 296 100 305 75 325 55" fill="none" stroke="#6B3E1B" strokeWidth={15} strokeLinecap="round" />
    <path d="M318 95 C 350 45 420 50 440 80 C 410 125 350 130 318 95 Z" fill="#1FA84A" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" />
    <Brillo x={185} y={400} rx={20} ry={58} rot={12} o={0.5} />
    <Cara x={300} y={385} s={1.0} />
  </g>
);

// ---------------------------------------------------------------- NARANJA
const Zanahoria: Dibujo = ({uid}) => (
  <g>
    <defs>
      <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#FFB060" />
        <stop offset="55%" stopColor="#FF7A00" />
        <stop offset="100%" stopColor="#C85200" />
      </linearGradient>
    </defs>
    <Sombra rx={110} />
    <path d="M300 150 C 250 70 215 70 205 40 C 255 40 285 90 300 130 C 315 80 345 40 400 45 C 385 75 345 85 300 150 Z" fill="#2FB24C" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" />
    <path d="M300 130 C 300 90 300 60 300 30" fill="none" stroke="#2FB24C" strokeWidth={22} strokeLinecap="round" />
    <path d="M300 30 L300 130" stroke={CONTORNO} strokeWidth={4} opacity={0.4} />
    <path d="M200 175 C 200 150 400 150 400 175 C 420 300 340 470 300 565 C 260 470 180 300 200 175 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <path d="M215 250 L255 250 M345 300 L388 300 M235 380 L270 380 M330 420 L360 420 M280 500 L305 500" stroke="#C85200" strokeWidth={6} strokeLinecap="round" />
    <Brillo x={235} y={250} rx={12} ry={50} rot={-8} o={0.5} />
    <Cara x={300} y={285} s={0.8} />
  </g>
);

const Naranja: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#FFC57A" b="#FF7A00" c="#B34A00" /></defs>
    <Sombra />
    <circle cx={300} cy={330} r={195} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} />
    {Array.from({length: 26}).map((_, i) => {
      const a = (i * 137.5 * Math.PI) / 180;
      const r = 40 + ((i * 29) % 135);
      return <circle key={i} cx={300 + Math.cos(a) * r} cy={330 + Math.sin(a) * r} r={4} fill="#C85200" opacity={0.45} />;
    })}
    <path d="M300 140 C 300 118 305 105 318 95" fill="none" stroke="#6B3E1B" strokeWidth={12} strokeLinecap="round" />
    <path d="M315 120 C 345 70 415 70 435 100 C 410 145 345 150 315 120 Z" fill="#2FB24C" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" />
    <Brillo x={190} y={250} rx={28} ry={58} rot={40} />
    <Cara x={300} y={355} s={1.05} />
  </g>
);

const Calabaza: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#FFB35C" b="#FF7A00" c="#B34A00" /></defs>
    <Sombra rx={200} />
    <path d="M285 200 C 280 150 300 115 335 95 L 355 125 C 330 140 325 170 335 205 Z" fill="#4A8A2A" stroke={CONTORNO} strokeWidth={8} strokeLinejoin="round" />
    <ellipse cx={170} cy={365} rx={115} ry={165} fill="#E56700" stroke={CONTORNO} strokeWidth={9} />
    <ellipse cx={430} cy={365} rx={115} ry={165} fill="#E56700" stroke={CONTORNO} strokeWidth={9} />
    <ellipse cx={235} cy={365} rx={120} ry={178} fill="#FF8A1F" stroke={CONTORNO} strokeWidth={9} />
    <ellipse cx={365} cy={365} rx={120} ry={178} fill="#FF8A1F" stroke={CONTORNO} strokeWidth={9} />
    <ellipse cx={300} cy={365} rx={102} ry={185} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} />
    <Brillo x={255} y={285} rx={16} ry={58} rot={10} o={0.5} />
    <Cara x={300} y={385} s={0.9} />
  </g>
);

// ---------------------------------------------------------------- MORADO
const Uvas: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#D9B3FF" b="#8E3CF0" c="#4B1A94" /></defs>
    <Sombra rx={150} />
    <path d="M300 130 C 295 95 310 70 335 55" fill="none" stroke="#6B3E1B" strokeWidth={14} strokeLinecap="round" />
    <path d="M320 95 C 360 40 435 45 455 80 C 425 130 355 135 320 95 Z" fill="#2FB24C" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" />
    {[
      [215, 215], [300, 205], [385, 215],
      [175, 300], [260, 295], [340, 295], [425, 300],
      [215, 385], [300, 380], [385, 385],
      [255, 465], [345, 465],
      [300, 535],
    ].map(([x, y], i) => (
      <g key={i}>
        <circle cx={x} cy={y} r={48} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={7} />
        <ellipse cx={x - 16} cy={y - 18} rx={9} ry={16} fill="#fff" opacity={0.55} transform={`rotate(25 ${x - 16} ${y - 18})`} />
      </g>
    ))}
    <Cara x={300} y={335} s={0.62} />
  </g>
);

const Berenjena: Dibujo = ({uid}) => (
  <g>
    <defs>
      <linearGradient id={`${uid}g`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="#B57BFF" />
        <stop offset="55%" stopColor="#7B2FD6" />
        <stop offset="100%" stopColor="#3B1180" />
      </linearGradient>
    </defs>
    <Sombra rx={150} />
    <path d="M300 150 C 205 150 150 230 160 330 C 170 440 220 540 300 545 C 380 540 430 440 440 330 C 450 230 395 150 300 150 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <path d="M300 152 C 255 135 215 150 175 185 C 215 205 255 195 300 215 C 345 195 385 205 425 185 C 385 150 345 135 300 152 Z" fill="#2FB24C" stroke={CONTORNO} strokeWidth={8} strokeLinejoin="round" />
    <path d="M300 130 C 296 85 310 60 340 45" fill="none" stroke="#2A8A3A" strokeWidth={22} strokeLinecap="round" />
    <Brillo x={205} y={340} rx={18} ry={70} rot={8} o={0.5} />
    <Cara x={300} y={375} s={0.95} />
  </g>
);

const Flor: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#E0C2FF" b="#9B55F5" c="#5B22B0" cx={0.5} cy={0.45} /></defs>
    <Sombra rx={120} />
    <path d="M300 420 L300 565" stroke="#2A8A3A" strokeWidth={20} strokeLinecap="round" />
    <path d="M300 500 C 360 470 420 480 450 520 C 400 545 340 540 300 500 Z" fill="#2FB24C" stroke={CONTORNO} strokeWidth={7} strokeLinejoin="round" />
    {Array.from({length: 8}).map((_, i) => (
      <ellipse key={i} cx={300} cy={125} rx={52} ry={95} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={8} transform={`rotate(${i * 45} 300 300) translate(0 -10)`} />
    ))}
    <circle cx={300} cy={300} r={92} fill="#FFD84A" stroke={CONTORNO} strokeWidth={9} />
    <Brillo x={265} y={265} rx={14} ry={26} rot={35} />
    <Cara x={300} y={305} s={0.78} boca="sonrisa" />
  </g>
);

// ---------------------------------------------------------------- ROSA
const Cerdito: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#FFC4E0" b="#FF7FBC" c="#D63A8A" /></defs>
    <Sombra rx={170} />
    <path d="M150 190 L120 85 L230 135 Z M450 190 L480 85 L370 135 Z" fill="#FF6FB0" stroke={CONTORNO} strokeWidth={8} strokeLinejoin="round" />
    <path d="M148 165 L135 118 L195 142 Z M452 165 L465 118 L405 142 Z" fill="#FFB0D6" />
    <ellipse cx={300} cy={340} rx={205} ry={185} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} />
    <ellipse cx={300} cy={395} rx={92} ry={68} fill="#FF98C9" stroke={CONTORNO} strokeWidth={8} />
    <ellipse cx={268} cy={395} rx={13} ry={22} fill={CONTORNO} />
    <ellipse cx={332} cy={395} rx={13} ry={22} fill={CONTORNO} />
    <Brillo x={185} y={265} rx={22} ry={48} rot={30} />
    <g transform="translate(300 300)">
      <ellipse cx={-85} cy={0} rx={18} ry={24} fill={CONTORNO} />
      <ellipse cx={85} cy={0} rx={18} ry={24} fill={CONTORNO} />
      <circle cx={-91} cy={-9} r={7} fill="#fff" />
      <circle cx={79} cy={-9} r={7} fill="#fff" />
      <ellipse cx={-125} cy={50} rx={21} ry={12} fill="#FF3D7F" opacity={0.5} />
      <ellipse cx={125} cy={50} rx={21} ry={12} fill="#FF3D7F" opacity={0.5} />
    </g>
  </g>
);

const Helado: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#FFC4E0" b="#FF5FAE" c="#C42A7A" /></defs>
    <Sombra rx={120} />
    <path d="M180 330 L300 570 L420 330 Z" fill="#E8B068" stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <path d="M215 345 L355 480 M260 345 L380 440 M300 345 L395 395 M385 345 L245 485 M340 345 L270 540 M240 345 L330 545" stroke="#B9783A" strokeWidth={5} strokeLinecap="round" />
    <circle cx={300} cy={300} r={140} fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} />
    <path d="M165 330 C 190 365 215 335 240 365 C 265 335 290 370 315 340 C 340 370 365 335 390 365 C 410 340 430 365 440 335 L 440 320 L 160 320 Z" fill="#FF9CCB" stroke={CONTORNO} strokeWidth={8} strokeLinejoin="round" />
    <circle cx={300} cy={130} r={30} fill="#D81B3C" stroke={CONTORNO} strokeWidth={7} />
    <path d="M300 102 C 310 70 335 55 355 50" fill="none" stroke="#6B3E1B" strokeWidth={7} strokeLinecap="round" />
    <Brillo x={225} y={225} rx={16} ry={36} rot={40} />
    <Cara x={300} y={285} s={0.8} />
  </g>
);

const Corazon: Dibujo = ({uid}) => (
  <g>
    <defs><Grad id={`${uid}g`} a="#FFB3D7" b="#FF4FA3" c="#B01768" /></defs>
    <Sombra rx={150} />
    <path d="M300 540 C 120 420 70 330 70 250 C 70 160 140 105 215 105 C 255 105 285 125 300 160 C 315 125 345 105 385 105 C 460 105 530 160 530 250 C 530 330 480 420 300 540 Z" fill={`url(#${uid}g)`} stroke={CONTORNO} strokeWidth={9} strokeLinejoin="round" />
    <Brillo x={170} y={210} rx={22} ry={48} rot={35} o={0.6} />
    <Cara x={300} y={290} s={1.0} />
  </g>
);

export const DIBUJOS: Record<string, Dibujo> = {
  manzana: Manzana, fresa: Fresa, mariquita: Mariquita,
  ballena: Ballena, gota: Gota, globo: Globo,
  pollito: Pollito, sol: Sol, platano: Platano,
  rana: Rana, hoja: Hoja, pera: Pera,
  zanahoria: Zanahoria, naranja: Naranja, calabaza: Calabaza,
  uvas: Uvas, berenjena: Berenjena, flor: Flor,
  cerdito: Cerdito, helado: Helado, corazon: Corazon,
};

export const Objeto: React.FC<{id: string; uid: string; size: number}> = ({id, uid, size}) => {
  const D = DIBUJOS[id];
  if (!D) return null;
  return (
    <svg viewBox="0 0 600 600" width={size} height={size} style={{overflow: 'visible'}}>
      <D uid={uid} />
    </svg>
  );
};
