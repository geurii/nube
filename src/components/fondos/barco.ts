// Escenas pixel "Mary Celeste": barco a la deriva, cubierta vacía y bodega con barriles.
// Diseño propio (sin marcas). Mismo método que forbes.ts: lienzo pixel a pixel, 1 px = 2 px del video.
import {G, RGB, rampa, bay, hs} from './pixelG';
import {rnd} from '../../lib/util';

export type Dib = (g: G, t: number, k: number, horiz: boolean, param: string, dur: number) => void;
const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const OUT: RGB = [14, 10, 12];
const MADERA = rampa('#22140a', '#3e2614', '#5e3c20', '#835530', '#a86e40', '#c8905a');
const ORO = rampa('#6a4306', '#b07a14', '#e8b03a', '#ffd870');
const VELA = rampa('#8a8070', '#b8ae96', '#dcd2b8', '#f2ecd8', '#fffbee');
const JARCIA: RGB = [60, 46, 34];
const MAR = rampa('#04101e', '#082440', '#0e3a60', '#1a5680', '#2e7298');
const ESPUMA: RGB = [220, 240, 250];
const tono = (r: RGB[], l: number, x: number, y: number): RGB => {
  const v = cl(l) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(v));
  return v - i > bay(x, y) ? r[i + 1] : r[i];
};

/* Relleno de polígono con contorno oscuro de 1 px (prueba punto a punto). */
const dentroPoly = (pts: [number, number][], x: number, y: number) => {
  let c = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i], [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
  }
  return c;
};
const poligono = (g: G, pts: [number, number][], f: (x: number, y: number) => RGB, borde: RGB | null = OUT) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++)
    for (let x = Math.floor(Math.min(...xs)); x <= Math.ceil(Math.max(...xs)); x++) {
      if (!dentroPoly(pts, x + 0.5, y + 0.5)) continue;
      const esBorde = borde && (!dentroPoly(pts, x - 1, y) || !dentroPoly(pts, x + 1, y) || !dentroPoly(pts, x, y - 1) || !dentroPoly(pts, x, y + 1));
      g.set(x, y, esBorde && borde ? borde : f(x, y));
    }
};

const titulo = (g: G, t: number, k: number, W: number, H: number, s: string, color = '#ffd870') => {
  if (!s) return;
  const a = cl((t - 0.1) / 0.3);
  const size = Math.round(Math.min(12 * k, (0.84 * W) / Math.max(1, s.length)));
  const y = H * 0.1;
  g.rect(W * 0.06, y - size * 0.95, W * 0.88, size * 1.9, [8, 6, 14], 0.72 * a);
  g.rect(W * 0.06, y - size * 0.95, W * 0.88, 2, [255, 214, 90], a);
  if (a > 0.05) g.txt(s, W / 2, y, size, color, '#000');
};

/* Vela cuadrada con panza (curva inferior), luz desde la izquierda y contorno. */
const vela = (g: G, x0: number, x1: number, yt: number, yb: number, panza: number, t: number, fase: number) => {
  const ancho = x1 - x0;
  poligono(g, [[x0, yt], [x1, yt], [x1, yb], [x0, yb]].map(([x, y]) => [x, y]) as [number, number][], (x, y) => {
    const u = (x - x0) / ancho;
    const v = (y - yt) / (yb - yt + 0.01);
    const pliegue = Math.sin(u * Math.PI * 2 + fase + Math.sin(t * 0.7) * 0.3) * 0.06;
    return tono(VELA, 0.9 - u * 0.35 - v * 0.22 + pliegue, x, y);
  }, OUT);
  // panza: el borde inferior se curva hacia abajo en el centro
  for (let x = Math.floor(x0); x <= Math.ceil(x1); x++) {
    const u = (x - x0) / ancho;
    const y = yb + panza * Math.sin(Math.PI * u);
    g.set(x, Math.floor(y), OUT);
  }
};

/* Bergantín con la estructura de referencia: popa alta a la izquierda, casco largo,
   dos mástiles con vergas y velas cuadradas, bauprés hacia la derecha. */
const bergantin = (g: G, cx: number, yb: number, s: number, t: number) => {
  const P = (x: number, y: number): [number, number] => [cx + x * s, yb + y * s];
  // casco: popa alta (castillo a la izquierda), línea de regala, proa que sube hacia el bauprés
  const casco: [number, number][] = [
    P(-0.44, -0.34), P(-0.5, -0.2), P(-0.46, -0.04), P(-0.36, 0.0), P(0.34, 0.0), P(0.5, -0.12), P(0.46, -0.2), P(-0.2, -0.2), P(-0.28, -0.26), P(-0.36, -0.26),
  ];
  poligono(g, casco, (x, y) => {
    const v = cl((y - (yb - 0.34 * s)) / (0.34 * s));
    const linea = Math.abs(((y * 6) % 1 + 1) % 1 - 0.5) < 0.12 ? 0.3 : 0;
    const tablon = Math.floor(x * 0.7) % 9 === 0 ? 0.12 : 0;
    return tono(MADERA, 0.9 - v * 0.45 - linea - tablon, x, y);
  }, OUT);
  // ventanas de la popa
  for (let i = 0; i < 3; i++) g.rect(P(-0.42 + i * 0.06, 0)[0], P(0, -0.18)[1], 4, 4, [255, 200, 120], 0.85);
  // portas de cañón
  for (let i = 0; i < 6; i++) g.rect(P(-0.16 + i * 0.09, 0)[0], P(0, -0.1)[1], 3, 4, OUT);
  // mástiles: el de proa más alto
  const m1x = cx - 0.22 * s, m2x = cx + 0.14 * s;
  const m1Top = yb - 0.98 * s, m2Top = yb - 0.86 * s, cubierta = yb - 0.2 * s;
  g.rect(m1x - 2, m1Top, 4, cubierta - m1Top, MADERA[2]);
  g.rect(m2x - 2, m2Top, 4, cubierta - m2Top, MADERA[2]);
  // vergas
  const vergas = (x: number, y: number, w: number) => g.rect(x - w / 2, y, w, 3, MADERA[3]);
  vergas(m1x, yb - 0.66 * s, 0.4 * s); vergas(m1x, yb - 0.3 * s, 0.4 * s);
  vergas(m1x, yb - 0.92 * s, 0.32 * s);
  vergas(m2x, yb - 0.56 * s, 0.36 * s); vergas(m2x, yb - 0.26 * s, 0.36 * s);
  vergas(m2x, yb - 0.84 * s, 0.3 * s);
  // velas: cuadradas con panza
  vela(g, m1x - 0.14 * s, m1x + 0.14 * s, yb - 0.9 * s, yb - 0.7 * s, 0.03 * s, t, 0);
  vela(g, m1x - 0.15 * s, m1x + 0.15 * s, yb - 0.66 * s, yb - 0.34 * s, 0.05 * s, t, 1);
  vela(g, m2x - 0.12 * s, m2x + 0.12 * s, yb - 0.82 * s, yb - 0.62 * s, 0.03 * s, t, 2.5);
  vela(g, m2x - 0.13 * s, m2x + 0.13 * s, yb - 0.58 * s, yb - 0.3 * s, 0.05 * s, t, 3.5);
  // foque triangular entre el mástil de proa y el bauprés
  poligono(g, [[m2x + 0.02 * s, yb - 0.82 * s], [cx + 0.5 * s, yb - 0.36 * s], [m2x + 0.02 * s, yb - 0.3 * s]], (x, y) => tono(VELA, 0.8 - (x - m2x) / (0.5 * s) * 0.3, x, y), OUT);
  // bauprés
  g.line(cx + 0.46 * s, yb - 0.2 * s, cx + 0.66 * s, yb - 0.4 * s, MADERA[3], 3);
  // jarcias finas desde las cimas hacia la popa y la proa
  for (let i = 0; i < 4; i++) {
    const vib = Math.sin(t * 1.6 + i) * 1.2;
    g.line(m1x, m1Top + i * 2, cx - 0.46 * s + i * 2, yb - 0.2 * s + vib, JARCIA, 1);
    g.line(m2x, m2Top + i * 2, cx + 0.46 * s - i * 2, yb - 0.18 * s + vib, JARCIA, 1);
  }
  g.line(m1x, m1Top, cx + 0.66 * s, yb - 0.4 * s, JARCIA, 1);
};

/* Olas: crestas horizontales curvas con espuma en la cresta. */
const mar = (g: G, t: number, k: number, hz: number) => {
  const W = g.w, H = g.h;
  for (let y = hz; y < H; y++) {
    const p = (y - hz) / (H - hz);
    for (let x = 0; x < W; x++) {
      const onda = Math.sin(y * 0.32 + t * 1.1 + Math.sin(x * 0.02 + y * 0.04) * 1.6);
      const capa = onda * 0.5 + 0.5;
      let c = tono(MAR, 0.15 + p * 0.55 + capa * 0.25, x, y);
      if (onda > 0.9) c = tono(MAR, 0.92, x, y);
      g.set(x, y, c);
    }
  }
  for (let i = 0; i < 120; i++) {
    const x = rnd(i, 1) * W, y = hz + rnd(i, 2) * (H - hz) * 0.8;
    const onda = Math.sin(y * 0.32 + t * 1.1 + Math.sin(x * 0.02 + y * 0.04) * 1.6);
    const b = cl((onda - 0.8) * 4);
    if (b > 0) { g.set(x, y, ESPUMA, 0.5 + 0.5 * b); g.set(x + 1, y, ESPUMA, 0.4 * b); }
  }
};

/* ---------- 1. BARCO A LA DERIVA (param: texto del banner) ---------- */
export const barcoDeriva: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const hz = Math.floor(H * 0.58);
  g.grad(0, hz, rampa('#0a0f26', '#1a2650', '#3a3a70', '#8a6a8a', '#d89a7a'));
  for (let i = 0; i < 60; i++) g.set(rnd(i, 1) * W, rnd(i, 2) * hz * 0.5, [255, 240, 220], 0.2 + 0.5 * Math.sin(t * 2 + i));
  g.ellA(W * 0.8, H * 0.12, 22 * k, 22 * k, [255, 240, 200], 0.18);
  g.ell(W * 0.8, H * 0.12, 9 * k, 9 * k, rampa('#fff0c0', '#fff8e4'));
  for (let i = 0; i < 4; i++) {
    const x = W * (0.1 + i * 0.27), w = 40 * k + i * 6 * k;
    for (let y = hz - 10 * k; y < hz; y++) for (let xx = x - w; xx < x + w; xx++) {
      const d = Math.abs(xx - x) / w;
      if (y > hz - (1 - d) * 10 * k) g.set(xx, y, [22, 28, 48]);
    }
  }
  mar(g, t, k, hz);
  for (let i = 0; i < 18; i++) {
    const y = hz + 6 * k + i * 6 * k, x = W * 0.8 + Math.sin(t * 2 + i) * 6 * k;
    g.rect(x - (14 - i * 0.6) * k, y, (28 - i * 1.2) * k, 1, [255, 230, 180] as RGB, 0.4);
  }
  const cx = W * 0.5 + Math.sin(t * 0.4) * 4 * k;
  const yb = H * 0.66 + Math.sin(t * 1.3) * 2 * k;
  g.ellA(cx, yb + 2 * k, 110 * k, 6 * k, [4, 8, 16], 0.5);
  bergantin(g, cx, yb, 190 * k, t);
  titulo(g, t, k, W, H, param);
};

/* ---------- 2. CUBIERTA VACÍA ---------- */
export const cubiertaVacia: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  g.grad(0, H, rampa('#0a0d18', '#1a2236', '#2a3450', '#14182a'));
  for (let i = 0; i < 4; i++) g.ellA(W * (0.2 + i * 0.22) + Math.sin(t * 0.3 + i) * 10 * k, H * 0.7, 120 * k, 14 * k, [120, 130, 160], 0.08);
  const cy = H * 0.66;
  for (let y = cy; y < H; y++) for (let x = 0; x < W; x++) {
    const tabla = Math.floor((y - cy) / (6 * k));
    g.set(x, y, tono(MADERA, 0.35 + ((tabla * 37) % 10) / 30 - (y - cy) / (H - cy) * 0.2, x, y));
  }
  for (let x = 0; x < W; x += 40 * k) g.rect(x, cy, 1, H - cy, [20, 12, 6], 0.7);
  g.rect(0, cy, W, 2, OUT);
  g.rect(W * 0.5 - 2, H * 0.1, 3, cy - H * 0.1, MADERA[1]);
  for (let i = 0; i < 6; i++) {
    const x1 = W * 0.5 + (i - 3) * 14 * k;
    g.line(W * 0.5, H * 0.12, x1 + Math.sin(t * 1.4 + i) * 3 * k, cy - 6 * k, JARCIA, 1);
  }
  const rx = W * 0.2, ry = H * 0.5;
  g.ring(rx, ry, 28 * k, 3, MADERA[2]);
  for (let a = 0; a < 8; a++) g.line(rx, ry, rx + Math.cos(a * Math.PI / 4) * 28 * k, ry + Math.sin(a * Math.PI / 4) * 28 * k, MADERA[3], 2);
  const fx = W * 0.8, fy = H * 0.12 + Math.sin(t * 1.2) * 6 * k;
  g.line(fx, H * 0.02, fx, fy, [60, 50, 30], 1);
  g.ellA(fx, fy + 4 * k, 40 * k, 40 * k, [255, 200, 120], 0.22);
  g.ell(fx, fy + 4 * k, 6 * k, 8 * k, rampa('#ffb860', '#ffdc96', '#fff0c0'));
  titulo(g, t, k, W, H, param);
};

/* ---------- 3. BODEGA CON BARRILES ---------- */
export const bodegaBarriles: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  g.grad(0, H, rampa('#050406', '#0c0a10', '#14101a', '#0a0808'));
  for (let i = 0; i < 14; i++) g.ellA(W * 0.5, H * 0.1 + i * 3 * k, (50 + i * 8) * k, 2 * k, [255, 210, 150], 0.05);
  const filas = 3, cols = horiz ? 8 : 4;
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    const cx = W * (0.14 + c * (0.72 / (cols - 1 || 1))), cy = H * (0.55 + f * 0.14);
    const r = (horiz ? 40 : 30) * k;
    g.ell(cx, cy, r * 0.8, r, MADERA);
    g.ring(cx, cy - r * 0.5, r * 0.8, 1, [12, 8, 4]);
    g.ring(cx, cy + r * 0.5, r * 0.8, 1, [12, 8, 4]);
    g.rect(cx - r * 0.5, cy - 2 * k, r, 4 * k, ORO[1], 0.5);
  }
  for (let i = 0; i < 40; i++) {
    const x = (rnd(i, 1) * W + Math.sin(t * 0.5 + i) * 4 * k), y = (rnd(i, 2) * H - t * 6 * k) % H;
    g.set((x + W) % W, (y + H) % H, [255, 220, 170], 0.3 + 0.3 * Math.sin(t * 2 + i));
  }
  titulo(g, t, k, W, H, param);
};

/* ---------- 2b. CUBIERTA VACÍA (perspectiva, tablones que convergen, sin tripulación) ---------- */
export const cubiertaVacia2: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const hz = Math.floor(H * 0.42);
  g.grad(0, hz, rampa('#06081a', '#0e1430', '#1a2244', '#2a3258'));
  // mar lejano en la franja del horizonte
  for (let x = 0; x < W; x++) g.set(x, hz - 1, [30, 46, 80], 0.8);
  // cubierta en perspectiva: tablones que se abren hacia la cámara
  for (let y = hz; y < H; y++) {
    const p = (y - hz) / (H - hz);
    for (let x = 0; x < W; x++) g.set(x, y, tono(MADERA, 0.2 + p * 0.55, x, y));
  }
  for (let i = -12; i <= 12; i++) {
    const xb = W * 0.5 + i * W * 0.11;
    for (let y = hz; y < H; y++) {
      const p = (y - hz) / (H - hz);
      const x = W * 0.5 + (xb - W * 0.5) * p;
      g.set(Math.round(x), y, OUT, 0.55);
    }
  }
  // regala a los lados (la borda del barco)
  g.rect(0, hz + (H - hz) * 0.12, W * 0.08, 6 * k, MADERA[5]);
  g.rect(W * 0.92, hz + (H - hz) * 0.12, W * 0.08, 6 * k, MADERA[5]);
  // mástil central con su verga y la vela recogida, sin nadie en la cubierta
  const mx = W * 0.5;
  g.rect(mx - 3 * k, H * 0.05, 6 * k, hz - H * 0.05 + (H - hz) * 0.25, MADERA[2]);
  g.rect(mx - 60 * k, H * 0.2, 120 * k, 4 * k, MADERA[3]);
  for (let i = 0; i < 5; i++) {
    const fx = mx - 56 * k + i * 28 * k;
    g.rect(fx, H * 0.2 + 4 * k, 22 * k, 16 * k + Math.sin(t * 1.5 + i) * 1.5 * k, [150, 140, 118], 0.9);
  }
  // jarcias que bajan al barco
  for (let i = 0; i < 6; i++) g.line(mx, H * 0.05, mx + (i - 2.5) * 40 * k, H * 0.9, JARCIA, 1);
  // farol colgando que se balancea
  const fx = W * 0.82, fy = H * 0.3 + Math.sin(t * 1.2) * 6 * k;
  g.line(fx, H * 0.1, fx, fy, JARCIA, 1);
  g.ellA(fx, fy + 6 * k, 46 * k, 46 * k, [255, 200, 120], 0.2);
  g.ell(fx, fy + 6 * k, 6 * k, 9 * k, rampa('#ffb860', '#ffdc96', '#fff0c0'));
  titulo(g, t, k, W, H, param);
};

/* ---------- 3b. BODEGA (barriles con aros metálicos y etiqueta) ---------- */
export const bodegaBarriles2: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  g.grad(0, H, rampa('#040305', '#0a0810', '#120e18', '#080608'));
  for (let i = 0; i < 16; i++) g.ellA(W * 0.5, H * 0.08 + i * 3 * k, (46 + i * 8) * k, 2 * k, [255, 210, 150], 0.05);
  const pal = rampa('#2a1408', '#4a2a14', '#6e4422', '#94603a', '#b88254');
  const cols = horiz ? 6 : 3, filas = 3;
  for (let f = 0; f < filas; f++) for (let c = 0; c < cols; c++) {
    const cx = W * (0.18 + c * (0.64 / Math.max(1, cols - 1))) + (f % 2) * 6 * k;
    const cy = H * (0.5 + f * 0.15);
    const r = (horiz ? 38 : 30) * k;
    // forma de barril: estrecho arriba y abajo, abombado en el centro
    const perfil = (u: number) => 0.62 + 0.3 * Math.sin(Math.PI * u); // u de 0 (arriba) a 1 (abajo)
    const lados: [number, number][] = [];
    for (let i = 0; i <= 12; i++) { const u = i / 12; lados.push([cx + perfil(u) * r * 0.8, cy - r + u * 2 * r]); }
    for (let i = 12; i >= 0; i--) { const u = i / 12; lados.push([cx - perfil(u) * r * 0.8, cy - r + u * 2 * r]); }
    poligono(g, lados, (x, y) => {
      const u = (x - (cx - r * 0.8)) / (r * 1.6);
      return tono(pal, 0.25 + u * 0.6, x, y);
    }, OUT);
    // aros metálicos horizontales, a lo ancho del barril en esa altura
    for (const off of [-0.6, 0.6]) {
      const yy = cy + off * r;
      const w = perfil((off * r + r) / (2 * r)) * r * 0.8;
      g.rect(cx - w, yy - 1 * k, w * 2, 2 * k, [96, 92, 104]);
    }
    // etiqueta en el barril de enfrente
    if (f === 0 && c === Math.floor(cols / 2)) {
      g.rect(cx - r * 0.45, cy - r * 0.2, r * 0.9, r * 0.4, [236, 226, 196]);
      g.txt('ALCOHOL', cx, cy, Math.round(6 * k), '#5a1a10', '');
    }
  }
  for (let i = 0; i < 36; i++) {
    const x = (rnd(i, 1) * W + Math.sin(t * 0.5 + i) * 4 * k), y = (rnd(i, 2) * H - t * 6 * k) % H;
    g.set((x + W) % W, (y + H) % H, [255, 220, 170], 0.25 + 0.3 * Math.sin(t * 2 + i));
  }
  titulo(g, t, k, W, H, param);
};

export const DIBUJOS_BARCO: Record<string, Dib> = {
  pixelbarcoderiva: barcoDeriva,
  pixelcubierta: cubiertaVacia2,
  pixelbodega: bodegaBarriles2,
};
