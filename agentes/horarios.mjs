/** Próximo horario de publicación alineado con los cron de oficina.yml (UTC). */
export const proximoHorario = (formato, ahoraMs = Date.now()) => {
  const slots = formato === 'largo'
    ? [0, 12]
    : [1, 4, 7, 10, 13, 16, 19, 22];
  // YouTube exige publishAt con margen; se calcula desde 40 minutos en el futuro.
  const minimo = ahoraMs + 40 * 60_000;
  const base = new Date(minimo);
  for (let dia = 0; dia < 3; dia++) {
    for (const hora of slots) {
      const candidato = new Date(base);
      candidato.setUTCDate(base.getUTCDate() + dia);
      candidato.setUTCHours(hora, 23, 0, 0);
      if (candidato.getTime() >= minimo) return candidato;
    }
  }
  return new Date(minimo + 60 * 60_000);
};
