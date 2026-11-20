// Escenas pixel "Los 5 trucos": objetos de diseño propio (sin marcas ni logos) dibujados pixel a pixel.
import {G, RGB, rampa, bay, hs, hex} from './pixelG';
import {rnd} from '../../lib/util';

export type Dib = (g: G, t: number, k: number, horiz: boolean, param: string, dur: number) => void;
const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t: number) => { t = cl(t); return t * t * (3 - 2 * t); };
const OUT: RGB = [10, 8, 16];

/** sólido de revolución con sombreado cilíndrico, tramado y contorno de 1 px */
const revol = (g: G, cx: number, y0: number, y1: number, hw: (u: number) => number, r: RGB[], luz = -0.5, brillo = true) => {
  const n = r.length;
  const ws: number[] = [];
  for (let y = Math.floor(y0); y < Math.ceil(y1); y++) ws.push(Math.max(0, hw((y + 0.5 - y0) / (y1 - y0))));
  ws.forEach((w, j) => {
    const y = Math.floor(y0) + j;
    if (w <= 0.2) return;
    const wp = j > 0 ? ws[j - 1] : 0, wn = j + 1 < ws.length ? ws[j + 1] : 0;
    for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) {
      const nx = (x + 0.5 - cx) / w;
      if (Math.abs(nx) > 1) continue;
      const borde = Math.abs(nx) * w > Math.min(wp, wn) - 0.9 && (Math.abs(nx) * w > wp - 1 || Math.abs(nx) * w > wn - 1) && (j === 0 || j === ws.length - 1 || Math.abs(nx) > 0.93);
      if (borde) { g.set(x, y, OUT); continue; }
      const z = Math.sqrt(Math.max(0, 1 - nx * nx));
      const l = cl(0.16 + 0.84 * Math.max(0, luz * nx + 0.75 * z) * 1.05);
      const v = l * (n - 1), i = Math.min(n - 2, Math.floor(v));
      g.set(x, y, v - i > bay(x, y) ? r[i + 1] : r[i]);
    }
    if (brillo && w > 5) { const bx = cx - w * 0.52; g.set(bx, y, [255, 255, 255], 0.55); }
  });
};
const poly = (g: G, pts: [number, number][], f: (x: number, y: number) => RGB, borde: RGB | null = OUT) => {
  const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
  const dentro = (x: number, y: number) => {
    let c = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
      const [xi, yi] = pts[i], [xj, yj] = pts[j];
      if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) c = !c;
    }
    return c;
  };
  const x0 = Math.floor(Math.min(...xs)), x1 = Math.ceil(Math.max(...xs)), y0 = Math.floor(Math.min(...ys)), y1 = Math.ceil(Math.max(...ys));
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (!dentro(x + 0.5, y + 0.5)) continue;
    const e = borde && (!dentro(x - 0.5, y + 0.5) || !dentro(x + 1.5, y + 0.5) || !dentro(x + 0.5, y - 0.5) || !dentro(x + 0.5, y + 1.5));
    g.set(x, y, e && borde ? borde : f(x, y));
  }
};
const tono = (r: RGB[], l: number, x: number, y: number): RGB => { const v = cl(l) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(v)); return v - i > bay(x, y) ? r[i + 1] : r[i]; };

/* ---------------- paletas ---------------- */
const ROJO = rampa('#4a0a12', '#8a1422', '#c8283a', '#f2606c', '#ffb0b6');
const VIDRIO_ROJO = rampa('#2a0408', '#6a0c18', '#b01a2c', '#e0485a', '#ff9aa4');
const BLANCO = rampa('#7e88a6', '#b4bed6', '#dfe6f4', '#ffffff');
const CREMA = rampa('#8a8070', '#c6bca6', '#ece3cc', '#fffaea');
const TEAL = rampa('#06303a', '#0c5a68', '#18889a', '#4cc4d0');
const ORO = rampa('#6a4306', '#b07a14', '#e8b03a', '#ffd870', '#fff4b8');
const MADERA = rampa('#1e1008', '#38200f', '#5a361a', '#7e5028', '#a06a38');
const ACERO = rampa('#1c1e28', '#3c4254', '#6a7288', '#a4adc2', '#e2e8f4');
const VERDE = rampa('#0c2c1c', '#1a5a34', '#2e8a4e', '#62c27c');
const HELADO = rampa('#9a8e7a', '#d8ccb4', '#f6edd8', '#ffffff');
const CHOCO = rampa('#1c0e06', '#3e2010', '#66381a', '#945a2c');

/* ---------------- sala y mesa ---------------- */
const sala = (g: G, t: number, k: number, horiz: boolean, fx: number, color: 'calido' | 'frio' | 'rojo' | 'verde' | 'azul' = 'calido', foco = 1) => {
  const W = g.w, H = g.h;
  const pal = {calido: ['#05070c', '#0a1c24', '#0e3038', '#144650'], frio: ['#04060e', '#081428', '#0e2448', '#16386a'], rojo: ['#0a0408', '#240810', '#44101c', '#681a2a'],
    verde: ['#040a08', '#08201a', '#0e3a2e', '#165a46'], azul: ['#040612', '#0a1238', '#142266', '#20388c']}[color];
  const hz = Math.floor(H * (horiz ? 0.66 : 0.66));
  g.grad(0, hz, rampa(...pal));
  // listones dorados de la pared
  const sep = Math.round(34 * k);
  for (let x = Math.floor(sep / 2); x < W; x += sep) for (let y = 0; y < hz; y++) { g.set(x, y, [150, 110, 40], 0.5); if (y % 3 === 0) g.set(x + 1, y, [60, 40, 14], 0.5); }
  // luces de fondo (bokeh)
  for (let i = 0; i < 26; i++) {
    const x = rnd(i, 1) * W, y = rnd(i, 2) * hz * 0.7, r = (2 + rnd(i, 3) * 4) * k * 0.6, b = 0.55 + 0.45 * Math.sin(t * 1.3 + i);
    g.ellA(x, y, r, r, i % 4 === 0 ? [90, 200, 220] : [255, 190, 90], 0.10 + 0.09 * b);
  }
  // mesa de madera
  g.grad(hz, H, rampa('#3a2210', '#5c3a1c', '#6e4624', '#4a2c14', '#24140a'));
  for (let y = hz; y < H; y++) {
    const p = (y - hz) / (H - hz);
    for (let x = 0; x < W; x++) {
      const veta = Math.sin(x * 0.045 + Math.sin(y * 0.3 + x * 0.01) * 2.2 + p * 5) * 0.5 + 0.5;
      if (veta > 0.78 && hs(x, y) > 0.3) g.set(x, y, [24, 12, 6], 0.30);
      else if (veta < 0.12 && hs(x, y, 2) > 0.5) g.set(x, y, [150, 100, 54], 0.20);
    }
  }
  g.rect(0, hz - 1, W, 2, [166, 112, 56]);
  g.rect(0, hz + 1, W, 1, [26, 14, 6], 0.6);
  // foco de luz cenital sobre la zona de interés (cono con tramado)
  const top = -4, ancho0 = 8 * k, ancho1 = 120 * k * (horiz ? 1.2 : 1);
  for (let y = 0; y < hz + (H - hz) * 0.5; y++) {
    const p = y / (hz + (H - hz) * 0.5);
    const w = ancho0 + (ancho1 - ancho0) * p;
    for (let x = Math.floor(fx - w); x <= Math.ceil(fx + w); x++) {
      const d = Math.abs(x - fx) / w;
      const a = (1 - d) * (1 - p * 0.55) * 0.20 * foco;
      if (a > 0 && a * 5 > bay(x, y) * 1.0) g.set(x, y, [255, 226, 160], 0.20);
    }
  }
  // pozo de luz en la mesa
  g.ellA(fx, hz + (H - hz) * 0.32, 130 * k, 26 * k, [255, 214, 140], 0.13 * foco);
  g.ellA(fx, hz + (H - hz) * 0.32, 84 * k, 15 * k, [255, 226, 170], 0.13 * foco);
  return hz;
};
const polvo = (g: G, t: number, k: number, x0: number, x1: number, y0: number, y1: number) => {
  for (let i = 0; i < 46; i++) {
    const x = x0 + ((rnd(i, 1) * (x1 - x0) + Math.sin(t * 0.7 + i) * 6 * k) % (x1 - x0));
    const y = y1 - ((rnd(i, 2) * (y1 - y0) + t * (4 + rnd(i, 3) * 8) * k) % (y1 - y0));
    g.set(x, y, [255, 230, 170], 0.55 + 0.4 * Math.sin(t * 2 + i));
  }
};
const sombra = (g: G, x: number, yb: number, rx: number) => { g.ellA(x, yb + 1, rx * 1.15, rx * 0.22, [8, 4, 2], 0.5); g.ellA(x, yb + 1, rx * 0.8, rx * 0.15, [4, 2, 1], 0.5); };

/* ---------------- objetos ---------------- */
export const botella = (g: G, x: number, yb: number, h: number, mostrar57 = true) => {
  sombra(g, x, yb, h * 0.2);
  const y0 = yb - h;
  const hw = (u: number) => {
    const y = 1 - u; // 0 abajo, 1 arriba
    if (y < 0.02) return h * 0.12;
    if (y < 0.50) return h * 0.2;
    if (y < 0.72) { const p = (y - 0.50) / 0.22; return h * (0.2 - 0.14 * ease(p)); }
    if (y < 0.86) return h * 0.06;
    if (y < 0.875) return h * 0.07;
    if (y < 0.995) return h * 0.075;
    return h * 0.05;
  };
  revol(g, x, y0, yb, hw, VIDRIO_ROJO);
  // tapa blanca
  revol(g, x, y0, y0 + h * 0.125, (u) => (u < 0.1 || u > 0.95 ? h * 0.056 : h * 0.077), BLANCO);
  // etiqueta crema
  const ey0 = yb - h * 0.46, ey1 = yb - h * 0.2;
  revol(g, x, ey0, ey1, (u) => (u < 0.03 || u > 0.97 ? 0 : h * 0.198), CREMA, -0.5, false);
  g.rect(x - h * 0.19, ey0 + 1, h * 0.38, 1, [200, 150, 50]);
  g.rect(x - h * 0.19, ey1 - 2, h * 0.38, 1, [200, 150, 50]);
  if (mostrar57) g.txt('57', x, (ey0 + ey1) / 2 + 1, Math.round(h * 0.105), '#b01a2c', '#ffffff');
  g.rect(x - h * 0.09, ey1 - h * 0.05, h * 0.18, 1, [180, 60, 60]);
};
export const vaso = (g: G, x: number, yb: number, h: number, t = 0) => {
  sombra(g, x, yb, h * 0.2);
  const y0 = yb - h * 0.52;
  revol(g, x, y0, yb, (u) => h * (0.215 - 0.075 * u), BLANCO);
  // franja turquesa con puntos
  const f0 = y0 + (yb - y0) * 0.3, f1 = y0 + (yb - y0) * 0.72;
  revol(g, x, f0, f1, (u) => h * (0.2 - 0.075 * (0.3 + 0.42 * u)) , TEAL, -0.5, false);
  for (let i = -2; i <= 2; i++) g.ellA(x + i * h * 0.075, (f0 + f1) / 2, h * 0.018, h * 0.018, [220, 250, 255], 1);
  // helado
  const hy = y0;
  const lobulos = [[0.215, 0.0, 0.10], [0.19, 0.12, 0.10], [0.15, 0.24, 0.10], [0.11, 0.35, 0.09], [0.07, 0.45, 0.08], [0.035, 0.54, 0.06]];
  lobulos.forEach(([rw, up, rh]) => g.ell(x, hy - up * h + 2, rw * h, rh * h * 0.8, HELADO));
  // cuchara (con hueco cuadrado en la cabeza)
  cuchara(g, x + h * 0.13, hy - h * 0.34, h * 0.62, -0.28, 0, t);
};
/** cuchara de McFlurry: mango delgado y cabeza con hueco cuadrado. ang en radianes (0 = vertical). */
export const cuchara = (g: G, x: number, y: number, largo: number, ang: number, brilloHueco = 0, t = 0) => {
  const dx = Math.sin(ang), dy = -Math.cos(ang);
  const nx = -dy, ny = dx; // perpendicular
  const ancho = Math.max(2, largo * 0.045);
  const cabeza = largo * 0.2;
  const P = (a: number, b: number): [number, number] => [x + dx * a + nx * b, y + dy * a + ny * b];
  const mango = [P(0, -ancho * 0.5), P(0, ancho * 0.5), P(largo - cabeza, ancho * 0.5), P(largo - cabeza, -ancho * 0.5)];
  poly(g, mango, (px, py) => tono(BLANCO, 0.55 + 0.35 * ((px - x) * nx + (py - y) * ny < 0 ? 1 : 0.2), px, py));
  const c = [P(largo - cabeza, -ancho * 1.6), P(largo - cabeza, ancho * 1.6), P(largo, ancho * 1.6), P(largo, -ancho * 1.6)];
  poly(g, c, (px, py) => tono(BLANCO, 0.75, px, py));
  // hueco cuadrado
  const h0 = P(largo - cabeza * 0.8, -ancho * 0.75), h1 = P(largo - cabeza * 0.8, ancho * 0.75), h2 = P(largo - cabeza * 0.25, ancho * 0.75), h3 = P(largo - cabeza * 0.25, -ancho * 0.75);
  poly(g, [h0, h1, h2, h3], () => (brilloHueco > 0 ? [255, 214, 90] : [20, 14, 26]), [30, 20, 10]);
};
export const tubo = (g: G, x: number, yb: number, h: number, abierto = 0, t = 0) => {
  sombra(g, x, yb, h * 0.17);
  const w = h * 0.155;
  const y0 = yb - h;
  revol(g, x, y0 + h * 0.07, yb, (u) => (u > 0.985 ? w * 0.95 : w), ROJO);
  // base metálica y aro
  revol(g, x, yb - h * 0.035, yb, () => w * 1.02, ACERO, -0.5, false);
  // etiqueta: óvalo amarillo con papas
  const ey = yb - h * 0.5;
  g.ell(x, ey, w * 0.82, h * 0.15, rampa('#8a5a0a', '#d9a02e', '#ffd05a', '#fff0a8'));
  g.txt('PAPAS', x, ey - h * 0.01, Math.round(h * 0.07), '#8a1422', '#fff4c0');
  g.rect(x - w * 0.78, ey + h * 0.1, w * 1.56, 1, [255, 224, 150], 0.7);
  g.txt('ORIGINAL', x, yb - h * 0.25, Math.round(h * 0.035), '#fff4d8', '#5a0a12');
  // tapa
  const ly = y0 - abierto * h * 0.12;
  revol(g, x, ly, ly + h * 0.085, (u) => (u < 0.12 ? w * 0.9 : w * 1.06), BLANCO);
  if (abierto > 0) {
    const a = abierto * (0.55 + 0.1 * Math.sin(t * 5));
    for (let i = 0; i < 40; i++) {
      const yy = y0 + 2 - rnd(i, 3) * h * 0.55 * abierto; const xx = x + (rnd(i, 4) - 0.5) * w * (0.6 + (y0 - yy) * 0.02);
      g.set(xx, yy, [255, 214, 120], a);
    }
    g.ellA(x, y0, w * 1.1, h * 0.04, [255, 200, 80], 0.5 * abierto);
  }
};
export const caja = (g: G, x: number, yb: number, h: number) => {
  sombra(g, x, yb, h * 0.32);
  const w = h * 0.46, y0 = yb - h * 0.72;
  poly(g, [[x - w / 2, y0], [x + w / 2, y0], [x + w / 2, yb], [x - w / 2, yb]], (px, py) => tono(rampa('#8fa8b8', '#c4d6e2', '#e6f0f8', '#ffffff'), 0.4 + 0.5 * (1 - (px - (x - w / 2)) / w) * 0.8, px, py));
  // tapa
  poly(g, [[x - w / 2 - 1, y0 - h * 0.1], [x + w / 2 + 1, y0 - h * 0.1], [x + w / 2 + 1, y0 + 1], [x - w / 2 - 1, y0 + 1]], (px, py) => tono(rampa('#a8b2c0', '#d4dce8', '#f4f8fc', '#ffffff'), 0.7 - 0.3 * (px - x) / w, px, py));
  // mentas
  for (let i = 0; i < 26; i++) {
    const mx = x - w / 2 + 3 + hs(i, 1) * (w - 6), my = y0 + 4 + hs(i, 2) * (yb - y0 - 8);
    g.ellA(mx, my, 2.4, 1.6, i % 5 === 0 ? [214, 238, 236] : [250, 252, 250], 1);
    g.set(mx - 1, my - 1, [255, 255, 255]);
  }
  // etiqueta
  g.rect(x - w * 0.42, y0 + (yb - y0) * 0.30, w * 0.84, (yb - y0) * 0.40, [24, 120, 150]);
  g.rect(x - w * 0.42, y0 + (yb - y0) * 0.30, w * 0.84, 1, [120, 220, 240]);
  g.txt('MENTAS', x, y0 + (yb - y0) * 0.5, Math.round(h * 0.06), '#ffffff', '#0a3a4a');
};
export const barra = (g: G, x: number, yb: number, h: number) => {
  // prisma triangular dorado, vista 3/4 (cara frontal + cara superior inclinada)
  sombra(g, x, yb, h * 0.7);
  const L = h * 1.35, a = h * 0.42, hh = h * 0.42;
  const x0 = x - L / 2, x1 = x + L / 2;
  // cara frontal (rectángulo inclinado hacia abajo-derecha) y cara superior (clara)
  poly(g, [[x0, yb], [x1, yb], [x1 - a * 0.25, yb - hh * 0.62], [x0 + a * 0.25, yb - hh * 0.62]], (px, py) => tono(ORO, 0.55 + 0.1 * Math.sin(px * 0.5) - 0.0, px, py));
  poly(g, [[x0 + a * 0.25, yb - hh * 0.62], [x1 - a * 0.25, yb - hh * 0.62], [x1 - a * 0.5, yb - hh], [x0 + a * 0.5, yb - hh]], (px, py) => tono(ORO, 0.9 - 0.2 * ((px - x0) / L), px, py));
  // puntas de la barra (zigzag dorado de los segmentos)
  const n = 9;
  for (let i = 1; i < n; i++) { const px = x0 + (L * i) / n; g.line(px, yb, px + a * 0.0, yb - hh * 0.62, ORO[1], 1); g.line(px + a * 0.25 * (1 - 0), yb - hh * 0.62, px + a * 0.5 * 0.5, yb - hh, ORO[1], 1); }
  g.rect(x0 + 2, yb - 3, L - 4, 1, ORO[4], 0.8);
  g.txt('CHOCOLATE', x, yb - hh * 0.3, Math.round(h * 0.075), '#4a2a08', '#ffe6a0');
};

/* ---------------- escenas ---------------- */
const ESC = (horiz: boolean) => (horiz ? 0.34 : 0.22); // altura de objeto respecto del alto
export const mesa: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const sel = Number(param || 0);
  const hz = sala(g, t, k, horiz, W * 0.5, 'calido', 1);
  const dim = (i: number) => (sel && sel !== i + 1);
  const bob = (i: number) => (sel === i + 1 ? Math.sin(t * 3) * 1.2 * k : 0);
  let pos: [number, number, number][]; // x, yb, alto
  if (horiz) {
    const yb = hz + (H - hz) * 0.55, hh = H * 0.40;
    pos = [[0.12, yb, hh * 0.92], [0.31, yb, hh * 0.92], [0.5, yb, hh], [0.69, yb, hh * 0.58], [0.88, yb, hh * 0.34]].map((p) => [W * p[0], p[1], p[2]] as [number, number, number]);
  } else {
    const yb1 = hz + (H - hz) * 0.26, yb2 = hz + (H - hz) * 0.78, hh = H * 0.26;
    pos = [[0.2, yb1, hh * 0.95], [0.5, yb1, hh * 0.95], [0.8, yb1, hh * 1.05], [0.3, yb2, hh * 0.9], [0.72, yb2, hh * 0.4]].map((p) => [W * p[0], p[1], p[2]] as [number, number, number]);
  }
  botella(g, pos[0][0], pos[0][1] + bob(0), pos[0][2]);
  vaso(g, pos[1][0], pos[1][1] + bob(1), pos[1][2], t);
  tubo(g, pos[2][0], pos[2][1] + bob(2), pos[2][2], 0, t);
  caja(g, pos[3][0], pos[3][1] + bob(3), pos[3][2] * (horiz ? 1 : 0.75));
  barra(g, pos[4][0], pos[4][1] + bob(4), pos[4][2]);
  if (sel) pos.forEach((p, i) => { if (dim(i)) g.rect(p[0] - W * 0.14, p[1] - p[2] * 1.15, W * 0.28, p[2] * 1.3, [0, 0, 8], 0.55); });
  polvo(g, t, k, 0, W, hz * 0.2, hz);
};
const cartel = (g: G, k: number, txt: string, y: number, color = '#ffd870') => g.txt(txt, g.w / 2, y, Math.round(14 * k), color, '#000');

export const ketchup: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const hz = sala(g, t, k, horiz, W * 0.5, 'rojo');
  const yb = hz + (H - hz) * 0.66, hh = H * (horiz ? 0.62 : 0.4);
  botella(g, W * 0.5, yb, hh, true);
  if (param === 'conteo') { // cuenta de productos que sube de 57 a más de 60
    const v = Math.round(57 + 4 * ease((t - 0.4) / 3));
    g.rect(W * 0.5 - 70 * k, H * 0.1, 140 * k, 52 * k, [8, 6, 14], 0.82);
    g.rect(W * 0.5 - 70 * k, H * 0.1, 140 * k, 2, [255, 214, 90]);
    g.txt(v > 60 ? '60+' : String(v), W * 0.5, H * 0.1 + 26 * k, Math.round(28 * k), '#ffd870', '#000');
    g.txt('PRODUCTOS', W * 0.5, H * 0.1 + 46 * k, Math.round(7 * k), '#ffffff', '#000');
  }
  polvo(g, t, k, 0, W, 0, hz);
};
export const mcflurry: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const hz = sala(g, t, k, horiz, W * 0.5, 'azul');
  const yb = hz + (H - hz) * 0.66, hh = H * (horiz ? 0.62 : 0.4);
  if (param === 'eje') {
    // cuchara horizontal grande con hueco cuadrado y eje de acero que entra y gira
    const cx = W * 0.42, cy = hz * 0.62;
    cuchara(g, cx - 70 * k, cy + 6 * k, 140 * k, Math.PI / 2, 1, t);
    const p = ease(Math.sin(t * 1.4) * 0.5 + 0.5);
    const ex = W * 0.9 - 80 * k * p;
    poly(g, [[ex, cy - 7 * k], [W, cy - 7 * k], [W, cy + 7 * k], [ex, cy + 7 * k]], (px, py) => tono(ACERO, 0.9 - Math.abs(py - cy) / (9 * k), px, py));
    g.rect(ex - 12 * k, cy - 4 * k, 12 * k, 8 * k, [220, 226, 240]);
    g.ellA(cx + 70 * k, cy, 12 * k, 12 * k, [255, 214, 90], 0.25 + 0.2 * Math.sin(t * 4));
    cartel(g, k, 'EJE DE LA MÁQUINA', cy + 38 * k, '#c8d8f0');
    vaso(g, W * 0.5, yb, hh * 0.8, t);
  } else {
    vaso(g, W * 0.5, yb, hh, t);
  }
  polvo(g, t, k, 0, W, 0, hz);
};
export const pringles: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  if (param === 'jardin') {
    g.grad(0, H * 0.7, rampa('#02030c', '#060a24', '#0c1440', '#16245c'));
    for (let i = 0; i < 60; i++) { const b = Math.sin(t * 1.8 + i * 2.1); g.set(rnd(i, 1) * W, rnd(i, 2) * H * 0.5, [255, 255, 255], b > 0 ? 0.9 : 0.4); }
    g.ellA(W * 0.82, H * 0.14, 16 * k, 16 * k, [250, 244, 214], 1); g.ellA(W * 0.82 - 4, H * 0.14 - 3, 14 * k, 14 * k, [210, 214, 220], 0.35);
    g.grad(H * 0.62, H, rampa('#0a2a18', '#10401f', '#1a5a2c', '#0e3a1c'));
    for (let x = 0; x < W; x++) { const h0 = 3 + hs(x, 0) * 5; for (let y = 0; y < h0; y++) g.set(x, H * 0.62 + y - 4, hs(x, y) > 0.5 ? [26, 90, 44] : [14, 56, 28]); }
    // lápida sin nombre
    const lx = W * 0.5, ly = H * 0.62, lw = 70 * k, lh = 100 * k;
    poly(g, [[lx - lw / 2, ly], [lx - lw / 2, ly - lh + lw / 2], [lx - lw * 0.3, ly - lh + lw * 0.1], [lx, ly - lh], [lx + lw * 0.3, ly - lh + lw * 0.1], [lx + lw / 2, ly - lh + lw / 2], [lx + lw / 2, ly]],
      (px, py) => tono(rampa('#2a2e3c', '#4a5066', '#767e98', '#a0a8c0'), 0.5 + 0.4 * (1 - (px - (lx - lw / 2)) / lw) - 0.1, px, py));
    // tubo pequeño al pie con brillo dorado
    const tx = lx + lw * 0.95, tb = ly + 30 * k;
    g.ellA(tx, tb - 20 * k, 40 * k, 28 * k, [255, 200, 90], 0.10 + 0.05 * Math.sin(t * 3));
    tubo(g, tx, tb + 10 * k, 74 * k, 0, t);
    for (let i = 0; i < 24; i++) { const y = tb - 10 * k - ((rnd(i, 1) * 60 * k + t * 12 * k) % (70 * k)); g.set(tx + (rnd(i, 2) - 0.5) * 30 * k, y, [255, 214, 120], 0.8); }
    if (t < 5) {
      const a = Math.min(1, t / 0.25) * (t > 4.4 ? Math.max(0, (5 - t) / 0.6) : 1);
      const sz = Math.round(Math.min(26 * k, ((horiz ? 0.62 : 0.8) * W) / 14));
      if (a > 0.05) { const by = H * (horiz ? 0.10 : 0.30); const bx = horiz ? W * 0.38 : W / 2; g.rect(horiz ? W * 0.03 : W * 0.04, by, horiz ? W * 0.70 : W * 0.92, sz * 3.6, [4, 4, 12], 0.6 * a); g.txt('ENTERRADO EN UN', bx, by + sz * 1.1, sz, '#ffffff', '#000'); g.txt('TUBO DE PAPAS', bx, by + sz * 2.5, Math.round(sz * 1.15), '#ffd870', '#000'); }
    }
    return;
  }
  if (param === 'patente') {
    g.rect(0, 0, W, H, [232, 222, 194]);
    for (let x = 0; x < W; x += 12) g.rect(x, 0, 1, H, [196, 208, 224], 0.7);
    for (let y = 0; y < H; y += 12) g.rect(0, y, W, 1, [196, 208, 224], 0.7);
    const cx = W * 0.5, base = H * 0.64, h = H * (horiz ? 0.5 : 0.34);
    const prog = ease(t / 1.4);
    const top = base - h * prog;
    for (let y = top; y < base; y++) { g.set(cx - h * 0.17, y, [70, 48, 26]); g.set(cx + h * 0.17, y, [70, 48, 26]); }
    g.rect(cx - h * 0.17, base, h * 0.34 + 1, 1, [70, 48, 26]); g.ellA(cx, top, h * 0.17, h * 0.04, [232, 222, 194], 1); g.ring(cx, top, h * 0.17, 1, [70, 48, 26]);
    for (let i = 0; i < 7; i++) { const yy = top + h * 0.07 + i * h * 0.12; if (yy < base) g.line(cx - h * 0.17, yy, cx + h * 0.17, yy + h * 0.02, [150, 120, 80], 1); }
    g.txt('FIG. 1', cx + h * 0.4, top + 10, Math.round(9 * k), '#46301a', '#e8dec0');
    g.txt('1966', cx, H * 0.2, Math.round(30 * k), '#8a1422', '#e8dec0');
    return;
  }
  const hz = sala(g, t, k, horiz, W * 0.5, 'rojo');
  const yb = hz + (H - hz) * 0.66, hh = H * (horiz ? 0.66 : 0.42);
  const ab = param === 'abre' ? ease((t - 0.3) / 1.3) : 0;
  tubo(g, W * 0.5, yb, hh, ab, t);
  polvo(g, t, k, 0, W, 0, hz);
};
export const tictac: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  if (param === 'etiqueta' || param === 'cuenta') {
    g.grad(0, H, rampa('#06242a', '#0a3c44', '#0e545e'));
    const pw = W * (horiz ? 0.34 : 0.8), ph = H * (horiz ? 0.70 : 0.52), px = W / 2 - pw / 2, py = H * (horiz ? 0.06 : 0.12);
    g.rect(px - 3, py - 3, pw + 6, ph + 6, [8, 14, 20]);
    g.rect(px, py, pw, ph, [250, 250, 246]);
    g.rect(px + 3, py + 3, pw - 6, 3, [10, 10, 10]);
    g.txt('INFORMACIÓN NUTRICIONAL', W / 2, py + 14 * k, Math.round(5.4 * k), '#101010', '#fafafa');
    g.rect(px + 4, py + 24 * k, pw - 8, 1, [10, 10, 10]);
    g.txt('PORCIÓN: 1 CARAMELO', W / 2, py + 33 * k, Math.round(5 * k), '#101010', '#fafafa');
    g.rect(px + 4, py + 41 * k, pw - 8, 5, [10, 10, 10]);
    const pulso = 0.6 + 0.4 * Math.sin(t * 5);
    g.rect(px + 4, py + 60 * k, pw - 8, 36 * k, [255, 238, 150], param === 'etiqueta' ? 0.55 * pulso : 0.0);
    g.txt('AZÚCAR 0 g', W / 2, py + 78 * k, Math.round(9.5 * k), '#b01a2c', '#fafafa');
    g.rect(px + 4, py + 100 * k, pw - 8, 1, [10, 10, 10]);
    if (param === 'cuenta') {
      const a = ease((t - 0.2) / 0.8);
      g.rect(px, py + 104 * k, pw, ph - 104 * k, [14, 20, 30], 0.92 * a);
      const l = ease((t - 0.8) / 0.6);
      g.txt('0,49 g', W / 2, py + 120 * k, Math.round(13 * k), '#ffd870', '#000');
      if (l > 0.1) g.txt('AZÚCAR ≈ 0,44 g', W / 2, py + 142 * k, Math.round(6.5 * k), '#ffffff', '#000');
      if (t > 1.6) g.txt('MENOS DE 0,5 g', W / 2, py + 160 * k, Math.round(6.5 * k), '#7bf0a4', '#000');
    }
    return;
  }
  const hz = sala(g, t, k, horiz, W * 0.5, 'verde');
  const yb = hz + (H - hz) * 0.66, hh = H * (horiz ? 0.66 : 0.4);
  caja(g, W * 0.5, yb, hh);
  polvo(g, t, k, 0, W, 0, hz);
};
export const toblerone: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  if (param === 'oso') {
    g.grad(0, H, rampa('#06102a', '#0c2050', '#16407e', '#3a72b0', '#9cc6e4'));
    const cx = W * 0.5, base = H * 0.78, ph = H * (horiz ? 0.66 : 0.46), pw = ph * 0.95;
    poly(g, [[cx - pw, base], [cx - pw * 0.05, base - ph], [cx + pw * 0.08, base - ph * 0.98], [cx + pw, base]], (px, py) => tono(rampa('#1a2438', '#34425e', '#5a6c8c', '#92a4c0'), 0.3 + 0.6 * ((cx - px) / (pw * 2) + 0.5) - 0.25 * (py < base - ph * 0.8 ? -1 : 0), px, py));
    poly(g, [[cx - pw * 0.28, base - ph * 0.74], [cx - pw * 0.05, base - ph], [cx + pw * 0.08, base - ph * 0.98], [cx + pw * 0.3, base - ph * 0.7], [cx + pw * 0.14, base - ph * 0.76], [cx - pw * 0.02, base - ph * 0.68], [cx - pw * 0.15, base - ph * 0.76]], (px, py) => tono(rampa('#a8b8d4', '#d8e4f4', '#ffffff'), 0.7 + 0.2 * hs(px, py), px, py), null);
    // oso (silueta oculta en el hueco del monte)
    const bx = cx, by = base - ph * 0.28, s = ph * 0.2;
    const a = 0.35 + 0.65 * ease((Math.sin(t * 1.6) + 1) / 2);
    const BR: RGB = [255, 214, 90];
    g.ellA(bx, by, s * 1.0, s * 0.62, [24, 14, 8], 0.9);
    g.ellA(bx + s * 0.8, by - s * 0.32, s * 0.4, s * 0.36, [24, 14, 8], 0.9);
    g.ellA(bx + s * 0.62, by - s * 0.66, s * 0.12, s * 0.12, [24, 14, 8], 0.9); g.ellA(bx + s * 1.0, by - s * 0.62, s * 0.12, s * 0.12, [24, 14, 8], 0.9);
    [-0.55, -0.15, 0.4, 0.75].forEach((o) => g.rect(bx + o * s * 0.9 - 1, by + s * 0.45, s * 0.22, s * 0.38, [24, 14, 8], 0.9));
    g.ring(bx + s * 0.1, by - s * 0.05, s * 1.35, 1, BR); g.ellA(bx + s * 0.1, by - s * 0.05, s * 1.35, s * 1.1, BR, 0.1 * a);
    g.rect(0, base, W, H - base, [16, 22, 40]);
    g.txt('MATTERHORN', cx, base + 18 * k, Math.round(7.5 * k), '#ffffff', '#000');
    return;
  }
  const hz = sala(g, t, k, horiz, W * 0.5, 'frio');
  const yb = hz + (H - hz) * 0.62, hh = H * (horiz ? 0.38 : 0.2);
  barra(g, W * 0.5, yb, hh);
  polvo(g, t, k, 0, W, 0, hz);
};
/** tarjeta de cifra: param "TEXTO GRANDE|texto pequeño|tono" */
export const cifra: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const [big = '', sub = '', tono_ = 'rojo'] = param.split('|');
  const pal: Record<string, string[]> = {rojo: ['#2a060c', '#5a0e1a', '#2a060c'], teal: ['#04202a', '#0a4a5a', '#04202a'], mint: ['#04281e', '#0c5a44', '#04281e'], azul: ['#060a2a', '#12246a', '#060a2a'], oro: ['#1c1204', '#4a3208', '#1c1204']};
  g.grad(0, H, rampa(...(pal[tono_] ?? pal.rojo)));
  for (let i = 0; i < 40; i++) { const x = (rnd(i, 1) * W + t * (6 + 10 * rnd(i, 2)) * k) % W, y = (rnd(i, 3) * H - t * (8 + rnd(i, 4) * 12) * k + H * 3) % H; g.set(x, y, [255, 220, 140], 0.5); }
  const pop = 1 + 0.18 * (1 - ease(t / 0.35));
  const cy = H * (horiz ? 0.36 : 0.40);
  const size = Math.round(Math.min(46 * k, (0.84 * W) / Math.max(1, big.length)) * pop);
  g.rect(W * 0.08, cy - size * 0.9, W * 0.84, 2, [255, 214, 90], 0.8);
  g.txt(big, W / 2, cy, size, '#ffd870', '#000');
  g.rect(W * 0.08, cy + size * 0.9, W * 0.84, 2, [255, 214, 90], 0.8);
  if (sub) {
    const ss = Math.round(Math.min(11 * k, 17));
    const max = Math.max(10, Math.floor((0.86 * W) / ss));
    const palabras = sub.split(' '); const lineas: string[] = []; let cur = '';
    palabras.forEach((p) => { if ((cur + ' ' + p).trim().length > max) { lineas.push(cur); cur = p; } else cur = (cur + ' ' + p).trim(); });
    lineas.push(cur);
    const a = Math.min(1, Math.max(0, (t - 0.3) / 0.4));
    if (a > 0) lineas.forEach((l, i) => g.txt(l, W / 2, cy + size * 1.5 + i * ss * 1.6, ss, '#ffffff', '#000'));
  }
};
export const veredicto: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const hz = sala(g, t, k, horiz, W * 0.5, 'calido');
  const [txt = 'GENIO', ob = 'botella'] = param.split('|');
  const yb = hz + (H - hz) * 0.66, hh = H * (horiz ? 0.55 : 0.34);
  const o: Record<string, () => void> = {botella: () => botella(g, W * 0.5, yb, hh), vaso: () => vaso(g, W * 0.5, yb, hh, t), tubo: () => tubo(g, W * 0.5, yb, hh, 0, t), caja: () => caja(g, W * 0.5, yb, hh * 0.7), barra: () => barra(g, W * 0.5, yb, hh * 0.45)};
  (o[ob] ?? o.botella)();
  const a = ease((t - 0.3) / 0.25);
  const s = 1 + 0.4 * (1 - a);
  g.rect(W * 0.08, H * 0.12, W * 0.84, 30 * k * s, [10, 8, 16], 0.78 * a);
  g.rect(W * 0.08, H * 0.12, W * 0.84, 2, [255, 214, 90], a);
  g.txt(txt, W / 2, H * 0.12 + 15 * k * s, Math.round(14 * k * s), txt.includes('ENGA') || txt.includes('LEGAL') ? '#ffb347' : '#ffd870', '#000');
};
export const DIBUJOS: Record<string, Dib> = {pixelmesa: mesa, pixelketchup: ketchup, pixelmcflurry: mcflurry, pixelpringles: pringles, pixeltictac: tictac, pixeltoblerone: toblerone, pixelcifra: cifra, pixelsello: veredicto};
