type Props = {
  connected: boolean
  searching: boolean
  onConnectByIp: () => void
  onSearchAgain: () => void
}

export function EmptyState({ connected, searching, onConnectByIp, onSearchAgain }: Props) {
  if (connected) {
    return (
      <div className="empty-state">
        <md-icon aria-hidden="true">forum</md-icon>
        <p className="type-title-small">Nenhuma mensagem ainda</p>
        <p className="type-body-medium">
          Escreva, cole um print ou segure o microfone (Ctrl+Espaço) para falar.
        </p>
      </div>
    )
  }
  if (!searching) {
    return (
      <div className="empty-state">
        <md-icon aria-hidden="true">search_off</md-icon>
        <p className="type-title-small">Busca pausada</p>
        <p className="type-body-medium">O PairLAN não está anunciando nem procurando o par na rede.</p>
        <md-filled-tonal-button onClick={onSearchAgain}>
          <md-icon slot="icon">wifi_find</md-icon>
          Procurar de novo
        </md-filled-tonal-button>
        <md-text-button onClick={onConnectByIp}>Conectar por IP</md-text-button>
      </div>
    )
  }
  return (
    <div className="empty-state">
      <md-icon aria-hidden="true">wifi_find</md-icon>
      <p className="type-title-small">Procurando o par na rede…</p>
      <p className="type-body-medium">Abra o PairLAN no outro PC, na mesma rede. A conexão é automática.</p>
      <md-filled-tonal-button onClick={onConnectByIp}>
        <md-icon slot="icon">lan</md-icon>
        Conectar por IP
      </md-filled-tonal-button>
    </div>
  )
}
