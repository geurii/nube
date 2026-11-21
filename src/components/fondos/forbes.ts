// Escenas pixel "Jóvenes genios": rascacielos, escenario, banco, gráfica, juicio y veredicto.
// Diseño propio (sin marcas ni logos). Mismo método: lienzo pixel a pixel, 1 px = 2 px del video.
import {G, RGB, rampa, bay, hs} from './pixelG';
import {rnd} from '../../lib/util';

export type Dib = (g: G, t: number, k: number, horiz: boolean, param: string, dur: number) => void;
const cl = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));
const ease = (t: number) => { t = cl(t); return t * t * (3 - 2 * t); };
const OUT: RGB = [10, 8, 18];
const tono = (r: RGB[], l: number, x: number, y: number): RGB => { const v = cl(l) * (r.length - 1), i = Math.min(r.length - 2, Math.floor(v)); return v - i > bay(x, y) ? r[i + 1] : r[i]; };
const ORO = rampa('#6a4306', '#b07a14', '#e8b03a', '#ffd870', '#fff4b8');
const PIEDRA = rampa('#4a4660', '#7a7694', '#aaa6c0', '#d8d6e6', '#ffffff');
const MADERA = rampa('#1e1008', '#38200f', '#5a361a', '#7e5028', '#a06a38');
const ROJO = rampa('#3a0610', '#7a1020', '#c01c34', '#f05a6a', '#ffb0b8');
const VERDE = rampa('#06281a', '#0e5a34', '#1c9254', '#52d088', '#b4f2cc');

const texto = (g: G, t: number, k: number, W: number, y: number, s: string, color = '#ffd870', tam = 13) => {
  if (!s) return;
  const a = ease((t - 0.15) / 0.3);
  const size = Math.round(Math.min(tam * k, ((W > g.h ? 0.7 : 0.86) * W) / Math.max(1, s.length)) * (1 + 0.3 * (1 - a)));
  const x0 = W * (W > g.h ? 0.04 : 0.06), ww = W * (W > g.h ? 0.74 : 0.88);
  g.rect(x0, y - size * 0.95, ww, size * 1.9, [8, 6, 16], 0.72 * a);
  g.rect(x0, y - size * 0.95, ww, 2, [255, 214, 90], a);
  g.rect(x0, y + size * 0.95 - 2, ww, 2, [255, 214, 90], a);
  if (a > 0.05) g.txt(s, x0 + ww / 2, y, size, color, '#000');
};

const chispas = (g: G, t: number, k: number, W: number, H: number, n = 40, c: RGB = [255, 226, 140]) => {
  for (let i = 0; i < n; i++) {
    const x = (rnd(i, 1) * W + Math.sin(t * 0.8 + i) * 6 * k + W) % W;
    const y = (rnd(i, 3) * H - t * (10 + rnd(i, 4) * 24) * k + H * 8) % H;
    const b = 0.5 + 0.5 * Math.sin(t * 4 + i * 2);
    g.set(x, y, c, 0.35 + 0.6 * b);
    if (b > 0.85) { g.set(x + 1, y, c, 0.5); g.set(x - 1, y, c, 0.5); g.set(x, y + 1, c, 0.5); g.set(x, y - 1, c, 0.5); }
  }
};

/* ---------- edificio con ventanas, luz lateral y antena ---------- */
const edificio = (g: G, x: number, ybase: number, w: number, h: number, pal: RGB[], seed: number, t: number, ventanas: boolean, antena: boolean) => {
  const top = ybase - h;
  for (let yy = Math.floor(top); yy < ybase; yy++)
    for (let xx = Math.floor(x); xx < Math.ceil(x + w); xx++) {
      const u = (xx - x) / w;
      g.set(xx, yy, tono(pal, 0.9 - u * 0.75 + (yy - top) / h * 0.12 - 0.1, xx, yy));
    }
  g.rect(x, top, w, 1, OUT);
  g.rect(x, top, 1, h, OUT);
  g.rect(x + w - 1, top, 1, h, OUT);
  if (ventanas) {
    const sx = 5, sy = 6;
    for (let wy = top + 6, fila = 0; wy < ybase - 5; wy += sy, fila++)
      for (let wx = x + 4, col = 0; wx < x + w - 5; wx += sx, col++) {
        const id = seed * 131 + fila * 17 + col;
        const enc = hs(id, 7) > 0.38;
        const parp = hs(id, 9) > 0.93 && Math.sin(t * 3 + id) > 0.6;
        if (enc && !parp) { g.rect(wx, wy, 3, 4, [255, 214, 120]); g.rect(wx, wy, 3, 1, [255, 244, 190]); }
        else g.rect(wx, wy, 3, 4, [24, 22, 48]);
      }
  }
  if (antena) { g.rect(x + w / 2, top - 12, 1, 12, OUT); g.set(x + w / 2, top - 12, Math.sin(t * 4 + seed) > 0 ? [255, 70, 70] : [120, 20, 20]); }
};

/* ---------------- 1. RASCACIELOS (ascenso) ---------------- */
export const rascacielos: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const hz = Math.floor(H * 0.8);
  g.grad(0, hz, rampa('#070b26', '#161a52', '#4a2a78', '#c2507c', '#ffa468', '#ffd29a'));
  for (let i = 0; i < 90; i++) { const x = rnd(i, 1) * W, y = rnd(i, 2) * hz * 0.5, b = 0.5 + 0.5 * Math.sin(t * 2 + i); g.set(x, y, [255, 240, 220], 0.2 + 0.7 * b * (1 - y / (hz * 0.5))); }
  // sol bajo con halo
  const sx = W * 0.72, sy = hz - 12 * k;
  for (let r = 7; r >= 1; r--) g.ellA(sx, sy, 16 * k * r * 0.5, 16 * k * r * 0.5, [255, 190, 120], 0.05 * (8 - r));
  g.ell(sx, sy, 16 * k, 16 * k, rampa('#ff8a4a', '#ffb060', '#ffd890', '#fff4c8'));
  // capas de edificios con paralaje (cada capa se desplaza a su ritmo)
  const capas = [
    {pal: rampa('#241e4a', '#322a62', '#463a7a'), vel: 3, ht: 0.34, ww: 26, v: false, s: 1},
    {pal: rampa('#160f34', '#26204e', '#3a3068', '#5a4a88'), vel: 7, ht: 0.46, ww: 34, v: true, s: 2},
    {pal: rampa('#0c0820', '#1a1438', '#2a2250', '#46386a'), vel: 14, ht: 0.58, ww: 44, v: true, s: 3},
  ];
  for (const c of capas) {
    const cw = c.ww * k;
    const off = (t * c.vel * k) % cw;
    const ini = Math.floor((off) / cw);
    for (let i = -1; i <= Math.ceil(W / cw) + 1; i++) {
      const idx = i + Math.floor((t * c.vel * k) / cw) + 1000 * c.s;
      const alto = H * (c.ht * 0.55 + c.ht * 0.55 * hs(idx, c.s));
      const x = i * cw - off + (hs(idx, 5) - 0.5) * cw * 0.1;
      edificio(g, x, hz + 2, cw * (0.9 + 0.1 * hs(idx, 3)), alto, c.pal, idx, t, c.v, hs(idx, 8) > 0.7);
    }
    void ini;
  }
  // suelo / avenida con luces
  g.grad(hz, H, rampa('#0c0820', '#14102e', '#1e1840'));
  for (let i = 0; i < 40; i++) { const x = (rnd(i, 1) * W * 2 + t * 40 * k * (1 + rnd(i, 2)) * (i % 2 ? 1 : -1)) % W, y = hz + 6 + rnd(i, 3) * (H - hz - 8); g.rect((x + W) % W, y, 6 * k, 1, i % 2 ? [255, 230, 150] : [255, 90, 90], 0.8); }
  chispas(g, t, k, W, H, 50);
  // flecha dorada ascendente
  const prog = ease(t / 1.6);
  const bx = W * 0.14, by = H * 0.52 - prog * H * 0.16;
  g.line(bx, H * 0.6, bx + W * 0.3 * prog, by, ORO[3], 3);
  if (prog > 0.9) { g.ell(bx + W * 0.3 * prog, by, 6 * k, 6 * k, ORO); }
  texto(g, t, k, W, H * (horiz ? 0.12 : 0.88), param, '#ffd870');
};

/* ---------------- 2. ESCENARIO (premio / aplausos) ---------------- */
export const escenario: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  g.grad(0, H, rampa('#07040c', '#1a0a24', '#2c1038', '#10061a'));
  // cortinas laterales rojas con pliegues
  for (const lado of [0, 1]) {
    const cw = W * 0.2;
    for (let y = 0; y < H * 0.8; y++) for (let x = 0; x < cw; x++) {
      const px = lado ? W - 1 - x : x;
      const pl = 0.5 + 0.5 * Math.sin(x * 0.55 + Math.sin(y * 0.03 + t * 0.6) * 1.2);
      g.set(px, y, tono(ROJO, 0.18 + pl * 0.5 - (x / cw) * 0.25, px, y));
    }
  }
  // focos que barren
  for (let i = 0; i < 3; i++) {
    const ox = W * (0.25 + 0.25 * i), ang = Math.sin(t * 0.9 + i * 2) * 0.35;
    for (let y = 0; y < H * 0.82; y++) {
      const p = y / (H * 0.82), cx = ox + Math.tan(ang) * y, w = 4 * k + 60 * k * p;
      for (let x = Math.floor(cx - w); x <= Math.ceil(cx + w); x++) { const d = Math.abs(x - cx) / w; const a = (1 - d) * (1 - p * 0.5) * 0.3; if (a * 5 > bay(x, y)) g.set(x, y, [255, 236, 190], 0.18); }
    }
    g.ell(ox, 4, 5 * k, 3 * k, ORO);
  }
  // escenario
  const sy = Math.floor(H * 0.74);
  g.grad(sy, H * 0.86, rampa('#6e4624', '#8a5a2c', '#4a2c14'));
  g.rect(0, sy, W, 2, [200, 150, 80]);
  g.ellA(W / 2, sy + 8, 120 * k, 14 * k, [255, 226, 160], 0.25);
  // atril + trofeo
  const px = W / 2, pw = 34 * k;
  for (let y = sy - 40 * k; y < sy; y++) for (let x = px - pw / 2; x < px + pw / 2; x++) g.set(x, y, tono(MADERA, 0.8 - ((x - (px - pw / 2)) / pw) * 0.6, x, y));
  g.rect(px - pw / 2, sy - 40 * k, pw, 2, ORO[3]);
  const by = sy - 40 * k;
  const brillo = 0.5 + 0.5 * Math.sin(t * 3);
  g.ellA(px, by - 22 * k, 36 * k, 36 * k, [255, 220, 120], 0.12 + 0.1 * brillo);
  g.ell(px, by - 14 * k, 9 * k, 11 * k, ORO);
  g.rect(px - 2, by - 6 * k, 4, 6 * k, ORO[2]);
  g.rect(px - 7 * k, by - 2, 14 * k, 3, ORO[1]);
  // estrella
  const ex = px, ey = by - 36 * k;
  for (let i = 0; i < 5; i++) { const a = (i * 2 * Math.PI) / 5 - Math.PI / 2 + t * 0.8; const a2 = a + Math.PI / 5; g.line(ex, ey, ex + Math.cos(a) * 11 * k, ey + Math.sin(a) * 11 * k, ORO[4], 2); g.line(ex, ey, ex + Math.cos(a2) * 5 * k, ey + Math.sin(a2) * 5 * k, ORO[3], 2); }
  // público: siluetas que aplauden
  for (let i = 0; i < 18; i++) {
    const x = (i + 0.5) * (W / 18) + (rnd(i, 1) - 0.5) * 10, y = H * 0.9 + (rnd(i, 2) - 0.5) * 20 * k;
    const s = (11 + rnd(i, 3) * 6) * k, b = Math.abs(Math.sin(t * 5 + i * 1.7)) * 3 * k;
    g.ell(x, y - s * 0.5 - b, s * 0.55, s * 0.62, rampa('#06040a', '#0e0816', '#1a1028'));
    g.ell(x, y - s * 1.25 - b, s * 0.34, s * 0.34, rampa('#06040a', '#0e0816', '#1a1028'));
    if (Math.sin(t * 5 + i * 1.7) > 0.6) { g.rect(x - s * 0.7, y - s * 1.6 - b, 2, s * 0.5, [14, 8, 22]); g.rect(x + s * 0.7, y - s * 1.6 - b, 2, s * 0.5, [14, 8, 22]); }
  }
  // confeti
  for (let i = 0; i < 70; i++) {
    const x = (rnd(i, 1) * W + Math.sin(t * 2 + i) * 8 * k + W) % W, y = (rnd(i, 2) * H + t * (30 + rnd(i, 3) * 40) * k) % H;
    g.rect(x, y, 2, 2, [[255, 214, 90], [255, 90, 120], [90, 200, 255], [255, 255, 255]][i % 4] as RGB);
  }
  texto(g, t, k, W, H * (horiz ? 0.12 : 0.88), param);
};

/* ---------------- 3. BANCO (fachada + bóveda) ---------------- */
export const banco: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const hz = Math.floor(H * 0.78);
  g.grad(0, hz, rampa('#0a1230', '#1c2a62', '#3a4a96', '#8a86b8', '#e8b098'));
  for (let i = 0; i < 40; i++) g.set(rnd(i, 1) * W, rnd(i, 2) * hz * 0.4, [255, 255, 240], 0.3 + 0.5 * Math.sin(t * 2 + i));
  // fachada
  const fx = W * 0.08, fw = W * 0.84, fy = H * (horiz ? 0.26 : 0.32), fh = hz - fy;
  for (let y = fy; y < hz; y++) for (let x = fx; x < fx + fw; x++) g.set(x, y, tono(PIEDRA, 0.62 - ((x - fx) / fw) * 0.3 + (y - fy) / fh * 0.1, x, y));
  g.rect(fx, fy, fw, 2, OUT);
  // frontón triangular
  const alto = H * 0.1;
  for (let y = 0; y < alto; y++) { const w = (fw / 2) * (y / alto); for (let x = W / 2 - w; x <= W / 2 + w; x++) g.set(x, fy - alto + y, tono(PIEDRA, 0.75 - ((x - (W / 2 - w)) / Math.max(1, 2 * w)) * 0.4, x, y)); }
  g.line(fx, fy, W / 2, fy - alto, OUT, 2); g.line(W / 2, fy - alto, fx + fw, fy, OUT, 2);
  // columnas con sombreado cilíndrico
  const n = 6, cw = (fw * 0.78) / n;
  for (let i = 0; i < n; i++) {
    const cx = fx + fw * 0.11 + i * (cw * 1.17) + cw / 2;
    for (let y = fy + 8; y < hz - 8; y++) for (let x = cx - cw * 0.42; x <= cx + cw * 0.42; x++) {
      const u = (x - cx) / (cw * 0.42); const z = Math.sqrt(Math.max(0, 1 - u * u)); g.set(x, y, tono(PIEDRA, 0.15 + 0.85 * Math.max(0, -0.5 * u + 0.8 * z), x, y));
    }
    g.rect(cx - cw * 0.5, fy + 5, cw, 4, PIEDRA[3]); g.rect(cx - cw * 0.5, hz - 10, cw, 4, PIEDRA[2]);
  }
  // letrero
  g.rect(W * 0.2, fy + 1, W * 0.6, 12 * k, [12, 10, 26]); g.rect(W * 0.2, fy + 1, W * 0.6, 1, ORO[3]);
  g.txt('BANCO', W / 2, fy + 1 + 6 * k, Math.round(9 * k), '#ffd870', '#000');
  // escalones
  for (let i = 0; i < 4; i++) g.rect(fx - i * 6, hz + i * 5, fw + i * 12, 5, tono(PIEDRA, 0.5 - i * 0.08, 3, i) as RGB);
  g.grad(hz + 20, H, rampa('#14102e', '#0a0818'));
  // puerta de bóveda en el centro con rayos que giran
  const vx = W / 2, vy = hz - 22 * k, vr = 26 * k;
  g.ell(vx, vy, vr, vr, rampa('#2a2e3a', '#4a5064', '#7a829a', '#b8c0d8'));
  g.ring(vx, vy, vr * 0.78, 2, [30, 34, 44]);
  for (let i = 0; i < 6; i++) { const a = t * 0.9 + (i * Math.PI) / 3; g.line(vx, vy, vx + Math.cos(a) * vr * 0.7, vy + Math.sin(a) * vr * 0.7, [200, 208, 228], 2); g.ell(vx + Math.cos(a) * vr * 0.7, vy + Math.sin(a) * vr * 0.7, 2.5, 2.5, rampa('#6a4306', '#e8b03a', '#fff4b8')); }
  g.ell(vx, vy, 5 * k, 5 * k, ORO);
  // monedas que caen
  for (let i = 0; i < 18; i++) { const x = rnd(i, 1) * W, y = (rnd(i, 2) * H + t * (40 + rnd(i, 3) * 50) * k) % H, w = Math.abs(Math.cos(t * 5 + i)) * 3.5 * k + 1; g.ell(x, y, w, 3.5 * k, ORO); }
  texto(g, t, k, W, H * (horiz ? 0.12 : 0.88), param);
};

/* ---------------- 4. GRÁFICA (param: título|sube / cae / duda) ---------------- */
export const grafica: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const [titulo = '', modo = 'sube'] = param.split('|');
  g.grad(0, H, rampa('#060a18', '#0c1830', '#060a18'));
  // cuadrícula
  const gx = W * 0.08, gy = H * (horiz ? 0.24 : 0.34), gw = W * 0.84, gh = H * (horiz ? 0.56 : 0.36);
  g.rect(gx, gy, gw, gh, [6, 12, 28]);
  for (let i = 0; i <= 5; i++) g.rect(gx, gy + (gh * i) / 5, gw, 1, [40, 60, 100], 0.6);
  for (let i = 0; i <= 8; i++) g.rect(gx + (gw * i) / 8, gy, 1, gh, [40, 60, 100], 0.4);
  g.rect(gx, gy, gw, 2, [80, 120, 200]); g.rect(gx, gy + gh - 2, gw, 2, [80, 120, 200]);
  // curva
  const N = 80, p = ease(t / 2.2);
  const f = (u: number) => modo === 'cae' ? 0.9 - 0.85 * Math.pow(u, 1.5) : modo === 'duda' ? 0.5 + 0.18 * Math.sin(u * 13) + 0.2 * u : u < 0.72 ? 0.12 + 0.82 * Math.pow(u / 0.72, 1.6) : 0.94 - 0.9 * Math.pow((u - 0.72) / 0.28, 1.2);
  let px = gx, py = gy + gh * (1 - f(0));
  const fin = Math.floor(N * p);
  const col: RGB = modo === 'cae' ? [255, 80, 100] : [70, 230, 140];
  for (let i = 1; i <= fin; i++) {
    const u = i / N, x = gx + gw * u, y = gy + gh * (1 - f(u));
    const c: RGB = modo === 'sube' && u > 0.72 ? [255, 80, 100] : col;
    g.line(px, py, x, y, c, 3);
    for (let yy = y; yy < gy + gh - 2; yy += 3) g.set(x, yy, c, 0.16);
    px = x; py = y;
  }
  if (fin > 0) { const b = 0.5 + 0.5 * Math.sin(t * 8); g.ellA(px, py, 9 * k * (0.6 + b * 0.5), 9 * k * (0.6 + b * 0.5), [255, 240, 160], 0.3); g.ell(px, py, 4 * k, 4 * k, ORO); }
  // flechas e iconos
  const ico = modo === 'cae' ? '▼' : '▲';
  g.txt(ico, W * 0.86, gy - 14 * k, Math.round(14 * k), modo === 'cae' ? '#ff5064' : '#46e68c', '#000');
  // billetes que flotan al subir
  if (modo !== 'cae') for (let i = 0; i < 12; i++) { const x = rnd(i, 1) * W, y = H - ((rnd(i, 2) * H + t * (24 + rnd(i, 3) * 30) * k) % H); g.rect(x, y, 10, 5, VERDE[2]); g.rect(x, y, 10, 1, VERDE[4]); g.set(x + 4, y + 2, VERDE[4]); }
  else for (let i = 0; i < 16; i++) { const x = rnd(i, 1) * W, y = (rnd(i, 2) * H + t * (30 + rnd(i, 3) * 40) * k) % H; g.rect(x, y, 3, 3, [255, 70, 90], 0.8); }
  chispas(g, t, k, W, H, 20, [140, 190, 255]);
  texto(g, t, k, W, H * (horiz ? 0.12 : 0.88), titulo);
};

/* ---------------- 5. JUICIO (mazo y balanza) ---------------- */
export const juicio: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  g.grad(0, H, rampa('#120a06', '#2a180c', '#4a2c14', '#1c1008'));
  for (let x = 0; x < W; x += 18 * k) for (let y = 0; y < H * 0.7; y++) g.set(x, y, [10, 6, 2], 0.3);
  g.rect(0, H * 0.7, W, H * 0.3, [30, 18, 10]);
  for (let i = 0; i < 3; i++) g.ellA(W * (0.25 + i * 0.25), H * 0.05, 70 * k, 90 * k, [255, 220, 150], 0.10);
  // mesa del juez
  const my = H * 0.66;
  for (let y = my; y < H; y++) for (let x = 0; x < W; x++) g.set(x, y, tono(MADERA, 0.65 - (y - my) / (H - my) * 0.4 + 0.1 * Math.sin(x * 0.07 + y * 0.2), x, y));
  g.rect(0, my, W, 3, MADERA[4]);
  // bloque y mazo (golpea cada 1.6 s)
  const ciclo = (t % 1.6) / 1.6;
  const ang = ciclo < 0.5 ? 0.5 + 0.06 * Math.sin(ciclo * 12) : ciclo < 0.58 ? 0.5 + 0.95 * ease((ciclo - 0.5) / 0.08) : 1.45 - 0.95 * ease((ciclo - 0.58) / 0.32);
  const L = 52 * k;
  const bx = W * (horiz ? 0.3 : 0.4), by = my + 2;
  g.ell(bx, by + 3, 30 * k, 7 * k, rampa('#2a1608', '#5a361a', '#8a5a2c', '#c08a50'));
  g.rect(bx - 26 * k, by - 6 * k, 52 * k, 9 * k, [90, 56, 26]);
  g.rect(bx - 26 * k, by - 6 * k, 52 * k, 2, [200, 146, 80]);
  g.rect(bx - 26 * k, by + 3 * k - 2, 52 * k, 2, [40, 22, 8]);
  const hx = bx + L * 0.9, hy = by - 8 * k;
  const mx = hx - Math.sin(ang) * L, my2 = hy - Math.cos(ang) * L;
  g.line(hx, hy, mx, my2, [150, 100, 52], 5);
  g.line(hx, hy - 1, mx, my2 - 1, [210, 160, 96], 1);
  const px = Math.cos(ang), py = -Math.sin(ang);
  g.line(mx - px * 13 * k, my2 - py * 13 * k, mx + px * 13 * k, my2 + py * 13 * k, [40, 22, 8], 16 * k * 0.8 + 4);
  g.line(mx - px * 12 * k, my2 - py * 12 * k, mx + px * 12 * k, my2 + py * 12 * k, [176, 120, 62], 16 * k * 0.8);
  g.line(mx - px * 12 * k, my2 - py * 12 * k - 3, mx + px * 12 * k, my2 + py * 12 * k - 3, [236, 190, 120], 3);
  if (ciclo > 0.57 && ciclo < 0.75) { const u = (ciclo - 0.57) / 0.18, ra = 20 * k * (0.6 + u * 1.6); g.ellA(bx, by, ra, ra * 0.3, [255, 240, 190], 0.5 * (1 - u)); g.ring(bx, by - 4 * k, ra * 0.8, 2, [255, 230, 160]); }
  // balanza de la justicia al fondo
  const sx = W * (horiz ? 0.7 : 0.5), sy = H * (horiz ? 0.3 : 0.27);
  g.rect(sx - 1, sy, 3, my - sy - 2, ORO[2]);
  g.rect(sx - 1, sy, 1, my - sy - 2, ORO[4]);
  g.ell(sx, my - 2, 22 * k, 5 * k, ORO);
  const incl = Math.sin(t * 1.2) * 0.12;
  const brazo = 56 * k;
  const lx = sx - Math.cos(incl) * brazo, ly = sy - Math.sin(incl) * brazo, rx = sx + Math.cos(incl) * brazo, ry = sy + Math.sin(incl) * brazo;
  g.line(lx, ly, rx, ry, ORO[3], 3);
  for (const [qx, qy] of [[lx, ly], [rx, ry]]) { g.line(qx, qy, qx - 16 * k, qy + 36 * k, ORO[1], 1); g.line(qx, qy, qx + 16 * k, qy + 36 * k, ORO[1], 1); g.ell(qx, qy + 37 * k, 20 * k, 4.5 * k, ORO); }
  g.ell(sx, sy, 6 * k, 6 * k, ORO);
  texto(g, t, k, W, H * (horiz ? 0.12 : 0.88), param, '#ffb347');
};

/* ---------------- 6. VEREDICTO ¿ESTAFADOR O GENIO? ---------------- */
export const veredictoGenio: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  g.grad(0, H, rampa('#06040e', '#160c2c', '#2c1450', '#160c2c', '#06040e'));
  for (let i = 0; i < 60; i++) g.set(rnd(i, 1) * W, rnd(i, 2) * H, [255, 230, 160], 0.25 + 0.5 * Math.sin(t * 3 + i));
  const cx = W / 2, cy = H * (horiz ? 0.55 : 0.52);
  // balanza grande que oscila (el veredicto queda abierto)
  const incl = Math.sin(t * 1.4) * 0.2;
  g.rect(cx - 2, cy - 70 * k, 4, 130 * k, ORO[2]);
  g.rect(cx - 2, cy - 70 * k, 1, 130 * k, ORO[4]);
  g.ell(cx, cy + 62 * k, 30 * k, 6 * k, rampa('#6a4306', '#b07a14', '#e8b03a'));
  const brazo = 96 * k, ax = cx, ay = cy - 70 * k;
  const lx = ax - Math.cos(incl) * brazo, ly = ay - Math.sin(incl) * brazo, rx = ax + Math.cos(incl) * brazo, ry = ay + Math.sin(incl) * brazo;
  g.line(lx, ly, rx, ry, ORO[3], 4);
  g.ell(ax, ay, 7 * k, 7 * k, ORO);
  const platos: [number, number, string, string, RGB[]][] = [[lx, ly, 'GENIO', '★', ORO], [rx, ry, 'ESTAFA', '$', ROJO]];
  for (const [px, py, nom, sim, pal] of platos) {
    g.line(px, py, px - 28 * k, py + 56 * k, ORO[1], 1); g.line(px, py, px + 28 * k, py + 56 * k, ORO[1], 1);
    g.ell(px, py + 58 * k, 32 * k, 7 * k, ORO);
    g.ell(px, py + 40 * k, 12 * k, 12 * k, pal);
    g.txt(sim, px, py + 40 * k, Math.round(13 * k), '#ffffff', '#000');
    g.txt(nom, px, py + 74 * k, Math.round(9 * k), nom === 'GENIO' ? '#ffd870' : '#ff6a7a', '#000');
  }
  chispas(g, t, k, W, H, 30);
  const a = ease((t - 0.1) / 0.3);
  const s = 1 + 0.35 * (1 - a);
  const by0 = H * (horiz ? 0.1 : 0.84);
  const bw = horiz ? 0.74 : 0.92, bxx = horiz ? 0.04 : 0.04;
  g.rect(W * bxx, by0, W * bw, 34 * k * s, [8, 6, 16], 0.8 * a);
  g.rect(W * bxx, by0, W * bw, 2, [255, 214, 90], a);
  g.txt(param || '¿ESTAFADOR O GENIO?', W * (bxx + bw / 2), by0 + 17 * k * s, Math.round(Math.min(14 * k, (bw * 0.98 * W) / Math.max(1, (param || '¿ESTAFADOR O GENIO?').length)) * s), '#ffd870', '#000');
};


/* ---------------- 7. FANTASMAS (clientes que no existian; param: TITULO|fade) ---------------- */
export const fantasmas: Dib = (g, t, k, horiz, param) => {
  const W = g.w, H = g.h;
  const [titulo = '', modo = ''] = param.split('|');
  g.grad(0, H, rampa('#050a1c', '#0c1a40', '#14285c', '#0a1430'));
  for (let i = 0; i < 50; i++) g.set(rnd(i, 1) * W, rnd(i, 2) * H * 0.5, [255, 255, 240], 0.2 + 0.5 * Math.sin(t * 2 + i));
  const cols = horiz ? 22 : 12, filas = horiz ? 9 : 14;
  const x0 = W * 0.07, x1 = W * (horiz ? 0.8 : 0.93), y0 = H * (horiz ? 0.2 : 0.33), y1 = H * (horiz ? 0.86 : 0.78);
  const dx = (x1 - x0) / cols, dy = (y1 - y0) / filas;
  const fade = modo === 'fade' ? ease((t - 0.9) / 1.4) : 0;
  for (let r = 0; r < filas; r++) for (let c = 0; c < cols; c++) {
    const id = r * 31 + c;
    const real = hs(id, 3) < 0.075;
    const cx = x0 + dx * (c + 0.5), cy = y0 + dy * (r + 0.5) + Math.sin(t * 2 + id) * (real ? 0.5 : 1.8);
    const s = Math.min(dx * 0.5, dy * 0.3);
    if (real) {
      g.ell(cx, cy - s * 0.9, s * 0.55, s * 0.55, ORO);
      g.ell(cx, cy + s * 0.2, s * 0.8, s * 0.95, ORO);
      g.ellA(cx, cy - s * 0.3, s * 1.6, s * 1.9, [255, 226, 140], 0.14 + 0.08 * Math.sin(t * 4 + id));
    } else {
      const a = 0.5 * (1 - fade) * (0.7 + 0.3 * Math.sin(t * 3 + id));
      if (a > 0.02) {
        g.ellA(cx, cy - s * 0.9, s * 0.55, s * 0.55, [170, 200, 255], a);
        g.ellA(cx, cy + s * 0.2, s * 0.8, s * 0.95, [170, 200, 255], a);
        g.set(cx - s * 0.2, cy - s * 0.95, [10, 20, 50], a * 1.4); g.set(cx + s * 0.2, cy - s * 0.95, [10, 20, 50], a * 1.4);
      }
    }
  }
  chispas(g, t, k, W, H, 20, [150, 190, 255]);
  texto(g, t, k, W, H * (horiz ? 0.12 : 0.88), titulo, fade > 0.5 ? '#ffd870' : '#bcd4ff');
};

export const DIBUJOS_FORBES: Record<string, Dib> = {
  pixelrascacielos: rascacielos,
  pixelpremio: escenario,
  pixelbanco: banco,
  pixelgrafica: grafica,
  pixeljuicio: juicio,
  pixelgenio: veredictoGenio,
  pixelfantasmas: fantasmas,
};
