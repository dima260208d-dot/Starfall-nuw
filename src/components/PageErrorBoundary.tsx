import { Component, type ErrorInfo, type ReactNode } from "react";

interface Props {
  children: ReactNode;
  /** Optional label for logging which screen failed. */
  name?: string;
  /** Rendered when a child throws. Receives a retry callback. */
  fallback?: (retry: () => void) => ReactNode;
}

interface State {
  hasError: boolean;
  epoch: number;
}

/**
 * PageErrorBoundary — не даёт одной странице (например Star Pass с тяжёлым 3D)
 * уронить всё приложение в «синий экран». Ловит исключение при рендере, чинит
 * общий WebGL-контекст и предлагает повторить. При повторе дерево монтируется
 * заново (по возрастанию `epoch`), поэтому обычно страница открывается со
 * второй попытки, когда контекст восстановлен.
 */
export default class PageErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, epoch: 0 };

  static getDerivedStateFromError(): Partial<State> {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error(`[PageErrorBoundary${this.props.name ? ` ${this.props.name}` : ""}]`, error, info.componentStack);
  }

  private retry = (): void => {
    this.setState((s) => ({ hasError: false, epoch: s.epoch + 1 }));
  };

  render(): ReactNode {
    if (this.state.hasError) {
      if (this.props.fallback) return this.props.fallback(this.retry);
      return (
        <div
          style={{
            position: "absolute",
            inset: 0,
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 16,
            color: "#fff",
            textAlign: "center",
            padding: 24,
          }}
        >
          <div style={{ fontSize: 15, fontWeight: 700, opacity: 0.85 }}>Не удалось отобразить страницу</div>
          <button
            type="button"
            className="ui-btn ui-btn--primary"
            onClick={this.retry}
            style={{ padding: "10px 24px", fontWeight: 800 }}
          >
            Повторить
          </button>
        </div>
      );
    }
    return <div key={this.state.epoch} style={{ display: "contents" }}>{this.props.children}</div>;
  }
}
