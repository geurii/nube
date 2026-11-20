import React from 'react';
import {AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/LilitaOne';
import type {VideoProps} from '../lib/tipos';
import {Subtitulos} from '../components/Subtitulos';
import {NOMBRES, Objeto, PALETAS} from './arte';
import type {ColorId, Paleta} from './arte';

const {fontFamily: FUENTE_TITULO} = loadFont();

/** Cada imagen dura como mucho esto (segundos): el ojo del niño siempre tiene algo nuevo. */
const MAX_SEGUNDOS_POR_IMAGEN = 1.7;

type Spec = {color: ColorId; item: string; n: number};

/**
 * "rojo:manzana"   -> una manzana roja
 * "rojo:manzana*3" -> tres manzanas (para contar)
 * "rojo:color"     -> estallido del color
 */
const leerSpec = (s: string): Spec => {
  const [c, resto] = s.split(':');
  const [i, cuantos] = (resto ?? 'color').split('*');
  return {color: (PALETAS[c as ColorId] ? c : 'rojo') as ColorId, item: i, n: Math.max(1, Number(cuantos ?? 1) || 1)};
};

/** Plural sencillo para los rótulos al contar ("3 MANZANAS") */
const plural = (nombre: string) => (/[AEIOUÁÉÍÓÚ]$/.test(nombre) ? `${nombre}S` : `${nombre}ES`);

const ITEMS_POR_COLOR: Record<ColorId, string[]> = {
  rojo: ['manzana', 'fresa', 'mariquita'],
  azul: ['ballena', 'gota', 'globo'],
  amarillo: ['pollito', 'sol', 'platano'],
  verde: ['rana', 'hoja', 'pera'],
  naranja: ['zanahoria', 'naranja', 'calabaza'],
  morado: ['uvas', 'berenjena', 'flor'],
  rosa: ['cerdito', 'helado', 'corazon'],
};

/** Número pseudoaleatorio estable (sin Math.random: el render tiene que ser idéntico siempre) */
const rnd = (n: number) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// ------------------------------------------------------------------ fondo
const FondoColor: React.FC<{p: Paleta; variante: number}> = ({p, variante}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const t = frame / fps;
  const angulo = variante % 2 === 0 ? 135 : 215;
  const giro = t * (variante % 2 === 0 ? 14 : -14);

  // Confeti y burbujas flotando
  const formas = Array.from({length: 26}).map((_, i) => {
    const sem = variante * 100 + i;
    const x = rnd(sem) * width;
    const vel = 60 + rnd(sem + 1) * 110;
    const y = height + 80 - ((t * vel + rnd(sem + 2) * height) % (height + 160));
    const tam = 22 + rnd(sem + 3) * 58;
    const tipo = Math.floor(rnd(sem + 4) * 3); // 0 círculo, 1 estrella, 2 rombo
    const col = [p.claro, '#FFFFFF', p.principal, '#FFF3A0'][Math.floor(rnd(sem + 5) * 4)];
    const rot = t * (40 + rnd(sem + 6) * 90) * (i % 2 ? 1 : -1);
    return {x: x + Math.sin(t * 1.4 + i) * 24, y, tam, tipo, col, rot, i};
  });

  return (
    <AbsoluteFill style={{background: `linear-gradient(${angulo}deg, ${p.fondoA} 0%, ${p.fondoB} 45%, ${p.fondoC} 100%)`}}>
      {/* rayos que giran desde el centro */}
      <AbsoluteFill
        style={{
          background: `repeating-conic-gradient(from ${giro}deg at 50% 44%, ${p.rayos}55 0deg 10deg, transparent 10deg 30deg)`,
          opacity: 0.55,
        }}
      />
      <AbsoluteFill style={{background: `radial-gradient(circle at 50% 44%, ${p.rayos}CC 0%, ${p.rayos}00 52%)`}} />
      {formas.map((f) => (
        <div
          key={f.i}
          style={{
            position: 'absolute',
            left: f.x,
            top: f.y,
            width: f.tam,
            height: f.tam,
            opacity: 0.85,
            transform: `translate(-50%, -50%) rotate(${f.rot}deg)`,
          }}
        >
          {f.tipo === 0 && <div style={{width: '100%', height: '100%', borderRadius: '50%', background: f.col, border: '4px solid #ffffffAA'}} />}
          {f.tipo === 1 && (
            <svg viewBox="0 0 100 100" width="100%" height="100%">
              <path d="M50 4 L62 38 L98 38 L69 59 L80 94 L50 73 L20 94 L31 59 L2 38 L38 38 Z" fill={f.col} stroke="#ffffffAA" strokeWidth={4} strokeLinejoin="round" />
            </svg>
          )}
          {f.tipo === 2 && <div style={{width: '70%', height: '70%', margin: '15%', background: f.col, transform: 'rotate(45deg)', borderRadius: 8, border: '4px solid #ffffffAA'}} />}
        </div>
      ))}
      {/* colinas de abajo, para dar profundidad */}
      <svg viewBox="0 0 1080 400" width={width} height={400} style={{position: 'absolute', bottom: 0, left: 0}} preserveAspectRatio="none">
        <path d={`M0 ${150 + (variante % 3) * 20} C 220 60 420 ${230 - (variante % 2) * 50} 640 ${120} C 820 40 960 ${130 + (variante % 3) * 10} 1080 90 L1080 400 L0 400 Z`} fill={p.principal} opacity={0.55} />
        <path d={`M0 260 C 180 190 380 300 600 230 C 800 170 960 270 1080 210 L1080 400 L0 400 Z`} fill={p.oscuro} opacity={0.5} />
      </svg>
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ rótulos
const Rotulo: React.FC<{texto: string; p: Paleta; tam: number}> = ({texto, p, tam}) => {
  const frame = useCurrentFrame();
  const {fps} = useVideoConfig();
  const s = spring({frame: frame - 2, fps, config: {damping: 8, stiffness: 160, mass: 0.6}});
  return (
    <div
      style={{
        fontFamily: FUENTE_TITULO,
        fontSize: tam,
        letterSpacing: 4,
        color: '#fff',
        WebkitTextStroke: `${Math.round(tam / 7)}px ${p.texto}`,
        paintOrder: 'stroke fill',
        textShadow: `0 ${Math.round(tam / 9)}px 0 ${p.texto}, 0 ${Math.round(tam / 5)}px 24px rgba(0,0,0,0.35)`,
        transform: `scale(${interpolate(s, [0, 1], [0.2, 1])}) rotate(${Math.sin(frame / fps * 4) * 2.5}deg)`,
        textAlign: 'center',
        lineHeight: 1,
      }}
    >
      {texto}
    </div>
  );
};

// ------------------------------------------------------------------ una imagen (un tramo)
const Imagen: React.FC<{spec: Spec; variante: number; primera: boolean}> = ({spec, variante, primera}) => {
  const frame = useCurrentFrame();
  const {fps, width, height} = useVideoConfig();
  const horizontal = width > height; // video largo 16:9
  const p = PALETAS[spec.color];
  const t = frame / fps;

  // Entrada: se abre un círculo desde el centro (como un "pop")
  const abre = primera ? 1 : interpolate(frame, [0, 9], [0, 1], {extrapolateRight: 'clamp'});
  const clip = `circle(${abre * 150}% at 50% 42%)`;

  const pop = spring({frame: frame - 2, fps, config: {damping: 7, stiffness: 150, mass: 0.7}});
  const bote = Math.abs(Math.sin(t * 5.2)) * 26; // salta con el ritmo
  const giro = Math.sin(t * 4.1) * 5;
  const aplasta = 1 + Math.sin(t * 5.2 + Math.PI / 2) * 0.025;

  const tam = horizontal ? height * 0.55 : 760;
  const topObjeto = horizontal ? height * 0.2 : 360;

  // Varias copias (para contar): se reparten en una fila o en dos filas
  const copias = spec.n;
  const filas = copias > 3 ? 2 : 1;
  const porFila = Math.ceil(copias / filas);
  const tamCopia = copias === 1 ? tam : Math.min(tam, (horizontal ? width * 0.8 : width * 0.92) / porFila) * (filas === 2 ? 0.95 : 1);
  const nombre = NOMBRES[spec.item] ?? spec.item.toUpperCase();

  return (
    <AbsoluteFill style={{clipPath: clip}}>
      <FondoColor p={p} variante={variante} />

      {spec.item === 'color' ? (
        <>
          {/* estallido: la palabra del color grande + objetos girando alrededor */}
          {ITEMS_POR_COLOR[spec.color].map((id, k) => {
            const ang = (t * 55 + k * 120) * (Math.PI / 180);
            const rx = horizontal ? 560 : 330;
            const ry = horizontal ? 200 : 250;
            const tc = horizontal ? 250 : 300;
            return (
              <div
                key={id}
                style={{
                  position: 'absolute',
                  left: width / 2 + Math.cos(ang) * rx - tc / 2,
                  top: (horizontal ? height * 0.5 : 780) + Math.sin(ang) * ry - tc / 2,
                  transform: `scale(${interpolate(pop, [0, 1], [0, 1])}) rotate(${Math.sin(t * 3 + k) * 8}deg)`,
                  zIndex: 1,
                }}
              >
                <Objeto id={id} uid={`o${variante}${k}`} size={tc} />
              </div>
            );
          })}
          <div style={{position: 'absolute', left: 0, right: 0, top: horizontal ? height * 0.27 : 640, display: 'flex', justifyContent: 'center', zIndex: 5}}>
            <Rotulo texto={p.nombre} p={p} tam={horizontal ? 230 : p.nombre.length > 6 ? 190 : 250} />
          </div>
        </>
      ) : (
        <>
          {Array.from({length: copias}).map((_, k) => {
            const fila = Math.floor(k / porFila);
            const col = k % porFila;
            const enFila = fila === filas - 1 ? copias - fila * porFila : porFila;
            const x = copias === 1 ? (width - tamCopia) / 2 : (width - enFila * tamCopia) / 2 + col * tamCopia;
            // varias copias: el bloque se centra en vertical (por debajo del rótulo y por encima del subtítulo)
            const paso = tamCopia * (filas === 2 ? 0.88 : 1);
            const centroY = horizontal ? height * 0.5 : 740;
            const y = copias === 1 ? topObjeto : centroY - (filas * paso) / 2 + fila * paso + (horizontal ? 20 : 40);
            // cada copia entra un poquito después de la anterior: se "cuenta" visualmente
            const popK = spring({frame: frame - 2 - k * 7, fps, config: {damping: 7, stiffness: 150, mass: 0.7}});
            const boteK = Math.abs(Math.sin(t * 5.2 + k * 0.7)) * (copias === 1 ? 26 : 14);
            return (
              <div
                key={k}
                style={{
                  position: 'absolute',
                  left: x,
                  top: y - boteK,
                  width: tamCopia,
                  height: tamCopia,
                  transform: `scale(${interpolate(popK, [0, 1], [0.1, 1]) * aplasta}) rotate(${giro * (k % 2 ? -1 : 1)}deg)`,
                  transformOrigin: '50% 90%',
                  filter: 'drop-shadow(0 22px 18px rgba(0,0,0,0.26))',
                }}
              >
                <Objeto id={spec.item} uid={`i${variante}${k}`} size={tamCopia} />
              </div>
            );
          })}
          <div style={{position: 'absolute', left: 0, right: 0, top: horizontal ? 36 : 150, display: 'flex', justifyContent: 'center'}}>
            <Rotulo texto={copias > 1 ? `${copias} ${plural(nombre)}` : nombre} p={p} tam={horizontal ? 104 : copias > 1 ? 100 : 118} />
          </div>
        </>
      )}
    </AbsoluteFill>
  );
};

// ------------------------------------------------------------------ video completo
export const VideoNinos: React.FC<VideoProps> = ({guion, musica, tiempos}) => {
  const {fps} = useVideoConfig();
  if (!tiempos) return <AbsoluteFill style={{background: '#fff'}} />;

  const aFrame = (s: number) => Math.round(s * fps);

  const tramos = tiempos.escenas.flatMap((e) => {
    const lista = (Array.isArray(e.fondo) ? e.fondo : [e.fondo]).map(leerSpec);
    const inicio = aFrame(e.inicio);
    const fin = aFrame(e.fin);
    const total = fin - inicio;
    const n = Math.max(lista.length, Math.ceil(total / (MAX_SEGUNDOS_POR_IMAGEN * fps)));
    return Array.from({length: n}).map((_, k) => ({
      clave: `${e.indice}-${k}`,
      spec: lista[k % lista.length],
      desde: inicio + Math.round((total * k) / n),
      hasta: inicio + Math.round((total * (k + 1)) / n),
      indiceEscena: e.indice,
      tipo: e.tipo,
      primerTramoEscena: k === 0,
    }));
  });

  const efectos: {frame: number; tipo: string; vol: number}[] = [];
  tramos.forEach((tr, k) => {
    efectos.push({frame: tr.desde, tipo: k % 3 === 0 ? 'pop' : k % 3 === 1 ? 'swoosh' : 'tick', vol: 0.4});
    if (tr.spec.item === 'color') efectos.push({frame: tr.desde + 2, tipo: 'sparkle', vol: 0.5});
  });
  const ultima = tiempos.escenas[tiempos.escenas.length - 1];
  efectos.push({frame: aFrame(ultima.inicio), tipo: 'ding', vol: 0.4});

  return (
    <AbsoluteFill style={{background: '#fff'}}>
      {tramos.map((tr, k) => {
        const siguiente = tramos[k + 1];
        const hasta = siguiente ? siguiente.desde + 10 : tr.hasta + 20; // solape para la apertura circular
        return (
          <Sequence key={`img-${tr.clave}`} from={tr.desde} durationInFrames={Math.max(1, hasta - tr.desde)}>
            <Imagen spec={tr.spec} variante={k} primera={k === 0} />
          </Sequence>
        );
      })}

      {/* Subtítulos karaoke blancos con borde negro y palabra amarilla (estilo del canal) */}
      {tiempos.escenas.map((e) => {
        const desde = aFrame(e.inicio);
        const hasta = aFrame(e.fin);
        return (
          <Sequence key={`sub-${e.indice}`} from={desde} durationInFrames={Math.max(1, hasta - desde)}>
            <Subtitulos escena={e} />
          </Sequence>
        );
      })}

      {efectos.map((ef, k) => (
        <Sequence key={`sfx-${k}`} from={Math.max(0, ef.frame)} durationInFrames={Math.round(2 * fps)}>
          <Audio src={staticFile(`sfx/${ef.tipo}.wav`)} volume={ef.vol} />
        </Sequence>
      ))}

      <Audio src={staticFile(guion.audio)} />
      {musica && <Audio src={staticFile(musica)} volume={0.1} />}
    </AbsoluteFill>
  );
};
