/** Un autor por línea: el importador une varios autores con " / ". */
export function splitAuthors(composer: string | undefined): string[] {
  return (composer ?? '')
    .split(/\s+\/\s+|\n/)
    .map((author) => author.trim())
    .filter((author) => author !== '');
}
