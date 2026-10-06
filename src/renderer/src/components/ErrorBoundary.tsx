import { Component, type ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Isolates a card or page: if one throws, the rest of the app still renders. */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error) {
    console.error(`Card "${this.props.label}" failed:`, error);
  }

  render() {
    if (this.state.error) {
      return (
        <section className="card card-error">
          <strong>{this.props.label}</strong>
          <div className="muted">Couldn’t render this: {this.state.error.message}</div>
        </section>
      );
    }
    return this.props.children;
  }
}
