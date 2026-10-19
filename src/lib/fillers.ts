// Portuguese prompts are kept short so they do not mask the command.
const choose = (lines: string[]) => () => lines[Math.floor(Math.random() * lines.length)]
export const working = choose(['Consultando.', 'Processando.', 'Verificando.'])
export const acknowledge = choose(['Entendido.', 'Certo.'])
export const attention = choose(['Estou aqui.', 'Pode falar.', 'Atlas pronto.'])
export function forTool(name: string): string {
  if (/search|exa|serper/i.test(name)) return 'Pesquisando.'
  if (/image|render|photo/i.test(name)) return 'Preparando a imagem.'
  if (/chrome|browser/i.test(name)) return 'Consultando o navegador.'
  if (/camera|eyes|look/i.test(name)) return 'Analisando a câmera.'
  return working()
}
