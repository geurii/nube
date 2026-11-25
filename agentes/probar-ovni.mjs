import {validarEscena, tieneAnclaNarrativa} from './pintor.mjs';

const comprobar = (tipo, texto, dimensiones) => {
  const escena = validarEscena({
    cielo: ['#071426', '#172b45', '#334c67'],
    capas: [
      {t: 'estrellas', n: 28},
      {t: 'nubes', x: 0.5, y: 0.2, w: 0.8},
      {t: tipo, x: 0.5, y: 0.42, ...dimensiones},
    ],
  });
  if (!escena) throw new Error(`No se pudo validar la escena pixel art: ${tipo}`);
  if (!tieneAnclaNarrativa(escena, texto)) throw new Error(`El objeto ${tipo} no coincide con la narración: ${texto}`);
};

comprobar('tic_tac', 'El objeto blanco con forma de Tic Tac aparece en el video FLIR1', {w: 0.42, h: 0.12});
comprobar('radar', 'La cámara infrarroja y la pantalla muestran el seguimiento del objeto', {w: 0.58, h: 0.42});
comprobar('ovni', 'Los pilotos registraron un ovni no identificado', {r: 0.16});
comprobar('avion', 'Un avión F/A-18 de la Marina sigue el objeto', {w: 0.62});
console.log('OK: cuatro anclas visuales OVNI validadas; sin personajes ni rostros.');
