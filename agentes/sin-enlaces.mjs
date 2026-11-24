/**
 * Regla global del dueño: las descripciones de video nunca contienen enlaces.
 * Elimina bloques de fuentes, enlaces Markdown, URLs y dominios, conservando
 * el texto editorial, la llamada a la acción y los hashtags.
 */
export const sinEnlaces = (valor) => String(valor ?? '')
  .replace(/\[[^\]]*\]\((?:https?:\/\/|www\.)[^)]+\)/gi, '')
  .replace(/(?:https?:\/\/|www\.)\S+/gi, '')
  .replace(/\b(?:Fuentes|Más historias en el canal)\s*:[^\n]*(?:\n|$)/gi, '')
  .replace(/\b(?:Fuentes|Más historias en el canal)\b[^\n]*(?:\n|$)/gi, '')
  .replace(/\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|co|tv|do|es|info|app|me|ai)(?:\/\S*)?/gi, '')
  .replace(/[ \t]+\n/g, '\n')
  .replace(/\n{3,}/g, '\n\n')
  .trim();
