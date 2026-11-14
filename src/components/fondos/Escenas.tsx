import React from 'react';
import {AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {formatearNumero, rnd} from '../../lib/util';

/** Props comunes: duración total de la escena en segundos y parámetro opcional ("contador:1700000000"). */
export type PropsEscena = {duracion: number; parametro?: string};

const useTiempo = () => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  return frame / fps;
};

const FUENTE_IMPACTO = 'Arial Black, Impact, sans-serif';

/* ------------------------------------------------------------------ */
/* ESCENARIO: telón rojo, focos barriendo y polvo flotando             */
/* ------------------------------------------------------------------ */
export const Escenario: React.FC<PropsEscena> = () => {
  const t = useTiempo();
  const sway = Math.sin(t * 0.9) * 1.2;
  return (
    <AbsoluteFill style={{background: '#12040a', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          backgroundImage:
            'repeating-linear-gradient(90deg, #5a0b16 0px, #8a1626 40px, #5a0b16 90px)',
          transform: `skewX(${sway}deg) scale(1.08) translateX(${Math.sin(t * 0.5) * 10}px)`,
          transformOrigin: 'top center',
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'linear-gradient(180deg, rgba(0,0,0,0.75) 0%, rgba(0,0,0,0.1) 25%, rgba(0,0,0,0.05) 70%, rgba(0,0,0,0.7) 100%)',
        }}
      />
      {[0, 1].map((i) => {
        const ang = Math.sin(t * 0.7 + i * Math.PI) * 22;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: i === 0 ? -200 : 500,
              top: -300,
              width: 780,
              height: 2400,
              transformOrigin: 'top center',
              transform: `rotate(${ang}deg)`,
              background:
                'linear-gradient(180deg, rgba(255,230,170,0.55) 0%, rgba(255,220,150,0.18) 45%, rgba(255,220,150,0) 85%)',
              clipPath: 'polygon(42% 0, 58% 0, 100% 100%, 0 100%)',
              mixBlendMode: 'screen',
            }}
          />
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          height: 260,
          background: 'linear-gradient(180deg, #7a5a2e, #3f2d14)',
          transform: `translateY(${Math.sin(t) * 3}px)`,
        }}
      />
      <Polvo t={t} color="rgba(255,235,190,0.8)" />
    </AbsoluteFill>
  );
};

const Polvo: React.FC<{t: number; color: string; cantidad?: number}> = ({t, color, cantidad = 36}) => (
  <>
    {Array.from({length: cantidad}).map((_, i) => {
      const x = rnd(i, 1) * 1080;
      const vel = 25 + rnd(i, 2) * 50;
      const y = 1920 - ((t * vel + rnd(i, 3) * 1920) % 2020);
      const tam = 3 + rnd(i, 4) * 6;
      const op = 0.3 + 0.5 * Math.abs(Math.sin(t * 1.5 + i));
      return (
        <div
          key={i}
          style={{
            position: 'absolute',
            left: x + Math.sin(t + i) * 20,
            top: y,
            width: tam,
            height: tam,
            borderRadius: '50%',
            background: color,
            opacity: op,
          }}
        />
      );
    })}
  </>
);

/* ------------------------------------------------------------------ */
/* VESTIDO: silueta que cambia de color con un barrido                 */
/* ------------------------------------------------------------------ */
const COLORES_VESTIDO = ['#d7263d', '#1e5bff', '#f2b400', '#f6f3ee'];
const FORMA_VESTIDO =
  'M540 520 L505 540 L480 700 L540 690 L600 700 L575 540 Z M470 700 Q520 1000 400 1500 L680 1500 Q560 1000 610 700 Z';

export const Vestido: React.FC<PropsEscena> = ({duracion}) => {
  const t = useTiempo();
  const n = COLORES_VESTIDO.length;
  const tramo = Math.max(duracion / n, 0.9);
  const idx = Math.min(n - 1, Math.floor(t / tramo));
  const enTramo = t - idx * tramo;
  const barrido = interpolate(enTramo, [0, 0.35], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const colorPrevio = COLORES_VESTIDO[Math.max(0, idx - 1)];
  const colorActual = COLORES_VESTIDO[idx];
  const giro = t * 18;
  const balanceo = Math.sin(t * 1.6) * 2.5;

  const rayos = Array.from({length: 9})
    .map((_, i) => `${colorActual}33 ${i * 40}deg, transparent ${i * 40 + 20}deg`)
    .join(', ');

  return (
    <AbsoluteFill style={{background: '#0b0616', overflow: 'hidden'}}>
      <div
        style={{
          position: 'absolute',
          left: -600,
          top: -400,
          width: 2280,
          height: 2280,
          borderRadius: '50%',
          background: `conic-gradient(from ${giro}deg, ${rayos})`,
        }}
      />
      <AbsoluteFill
        style={{
          background:
            'radial-gradient(circle at 50% 55%, rgba(255,255,255,0.14) 0%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.6) 100%)',
        }}
      />
      <svg
        viewBox="0 0 1080 1920"
        width="100%"
        height="100%"
        style={{
          position: 'absolute',
          transform: `rotate(${balanceo}deg) scale(${1.02 + Math.sin(t) * 0.02})`,
          transformOrigin: '50% 30%',
        }}
      >
        <defs>
          <clipPath id="barrido">
            <rect x="0" y="0" width="1080" height={520 + barrido * 1000} />
          </clipPath>
          <filter id="sombraVestido">
            <feDropShadow dx="0" dy="30" stdDeviation="30" floodColor="#000" floodOpacity="0.6" />
          </filter>
        </defs>
        <circle cx="540" cy="430" r="62" fill="#2a2140" />
        <rect x="520" y="480" width="40" height="50" fill="#2a2140" />
        <g filter="url(#sombraVestido)">
          <path d={FORMA_VESTIDO} fill={colorPrevio} />
          <path d={FORMA_VESTIDO} fill={colorActual} clipPath="url(#barrido)" />
          {barrido < 1 && (
            <rect x="380" y={520 + barrido * 1000 - 6} width="320" height="12" fill="#fff" opacity="0.8" />
          )}
        </g>
        {Array.from({length: 18}).map((_, i) => {
          const x = 300 + rnd(i, 7) * 480;
          const y = 450 + ((rnd(i, 8) * 1100 + t * 60) % 1100);
          const s = 0.5 + Math.abs(Math.sin(t * 3 + i * 1.3));
          return (
            <path
              key={i}
              d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z"
              fill="#fff"
              opacity={s * 0.9}
              transform={`translate(${x} ${y}) scale(${s})`}
            />
          );
        })}
      </svg>
      <div style={{position: 'absolute', right: 60, bottom: 300, display: 'flex', gap: 18}}>
        {COLORES_VESTIDO.map((c, i) => (
          <div
            key={i}
            style={{
              width: 34,
              height: 34,
              borderRadius: 8,
              background: i <= idx ? c : 'rgba(255,255,255,0.15)',
              border: '3px solid rgba(255,255,255,0.7)',
              transform: `scale(${i === idx ? 1.25 : 1})`,
            }}
          />
        ))}
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* CONTADOR: número que sube (vistas), corazones y ojos subiendo       */
/* ------------------------------------------------------------------ */
export const Contador: React.FC<PropsEscena> = ({duracion, parametro}) => {
  const t = useTiempo();
  const objetivo = Number(parametro ?? '1000000') || 1000000;
  const p = interpolate(t, [0, Math.max(duracion * 0.6, 1)], [0, 1], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const suavizado = 1 - Math.pow(1 - p, 3);
  const valor = objetivo * suavizado;
  const latido = 1 + Math.sin(t * 6) * 0.025;
  return (
    <AbsoluteFill
      style={{
        background: 'linear-gradient(180deg, #050816 0%, #141a3a 50%, #0a0414 100%)',
        overflow: 'hidden',
      }}
    >
      <AbsoluteFill
        style={{
          backgroundImage:
            'linear-gradient(rgba(255,255,255,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.06) 1px, transparent 1px)',
          backgroundSize: '90px 90px',
          backgroundPosition: `0 ${(t * 40) % 90}px`,
        }}
      />
      {Array.from({length: 26}).map((_, i) => {
        const x = rnd(i, 11) * 1000 + 40;
        const vel = 120 + rnd(i, 12) * 160;
        const y = 2000 - ((t * vel + rnd(i, 13) * 2000) % 2100);
        const esCorazon = rnd(i, 14) > 0.4;
        const s = 0.6 + rnd(i, 15) * 0.9;
        return (
          <svg
            key={i}
            viewBox="0 0 100 100"
            width={70 * s}
            height={70 * s}
            style={{position: 'absolute', left: x + Math.sin(t * 2 + i) * 25, top: y, opacity: 0.85}}
          >
            {esCorazon ? (
              <path d="M50 88 L14 50 A20 20 0 0 1 50 26 A20 20 0 0 1 86 50 Z" fill="#ff2d55" />
            ) : (
              <>
                <path d="M5 50 Q50 5 95 50 Q50 95 5 50 Z" fill="#fff" />
                <circle cx="50" cy="50" r="18" fill="#111" />
                <circle cx="56" cy="44" r="5" fill="#fff" />
              </>
            )}
          </svg>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          top: 1180,
          textAlign: 'center',
          color: '#fff',
          fontFamily: FUENTE_IMPACTO,
          fontWeight: 900,
          fontSize: 118,
          letterSpacing: -2,
          transform: `scale(${latido})`,
          textShadow: '0 0 40px rgba(255,45,85,0.8), 0 8px 0 #000',
        }}
      >
        {formatearNumero(valor)}
        <div style={{fontSize: 48, letterSpacing: 10, marginTop: 8, color: '#ffb3c1'}}>VISTAS</div>
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* MISTERIO: interrogaciones flotando y haz de luz que escanea         */
/* ------------------------------------------------------------------ */
export const Misterio: React.FC<PropsEscena> = () => {
  const t = useTiempo();
  const lx = 540 + Math.sin(t * 0.8) * 320;
  const ly = 900 + Math.cos(t * 0.6) * 450;
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 50% 40%, #0f1f4d 0%, #060a1c 70%)',
        overflow: 'hidden',
      }}
    >
      {Array.from({length: 22}).map((_, i) => {
        const x = rnd(i, 21) * 1000;
        const vel = 40 + rnd(i, 22) * 70;
        const y = 2000 - ((t * vel + rnd(i, 23) * 2000) % 2100);
        const s = 60 + rnd(i, 24) * 140;
        const rot = Math.sin(t + i) * 20;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              fontSize: s,
              fontFamily: FUENTE_IMPACTO,
              color: i % 3 === 0 ? '#E8B20C' : 'rgba(255,255,255,0.35)',
              transform: `rotate(${rot}deg)`,
              textShadow: '0 0 30px rgba(232,178,12,0.5)',
            }}
          >
            ?
          </div>
        );
      })}
      <div
        style={{
          position: 'absolute',
          left: lx - 420,
          top: ly - 420,
          width: 840,
          height: 840,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,245,200,0.35) 0%, rgba(255,245,200,0.08) 40%, rgba(0,0,0,0) 70%)',
          mixBlendMode: 'screen',
        }}
      />
      <AbsoluteFill style={{boxShadow: 'inset 0 0 300px rgba(0,0,0,0.9)'}} />
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* CAPAS: telas apiladas que se van soltando una a una                 */
/* ------------------------------------------------------------------ */
export const Capas: React.FC<PropsEscena> = () => {
  const t = useTiempo();
  const colores = ['#f6f3ee', '#f2b400', '#1e5bff', '#d7263d'];
  const ciclo = 1.4;
  const paso = Math.floor(t / ciclo);
  const enCiclo = (t % ciclo) / ciclo;
  return (
    <AbsoluteFill style={{background: 'linear-gradient(160deg, #1a1030, #050308)', overflow: 'hidden'}}>
      <AbsoluteFill
        style={{
          backgroundImage: 'radial-gradient(rgba(255,255,255,0.12) 2px, transparent 2px)',
          backgroundSize: '60px 60px',
          backgroundPosition: `${(t * 30) % 60}px ${(t * 20) % 60}px`,
        }}
      />
      {colores
        .map((c, i) => {
          const orden = (i - paso) % colores.length;
          const idx = orden < 0 ? orden + colores.length : orden; // 0 = capa de arriba
          return {c, i, idx};
        })
        .sort((a, b) => b.idx - a.idx) // las de abajo se pintan primero
        .map(({c, i, idx}) => {
        const soltando = idx === 0;
        const salida = soltando
          ? interpolate(enCiclo, [0.45, 1], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})
          : 0;
        const ease = 1 - Math.pow(1 - salida, 2);
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 240,
              top: 1060 + idx * 14,
              width: 600,
              height: 720,
              borderRadius: 40,
              background: `linear-gradient(135deg, ${c}, ${c}cc)`,
              boxShadow: '0 30px 60px rgba(0,0,0,0.55)',
              transform: `translate(${ease * 900}px, ${-ease * 300}px) rotate(${
                (idx - 1.5) * 3 + ease * 45 + Math.sin(t * 1.3 + i) * 1.5
              }deg)`,
              opacity: 1 - ease * 0.9,
            }}
          >
            {[0, 1, 2, 3].map((k) => (
              <div
                key={k}
                style={{
                  position: 'absolute',
                  left: k % 2 === 0 ? 40 : 520,
                  top: k < 2 ? 40 : 640,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: 'radial-gradient(circle at 35% 35%, #9ca3af, #1f2937)',
                }}
              />
            ))}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* VEREDICTO: pantalla dividida roja / dorada                          */
/* ------------------------------------------------------------------ */
export const Veredicto: React.FC<PropsEscena> = () => {
  const t = useTiempo();
  const pulso = 1 + Math.sin(t * 4) * 0.04;
  const temblor = Math.sin(t * 30) * 2;
  const entrada = interpolate(t, [0, 0.5], [1200, 0], {
    extrapolateLeft: 'clamp',
    extrapolateRight: 'clamp',
  });
  const etiqueta: React.CSSProperties = {
    position: 'absolute',
    fontFamily: FUENTE_IMPACTO,
    fontWeight: 900,
    fontSize: 96,
    color: '#fff',
    letterSpacing: 2,
    textShadow: '0 8px 0 #000, 0 0 30px rgba(0,0,0,0.6)',
  };
  return (
    <AbsoluteFill style={{overflow: 'hidden', transform: `translateX(${temblor}px)`}}>
      <div
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: '50%',
          height: '100%',
          background: 'linear-gradient(180deg, #7f1d1d, #b91c1c 50%, #450a0a)',
          transform: `translateX(${-entrada}px)`,
        }}
      />
      <div
        style={{
          position: 'absolute',
          right: 0,
          top: 0,
          width: '50%',
          height: '100%',
          background: 'linear-gradient(180deg, #78350f, #d4a017 50%, #3f2a05)',
          transform: `translateX(${entrada}px)`,
        }}
      />
      <AbsoluteFill
        style={{
          backgroundImage: `repeating-linear-gradient(${45 + t * 10}deg, rgba(255,255,255,0.07) 0 30px, transparent 30px 60px)`,
        }}
      />
      <div style={{...etiqueta, left: 50, top: 300, transform: `rotate(-8deg) scale(${pulso})`}}>
        ¿ESTAFADOR
      </div>
      <div style={{...etiqueta, right: 60, top: 1180, transform: `rotate(6deg) scale(${pulso})`}}>
        O GENIO?
      </div>
      <div
        style={{
          position: 'absolute',
          left: 530,
          top: -100,
          width: 20,
          height: 2200,
          background: '#fff',
          transform: `rotate(${8 + Math.sin(t) * 2}deg)`,
          boxShadow: '0 0 40px #fff',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 400,
          top: 1380,
          width: 280,
          height: 280,
          borderRadius: '50%',
          background: '#111',
          border: '14px solid #fff',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: '#E8B20C',
          fontFamily: FUENTE_IMPACTO,
          fontSize: 200,
          fontWeight: 900,
          transform: `rotate(${Math.sin(t * 2) * 15}deg) scale(${pulso})`,
          boxShadow: '0 0 60px rgba(0,0,0,0.7)',
        }}
      >
        ?
      </div>
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
/* EXITO: explosión viral, anillos y confeti                            */
/* ------------------------------------------------------------------ */
export const Exito: React.FC<PropsEscena> = () => {
  const t = useTiempo();
  const colores = ['#ff2d55', '#E8B20C', '#1e5bff', '#22c55e', '#fff'];
  return (
    <AbsoluteFill
      style={{
        background: 'radial-gradient(circle at 50% 50%, #2a0a3d 0%, #07030d 75%)',
        overflow: 'hidden',
      }}
    >
      {[0, 1, 2].map((i) => {
        const p = (t * 0.5 + i / 3) % 1;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: 540 - p * 900,
              top: 960 - p * 900,
              width: p * 1800,
              height: p * 1800,
              borderRadius: '50%',
              border: `${10 * (1 - p) + 2}px solid rgba(255,255,255,${(1 - p) * 0.6})`,
            }}
          />
        );
      })}
      {Array.from({length: 70}).map((_, i) => {
        const x = rnd(i, 31) * 1080;
        const vel = 250 + rnd(i, 32) * 350;
        const y = ((t * vel + rnd(i, 33) * 2000) % 2100) - 100;
        const w = 14 + rnd(i, 34) * 16;
        const rot = t * (120 + rnd(i, 35) * 240) + i * 40;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x + Math.sin(t * 2 + i) * 40,
              top: y,
              width: w,
              height: w * 1.8,
              background: colores[i % colores.length],
              transform: `rotate(${rot}deg)`,
              borderRadius: 3,
              opacity: 0.9,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/* ------------------------------------------------------------------ */
export const REGISTRO_ESCENAS: Record<string, React.FC<PropsEscena>> = {
  escenario: Escenario,
  vestido: Vestido,
  contador: Contador,
  misterio: Misterio,
  capas: Capas,
  veredicto: Veredicto,
  exito: Exito,
};
