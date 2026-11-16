export type CommandName =
  | 'tela'
  | 'audio'
  | 'ouvir'
  | 'controle'
  | 'alerta'
  | 'chacoalhar'
  | 'anexo'
  | 'notas'
  | 'salvar'
  | 'parar'
  | 'buscar'
  | 'conectar'
  | 'direct'
  | 'usuario'
  | 'par'
  | 'config'
  | 'tema'
  | 'limpar'
  | 'apagar'
  | 'help'

type CommandInfo = { name: CommandName; usage: string; help: string; group: string }

export const COMMANDS: CommandInfo[] = [
  { name: 'tela', usage: '/tela', help: 'compartilhar / parar minha tela', group: 'mídia' },
  { name: 'audio', usage: '/audio', help: 'transmitir / parar o áudio do pc', group: 'mídia' },
  { name: 'ouvir', usage: '/ouvir', help: 'voz do par ao vivo on/off', group: 'mídia' },
  { name: 'controle', usage: '/controle', help: 'liberar / bloquear meu mouse e teclado', group: 'mídia' },
  { name: 'alerta', usage: '/alerta [vermelho]', help: 'chamar atenção do par (amarelo; vermelho = urgente)', group: 'atenção' },
  { name: 'chacoalhar', usage: '/chacoalhar', help: 'balançar a janela do par', group: 'atenção' },
  { name: 'anexo', usage: '/anexo', help: 'escolher arquivo (ou arraste / cole)', group: 'arquivos' },
  { name: 'salvar', usage: '/salvar [vermelho|amarelo|verde]', help: 'salvar a última msg do par nas notas (cor = hit)', group: 'notas' },
  { name: 'notas', usage: '/notas [busca]', help: 'abrir as notas (clique direito numa msg também salva)', group: 'notas' },
  { name: 'parar', usage: '/parar', help: 'parar de procurar o par', group: 'conexão' },
  { name: 'buscar', usage: '/buscar', help: 'voltar a procurar', group: 'conexão' },
  { name: 'conectar', usage: '/conectar ip', help: 'conectar direto por ip', group: 'conexão' },
  { name: 'direct', usage: '/direct [mac|off]', help: 'wi-fi direct liga / desliga (mac = endereço do par)', group: 'conexão' },
  { name: 'usuario', usage: '/usuario [nome]', help: 'internet: registrar / ver meu usuário', group: 'conexão' },
  { name: 'par', usage: '/par [usuario|off]', help: 'internet: adicionar / ver / remover o par', group: 'conexão' },
  { name: 'config', usage: '/config', help: 'configurações', group: 'app' },
  { name: 'tema', usage: '/tema', help: 'sair do modo terminal', group: 'app' },
  { name: 'limpar', usage: '/limpar', help: 'limpar a tela (não apaga o histórico)', group: 'app' },
  { name: 'apagar', usage: '/apagar', help: 'apagar o histórico deste pc (pede confirmação)', group: 'app' },
  { name: 'help', usage: '/help', help: 'esta ajuda', group: 'app' }
]

export type ParsedInput =
  | { kind: 'message'; text: string }
  | { kind: 'command'; name: CommandName; arg: string }
  | { kind: 'unknown'; name: string }

export function parseInput(input: string): ParsedInput {
  const trimmed = input.trim()
  if (trimmed.startsWith('//')) return { kind: 'message', text: input.replace(/^\s*\//, '') }
  const match = /^\/(\S+)\s*([\s\S]*)$/.exec(trimmed)
  if (!match) return { kind: 'message', text: input }
  const name = match[1].toLowerCase()
  const known = COMMANDS.find((c) => c.name === name)
  return known ? { kind: 'command', name: known.name, arg: match[2].trim() } : { kind: 'unknown', name }
}

export function completeCommand(input: string): string[] {
  const match = /^\/(\S*)$/.exec(input)
  if (!match) return []
  return COMMANDS.filter((c) => c.name.startsWith(match[1].toLowerCase())).map((c) => `/${c.name}`)
}

export function helpText(): string {
  const width = Math.max(...COMMANDS.map((c) => c.usage.length)) + 3
  const groups = [...new Set(COMMANDS.map((c) => c.group))]
  const lines = ['uso: digite e Enter envia. Shift+Enter quebra linha.', '     ``` abre bloco de código. // envia texto que começa com /.', '']
  for (const group of groups) {
    lines.push(group)
    for (const c of COMMANDS.filter((x) => x.group === group)) lines.push(`  ${c.usage.padEnd(width)}${c.help}`)
    if (group === 'mídia') lines.push(`  ${'Ctrl+Espaço'.padEnd(width)}segurar para falar (walkie)`)
    lines.push('')
  }
  return lines.join('\n').trimEnd()
}
