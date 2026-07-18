import { Component, type ReactNode } from 'react';

interface Props {
  children: ReactNode;
  /** Remounts the boundary when this key changes (e.g. the route), clearing a caught error. */
  resetKey?: unknown;
}

interface State {
  error: Error | null;
}

/** Catches render-time throws so one broken page doesn't white-screen the app. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error('Render error:', error);
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (this.state.error) {
      return (
        <div className="m-6 rounded-lg border border-red-200 bg-red-50 p-6">
          <h2 className="mb-1 text-lg font-bold text-red-800">Something went wrong on this page</h2>
          <p className="mb-3 text-sm text-red-700">{this.state.error.message}</p>
          <button className="cmt-btn" onClick={() => this.setState({ error: null })}>
            Try again
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}
