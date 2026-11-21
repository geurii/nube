// Garantía de publicación: si el canal lleva más de 7 horas sin publicar, la oficina relaja los filtros de ESTILO (nota del Editor y voto del
// panel) para que salga un video. Los filtros de VERDAD no se relajan nunca: datos del material, nombres de personas y normas del canal.
// Variable opcional FORZAR_GARANTIA=1 para activarla a mano.
import fs from 'node:fs';
import path from 'node:path';

export const enGarantia = (canal = 'lqns') => {
  if (process.env.FORZAR_GARANTIA === '1') return true;
  try {
    const v = JSON.parse(fs.readFileSync(path.join('oficina-salida', canal, 'vistas.json'), 'utf8'));
    const ultimo = (v.videos ?? []).map((x) => new Date(x.publicado).getTime()).filter(Number.isFinite).sort((a, b) => b - a)[0];
    return !ultimo || Date.now() - ultimo > 7 * 3600 * 1000;
  } catch { return true; }
};
