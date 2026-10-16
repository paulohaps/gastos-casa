import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { WalletController } from "./controller";
import type { Goal, WalletState } from "./contracts";
export function GoalEditor({
  controller,
  state,
}: {
  controller: WalletController;
  state: WalletState;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  const wallet = state.wallets.find((w) => w.id === state.selected),
    goal = wallet?.goal;
  const version = useRef(0);
  useEffect(() => {
    const reset = () => {
      version.current++;
      setError("");
      setBusy(false);
      if (dialog.current) {
        window.AppUI.setModalBusy(dialog.current, false);
        window.AppUI.closeModal(dialog.current);
      }
    };
    window.addEventListener("gastos:sessioncleared", reset);
    window.addEventListener("gastos:viewchange", reset);
    return () => {
      window.removeEventListener("gastos:sessioncleared", reset);
      window.removeEventListener("gastos:viewchange", reset);
    };
  }, []);
  async function save(value: Goal | null) {
    const turn = version.current;
    setBusy(true);
    setError("");
    window.AppUI.setModalBusy("walletGoalDialog", true);
    try {
      await controller.saveGoal(value);
      if (turn === version.current) {
        window.AppUI.setModalBusy("walletGoalDialog", false);
        window.AppUI.closeModal("walletGoalDialog");
      }
    } catch (cause) {
      if (turn === version.current)
        setError(
          cause instanceof Error
            ? cause.message
            : "Não foi possível salvar sua meta. Tente novamente.",
        );
    } finally {
      if (turn === version.current) {
        setBusy(false);
        window.AppUI.setModalBusy("walletGoalDialog", false);
      }
    }
  }
  return (
    <>
      <button
        className="btn btn--tertiary"
        id="walletGoalOpen"
        type="button"
        disabled={!state.plan}
        onClick={() => {
          setError("");
          window.AppUI.openModal("walletGoalDialog", "#walletGoalName");
        }}
      >
        {goal ? "Editar meta" : "Criar uma meta"}
      </button>
      {createPortal(
        <dialog
          ref={dialog}
          id="walletGoalDialog"
          className="app-modal wallet-form-dialog"
          aria-labelledby="walletGoalTitle"
        >
          <div className="modal-heading">
            <h2 id="walletGoalTitle">Sua meta pessoal</h2>
            <button
              type="button"
              className="btn btn--ghost modal-close"
              disabled={busy}
              onClick={() => window.AppUI.closeModal("walletGoalDialog")}
            >
              Fechar
            </button>
          </div>
          <p className="supporting-text">
            Separe parte do limite de{" "}
            {state.month.split("-").reverse().join("/")} para um plano. Isso não
            transfere dinheiro nem comprova poupança.
          </p>
          <form
            key={
              state.selected + ":" + state.month + ":" + JSON.stringify(goal)
            }
            className="form-stack"
            id="walletGoalForm"
            onSubmit={(event) => {
              event.preventDefault();
              if (busy) return;
              const data = new FormData(event.currentTarget);
              void save({
                name: String(data.get("name")).trim(),
                target: Number(data.get("target")),
                reserve: Number(data.get("reserve")),
                deadline: String(data.get("deadline")),
                month: state.month,
              });
            }}
          >
            <label className="field">
              <span>O que você quer realizar?</span>
              <input
                name="name"
                id="walletGoalName"
                required
                minLength={2}
                maxLength={80}
                defaultValue={goal?.name}
                placeholder="Ex.: Viagem"
              />
            </label>
            <div className="form-grid form-grid--2">
              <label className="field">
                <span>Valor da meta (R$)</span>
                <input
                  name="target"
                  id="walletGoalTarget"
                  type="number"
                  required
                  min="0.01"
                  step="0.01"
                  max="9999999999.99"
                  defaultValue={goal?.target}
                />
              </label>
              <label className="field">
                <span>Prazo</span>
                <input
                  name="deadline"
                  id="walletGoalDeadline"
                  type="date"
                  required
                  defaultValue={goal?.deadline}
                />
              </label>
            </div>
            <label className="field">
              <span>Proteger neste mês (R$)</span>
              <input
                name="reserve"
                id="walletGoalReserve"
                type="number"
                required
                min="0"
                step="0.01"
                max={9999999999.99}
                defaultValue={goal?.month === state.month ? goal.reserve : 0}
              />
              <small>
                Esta parte do orçamento sai da referência diária para gastos.
              </small>
            </label>
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn--primary"
                disabled={busy}
              >
                Salvar meta
              </button>
              {goal && (
                <button
                  type="button"
                  className="btn btn--ghost"
                  disabled={busy}
                  onClick={async () => {
                    const turn = version.current;
                    window.AppUI.closeModal("walletGoalDialog");
                    const confirmed = await window.AppUI.confirmAction({
                      title: "Remover meta?",
                      message:
                        "A reserva voltará a fazer parte do limite disponível.",
                      confirmLabel: "Remover meta",
                    });
                    if (turn !== version.current) return;
                    if (confirmed) void save(null);
                    else window.AppUI.openModal("walletGoalDialog");
                  }}
                >
                  Remover meta
                </button>
              )}
            </div>
          </form>
          <p role="alert" data-wallet-status="">
            {error}
          </p>
        </dialog>,
        document.body,
      )}
    </>
  );
}
