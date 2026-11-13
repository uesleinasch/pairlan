export function EmptyState({ connected, onConnectByIp }: { connected: boolean; onConnectByIp: () => void }) {
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
