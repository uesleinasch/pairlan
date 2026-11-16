import type { InternetStatus } from '../../shared/api'

export function internetSummary(s: InternetStatus): string {
  if (!s.relayUrl) return 'Sem servidor. Informe o endereço do relay abaixo.'
  if (!s.me) return 'Registre seu usuário para conectar pela internet.'
  if (!s.peer) return `Você é @${s.me}. Adicione o usuário do seu par.`
  switch (s.state) {
    case 'connecting':
      return 'Conectando ao servidor…'
    case 'waiting-peer':
      return `Aguardando @${s.peer}: precisa estar com o app aberto e ter adicionado @${s.me}.`
    case 'securing':
      return 'Trocando chaves com o par…'
    case 'connected':
      return `Conectado a @${s.peer} pela internet, cifrado ponta a ponta.`
    case 'error':
      return s.error ?? 'A conexão pela internet falhou.'
    default:
      return 'Pausado: o par está na mesma rede.'
  }
}
