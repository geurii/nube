#!/usr/bin/env python3
# Convierte una imagen a pixel art de verdad: recorta la marca de agua, sube color y contraste,
# reduce por promedio de area al ancho del lienzo, aplica una paleta corta y la amplia a 1080x1920
# sin suavizar, para que cada pixel quede cuadrado.
#   python3 scripts/a_pixel_art.py entrada.jpg salida.png [ancho] [colores]
import sys
from PIL import Image, ImageEnhance

entrada, salida = sys.argv[1], sys.argv[2]
ancho = int(sys.argv[3]) if len(sys.argv) > 3 else 288
colores = int(sys.argv[4]) if len(sys.argv) > 4 else 48
salida_w = int(sys.argv[5]) if len(sys.argv) > 5 else 1080
salida_h = int(sys.argv[6]) if len(sys.argv) > 6 else 1920

im = Image.open(entrada).convert("RGB")
w, h = im.size
im = im.crop((0, 0, w, int(h * 0.945)))                  # fuera la marca de agua de abajo
im = ImageEnhance.Color(im).enhance(1.20)
im = ImageEnhance.Contrast(im).enhance(1.08)
alto = max(8, round(ancho * im.size[1] / im.size[0]))
chico = im.resize((ancho, alto), Image.BOX)              # promedio: bloques limpios, sin grano
chico = chico.quantize(colors=colores, method=Image.MEDIANCUT, dither=Image.Dither.NONE).convert("RGB")
chico.resize((salida_w, salida_h), Image.NEAREST).save(salida)
print(f"{salida}  {ancho}px -> {salida_w}x{salida_h}  {colores} colores")
