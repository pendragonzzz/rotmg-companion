import { Component, type ReactNode } from 'react';

interface Props {
  label: string;
  children: ReactNode;
}
interface State {
  error: Error | null;
}

/** Isolates a single card: if one character throws, the rest still render. */
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
          <div className="muted">Couldn’t render this character: {this.state.error.message}</div>
        </section>
      );
    }
    return this.props.children;
  }
}
