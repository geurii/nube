// Escenas "pixel realista" de la serie de los pingüinos.
// Se dibujan pixel por pixel en un lienzo de baja resolución (1 píxel = 3 px del video) con
// sombreado por luz, degradados con tramado (dithering) y paletas de 4-5 tonos, y luego se
// amplían sin suavizar. Funcionan en vertical (1080x1920) y horizontal (1920x1080).
import React, {useEffect, useLayoutEffect, useRef, useState} from 'react';
import {AbsoluteFill, continueRender, delayRender, interpolate, useCurrentFrame, useVideoConfig} from 'remotion';
import {loadFont} from '@remotion/google-fonts/PressStart2P';
import {formatearNumero, rnd} from '../../lib/util';
import type {PropsEscena} from './Escenas';

const {fontFamily: FUENTE_PIXEL} = loadFont();
const F = 2; // 1 píxel del lienzo = 2 px del video (pixel fino, más detalle)

type RGB = [number, number, number];
const hex = (s: string): RGB => [parseInt(s.slice(1, 3), 16), parseInt(s.slice(3, 5), 16), parseInt(s.slice(5, 7), 16)];
const rampa = (...cs: string[]): RGB[] => cs.map(hex);
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
const bay = (x: number, y: number) => (BAYER[((y & 3) << 2) | (x & 3)] + 0.5) / 16;
const hs = (x: number, y: number, s = 0) => rnd((x * 7919 + y * 104729) | 0, 11 + s);

type Texto = {s: string; x: number; y: number; size: number; fill: string; stroke?: string; align?: CanvasTextAlign};

class G {
  w: number;
  h: number;
  d: Uint8ClampedArray;
  textos: Texto[] = [];
  contorno: RGB | null = null;
  constructor(w: number, h: number) {
    this.w = w;
    this.h = h;
    this.d = new Uint8ClampedArray(w * h * 4);
  }
  set(x: number, y: number, c: RGB, a = 1) {
    x = Math.floor(x);
    y = Math.floor(y);
    if (x < 0 || y < 0 || x >= this.w || y >= this.h) return;
    const i = (y * this.w + x) * 4;
    if (a >= 1 || !this.d[i + 3]) {
      this.d[i] = c[0];
      this.d[i + 1] = c[1];
      this.d[i + 2] = c[2];
    } else {
      this.d[i] = this.d[i] * (1 - a) + c[0] * a;
      this.d[i + 1] = this.d[i + 1] * (1 - a) + c[1] * a;
      this.d[i + 2] = this.d[i + 2] * (1 - a) + c[2] * a;
    }
    this.d[i + 3] = 255;
  }
  rect(x: number, y: number, w: number, h: number, c: RGB, a = 1) {
    for (let j = Math.floor(y); j < Math.floor(y + h); j++) for (let i = Math.floor(x); i < Math.floor(x + w); i++) this.set(i, j, c, a);
  }
  /** degradado vertical con tramado entre los tonos de la rampa */
  grad(y0: number, y1: number, r: RGB[]) {
    const n = r.length;
    for (let y = Math.max(0, Math.floor(y0)); y < Math.min(this.h, Math.ceil(y1)); y++) {
      const t = ((y - y0) / Math.max(1, y1 - y0)) * (n - 1);
      const i = Math.max(0, Math.min(n - 2, Math.floor(t)));
      const f = Math.max(0, Math.min(1, t - i));
      for (let x = 0; x < this.w; x++) this.set(x, y, f > bay(x, y) ? r[i + 1] : r[i]);
    }
  }
  /** elipse con sombreado por luz (4-5 tonos y tramado en los bordes de sombra) */
  ell(cx: number, cy: number, rx: number, ry: number, r: RGB[], luz: [number, number, number] = [-0.45, -0.6, 0.66]) {
    const n = r.length;
    if (this.contorno) this.ellA(cx, cy, rx + 1.2, ry + 1.2, this.contorno, 1);
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        const q = nx * nx + ny * ny;
        if (q > 1) continue;
        const z = Math.sqrt(1 - q);
        const l = Math.max(0, Math.min(1, 0.22 + 0.78 * Math.max(0, nx * luz[0] + ny * luz[1] + z * luz[2])));
        const v = l * (n - 1);
        const i = Math.min(n - 2, Math.floor(v));
        this.set(x, y, v - i > bay(x, y) ? r[i + 1] : r[i]);
      }
    }
  }
  /** elipse sombreada con contorno oscuro de 1 px (como el pixel art de referencia) */
  ellO(cx: number, cy: number, rx: number, ry: number, r: RGB[], borde: RGB = [8, 10, 20]) {
    this.ellA(cx, cy, rx + 1.2, ry + 1.2, borde, 1);
    this.ell(cx, cy, rx, ry, r);
  }
  ellA(cx: number, cy: number, rx: number, ry: number, c: RGB, a: number) {
    for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++)
      for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
        const nx = (x + 0.5 - cx) / rx;
        const ny = (y + 0.5 - cy) / ry;
        if (nx * nx + ny * ny <= 1) this.set(x, y, c, a);
      }
  }
  line(x0: number, y0: number, x1: number, y1: number, c: RGB, th = 1) {
    const n = Math.ceil(Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0))) || 1;
    for (let i = 0; i <= n; i++) this.rect(x0 + ((x1 - x0) * i) / n - th / 2, y0 + ((y1 - y0) * i) / n - th / 2, th, th, c);
  }
  ring(cx: number, cy: number, r: number, th: number, c: RGB) {
    for (let y = Math.floor(cy - r); y <= Math.ceil(cy + r); y++)
      for (let x = Math.floor(cx - r); x <= Math.ceil(cx + r); x++) {
        const d = Math.hypot(x + 0.5 - cx, y + 0.5 - cy);
        if (d <= r && d >= r - th) this.set(x, y, c);
      }
  }
  txt(s: string, x: number, y: number, size: number, fill: string, stroke = '#000', align: CanvasTextAlign = 'center') {
    this.textos.push({s, x, y, size, fill, stroke, align});
  }
}

const Lienzo: React.FC<{draw: (g: G, t: number, k: number, horiz: boolean) => void}> = ({draw}) => {
  const {width, height, fps} = useVideoConfig();
  const frame = useCurrentFrame();
  const ref = useRef<HTMLCanvasElement>(null);
  const lw = Math.round(width / F);
  const lh = Math.round(height / F);
  const [espera] = useState(() => delayRender('fuente pixel'));
  const [listo, setListo] = useState(false);
  useEffect(() => {
    document.fonts
      .load(`16px ${FUENTE_PIXEL}`)
      .catch(() => undefined)
      .then(() => setListo(true));
  }, []);
  const liberado = useRef(false);
  useLayoutEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    if (!ctx) return;
    const g = new G(lw, lh);
    draw(g, frame / fps, Math.min(lw, lh) / 360, width > height);
    ctx.putImageData(new ImageData(new Uint8ClampedArray(g.d), lw, lh), 0, 0);
    ctx.textBaseline = 'middle';
    for (const t of g.textos) {
      ctx.font = `${t.size}px ${FUENTE_PIXEL}`;
      ctx.textAlign = t.align ?? 'center';
      if (t.stroke) {
        ctx.lineJoin = 'miter';
        ctx.lineWidth = Math.max(2, t.size / 4);
        ctx.strokeStyle = t.stroke;
        ctx.strokeText(t.s, t.x, t.y);
      }
      ctx.fillStyle = t.fill;
      ctx.fillText(t.s, t.x, t.y);
    }
    if (listo && !liberado.current) {
      liberado.current = true;
      continueRender(espera);
    }
  }, [frame, listo]);
  return (
    <AbsoluteFill style={{background: '#000'}}>
      <canvas ref={ref} width={lw} height={lh} style={{width: '100%', height: '100%', imageRendering: 'pixelated'}} />
    </AbsoluteFill>
  );
};

/* ---------------- Paletas ---------------- */
const NEGRO = rampa('#06080f', '#101624', '#1c2638', '#2e3d56');
const BLANCO = rampa('#8d9bb2', '#bcc8da', '#e3eaf4', '#ffffff');
const NARANJA = rampa('#a94a0a', '#dd8418', '#f4b03a', '#ffd873');
const AMARILLO = rampa('#a3741a', '#d9a82e', '#f4cf54', '#fff09a');
const OCRE = rampa('#6e3a14', '#9a5a22', '#c47e34', '#e6a85a');
const ROJO = rampa('#6a0f1c', '#a31a2b', '#d7263d', '#ff6b7a');
const VERDE = rampa('#1f4a2c', '#2f7a46', '#4fae68', '#8ee09a');
const MARRON = rampa('#2b1a0e', '#4a2e18', '#6e4524', '#94653a');
const HUEVO = rampa('#b9aa8e', '#d8ccb2', '#efe6d0', '#fffaf0');
const PIEL = rampa('#9c6a4a', '#c8946e', '#e6b890', '#f8d7b6');
const ACERO = rampa('#0c0d14', '#22242f', '#3c3f50', '#686c82');
const PLUMA = rampa('#9a6a38', '#c99454', '#ecc383', '#fff1d2');

/* ---------------- Pingüino realista ---------------- */
const pinguino = (g: G, x: number, yb: number, h: number, dir: 1 | -1, fase: number) => {
  const y = yb - Math.abs(Math.sin(fase)) * h * 0.025;
  g.ellA(x, yb + 1, h * 0.3, h * 0.06, [10, 20, 40], 0.3);
  g.contorno = [4, 6, 12];
  for (const j of [0, 1]) {
    const lev = Math.max(0, Math.sin(fase + Math.PI * j)) * h * 0.05;
    g.ell(x + (j ? 1 : -1) * h * 0.11, yb - lev, h * 0.09, h * 0.04, NARANJA);
  }
  const sw = Math.sin(fase) * h * 0.03;
  g.ell(x - h * 0.27, y - h * 0.4 + sw, h * 0.065, h * 0.2, NEGRO);
  g.ell(x + h * 0.27, y - h * 0.4 - sw, h * 0.065, h * 0.2, NEGRO);
  g.ell(x, y - h * 0.38, h * 0.26, h * 0.37, NEGRO);
  g.ell(x, y - h * 0.74, h * 0.17, h * 0.17, NEGRO);
  g.contorno = null;
  g.ell(x + dir * h * 0.025, y - h * 0.34, h * 0.185, h * 0.31, BLANCO);
  g.ell(x + dir * h * 0.03, y - h * 0.62, h * 0.11, h * 0.08, AMARILLO);
  const ex = x + dir * h * 0.07;
  g.rect(ex - 1, y - h * 0.78 - 1, 2, 2, [250, 250, 250]);
  g.rect(ex, y - h * 0.78, 1, 1, [5, 5, 10]);
  g.ell(x + dir * h * 0.17, y - h * 0.72, h * 0.09, h * 0.03, NARANJA);
};

const nieve = (g: G, t: number, n: number, viento: number, k: number) => {
  for (let i = 0; i < n; i++) {
    const v = (20 + rnd(i, 2) * 40) * k;
    const y = (t * v + rnd(i, 3) * g.h * 1.3) % (g.h * 1.1);
    const x = (rnd(i, 1) * g.w + t * viento * k * (0.5 + rnd(i, 6)) + Math.sin(t * 1.5 + i) * 4 * k) % (g.w + 10);
    const grande = rnd(i, 4) > 0.82;
    g.rect(x, y, grande ? 2 : 1, grande ? 2 : 1, [255, 255, 255], 0.9);
  }
};

/* ---------------- Colonia de pingüinos (cartel de prohibido si parametro = ley) ---------------- */
export const PixelColonia: React.FC<PropsEscena> = ({parametro}) => (
  <Lienzo
    draw={(g, t, k, horiz) => {
      const W = g.w;
      const H = g.h;
      const hz = Math.floor(H * (horiz ? 0.46 : 0.42));
      g.grad(0, hz, rampa('#03051a', '#07103a', '#0e2358', '#1a4274', '#3d7aa6'));
      for (let i = 0; i < 90; i++) {
        const b = Math.sin(t * 2.5 + i * 1.9);
        if (b > -0.3) g.set(rnd(i, 1) * W, rnd(i, 2) * hz * 0.85, i % 5 === 0 ? [180, 210, 255] : [255, 255, 255], b > 0.5 ? 1 : 0.6);
      }
      for (let x = 0; x < W; x++) {
        for (let y = 0; y < hz * 0.8; y++) {
          const onda = Math.sin(x * 0.022 + t * 0.55 + Math.sin(y * 0.03 + t * 0.4) * 1.4);
          const alt = 1 - Math.abs(y / (hz * 0.8) - 0.38) * 2.6;
          const i = Math.max(0, onda * 0.5 + 0.5) * Math.max(0, alt);
          const a = Math.floor(i * 4) / 4;
          if (a > 0) {
            const m = Math.floor(((Math.sin(x * 0.012 + t * 0.2) + 1) / 2) * 3) / 3;
            g.set(x, y, [Math.round(60 + 90 * m), Math.round(255 - 155 * m), Math.round(176 + 79 * m)], a * 0.42);
          }
        }
      }
      for (let x = 0; x < W; x++) {
        const hm = (22 + Math.sin(x * 0.03) * 12 + Math.sin(x * 0.011 + 2) * 18 + Math.sin(x * 0.09) * 3) * k;
        for (let y = hz - hm; y < hz; y++) {
          const luz = y - (hz - hm) < 3 ? 2 : y - (hz - hm) < 9 ? 1 : 0;
          g.set(x, y, [[22, 44, 82], [40, 72, 118], [112, 160, 205]][luz] as RGB);
        }
      }
      g.grad(hz, H, rampa('#e6f4fc', '#c9e3f2', '#aecfe6', '#90bcd8'));
      for (let y = hz; y < H; y++) {
        const p = (y - hz) / (H - hz);
        if (Math.floor(y - hz) % Math.max(4, Math.round(5 + p * 16)) === 0) for (let x = 0; x < W; x++) g.set(x, y, [60, 100, 140], 0.13);
        for (let x = 0; x < W; x++) {
          const r = hs(x, y);
          if (r > 0.992) g.set(x, y, [255, 255, 255], 0.9);
          else if (r < 0.01) g.set(x, y, [70, 110, 150], 0.35);
        }
      }
      g.rect(0, hz - 1, W, 2, [244, 251, 255]);
      const tam = [34, 52, 78];
      [0, 1, 2].forEach((fila) => {
        const ph = tam[fila] * k;
        const sep = ph * 1.05;
        const n = Math.ceil(W / sep) + 2;
        const yb = hz + (H - hz) * (0.2 + fila * 0.3) + ph * 0.5;
        for (let i = 0; i < n; i++) {
          const x = ((i * sep + t * (10 + fila * 7) + fila * 31) % (n * sep)) - sep;
          pinguino(g, x, yb, ph, (i + fila) % 3 === 0 ? -1 : 1, t * 7 + i * 1.3 + fila);
        }
      });
      if (parametro === 'ley') {
        const px = W * (horiz ? 0.2 : 0.3);
        const base = hz + 6 * k;
        g.rect(px - 2, base - 118 * k, 4, 118 * k, MARRON[1]);
        g.rect(px - 1, base - 118 * k, 1, 118 * k, MARRON[2]);
        const sx = px - 44 * k;
        const sy = base - 196 * k;
        g.rect(sx - 2, sy - 2, 88 * k + 4, 88 * k + 4, [14, 14, 18]);
        g.rect(sx, sy, 88 * k, 88 * k, [244, 246, 250]);
        pinguino(g, px, sy + 76 * k, 62 * k, 1, 0);
        g.ring(px, sy + 44 * k, 38 * k, 7 * k, ROJO[2]);
        g.line(px - 27 * k, sy + 17 * k, px + 27 * k, sy + 71 * k, ROJO[2], 7 * k);
      }
      nieve(g, t, 110, 18, k);
    }}
  />
);

/* ---------------- Aves del supermercado ---------------- */
const ave = (g: G, x: number, yb: number, s: number, tipo: number, rebote: number) => {
  const y = yb + rebote;
  const ojo = Math.max(1, s * 0.07);
  g.ellA(x, yb + 1, s * 1.05, s * 0.18, [40, 30, 20], 0.25);
  g.contorno = [52, 30, 14];
  if (tipo === 0) {
    g.ell(x + s * 0.6, y - s * 0.95, s * 0.4, s * 0.36, rampa('#a5441a', '#c9702a', '#e89a48', '#fbd9a0'));
    g.ell(x, y - s * 0.6, s * 0.95, s * 0.72, PLUMA);
    g.ell(x - s * 0.55, y - s * 1.2, s * 0.42, s * 0.42, PLUMA);
    g.ell(x - s * 0.58, y - s * 1.66, s * 0.17, s * 0.15, ROJO);
    g.ell(x - s * 0.93, y - s * 1.16, s * 0.2, s * 0.09, NARANJA);
    g.rect(x - s * 0.62, y - s * 1.28, ojo, ojo, [10, 10, 10]);
    g.ell(x - s * 0.1, y - s * 0.55, s * 0.5, s * 0.3, rampa('#7a4f26', '#a0723c', '#c99454', '#ecc383'));
  } else if (tipo === 1) {
    g.ell(x, y - s * 0.55, s * 1.0, s * 0.6, rampa('#6a5a48', '#8f7c62', '#b9a483', '#e0d0b0'));
    g.ell(x - s * 0.7, y - s * 1.2, s * 0.32, s * 0.4, VERDE);
    g.ell(x - s * 0.98, y - s * 1.12, s * 0.22, s * 0.1, AMARILLO);
    g.rect(x - s * 0.7, y - s * 1.28, ojo, ojo, [10, 10, 10]);
  } else {
    for (let a = -3; a <= 3; a++) g.ell(x + s * 0.55 + a * 0.05 * s, y - s * 1.15 - Math.abs(a) * 0.04 * s, s * 0.2, s * 0.62, a % 2 ? OCRE : MARRON);
    g.ell(x, y - s * 0.6, s * 0.9, s * 0.66, MARRON);
    g.ell(x - s * 0.62, y - s * 1.22, s * 0.32, s * 0.38, rampa('#5a3a22', '#7e5430', '#a27640', '#c9a066'));
    g.ell(x - s * 0.7, y - s * 0.98, s * 0.1, s * 0.2, ROJO);
    g.ell(x - s * 0.92, y - s * 1.2, s * 0.15, s * 0.07, AMARILLO);
  }
  g.contorno = null;
  g.rect(x - s * 0.3, y - s * 0.1, 2, s * 0.14, NARANJA[1]);
  g.rect(x + s * 0.2, y - s * 0.1, 2, s * 0.14, NARANJA[1]);
};

/* ---------------- Supermercado: pollo, pato, pavo... y el estante vacío del pingüino ---------------- */
export const PixelSuper: React.FC<PropsEscena> = () => (
  <Lienzo
    draw={(g, t, k, horiz) => {
      const W = g.w;
      const H = g.h;
      g.grad(0, H, rampa('#f1ead9', '#e6dcc4', '#d6cab0', '#c2b596'));
      for (let x = 0; x < W; x += 16) g.rect(x, 0, 1, H, [150, 135, 105], 0.18);
      const fy = Math.floor(H * 0.9);
      for (let y = fy; y < H; y++)
        for (let x = 0; x < W; x++) g.set(x, y, (Math.floor(x / 22) + Math.floor((y - fy) / 7)) % 2 ? [128, 128, 140] : [150, 150, 162]);
      g.rect(0, fy - 1, W, 1, [70, 70, 80]);
      g.rect(0, Math.floor(H * 0.03), W, Math.floor(H * 0.07), ROJO[2]);
      g.rect(0, Math.floor(H * 0.03), W, 2, ROJO[3]);
      g.rect(0, Math.floor(H * 0.1) - 2, W, 2, ROJO[0]);
      g.txt('SUPERMERCADO', W / 2, H * 0.065, 16, '#fff', '#5a0f1c');
      for (let f = 0; f < 3; f++) {
        const yb = H * (horiz ? 0.34 : 0.36) + f * H * (horiz ? 0.24 : 0.18);
        const s = (horiz ? 17 : 15) * k;
        const n = Math.floor((W - 20) / (s * 2.6));
        const sep = (W - 20) / n;
        g.rect(8, yb + 2, W - 16, 7 * k, MARRON[2]);
        g.rect(8, yb + 2, W - 16, 2, MARRON[3]);
        g.rect(8, yb + 2 + 7 * k, W - 16, 3, MARRON[0]);
        for (let i = 0; i < n; i++) {
          const x = 10 + sep * (i + 0.5);
          if (f === 1 && i === Math.floor(n / 2)) {
            const par = Math.sin(t * 5) > 0;
            for (let d = 0; d < s * 2.2; d += 4) {
              g.rect(x - s * 1.1 + d, yb - s * 2, 2, 2, par ? ROJO[2] : ROJO[0]);
              g.rect(x - s * 1.1 + d, yb, 2, 2, par ? ROJO[2] : ROJO[0]);
            }
            g.txt('?', x, yb - s * 0.9, 24, par ? '#ffd84a' : '#8a7a30', '#000');
            continue;
          }
          ave(g, x, yb, s, (i + f) % 3, Math.round(Math.sin(t * 2 + i + f) * 0.5));
        }
      }
      const cy = H * (horiz ? 0.86 : 0.85) + Math.sin(t * 2) * 1.5;
      g.rect(W / 2 - 62 * k, cy - 18 * k, 124 * k, 36 * k, [20, 20, 24]);
      g.rect(W / 2 - 60 * k, cy - 16 * k, 120 * k, 32 * k, [244, 244, 248]);
      g.txt('PINGUINO', W / 2, cy, 16, '#c21e33', '', 'center');
      g.line(W / 2 - 54 * k, cy - 11 * k, W / 2 + 54 * k, cy + 11 * k, ROJO[2], 3);
    }}
  />
);

/* ---------------- Caldera de vapor con contador (≈ 2 millones) ---------------- */
export const PixelCaldera: React.FC<PropsEscena> = ({duracion}) => (
  <Lienzo
    draw={(g, t, k, horiz) => {
      const W = g.w;
      const H = g.h;
      const hz = Math.floor(H * 0.64);
      g.grad(0, hz, rampa('#140a26', '#2a1240', '#4e1c55', '#85305a', '#c4505a', '#f08a5a'));
      g.ell(W * (horiz ? 0.78 : 0.76), hz - 26 * k, 34 * k, 34 * k, rampa('#ffb347', '#ffd166', '#ffe9a0', '#fff6d0'));
      g.grad(hz, H, rampa('#35507c', '#27406a', '#1b2f55', '#10203d'));
      for (let y = hz; y < H; y += 3)
        for (let x = 0; x < W; x++) {
          const o = Math.sin(x * 0.12 + t * 1.4 + y * 0.35);
          if (o > 0.85) g.set(x, y, [255, 190, 120], 0.35 * (1 - (y - hz) / (H - hz)));
        }
      g.rect(0, hz, W, 1, [255, 200, 140]);
      const rocaY = hz + 6 * k;
      for (let i = 0; i < 9; i++) g.ell(rnd(i, 5) * W, rocaY + 24 * k, (20 + rnd(i, 6) * 26) * k, (10 + rnd(i, 7) * 10) * k, ACERO);
      g.grad(rocaY + 20 * k, H, rampa('#1d1e2a', '#14151f', '#0c0d14', '#07080c'));
      for (let y = Math.floor(rocaY + 20 * k); y < H; y++) for (let x = 0; x < W; x++) if (hs(x, y, 5) > 0.985) g.set(x, y, [90, 94, 120], 0.5);
      for (let i = 0; i < 7; i++) g.ell(rnd(i, 8) * W, H - (14 + rnd(i, 9) * 40) * k, (26 + rnd(i, 10) * 34) * k, (14 + rnd(i, 3) * 16) * k, ACERO);      const cx = W * (horiz ? 0.34 : 0.5);
      for (let r = 1; r <= 4; r++) g.ellA(cx, rocaY + 10 * k, 40 * r * k, 16 * r * k, [255, 140, 40], 0.03 + Math.abs(Math.sin(t * 6)) * 0.012);
      g.ell(cx, rocaY + 22 * k, 80 * k, 22 * k, ACERO);
      for (let i = 0; i < 9; i++) {
        const alto = (22 + Math.abs(Math.sin(t * 7 + i * 1.7)) * 26) * k;
        const fx = cx - 50 * k + i * 12 * k;
        g.ell(fx, rocaY + 10 * k - alto * 0.5, 7 * k, alto * 0.5, i % 2 ? rampa('#c2410c', '#ea580c', '#fb923c', '#fde68a') : rampa('#d97706', '#f59e0b', '#fcd34d', '#fff7c2'));
      }
      g.ell(cx, rocaY - 52 * k, 62 * k, 52 * k, ACERO);
      g.ell(cx, rocaY - 92 * k, 66 * k, 12 * k, rampa('#1a1b24', '#3a3d4e', '#666a80', '#9ca0b8'));
      g.ell(cx, rocaY - 92 * k, 54 * k, 8 * k, rampa('#1b0f10', '#3a1c14', '#5a2c1a', '#8a4a2a'));
      for (let r = 0; r < 3; r++) g.rect(cx - 62 * k + 6, rocaY - 76 * k + r * 22 * k, 124 * k - 12, 2, [110, 114, 134], 0.7);
      for (let i = 0; i < 16; i++) {
        const ciclo = (t * 0.3 + rnd(i, 1)) % 1;
        g.ellA(cx - 30 * k + rnd(i, 2) * 60 * k + Math.sin(ciclo * 6 + i) * 10 * k, rocaY - 100 * k - ciclo * 180 * k, (9 + ciclo * 22) * k, (7 + ciclo * 16) * k, [245, 247, 252], 0.55 * (1 - ciclo));
      }
      const valor = 2000000 * (1 - Math.pow(1 - interpolate(t, [0, Math.max(duracion * 0.8, 1)], [0, 1], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'}), 3));
      const bx = W * (horiz ? 0.52 : 0.06);
      const bw = W * (horiz ? 0.44 : 0.88);
      const by = H * (horiz ? 0.22 : 0.3);
      g.rect(bx, by, bw, 62 * k, [4, 4, 10], 0.82);
      g.rect(bx, by, bw, 2, [255, 255, 255], 0.5);
      g.txt(formatearNumero(valor), bx + bw / 2, by + 24 * k, 24, '#ffffff', '#000');
      g.txt('PINGUINOS', bx + bw / 2, by + 48 * k, 16, '#ff8a8a', '#000');
    }}
  />
);

/* ---------------- Tormenta polar: expedición de invierno ---------------- */
const persona = (g: G, x: number, yb: number, s: number, abrigo: RGB[], paso: number) => {
  const b = Math.round(Math.sin(paso));
  const lev = Math.sin(paso) * s * 0.08;
  g.contorno = [8, 8, 18];
  g.ell(x - s * 0.13, yb - s * 0.12 + lev, s * 0.11, s * 0.1, ACERO);
  g.ell(x + s * 0.13, yb - s * 0.12 - lev, s * 0.11, s * 0.1, ACERO);
  g.ell(x, yb - s * 0.5 + b, s * 0.26, s * 0.4, abrigo);
  g.ell(x, yb - s * 0.92 + b, s * 0.17, s * 0.17, abrigo);
  g.ell(x + s * 0.03, yb - s * 0.9 + b, s * 0.1, s * 0.1, PIEL);
  g.contorno = null;
  g.rect(x + s * 0.02, yb - s * 0.93 + b, 2, 1, [20, 20, 20]);
};

export const PixelTormenta: React.FC<PropsEscena> = ({parametro, duracion}) => (
  <Lienzo
    draw={(g, t, k, horiz) => {
      const W = g.w;
      const H = g.h;
      const hz = Math.floor(H * 0.64);
      g.grad(0, hz, rampa('#020308', '#060a16', '#0b1226', '#142040', '#22345c'));
      for (let x = 0; x < W; x++) {
        const hm = (18 + Math.sin(x * 0.02 + 1) * 10 + Math.sin(x * 0.05) * 4) * k;
        for (let y = hz - hm; y < hz; y++) g.set(x, y, y - (hz - hm) < 3 ? [150, 175, 210] : [60, 82, 120]);
      }
      g.grad(hz, H, rampa('#aec2d8', '#92a9c2', '#7790ae', '#5b7392'));
      for (let y = hz; y < H; y++)
        for (let x = 0; x < W; x++) {
          const r = hs(x, y, 3);
          if (r > 0.99) g.set(x, y, [240, 248, 255], 0.9);
          else if (r < 0.01) g.set(x, y, [40, 56, 84], 0.4);
        }
      const px = W * (horiz ? 0.34 : 0.4) + Math.min(t / Math.max(duracion, 1), 1) * W * 0.3;
      const yb = hz + 40 * k;
      const s = 66 * k;
      const paso = t * 6;
      const lx = px - 98 * k;
      const ly = yb - 38 * k;
      for (let y = Math.floor(ly - 70 * k); y < ly + 40 * k; y++)
        for (let x = Math.floor(lx - 150 * k); x < lx; x++) {
          const d = (lx - x) / (150 * k);
          if (Math.abs(y - ly) < (0.1 + d * 0.9) * 46 * k && (1 - d) * 0.5 > bay(x, y) * 0.6) g.set(x, y, [255, 233, 168], 0.3);
        }
      g.ell(lx, ly, 8 * k, 8 * k, rampa('#8a5a10', '#d9a02e', '#ffd66b', '#fff5c8'));
      g.line(px - 64 * k, yb - 26 * k, px - 30 * k, yb - 14 * k, [210, 210, 220], 1);
      g.rect(px - 20 * k, yb - 30 * k, 68 * k, 14 * k, MARRON[2]);
      g.rect(px - 20 * k, yb - 30 * k, 68 * k, 2, MARRON[3]);
      g.rect(px - 24 * k, yb - 14 * k, 76 * k, 3, ACERO[1]);
      g.ell(px + 14 * k, yb - 38 * k, 22 * k, 10 * k, rampa('#3a2e24', '#5a4634', '#7e6446', '#a08660'));
      persona(g, px - 52 * k, yb, s, rampa('#4a0a10', '#7e1620', '#b02530', '#e0505a'), paso);
      persona(g, px - 92 * k, yb, s * 0.96, rampa('#0f2a4e', '#1d4e89', '#3a7cc0', '#78b0e8'), paso + 1.2);
      for (let i = 0; i < 18; i++) {
        const x = ((t * (130 + rnd(i, 1) * 90) * k + rnd(i, 2) * W) % (W + 90)) - 60;
        g.rect(x, rnd(i, 3) * hz, 24 + rnd(i, 4) * 40, 1, [255, 255, 255], 0.5);
      }
      nieve(g, t, 200, 150, k);
      if (parametro === 'huevos' && t > duracion * 0.45) {
        const a = Math.min(1, (t - duracion * 0.45) * 2) * 0.62;
        g.rect(0, 0, W, H, [0, 0, 6], a);
        const cx = W / 2;
        const cy = H * 0.5;
        g.ellA(cx, cy, 120 * k, 84 * k, [255, 233, 168], 0.1 + Math.abs(Math.sin(t * 3)) * 0.07);
        g.ellA(cx, cy, 82 * k, 58 * k, [255, 233, 168], 0.1);
        [-1, 0, 1].forEach((j) => g.ell(cx + j * 50 * k, cy + Math.round(Math.sin(t * 3 + j)) * 1.5, 16 * k, 21 * k, HUEVO));
        g.txt('3 HUEVOS', cx, cy + 50 * k, 24, '#ffffff', '#000');
      }
    }}
  />
);

export const REGISTRO_PINGUINOS: Record<string, React.FC<PropsEscena>> = {
  pixelcolonia: PixelColonia,
  pixelsuper: PixelSuper,
  pixelcaldera: PixelCaldera,
  pixeltormenta: PixelTormenta,
};
