import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props { children: ReactNode; label?: string }
interface State { error: Error | null }

export default class AdminErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error("[admin-tab]", this.props.label ?? "tab", error, info.componentStack);
  }

  render() {
    if (this.state.error) {
      return (
        <div style={{
          padding: 24,
          borderRadius: 12,
          border: "1px solid rgba(255,82,82,0.45)",
          background: "rgba(255,82,82,0.08)",
          color: "#ffcdd2",
        }}>
          <div style={{ fontWeight: 900, marginBottom: 8 }}>
            Ошибка вкладки {this.props.label ?? ""}
          </div>
          <div style={{ fontSize: 12, lineHeight: 1.5, marginBottom: 12 }}>
            {this.state.error.message || "Неизвестная ошибка"}
          </div>
          <button
            type="button"
            onClick={() => this.setState({ error: null })}
            style={{
              padding: "8px 14px",
              borderRadius: 8,
              border: "1px solid rgba(255,255,255,0.25)",
              background: "rgba(255,255,255,0.08)",
              color: "white",
              fontWeight: 800,
              cursor: "pointer",
            }}
          >
            Повторить
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
