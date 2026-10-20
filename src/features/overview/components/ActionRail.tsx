import { Icon } from "../../../shared/ui/Icon";

export function ActionRail({
  personal,
  canInspectBalance,
  onBalance,
  onHistory,
  onAnalysis,
}: {
  personal: boolean;
  canInspectBalance: boolean;
  onBalance(): void;
  onHistory(): void;
  onAnalysis(): void;
}) {
  return (
    <aside className="workspace-actions" aria-label="Próximas ações">
      <h2>O que você quer fazer?</h2>
      <button type="button" data-entry-open="">
        <Icon name="plus" />
        <span>
          <strong>Registrar despesa</strong>
          <small>Valor, descrição e quem pagou</small>
        </span>
        <span aria-hidden="true">↗</span>
      </button>
      {personal ? (
        <a href="#carteiras">
          <Icon name="wallet" />
          <span>
            <strong>Cuidar do meu cofre</strong>
            <small>Limite, reserva e metas</small>
          </span>
          <span aria-hidden="true">↗</span>
        </a>
      ) : (
        <button type="button" onClick={onBalance} disabled={!canInspectBalance}>
          <Icon name="check" />
          <span>
            <strong>Conferir meus acertos</strong>
            <small>Entenda o saldo antes de pagar</small>
          </span>
          <span aria-hidden="true">↗</span>
        </button>
      )}
      <button type="button" onClick={onHistory}>
        <Icon name="clock" />
        <span>
          <strong>Encontrar um lançamento</strong>
          <small>Pesquise suas movimentações</small>
        </span>
        <span aria-hidden="true">↗</span>
      </button>
      <button type="button" onClick={onAnalysis}>
        <Icon name="layers" />
        <span>
          <strong>Entender meu mês</strong>
          <small>Comparações, categorias e limites</small>
        </span>
        <span aria-hidden="true">↗</span>
      </button>
    </aside>
  );
}
