// Граница ошибок: ловит исключения при рендере дочернего дерева и показывает их текст,
// вместо «немого» чёрного экрана (React по умолчанию размонтирует всё дерево при throw).
// Диагностика + страховка для пользователя. См. docs/ARCHITECTURE.md §7.
import { Component, type ReactNode, type ErrorInfo } from "react";

interface Props {
  children: ReactNode;
}
interface State {
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    // В dev видно в консоли webview; в проде — хотя бы текст на экране (ниже)
    console.error("UI упал:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    return (
      <div className="flex h-screen flex-col items-center justify-center gap-3 bg-bg p-8 text-center text-fg">
        <h1 className="text-lg font-medium text-destructive">Что-то сломалось в интерфейсе</h1>
        <pre className="max-w-2xl overflow-auto rounded-md bg-surface p-4 text-left text-xs text-fg-muted">
          {error.message}
          {"\n\n"}
          {error.stack}
        </pre>
        <button
          type="button"
          onClick={() => this.setState({ error: null })}
          className="rounded-md bg-surface-2 px-3 py-1.5 text-sm text-fg hover:bg-border"
        >
          Попробовать снова
        </button>
      </div>
    );
  }
}
