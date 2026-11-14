import React from 'react';
import {Img, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import type {Esquina} from '../lib/tipos';

const ORO_CLARO = '#ffe27a';
const ORO = '#e0a912';
const ORO_OSCURO = '#8a5f05';

type Props = {esquina?: Esquina; ancho?: number; imagen?: string | null};

/**
 * Personaje de la marca (referencia: muñeco 3D, pelo negro, lentes oscuros, traje azul
 * marino, corbata dorada, pañuelo blanco y lupa dorada con signo de interrogación).
 *
 * Si existe public/personaje/personaje.png (PNG con fondo transparente) se usa esa imagen
 * real; si no, se dibuja esta versión vectorial sombreada. Siempre se mueve suavemente.
 */
export const Personaje: React.FC<Props> = ({esquina = 'arriba-derecha', ancho = 400, imagen}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const t = frame / fps;

  const flotar = Math.sin(t * 2.0) * 8;
  const inclinar = Math.sin(t * 1.3) * 2.2;
  const lupaGiro = Math.sin(t * 1.7) * 3;
  const pulso = 1 + Math.sin(t * 3.0) * 0.045;
  const brillo = ((t * 0.4) % 1) * 2 - 1;

  const izquierda = esquina.endsWith('izquierda');
  const posicion: React.CSSProperties = {
    position: 'absolute',
    width: ancho,
    height: (ancho * 420) / 360,
    ...(esquina.startsWith('arriba') ? {top: 120} : {bottom: 380}),
    ...(izquierda ? {left: 24} : {right: 24}),
    transform: `translateY(${flotar}px) rotate(${inclinar}deg)`,
    transformOrigin: '50% 100%',
    filter: 'drop-shadow(0 16px 20px rgba(0,0,0,0.6))',
    // El torso se desvanece hacia abajo en vez de terminar en un corte recto.
    WebkitMaskImage: 'linear-gradient(to bottom, #000 78%, transparent 100%)',
    maskImage: 'linear-gradient(to bottom, #000 78%, transparent 100%)',
  };

  if (imagen) {
    return (
      <div style={posicion}>
        <Img src={staticFile(imagen)} style={{width: '100%', height: '100%', objectFit: 'contain'}} />
      </div>
    );
  }

  return (
    <div style={posicion}>
      <svg viewBox="0 0 360 420" width="100%" height="100%">
        <defs>
          <linearGradient id="traje" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#26407f" />
            <stop offset="0.55" stopColor="#16264f" />
            <stop offset="1" stopColor="#0b1530" />
          </linearGradient>
          <linearGradient id="solapa" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#101d40" />
            <stop offset="1" stopColor="#0a1229" />
          </linearGradient>
          <radialGradient id="piel" cx="40%" cy="32%" r="75%">
            <stop offset="0" stopColor="#fff1e4" />
            <stop offset="0.6" stopColor="#f2d3b8" />
            <stop offset="1" stopColor="#d9ac8a" />
          </radialGradient>
          <linearGradient id="pelo" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#3a3a44" />
            <stop offset="0.35" stopColor="#14141a" />
            <stop offset="1" stopColor="#050507" />
          </linearGradient>
          <linearGradient id="lente" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#3a3a42" />
            <stop offset="0.5" stopColor="#0b0b0e" />
            <stop offset="1" stopColor="#000" />
          </linearGradient>
          <linearGradient id="oro" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor={ORO_CLARO} />
            <stop offset="0.5" stopColor={ORO} />
            <stop offset="1" stopColor={ORO_OSCURO} />
          </linearGradient>
          <radialGradient id="cristal" cx="35%" cy="28%" r="85%">
            <stop offset="0" stopColor="#ffffff" stopOpacity="0.5" />
            <stop offset="0.5" stopColor="#cfe6ff" stopOpacity="0.14" />
            <stop offset="1" stopColor="#9cc4ff" stopOpacity="0.2" />
          </radialGradient>
          <clipPath id="clipLupa">
            <circle cx="196" cy="326" r="56" />
          </clipPath>
        </defs>

        {/* Cuerpo y traje */}
        <path d="M26 420 Q30 290 112 262 L248 262 Q330 290 334 420 Z" fill="url(#traje)" />
        {/* Camisa */}
        <path d="M148 250 L212 250 L184 360 Z" fill="#f7f8fb" />
        {/* Solapas */}
        <path d="M148 250 L120 262 L150 372 L184 300 Z" fill="url(#solapa)" />
        <path d="M212 250 L240 262 L218 372 L184 300 Z" fill="url(#solapa)" />
        {/* Corbata dorada */}
        <path d="M170 262 L198 262 L192 280 L176 280 Z" fill="url(#oro)" />
        <path d="M176 280 L192 280 L204 372 L184 392 L164 372 Z" fill="url(#oro)" />
        <path d="M184 282 L184 388" stroke={ORO_OSCURO} strokeWidth="2" opacity="0.5" />
        {/* Pañuelo blanco */}
        <path d="M258 300 L286 296 L286 308 L258 310 Z" fill="#f4f5f8" />

        {/* Cuello */}
        <path d="M156 214 L212 214 L208 258 L160 258 Z" fill="#d9ac8a" />
        <path d="M156 214 L212 214 L210 236 Q184 252 158 236 Z" fill="#c4977a" opacity="0.7" />

        {/* Orejas */}
        <ellipse cx="97" cy="140" rx="11" ry="17" fill="#e8c2a4" />
        <ellipse cx="271" cy="140" rx="11" ry="17" fill="#e8c2a4" />
        {/* Cabeza */}
        <ellipse cx="184" cy="132" rx="86" ry="94" fill="url(#piel)" />
        {/* Pelo */}
        <path
          d="M96 128 Q84 52 164 40 Q248 30 272 112 Q276 132 270 140 Q262 100 236 84 Q214 98 176 92 Q132 88 112 112 Q102 120 96 128 Z"
          fill="url(#pelo)"
        />
        <path d="M150 52 Q190 36 238 62" stroke="#6a6a78" strokeWidth="5" fill="none" opacity="0.5" strokeLinecap="round" />

        {/* Cejas */}
        <path d="M112 112 Q140 98 166 110" stroke="#0a0a0c" strokeWidth="9" fill="none" strokeLinecap="round" />
        <path d="M202 110 Q228 98 256 112" stroke="#0a0a0c" strokeWidth="9" fill="none" strokeLinecap="round" />

        {/* Lentes oscuros */}
        <rect x="100" y="116" width="76" height="46" rx="14" fill="url(#lente)" stroke="#050505" strokeWidth="8" />
        <rect x="192" y="116" width="76" height="46" rx="14" fill="url(#lente)" stroke="#050505" strokeWidth="8" />
        <path d="M176 130 Q184 124 192 130" stroke="#050505" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path d="M100 128 L90 126 M268 128 L278 126" stroke="#050505" strokeWidth="7" strokeLinecap="round" />
        <path d="M112 124 L140 124" stroke="#fff" strokeWidth="4" opacity="0.28" strokeLinecap="round" />
        <path d="M204 124 L232 124" stroke="#fff" strokeWidth="4" opacity="0.28" strokeLinecap="round" />

        {/* Nariz y boca */}
        <path d="M184 150 Q190 172 182 178" stroke="#c99674" strokeWidth="4" fill="none" strokeLinecap="round" opacity="0.8" />
        <path d="M156 196 Q184 210 214 192" stroke="#a65f4c" strokeWidth="5" fill="none" strokeLinecap="round" />
        <path d="M214 192 Q220 190 222 184" stroke="#c99674" strokeWidth="3" fill="none" strokeLinecap="round" />

        {/* Brazo y mano que sostienen la lupa */}
        <path d="M70 290 Q58 350 96 384" stroke="url(#traje)" strokeWidth="44" fill="none" strokeLinecap="round" />
        <g transform={`rotate(${lupaGiro} 120 380)`}>
          {/* Mango dorado */}
          <path d="M160 366 L112 410" stroke={ORO_OSCURO} strokeWidth="22" strokeLinecap="round" />
          <path d="M160 366 L112 410" stroke="url(#oro)" strokeWidth="14" strokeLinecap="round" />
          {/* Mano */}
          <ellipse cx="124" cy="392" rx="22" ry="19" fill="url(#piel)" />
          <path d="M108 384 Q118 376 130 382" stroke="#c4977a" strokeWidth="3" fill="none" strokeLinecap="round" />
          {/* Cristal */}
          <circle cx="196" cy="326" r="56" fill="url(#cristal)" />
          {/* Signo de interrogación dorado */}
          <g transform={`translate(196 326) scale(${pulso}) translate(-196 -326)`}>
            <text
              x="196"
              y="362"
              textAnchor="middle"
              fontFamily="Arial Black, Impact, sans-serif"
              fontWeight="900"
              fontSize="98"
              fill="url(#oro)"
              stroke={ORO_OSCURO}
              strokeWidth="2.5"
            >
              ?
            </text>
          </g>
          {/* Reflejo que cruza el cristal */}
          <g clipPath="url(#clipLupa)">
            <rect
              x={196 + brillo * 90 - 12}
              y="262"
              width="22"
              height="140"
              fill="#fff"
              opacity="0.3"
              transform={`rotate(-25 ${196 + brillo * 90} 326)`}
            />
          </g>
          {/* Aro dorado */}
          <circle cx="196" cy="326" r="56" fill="none" stroke="url(#oro)" strokeWidth="11" />
          <circle cx="196" cy="326" r="61" fill="none" stroke={ORO_OSCURO} strokeWidth="2" opacity="0.7" />
        </g>
      </svg>
    </div>
  );
};
