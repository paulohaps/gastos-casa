import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";
export class FeatureBoundary extends Component<
  { children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch(_error: Error, _info: ErrorInfo) {
    // Do not log conversation content or credentials from component props.
    console.error("A tela do assistente não pôde ser exibida.");
  }
  render() {
    if (this.state.failed)
      return (
        <div className="chat-error" role="alert">
          <p>Não foi possível abrir o Assistente.</p>
          <button
            type="button"
            className="btn btn--primary"
            onClick={() => location.reload()}
          >
            Recarregar aplicativo
          </button>
        </div>
      );
    return this.props.children;
  }
}
