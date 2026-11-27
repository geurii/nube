# CAPAS DE PROFUNDIDAD PARA PIXEL ART
# Toma una imagen YA pixelada y la corta en tres planos (lejos / medio / cerca)
# usando MiDaS small en ONNX: gratis, sin llave y sin limite.
# El motor mueve cada plano a distinta velocidad, asi las cosas pasan unas por
# delante de otras y el fondo deja de ser una foto deslizandose.
#
#   python3 -I scripts/capas_profundidad.py arte.png modelos/midas.onnx
#   -> arte.l0.png (lejos, opaco)  arte.l1.png (medio, RGBA)  arte.l2.png (cerca, RGBA)
import sys, numpy as np, onnxruntime as ort
from PIL import Image, ImageFilter

arte, modelo = sys.argv[1], sys.argv[2]
base = arte[:-4] if arte.lower().endswith('.png') else arte
PIXEL = int(sys.argv[3]) if len(sys.argv) > 3 else 2   # 1 px de arte = 2 px de video

im = Image.open(arte).convert('RGB')
W, H = im.size

# --- profundidad ---
x = np.asarray(im.resize((256, 256), Image.BILINEAR), dtype=np.float32) / 255.0
mean = np.array([0.485, 0.456, 0.406], np.float32); std = np.array([0.229, 0.224, 0.225], np.float32)
x = ((x - mean) / std).transpose(2, 0, 1)[None]
s = ort.InferenceSession(modelo, providers=['CPUExecutionProvider'])
d = np.squeeze(s.run(None, {s.get_inputs()[0].name: x})[0])
d = (d - d.min()) / (d.max() - d.min() + 1e-6)
# a tamano de arte, en bloques del tamano del pixel para no romper el pixel art
dw, dh = max(W // PIXEL, 1), max(H // PIXEL, 1)
dep = np.asarray(Image.fromarray((d * 255).astype(np.uint8)).resize((dw, dh), Image.BILINEAR)
                 .resize((W, H), Image.NEAREST), dtype=np.float32) / 255.0

# --- cortes por percentil: toda imagen se parte en tres de verdad ---
c1, c2 = np.percentile(dep, 45), np.percentile(dep, 78)
rgb = np.asarray(im, dtype=np.uint8)

def plano(mascara):
    a = (mascara * 255).astype(np.uint8)
    cap = np.dstack([rgb, a])
    return Image.fromarray(cap, 'RGBA')

m_medio = ((dep >= c1) & (dep < c2)).astype(np.float32)
m_cerca = (dep >= c2).astype(np.float32)

# --- el plano de lejos se rellena donde se recorto, si no se ve el hueco al moverse ---
hueco = ((m_medio + m_cerca) > 0)
lejos = rgb.copy()
if hueco.any():
    # relleno por expansion: se estira el color de alrededor sobre el hueco
    relleno = Image.fromarray(rgb)
    for _ in range(6):
        relleno = relleno.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.GaussianBlur(2))
    r = np.asarray(relleno, dtype=np.uint8)
    lejos[hueco] = r[hueco]
# se vuelve a cuadricular para que el relleno no quede suave
lj = Image.fromarray(lejos).resize((dw, dh), Image.BOX).resize((W, H), Image.NEAREST)
lj.convert('RGB').save(base + '.l0.png')
plano(m_medio).save(base + '.l1.png')
plano(m_cerca).save(base + '.l2.png')
print(f'{base}: 3 planos  (cortes {c1:.2f}/{c2:.2f})')
